// GPU worker: owns the WebGPU device and the canvas, and executes the command ring the renderer
// front end (glue/rexglue-sdk-main/src/graphics/gta4_web) writes into shared wasm memory.
//
// WebGPU objects belong to the worker that created them, while the game submits title commands
// from its own threads; and WebGPU is asynchronous, while game threads block. So the game only
// records commands and this worker, which has a normal event loop, executes them.
//
// Ring layout and command structs: keep in sync with gpu_ring.h.
'use strict';

const HEADER = { head: 0, tail: 1, capacity: 2, state: 3, executed: 4, errors: 5, fence: 6 };
const RING_HEADER_BYTES = 64;

const OP = {
	NOP: 0, WRAP: 1, FENCE: 2, CREATE_TEXTURE: 3, DESTROY_TEXTURE: 4, UPLOAD_TEXTURE: 5, CREATE_BUFFER: 6,
	DESTROY_BUFFER: 7, UPLOAD_BUFFER: 8, CREATE_SAMPLER: 9, CREATE_PIPELINE: 10, BEGIN_PASS: 11, END_PASS: 12,
	DRAW: 13, COPY_TEXTURE: 14, CONVERT_TEXTURE: 15, CLEAR_RECT: 16, PRESENT: 17, CONSTANTS: 18, LOG: 19,
	TRANSIENT: 20,
};

const FORMATS = [null, 'r8unorm', 'rg8unorm', 'rgba8unorm', 'bc1-rgba-unorm', 'bc2-rgba-unorm', 'bc3-rgba-unorm',
	'rgba16float', 'rg16float', 'r32float', 'depth24plus-stencil8'];
// [block width, block height, bytes per block]
const BLOCK = { 'bc1-rgba-unorm': [4, 4, 8], 'bc2-rgba-unorm': [4, 4, 16], 'bc3-rgba-unorm': [4, 4, 16] };
const DIMENSIONS = ['2d', '2d-array', '3d', 'cube'];
const VERTEX_FORMATS = [null, 'float32', 'float32x2', 'float32x3', 'float32x4', 'uint8x4', 'unorm8x4-bgra', 'sint16x2',
	'sint16x4', 'unorm8x4', 'snorm16x2', 'snorm16x4', 'uint16x2', 'unorm16x2', 'uint16x4', 'unorm16x4', 'uint32',
	'snorm8x4', 'float16x2', 'float16x4', 'sint32', 'sint32x2', 'sint32x3', 'sint32x4', 'uint32x2', 'uint32x3',
	'uint32x4'];
const COMPARE = ['never', 'less', 'equal', 'less-equal', 'greater', 'not-equal', 'greater-equal', 'always'];
const STENCIL_OPS = ['keep', 'zero', 'replace', 'increment-clamp', 'decrement-clamp', 'invert', 'increment-wrap',
	'decrement-wrap'];
const BLEND_FACTORS = ['zero', 'one', 'src', 'one-minus-src', 'src-alpha', 'one-minus-src-alpha', 'dst', 'one-minus-dst',
	'dst-alpha', 'one-minus-dst-alpha', 'constant', 'one-minus-constant', 'src-alpha-saturated'];
const BLEND_OPS = ['add', 'subtract', 'min', 'max', 'reverse-subtract'];
const TOPOLOGY = ['point-list', 'line-list', 'line-strip', 'triangle-list', 'triangle-strip'];
const ADDRESS = ['clamp-to-edge', 'repeat', 'mirror-repeat'];
const TEXTURE_SLOTS = 26;
const SAMPLER_BINDING_BASE = 32;

let memory = null, ringBase = 0, dataBase = 0, capacity = 0;
let words = null, bytes = null, view = null;
let device = null, context = null, canvasFormat = null, adapterFeatures = new Set();
let shaderMeta = {}, shaderSource = {};
const modules = new Map();     // "hash:variant" -> GPUShaderModule
const textures = new Map();    // id -> { texture, desc, sampleView }
const buffers = new Map();     // id -> GPUBuffer
const samplers = new Map();    // id -> GPUSampler
const pipelines = new Map();   // id -> { pipeline, layouts: [g0, g1, g2], ps, vs }
const pipelineTasks = new Map();
const compiledRecipes = new Map();
let pipelineDatabase = null, recipeWriteTimer = null, warmPipelineHits = 0;
const pendingRecipes = new Map();
const MAX_WARM_PIPELINES = 512, MAX_STORED_PIPELINES = 768;
let bindGroupCache = new Map();
let bindGroupCreates = 0, bindGroupCacheResets = 0;
const textureSlotsCache = new WeakMap();
let pendingDestroys = [];
let errorsLogged = 0;

function log(text) {
	console.log('[gpu] ' + text);
	self.postMessage({ log: String(text) });
}

function refreshViews() {
	if (!words || words.buffer !== memory.buffer) {
		words = new Int32Array(memory.buffer);
		bytes = new Uint8Array(memory.buffer);
		view = new DataView(memory.buffer);
	}
}

// Ring offsets and guest addresses are bounded by the device/memory limits
// (at most 16 GiB), so decode them exactly without allocating BigInt values.
function readOffset(at) {
	return view.getUint32(at, true) + view.getUint32(at + 4, true) * 4294967296;
}

// ─── Growable upload arenas (constants, per-draw uniforms, transient geometry) ─────────────────────
class Arena {
	constructor(usage, initial, label) {
		this.usage = usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
		this.label = label;
		this.cpu = new Uint8Array(initial);
		this.u32 = new Uint32Array(this.cpu.buffer);
		this.used = 0;
		this.uploaded = 0;
		this.buffer = device.createBuffer({ size: initial, usage: this.usage, label });
		this.generation = 0;
	}
	reset() {
		this.used = 0;
		this.uploaded = 0;
	}
	// Returns the offset of `length` bytes, or -1 when the GPU buffer must grow first (see grow()).
	alloc(length, alignment) {
		const offset = Math.ceil(this.used / alignment) * alignment;
		if (offset + length > this.buffer.size) return -1;
		if (offset + length > this.cpu.length) {
			const next = new Uint8Array(this.buffer.size);
			next.set(this.cpu.subarray(0, this.used));
			this.cpu = next;
			this.u32 = new Uint32Array(next.buffer);
		}
		this.used = offset + length;
		return offset;
	}
	// Called between submissions only: earlier command buffers keep the old buffer.
	grow(minimum, encoderState) {
		let size = this.buffer.size;
		while (size < minimum) size *= 2;
		const next = device.createBuffer({ size, usage: this.usage, label: this.label });
		const old = this.buffer;
		this.flush();
		const copy = device.createCommandEncoder();
		copy.copyBufferToBuffer(old, 0, next, 0, Math.ceil(this.uploaded / 4) * 4);
		device.queue.submit([copy.finish()]);
		pendingDestroys.push(old);
		this.buffer = next;
		this.generation++;
	}
	flush() {
		if (this.used > this.uploaded) {
			const start = this.uploaded & ~3;
			const end = Math.ceil(this.used / 4) * 4;
			device.queue.writeBuffer(this.buffer, start, this.cpu.buffer, this.cpu.byteOffset + start, end - start);
			this.uploaded = this.used;
		}
	}
}

let constants, drawUniforms, transientIndices, transientVertices;
const bankOffsets = new Map();
const transients = new Map(); // id -> { arena, offset }
let zeroBuffer = null;
let group0 = null, group0Generation = -1;
let group0Layout = null;
let fallbackTextures = {};
let fallbackSampler = null;
let utility = {};

// ─── Command execution state ──────────────────────────────────────────────────────────────────────
let encoder = null;
let pass = null;
let passState = null;
let passTargets = null; // { width, height }
let drawIndex = 0;
let frontbuffer = null;
let frameCount = 0;
let nextPresentDeadline = 0;
let lastPresentTime = 0, statsTime = 0, statsFrames = 0;
let pipelineCompileMs = 0, maxPipelineCompileMs = 0;
let decodeMs = 0, decodedCommands = 0;
const frameIntervals = [];
let timestampQuery = null, timestampResolve = null, timestampCursor = 0;
let skippedTimingPasses = 0;
const timestampReadbacks = [], gpuFrameTimes = [];
const TIMESTAMP_COUNT = 2048;

function beginRenderPass(descriptor) {
	if (timestampQuery && timestampCursor + 2 <= TIMESTAMP_COUNT) {
		descriptor.timestampWrites = { querySet: timestampQuery,
			beginningOfPassWriteIndex: timestampCursor++, endOfPassWriteIndex: timestampCursor++ };
	}
	return encoder.beginRenderPass(descriptor);
}

function acknowledgePresent(address, frame) {
	if (!address) return;
	// Browser canvases display at refresh rate. Without pacing, the title
	// redraws its loading text hundreds of times per second while streaming.
	const now = performance.now();
	const deadline = Math.max(nextPresentDeadline, now);
	nextPresentDeadline = deadline + 1000 / 60;
	setTimeout(() => {
		refreshViews();
		const bigEndianFrame = ((frame & 255) << 24) | ((frame & 0xff00) << 8) |
			((frame >>> 8) & 0xff00) | (frame >>> 24);
		Atomics.store(words, address / 4, bigEndianFrame);
		Atomics.notify(words, address / 4);
	}, deadline - now);
}

function beginEncoder() {
	if (!encoder) encoder = device.createCommandEncoder();
}

function endPass() {
	if (pass) {
		pass.end();
		pass = null;
		passState = null;
		passTargets = null;
	}
}

function submit(frameEnd = false) {
	endPass();
	constants.flush();
	drawUniforms.flush();
	transientIndices.flush();
	transientVertices.flush();
	const count = frameEnd ? timestampCursor : 0;
	const readback = count && timestampReadbacks.find((slot) => !slot.busy);
	if (readback) {
		beginEncoder();
		encoder.resolveQuerySet(timestampQuery, 0, count, timestampResolve, 0);
		encoder.copyBufferToBuffer(timestampResolve, 0, readback.buffer, 0, count * 8);
		readback.busy = true;
	}
	if (encoder) {
		device.queue.submit([encoder.finish()]);
		encoder = null;
	}
	if (frameEnd) timestampCursor = 0;
	if (readback) {
		readback.buffer.mapAsync(GPUMapMode.READ).then(() => {
			const times = new BigUint64Array(readback.buffer.getMappedRange(0, count * 8));
			const intervals = [];
			for (let i = 0; i < count; i += 2) {
				// Some Metal adapters omit end timestamps on clear-only passes.
				// An unavailable timestamp must not become a negative frame time.
				if (times[i + 1] < times[i]) { skippedTimingPasses++; continue; }
				intervals.push([times[i], times[i + 1]]);
			}
			// GPU stages from adjacent passes may overlap. Merge intervals so
			// their shared execution time is counted once rather than per pass.
			intervals.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
			let elapsed = 0n, begin = 0n, end = 0n;
			for (const [a, b] of intervals) {
				if (a > end) { elapsed += end - begin; begin = a; end = b; }
				else if (b > end) end = b;
			}
			elapsed += end - begin;
			gpuFrameTimes.push(Number(elapsed) / 1e6);
			if (gpuFrameTimes.length > 300) gpuFrameTimes.shift();
			readback.buffer.unmap();
		}).catch((error) => log('GPU timing readback failed: ' + error.message))
			.finally(() => { readback.busy = false; });
	}
	drawUniforms.reset();
	drawIndex = 0;
	for (const object of pendingDestroys) object.destroy();
	pendingDestroys = [];
}

function attachmentView(id, mip, layer) {
	const entry = textures.get(id);
	if (!entry) return null;
	return entry.texture.createView({ dimension: '2d', baseMipLevel: mip || 0, mipLevelCount: 1,
		baseArrayLayer: layer || 0, arrayLayerCount: 1 });
}

// ─── Shaders and pipelines ─────────────────────────────────────────────────────────────────────────
function shaderModule(hash, variant) {
	const key = hash + ':' + variant;
	let module = modules.get(key);
	if (module) return module;
	const sources = shaderSource[hash];
	const code = sources && (sources[variant] || sources.early);
	if (!code) throw new Error('shader ' + hash + ' missing from pack');
	module = device.createShaderModule({ code, label: key });
	modules.set(key, module);
	return module;
}

async function prepareShaders() {
	const entries = Object.entries(shaderSource).flatMap(([hash, variants]) =>
		Object.keys(variants).map((variant) => [hash, variant]));
	const began = performance.now();
	for (let i = 0; i < entries.length; i += 4) {
		await Promise.all(entries.slice(i, i + 4).map(async ([hash, variant]) => {
			const info = await shaderModule(hash, variant).getCompilationInfo();
			const errors = info.messages.filter((message) => message.type === 'error');
			if (errors.length) throw new Error('shader ' + hash + ':' + variant + ': ' +
				errors.map((message) => message.message).join('; '));
		}));
		if (i % 100 === 0 || i + 4 >= entries.length) {
			self.postMessage({ progress: { label: 'Preparing graphics', completed: Math.min(i + 4, entries.length), total: entries.length } });
		}
	}
	log('prepared ' + entries.length + ' shader variants in ' + ((performance.now() - began) / 1000).toFixed(1) + 's');
}

function textureGroupLayout(meta, visibility) {
	const entries = [];
	if (meta) {
		for (const [slot, dim] of Object.entries(meta.textures || {})) {
			entries.push({ binding: Number(slot), visibility,
				texture: { sampleType: 'float', viewDimension: dim === '2d-array' ? '2d-array' : dim } });
		}
		for (const slot of meta.samplers || []) {
			entries.push({ binding: SAMPLER_BINDING_BASE + slot, visibility, sampler: { type: 'filtering' } });
		}
	}
	return device.createBindGroupLayout({ entries });
}

function hex(low, high) {
	return (high >>> 0).toString(16).toUpperCase().padStart(8, '0') + (low >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

async function compilePipeline(packet) {
	const u32 = (at) => packet.getUint32(at, true);
	const vsHash = hex(u32(8), u32(12));
	const psLow = u32(16), psHigh = u32(20);
	const psHash = psLow || psHigh ? hex(psLow, psHigh) : null;
	const late = u32(24) !== 0;
	const vsMeta = shaderMeta[vsHash], psMeta = psHash ? shaderMeta[psHash] : null;
	const layouts = [group0Layout, textureGroupLayout(psMeta, GPUShaderStage.FRAGMENT),
		textureGroupLayout(vsMeta, GPUShaderStage.VERTEX)];
	const targets = [];
	for (let i = 0; i < 4; i++) {
		const format = FORMATS[u32(48 + i * 4)];
		if (!format) {
			targets.push(null);
			continue;
		}
		const b = 64 + i * 32;
		const target = { format, writeMask: u32(b + 28) };
		if (u32(b) && format !== 'r32float') {
			const colorOp = BLEND_OPS[u32(b + 12)], alphaOp = BLEND_OPS[u32(b + 24)];
			const minmax = (op) => op === 'min' || op === 'max';
			target.blend = {
				color: { srcFactor: minmax(colorOp) ? 'one' : BLEND_FACTORS[u32(b + 4)],
					dstFactor: minmax(colorOp) ? 'one' : BLEND_FACTORS[u32(b + 8)], operation: colorOp },
				alpha: { srcFactor: minmax(alphaOp) ? 'one' : BLEND_FACTORS[u32(b + 16)],
					dstFactor: minmax(alphaOp) ? 'one' : BLEND_FACTORS[u32(b + 20)], operation: alphaOp },
			};
		}
		targets.push(target);
	}
	while (targets.length && targets[targets.length - 1] === null) targets.pop();
	const depthFormat = FORMATS[u32(192)];
	const vertexBuffers = [];
	const bufferCount = u32(260);
	for (let i = 0; i < bufferCount; i++) {
		const b = 264 + i * 272;
		const stride = u32(b), count = u32(b + 8);
		const attributes = [];
		for (let a = 0; a < count; a++) {
			const at = b + 16 + a * 16;
			attributes.push({ format: VERTEX_FORMATS[u32(at)], offset: u32(at + 4), shaderLocation: u32(at + 8) });
		}
		vertexBuffers.push({ arrayStride: stride, stepMode: u32(b + 4) ? 'instance' : 'vertex', attributes });
	}
	const topology = TOPOLOGY[u32(28)];
	const descriptor = {
		label: 'title ' + vsHash + '/' + (psHash || 'none'),
		layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
		vertex: { module: shaderModule(vsHash, 'early'), entryPoint: 'shaderMain', buffers: vertexBuffers },
		primitive: { topology, cullMode: ['none', 'front', 'back'][u32(36)], frontFace: u32(40) ? 'ccw' : 'cw' },
		multisample: { count: 1 },
	};
	if (topology === 'triangle-strip' || topology === 'line-strip') {
		descriptor.primitive.stripIndexFormat = u32(32) ? 'uint32' : 'uint16';
	}
	if (psHash) {
		descriptor.fragment = { module: shaderModule(psHash, late ? 'late' : 'early'), entryPoint: 'shaderMain', targets };
	} else if (targets.length) {
		descriptor.fragment = { module: utility.nullFragment, entryPoint: 'main',
			targets: targets.map((t) => (t ? { format: t.format, writeMask: 0 } : null)) };
	}
	if (depthFormat) {
		const stencil = u32(204) !== 0;
		const face = (at) => ({ compare: COMPARE[u32(at)], failOp: STENCIL_OPS[u32(at + 4)],
			depthFailOp: STENCIL_OPS[u32(at + 8)], passOp: STENCIL_OPS[u32(at + 12)] });
		descriptor.depthStencil = {
			format: depthFormat,
			depthWriteEnabled: u32(196) !== 0,
			depthCompare: COMPARE[u32(200)],
			stencilFront: stencil ? face(208) : {},
			stencilBack: stencil ? face(224) : {},
			stencilReadMask: stencil ? u32(240) & 255 : 0,
			stencilWriteMask: stencil ? u32(244) & 255 : 0,
			depthBias: packet.getInt32(248, true),
			depthBiasSlopeScale: packet.getFloat32(252, true),
		};
	}
	const began = performance.now();
	const pipeline = await device.createRenderPipelineAsync(descriptor);
	const elapsed = performance.now() - began;
	pipelineCompileMs += elapsed;
	maxPipelineCompileMs = Math.max(maxPipelineCompileMs, elapsed);
	return { pipeline, layouts, psMeta, vsMeta, depthFormat };
}

function recipeKey(recipe) {
	// The first word is the transient runtime ID; all remaining bytes describe
	// immutable shader, vertex layout and fixed-function pipeline state.
	let key = '';
	for (let i = 4; i < recipe.length; i++) key += String.fromCharCode(recipe[i]);
	return key;
}

function rememberRecipe(key, recipe) {
	if (!pipelineDatabase) return;
	pendingRecipes.set(key, { key, recipe, touched: Date.now() });
	if (recipeWriteTimer !== null) return;
	recipeWriteTimer = setTimeout(() => {
		recipeWriteTimer = null;
		try {
			const tx = pipelineDatabase.transaction('recipes', 'readwrite');
			for (const record of pendingRecipes.values()) tx.objectStore('recipes').put(record);
			pendingRecipes.clear();
			tx.onerror = () => log('pipeline cache write unavailable');
		} catch (_) { /* Cache storage must never interrupt rendering. */ }
	}, 1000);
}

async function prepareRecipe(recipe, remember) {
	const key = recipeKey(recipe);
	let pending = compiledRecipes.get(key);
	if (!pending) {
		pending = compilePipeline(new DataView(recipe.buffer, recipe.byteOffset, recipe.byteLength));
		compiledRecipes.set(key, pending);
		pending.catch(() => { if (compiledRecipes.get(key) === pending) compiledRecipes.delete(key); });
	} else if (remember) warmPipelineHits++;
	const entry = await pending;
	if (remember) rememberRecipe(key, recipe);
	return entry;
}

async function createPipeline(o) {
	const id = view.getUint32(o, true), count = view.getUint32(o + 260, true);
	const recipe = new Uint8Array(view.buffer, view.byteOffset + o, 264 + count * 272).slice();
	pipelines.set(id, await prepareRecipe(recipe, true));
}

async function warmPipelineCache() {
	if (typeof indexedDB === 'undefined') return;
	try {
		pipelineDatabase = await new Promise((resolve) => {
			const request = indexedDB.open('liberty-render-pipelines', 1);
			request.onupgradeneeded = () => request.result.createObjectStore('recipes', { keyPath: 'key' });
			request.onsuccess = () => resolve(request.result);
			request.onerror = request.onblocked = () => resolve(null);
		});
		if (!pipelineDatabase) return;
		const records = await new Promise((resolve, reject) => {
			const request = pipelineDatabase.transaction('recipes').objectStore('recipes').getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		records.sort((a, b) => b.touched - a.touched);
		// Keep storage and eager GPU allocation bounded, including old game builds.
		if (records.length > MAX_STORED_PIPELINES) {
			const tx = pipelineDatabase.transaction('recipes', 'readwrite');
			for (const old of records.slice(MAX_STORED_PIPELINES)) tx.objectStore('recipes').delete(old.key);
		}
		const recipes = records.slice(0, MAX_WARM_PIPELINES), began = performance.now();
		let warmed = 0;
		for (let i = 0; i < recipes.length; i += 4) {
			await Promise.all(recipes.slice(i, i + 4).map(async (record) => {
				try { await prepareRecipe(new Uint8Array(record.recipe), false); warmed++; }
				catch (_) { /* An obsolete recipe cannot prevent game startup. */ }
			}));
			self.postMessage({ progress: { label: 'Preparing render pipelines', completed: Math.min(i + 4, recipes.length), total: recipes.length } });
		}
		if (warmed) log('warmed ' + warmed + ' render pipelines in ' + ((performance.now() - began) / 1000).toFixed(1) + 's');
	} catch (_) { pipelineDatabase = null; }
}

function startPipeline(o) {
	const id = view.getUint32(o, true);
	if (!pipelineTasks.has(id)) {
		const task = createPipeline(o);
		// A prefetched task can fail before its ordered command is reached.
		// Its original rejection is still reported by the command decoder.
		task.catch(() => {});
		pipelineTasks.set(id, task);
	}
	return pipelineTasks.get(id);
}

function prepareQueuedPipelines(tail, head) {
	// Descriptors contain only immutable shader/layout state. Compile a small
	// window ahead, while draw execution and ring retirement remain ordered.
	let at = tail;
	while (at !== head && pipelineTasks.size < 4) {
		const offset = at & (capacity - 1), o = dataBase + offset;
		const op = view.getUint32(o, true), size = view.getUint32(o + 4, true);
		if (op === OP.WRAP) {
			at = (at + capacity - offset) >>> 0;
			continue;
		}
		if (op === OP.CREATE_PIPELINE && !pipelines.has(view.getUint32(o + 8, true))) startPipeline(o + 8);
		at = (at + 8 + size) >>> 0;
	}
}

// ─── Utility passes (clears, resolve conversion, depth handoff, present) ───────────────────────────
const FULLSCREEN_VS = `
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}`;

function createUtility() {
	utility.nullFragment = device.createShaderModule({ code: '@fragment fn main() {}' });
	const clear = device.createShaderModule({ code: FULLSCREEN_VS + `
struct C { color: vec4f, depth: f32 }
@group(0) @binding(0) var<uniform> c: C;
@fragment fn color() -> @location(0) vec4f { return c.color; }
@fragment fn depth() -> @builtin(frag_depth) f32 { return c.depth; }` });
	const convert = device.createShaderModule({ code: FULLSCREEN_VS + `
struct P { src: vec2i, src_extent: vec2u, dst: vec2u, dst_extent: vec2u, scale: f32, float24: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var depth_source: texture_depth_2d;
fn coord(frag: vec2f) -> vec2i {
  let rel = (frag - vec2f(p.dst)) * vec2f(p.src_extent) / max(vec2f(p.dst_extent), vec2f(1.0));
  return p.src + vec2i(floor(rel));
}
@fragment fn color(@builtin(position) f: vec4f) -> @location(0) vec4f {
  let v = textureLoad(source, coord(f.xy), 0) * p.scale;
  return select(clamp(v, vec4f(-65504.0), vec4f(65504.0)), vec4f(0.0), v != v);
}
@fragment fn depth_to_color(@builtin(position) f: vec4f) -> @location(0) vec4f {
  return vec4f(textureLoad(depth_source, coord(f.xy), 0), 0.0, 0.0, 1.0);
}
@fragment fn color_to_depth(@builtin(position) f: vec4f) -> @builtin(frag_depth) f32 {
  return textureLoad(source, coord(f.xy), 0).x;
}
fn depth20e4(depth: f32) -> u32 {
  if (!(depth > 0.0)) { return 0u; }
  var bits = bitcast<u32>(depth);
  if (bits >= 0x3FFFFFF8u) { return 0xFFFFFFu; }
  if (bits < 0x38800000u) {
    let shift = min(113u - (bits >> 23u), 24u);
    bits = (0x800000u | (bits & 0x7FFFFFu)) >> shift;
  } else {
    bits = bits + 0xC8000000u;
  }
  return (bits >> 3u) & 0xFFFFFFu;
}
@fragment fn scene_depth(@builtin(position) f: vec4f) -> @builtin(frag_depth) f32 {
  let depth = textureLoad(source, coord(f.xy), 0).x;
  let packed = select(u32(round(clamp(depth, 0.0, 1.0) * 16777215.0)), depth20e4(depth), p.float24 != 0u);
  if (packed == 0u) { discard; }
  return depth;
}` });
	const present = device.createShaderModule({ code: FULLSCREEN_VS + `
@group(0) @binding(0) var frame: texture_2d<f32>;
@group(0) @binding(1) var linear: sampler;
struct P { origin: vec2f, extent: vec2f, uv_scale: vec2f }
@group(0) @binding(2) var<uniform> p: P;
@fragment fn main(@builtin(position) f: vec4f) -> @location(0) vec4f {
  let uv = (f.xy - p.origin) / p.extent * p.uv_scale;
  return vec4f(textureSampleLevel(frame, linear, uv, 0.0).rgb, 1.0);
}` });
	utility.modules = { clear, convert, present };
	utility.pipelines = new Map();
	utility.uniforms = device.createBuffer({ size: 256 * 1024, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
	utility.uniformOffset = 0;
	utility.layouts = {
		clear: device.createBindGroupLayout({ entries: [
			{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] }),
		convert: device.createBindGroupLayout({ entries: [
			{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
			{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
			{ binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }] }),
		present: device.createBindGroupLayout({ entries: [
			{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
			{ binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
			{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] }),
	};
	utility.dummyDepth = device.createTexture({ size: [1, 1], format: 'depth24plus-stencil8',
		usage: GPUTextureUsage.TEXTURE_BINDING }).createView({ aspect: 'depth-only' });
	utility.dummyColor = device.createTexture({ size: [1, 1], format: 'rgba8unorm',
		usage: GPUTextureUsage.TEXTURE_BINDING }).createView();
}

function utilityUniform(data) {
	// Small per-op uniforms: written immediately (ops run before the next submit's queue writes).
	if (utility.uniformOffset + 256 > utility.uniforms.size) {
		submit();
		utility.uniformOffset = 0;
	}
	const offset = utility.uniformOffset;
	utility.uniformOffset += 256;
	device.queue.writeBuffer(utility.uniforms, offset, data);
	return { buffer: utility.uniforms, offset, size: data.byteLength };
}

function utilityPipeline(key, make) {
	let pipeline = utility.pipelines.get(key);
	if (!pipeline) {
		pipeline = make();
		utility.pipelines.set(key, pipeline);
	}
	return pipeline;
}

function clearRect(o) {
	const u32 = (at) => view.getUint32(o + at, true), f32 = (at) => view.getFloat32(o + at, true);
	const entry = textures.get(u32(0));
	if (!entry) return;
	const depth = u32(4) !== 0, aspects = u32(8);
	const x = u32(12), y = u32(16), w = u32(20), h = u32(24);
	const color = [f32(28), f32(32), f32(36), f32(40)];
	const depthValue = f32(44), stencil = u32(48) & 255;
	const width = entry.desc.width, height = entry.desc.height;
	const full = x === 0 && y === 0 && w === width && h === height;
	endPass();
	beginEncoder();
	const target = entry.texture.createView({ dimension: '2d', mipLevelCount: 1, arrayLayerCount: 1 });
	if (!depth) {
		const p = beginRenderPass({ colorAttachments: [{ view: target, loadOp: full ? 'clear' : 'load',
			storeOp: 'store', clearValue: color }] });
		if (!full) {
			const pipeline = utilityPipeline('clear-color:' + entry.desc.format, () => device.createRenderPipeline({
				layout: device.createPipelineLayout({ bindGroupLayouts: [utility.layouts.clear] }),
				vertex: { module: utility.modules.clear, entryPoint: 'vs' },
				fragment: { module: utility.modules.clear, entryPoint: 'color', targets: [{ format: entry.desc.format }] },
			}));
			const data = new Float32Array(8);
			data.set(color);
			const u = utilityUniform(data);
			p.setPipeline(pipeline);
			p.setBindGroup(0, device.createBindGroup({ layout: utility.layouts.clear,
				entries: [{ binding: 0, resource: { buffer: u.buffer, offset: u.offset, size: 32 } }] }));
			p.setScissorRect(x, y, w, h);
			p.draw(3);
		}
		p.end();
		return;
	}
	const clearDepth = (aspects & 2) !== 0, clearStencil = (aspects & 4) !== 0;
	const p = beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: target,
		depthLoadOp: full && clearDepth ? 'clear' : 'load', depthStoreOp: 'store', depthClearValue: depthValue,
		stencilLoadOp: full && clearStencil ? 'clear' : 'load', stencilStoreOp: 'store', stencilClearValue: stencil } });
	if (!full) {
		const pipeline = utilityPipeline('clear-depth:' + aspects, () => device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [utility.layouts.clear] }),
			vertex: { module: utility.modules.clear, entryPoint: 'vs' },
			fragment: { module: utility.modules.clear, entryPoint: 'depth', targets: [] },
			depthStencil: { format: 'depth24plus-stencil8', depthWriteEnabled: clearDepth, depthCompare: 'always',
				stencilFront: { compare: 'always', passOp: clearStencil ? 'replace' : 'keep' },
				stencilBack: { compare: 'always', passOp: clearStencil ? 'replace' : 'keep' },
				stencilWriteMask: clearStencil ? 255 : 0 },
		}));
		const data = new Float32Array(8);
		data[4] = depthValue;
		const u = utilityUniform(data);
		p.setPipeline(pipeline);
		p.setBindGroup(0, device.createBindGroup({ layout: utility.layouts.clear,
			entries: [{ binding: 0, resource: { buffer: u.buffer, offset: u.offset, size: 32 } }] }));
		p.setStencilReference(stencil);
		p.setScissorRect(x, y, w, h);
		p.draw(3);
	}
	p.end();
}

function convertTexture(o) {
	const u32 = (at) => view.getUint32(o + at, true), i32 = (at) => view.getInt32(o + at, true);
	const source = textures.get(u32(0)), destination = textures.get(u32(4));
	if (!source || !destination) return;
	const mip = u32(8), layer = u32(12);
	const sx = i32(16), sy = i32(20), dx = u32(24), dy = u32(28), w = u32(32), h = u32(36);
	const sw = u32(40), sh = u32(44), mode = u32(48), bias = i32(52), load = u32(56) === 0 ? 'load' : 'clear';
	endPass();
	beginEncoder();
	const params = new ArrayBuffer(48);
	const pv = new DataView(params);
	pv.setInt32(0, sx, true); pv.setInt32(4, sy, true);
	pv.setUint32(8, sw, true); pv.setUint32(12, sh, true);
	pv.setUint32(16, dx, true); pv.setUint32(20, dy, true);
	pv.setUint32(24, w, true); pv.setUint32(28, h, true);
	pv.setFloat32(32, mode === 0 ? Math.pow(2, bias) : 1, true);
	pv.setUint32(36, mode >= 2 ? bias : 0, true);
	const u = utilityUniform(params);
	const sourceIsDepth = source.desc.format === 'depth24plus-stencil8';
	const entries = [
		{ binding: 0, resource: { buffer: u.buffer, offset: u.offset, size: 48 } },
		{ binding: 1, resource: sourceIsDepth ? utility.dummyColor : source.texture.createView({ dimension: '2d', mipLevelCount: 1, arrayLayerCount: 1 }) },
		{ binding: 2, resource: sourceIsDepth ? source.texture.createView({ aspect: 'depth-only', dimension: '2d' }) : utility.dummyDepth },
	];
	const layout = device.createPipelineLayout({ bindGroupLayouts: [utility.layouts.convert] });
	const target = destination.texture.createView({ dimension: '2d', baseMipLevel: mip, mipLevelCount: 1,
		baseArrayLayer: destination.desc.dimension === '3d' ? 0 : layer, arrayLayerCount: 1 });
	if (mode === 0 || mode === 1) {
		const entryPoint = mode === 1 ? 'depth_to_color' : 'color';
		const pipeline = utilityPipeline('convert:' + entryPoint + ':' + destination.desc.format, () => device.createRenderPipeline({
			layout, vertex: { module: utility.modules.convert, entryPoint: 'vs' },
			fragment: { module: utility.modules.convert, entryPoint, targets: [{ format: destination.desc.format }] },
		}));
		const p = beginRenderPass({ colorAttachments: [{ view: target, loadOp: load, storeOp: 'store',
			clearValue: [0, 0, 0, 0] }] });
		p.setPipeline(pipeline);
		p.setBindGroup(0, device.createBindGroup({ layout: utility.layouts.convert, entries }));
		p.setScissorRect(dx, dy, Math.min(w, (destination.desc.width >> mip) - dx), Math.min(h, (destination.desc.height >> mip) - dy));
		p.draw(3);
		p.end();
		return;
	}
	// Depth handoff into a depth/stencil surface (2: depth only, 3: also rebuild scene coverage stencil).
	const rebuild = mode === 3;
	const pipeline = utilityPipeline('handoff:' + rebuild, () => device.createRenderPipeline({
		layout, vertex: { module: utility.modules.convert, entryPoint: 'vs' },
		fragment: { module: utility.modules.convert, entryPoint: rebuild ? 'scene_depth' : 'color_to_depth', targets: [] },
		depthStencil: { format: 'depth24plus-stencil8', depthWriteEnabled: true, depthCompare: 'always',
			stencilFront: { compare: 'always', passOp: rebuild ? 'replace' : 'keep' },
			stencilBack: { compare: 'always', passOp: rebuild ? 'replace' : 'keep' },
			stencilWriteMask: rebuild ? 255 : 0 },
	}));
	const p = beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: target,
		depthLoadOp: rebuild ? 'clear' : load, depthClearValue: 0, depthStoreOp: 'store',
		stencilLoadOp: rebuild ? 'clear' : load, stencilClearValue: rebuild ? 0x80 : 0, stencilStoreOp: 'store' } });
	p.setPipeline(pipeline);
	p.setBindGroup(0, device.createBindGroup({ layout: utility.layouts.convert, entries }));
	p.setStencilReference(0xFF);
	p.draw(3);
	p.end();
}

function present(o) {
	const id = view.getUint32(o, true), width = view.getUint32(o + 4, true), height = view.getUint32(o + 8, true);
	const entry = textures.get(id);
	endPass();
	if (!entry || !context) return;
	beginEncoder();
	const canvas = context.canvas;
	const target = context.getCurrentTexture();
	const scale = Math.min(canvas.width / width, canvas.height / height);
	const ew = width * scale, eh = height * scale;
	const origin = [(canvas.width - ew) / 2, (canvas.height - eh) / 2];
	const u = utilityUniform(new Float32Array([origin[0], origin[1], ew, eh,
		width / entry.desc.width, height / entry.desc.height, 0, 0]));
	const pipeline = utilityPipeline('present', () => device.createRenderPipeline({
		layout: device.createPipelineLayout({ bindGroupLayouts: [utility.layouts.present] }),
		vertex: { module: utility.modules.present, entryPoint: 'vs' },
		fragment: { module: utility.modules.present, entryPoint: 'main', targets: [{ format: canvasFormat }] },
	}));
	const p = beginRenderPass({ colorAttachments: [{ view: target.createView(), loadOp: 'clear',
		clearValue: [0, 0, 0, 1], storeOp: 'store' }] });
	p.setPipeline(pipeline);
	p.setBindGroup(0, device.createBindGroup({ layout: utility.layouts.present, entries: [
		{ binding: 0, resource: entry.sampleView },
		{ binding: 1, resource: fallbackSampler.linear },
		{ binding: 2, resource: { buffer: u.buffer, offset: u.offset, size: 32 } }] }));
	p.setViewport(Math.max(0, origin[0]), Math.max(0, origin[1]), Math.min(ew, canvas.width), Math.min(eh, canvas.height), 0, 1);
	p.draw(3);
	p.end();
	frameCount++;
	const now = performance.now();
	if (lastPresentTime) {
		frameIntervals.push(now - lastPresentTime);
		if (frameIntervals.length > 300) frameIntervals.shift();
	}
	lastPresentTime = now;
}

// ─── Draw ──────────────────────────────────────────────────────────────────────────────────────────
function textureGroup(entry, layout, meta, base, groupIndex) {
	let textureSlots = meta && textureSlotsCache.get(meta);
	if (meta && !textureSlots) {
		textureSlots = Object.keys(meta.textures || {}).map(Number);
		textureSlotsCache.set(meta, textureSlots);
	}
	if (!meta || ((!meta.samplers || !meta.samplers.length) && !textureSlots.length)) {
		let empty = bindGroupCache.get(layout);
		if (!empty) {
			empty = device.createBindGroup({ layout, entries: [] });
			bindGroupCreates++;
			bindGroupCache.set(layout, empty);
		}
		return empty;
	}
	let key = groupIndex + ':' + entry.id;
	for (const slot of textureSlots) {
		const at = base + slot * 8;
		const t = view.getUint32(at, true), s = view.getUint32(at + 4, true);
		key += ',' + t + '/' + s;
	}
	for (const slot of meta.samplers) {
		if (meta.textures[slot] === undefined) key += ',s' + view.getUint32(base + slot * 8 + 4, true);
	}
	let group = bindGroupCache.get(key);
	if (group) return group;
	const entries = [];
	for (const slot of textureSlots) {
		const t = view.getUint32(base + slot * 8, true);
		const dim = meta.textures[slot];
		const texture = textures.get(t);
		let resource = texture && texture.sampleDimension === dim ? texture.sampleView : fallbackTextures[dim];
		entries.push({ binding: slot, resource });
	}
	for (const slot of meta.samplers) {
		const s = samplers.get(view.getUint32(base + slot * 8 + 4, true));
		entries.push({ binding: SAMPLER_BINDING_BASE + slot, resource: s || fallbackSampler.nearest });
	}
	group = device.createBindGroup({ layout, entries });
	bindGroupCreates++;
	if (bindGroupCache.size > 20000) { bindGroupCache = new Map(); bindGroupCacheResets++; }
	bindGroupCache.set(key, group);
	return group;
}

function draw(o) {
	const u32 = (at) => view.getUint32(o + at, true);
	const entry = pipelines.get(u32(0));
	if (!entry || !pass) return;
	entry.id = u32(0);
	const vertexBank = bankOffsets.get(u32(4)), pixelBank = bankOffsets.get(u32(8)), sharedBank = bankOffsets.get(u32(12));
	if (vertexBank === undefined || pixelBank === undefined || sharedBank === undefined) return;
	let uniformOffset = drawUniforms.alloc(16, 256);
	if (uniformOffset < 0) return; // out of per-batch draw slots (submit() resets)
	const uniformWord = uniformOffset / 4;
	drawUniforms.u32[uniformWord] = vertexBank;
	drawUniforms.u32[uniformWord + 1] = pixelBank;
	drawUniforms.u32[uniformWord + 2] = sharedBank;
	drawUniforms.u32[uniformWord + 3] = u32(16);
	if (group0Generation !== constants.generation + drawUniforms.generation * 1000) {
		group0 = device.createBindGroup({ layout: group0Layout, entries: [
			{ binding: 0, resource: { buffer: drawUniforms.buffer, offset: 0, size: 16 } },
			{ binding: 1, resource: { buffer: constants.buffer } }] });
		group0Generation = constants.generation + drawUniforms.generation * 1000;
	}
	const state = passState || (passState = { pipeline: null, groups: [], vertices: [], index: null,
		viewport: new Float64Array(6).fill(NaN), scissor: new Float64Array(4).fill(NaN),
		blend: new Float64Array(4).fill(NaN), stencil: -1 });
	if (state.pipeline !== entry.pipeline) {
		pass.setPipeline(entry.pipeline);
		state.pipeline = entry.pipeline;
	}
	pass.setBindGroup(0, group0, [uniformOffset]);
	for (let i = 1; i <= 2; i++) {
		const group = textureGroup(entry, entry.layouts[i], i === 1 ? entry.psMeta : entry.vsMeta,
			o + (i === 1 ? 248 : 456), i);
		if (state.groups[i] !== group) { pass.setBindGroup(i, group); state.groups[i] = group; }
	}
	const bufferCount = u32(52);
	for (let i = 0; i < bufferCount; i++) {
		const at = 56 + i * 16;
		const id = u32(at);
		const offset = readOffset(o + at + 8);
		let buffer = null, bufferOffset = offset;
		if (id & 0x80000000) {
			const t = transients.get(id);
			if (t) { buffer = t.arena.buffer; bufferOffset += t.offset; }
		} else if (id) {
			buffer = buffers.get(id);
			if (buffer) bufferOffset = Math.min(offset, buffer.size);
		} else {
			buffer = zeroBuffer; bufferOffset = 0;
		}
		const previous = state.vertices[i];
		if (buffer && (!previous || previous.buffer !== buffer || previous.offset !== bufferOffset)) {
			pass.setVertexBuffer(i, buffer, bufferOffset);
			state.vertices[i] = { buffer, offset: bufferOffset };
		}
	}
	// Viewport and scissor must lie inside the attachments in WebGPU.
	const vx = view.getFloat32(o + 184, true), vy = view.getFloat32(o + 188, true);
	const vw = view.getFloat32(o + 192, true), vh = view.getFloat32(o + 196, true);
	const x0 = Math.max(0, vx), y0 = Math.max(0, vy);
	const x1 = Math.min(passTargets.width, vx + vw), y1 = Math.min(passTargets.height, vy + vh);
	if (x1 <= x0 || y1 <= y0) return;
	const near = Math.min(Math.max(view.getFloat32(o + 200, true), 0), 1);
	const far = Math.min(Math.max(view.getFloat32(o + 204, true), 0), 1);
	const width = x1 - x0, height = y1 - y0, minDepth = Math.min(near, far), maxDepth = Math.max(near, far);
	const v = state.viewport;
	if (v[0] !== x0 || v[1] !== y0 || v[2] !== width || v[3] !== height || v[4] !== minDepth || v[5] !== maxDepth) {
		pass.setViewport(x0, y0, width, height, minDepth, maxDepth);
		v.set([x0, y0, width, height, minDepth, maxDepth]);
	}
	const sx = Math.min(u32(208), passTargets.width), sy = Math.min(u32(212), passTargets.height);
	const sw = Math.min(u32(216), passTargets.width - sx), sh = Math.min(u32(220), passTargets.height - sy);
	const sc = state.scissor;
	if (sc[0] !== sx || sc[1] !== sy || sc[2] !== sw || sc[3] !== sh) {
		pass.setScissorRect(sx, sy, sw, sh); sc.set([sx, sy, sw, sh]);
	}
	const stencil = u32(224) & 255;
	if (entry.depthFormat && state.stencil !== stencil) { pass.setStencilReference(stencil); state.stencil = stencil; }
	const r = view.getFloat32(o + 228, true), g = view.getFloat32(o + 232, true);
	const b = view.getFloat32(o + 236, true), a = view.getFloat32(o + 240, true), blend = state.blend;
	if (blend[0] !== r || blend[1] !== g || blend[2] !== b || blend[3] !== a) {
		blend.set([r, g, b, a]); pass.setBlendConstant(blend);
	}
	const count = u32(40), first = u32(44);
	if (u32(20)) {
		const id = u32(24), format = u32(28) ? 'uint32' : 'uint16';
		const offset = readOffset(o + 32);
		let buffer, bufferOffset = offset;
		if (id & 0x80000000) {
			const t = transients.get(id);
			if (!t) return;
			buffer = t.arena.buffer; bufferOffset += t.offset;
		} else {
			buffer = buffers.get(id);
			if (!buffer) return;
		}
		if (!state.index || state.index.buffer !== buffer || state.index.offset !== bufferOffset || state.index.format !== format) {
			pass.setIndexBuffer(buffer, format, bufferOffset);
			state.index = { buffer, format, offset: bufferOffset };
		}
		pass.drawIndexed(count, 1, 0, view.getInt32(o + 48, true), 0);
	} else {
		pass.draw(count, 1, first, 0);
	}
	drawIndex++;
}

function beginPass(o) {
	endPass();
	beginEncoder();
	const u32 = (at) => view.getUint32(o + at, true), f32 = (at) => view.getFloat32(o + at, true);
	const colorAttachments = [];
	let width = 0, height = 0;
	for (let i = 0; i < 4; i++) {
		const b = i * 32;
		const id = u32(b);
		if (!id) {
			colorAttachments.push(null);
			continue;
		}
		const entry = textures.get(id);
		if (!entry) {
			colorAttachments.push(null);
			continue;
		}
		width = entry.desc.width;
		height = entry.desc.height;
		colorAttachments.push({ view: attachmentView(id, u32(b + 4), u32(b + 8)), loadOp: u32(b + 12) ? 'clear' : 'load',
			storeOp: 'store', clearValue: [f32(b + 16), f32(b + 20), f32(b + 24), f32(b + 28)] });
	}
	while (colorAttachments.length && !colorAttachments[colorAttachments.length - 1]) colorAttachments.pop();
	const descriptor = { colorAttachments };
	const depthId = u32(128);
	if (depthId && textures.get(depthId)) {
		const entry = textures.get(depthId);
		width = entry.desc.width;
		height = entry.desc.height;
		descriptor.depthStencilAttachment = { view: attachmentView(depthId, 0, 0),
			depthLoadOp: u32(132) ? 'clear' : 'load', depthStoreOp: 'store', depthClearValue: f32(140),
			stencilLoadOp: u32(136) ? 'clear' : 'load', stencilStoreOp: 'store', stencilClearValue: u32(144) & 255 };
	}
	pass = beginRenderPass(descriptor);
	passTargets = { width: width || 1, height: height || 1 };
}

// ─── Resources ─────────────────────────────────────────────────────────────────────────────────────
function createTexture(o) {
	const u32 = (at) => view.getUint32(o + at, true);
	const id = u32(0), format = FORMATS[u32(4)], dimension = DIMENSIONS[u32(8)];
	const width = u32(12), height = u32(16), layers = u32(20), mips = u32(24), usageBits = u32(32);
	let usage = 0;
	if (usageBits & 1) usage |= GPUTextureUsage.COPY_SRC;
	if (usageBits & 2) usage |= GPUTextureUsage.COPY_DST;
	if (usageBits & 4) usage |= GPUTextureUsage.TEXTURE_BINDING;
	if (usageBits & 16) usage |= GPUTextureUsage.RENDER_ATTACHMENT;
	const block = BLOCK[format];
	let w = width, h = height;
	if (block) {
		// Compressed textures need block-aligned base extents.
		w = Math.ceil(w / block[0]) * block[0];
		h = Math.ceil(h / block[1]) * block[1];
	}
	const old = textures.get(id);
	if (old) pendingDestroys.push(old.texture);
	const texture = device.createTexture({
		size: [w, h, dimension === '3d' ? layers : (dimension === 'cube' ? 6 : layers)],
		dimension: dimension === '3d' ? '3d' : '2d',
		mipLevelCount: Math.min(mips, Math.floor(Math.log2(Math.max(w, h, dimension === '3d' ? layers : 1))) + 1),
		format, usage,
	});
	let sampleView = null, sampleDimension = dimension;
	if (format === 'depth24plus-stencil8') {
		sampleView = texture.createView({ aspect: 'depth-only', dimension: '2d' });
		sampleDimension = 'depth';
	} else {
		sampleView = texture.createView({ dimension });
	}
	textures.set(id, { texture, desc: { width, height, layers, mips, format, dimension }, sampleView, sampleDimension });
}

function uploadTexture(o, payloadBytes) {
	const u32 = (at) => view.getUint32(o + at, true);
	const entry = textures.get(u32(0));
	if (!entry) return;
	const mip = u32(4), layer = u32(8), width = u32(12), height = u32(16), depth = u32(20);
	const bytesPerRow = u32(24), rowsPerImage = u32(28), dataBytes = u32(32), originY = u32(36);
	if (mip >= entry.texture.mipLevelCount) return;
	const block = BLOCK[entry.desc.format] || [1, 1];
	const mipWidth = Math.max(1, entry.texture.width >> mip), mipHeight = Math.max(1, entry.texture.height >> mip);
	const physicalWidth = Math.ceil(mipWidth / block[0]) * block[0];
	const physicalHeight = Math.ceil(mipHeight / block[1]) * block[1];
	const copyWidth = Math.min(Math.ceil(width / block[0]) * block[0], physicalWidth);
	const copyHeight = Math.min(Math.ceil(height / block[1]) * block[1], physicalHeight - originY);
	if (copyWidth <= 0 || copyHeight <= 0) return;
	const is3d = entry.desc.dimension === '3d';
	device.queue.writeTexture(
		{ texture: entry.texture, mipLevel: mip, origin: [0, originY, is3d ? 0 : layer] },
		bytes, { offset: o + 40, bytesPerRow, rowsPerImage: depth > 1 ? rowsPerImage : undefined },
		[copyWidth, copyHeight, Math.max(1, depth)]);
	void dataBytes;
	void payloadBytes;
}

function createSampler(o) {
	const u32 = (at) => view.getUint32(o + at, true), f32 = (at) => view.getFloat32(o + at, true);
	samplers.set(u32(0), device.createSampler({
		addressModeU: ADDRESS[u32(4)], addressModeV: ADDRESS[u32(8)], addressModeW: ADDRESS[u32(12)],
		minFilter: u32(16) ? 'linear' : 'nearest', magFilter: u32(20) ? 'linear' : 'nearest',
		mipmapFilter: u32(24) ? 'linear' : 'nearest', lodMinClamp: f32(28), lodMaxClamp: Math.max(f32(28), f32(32)),
	}));
}

function arenaWrite(arena, src, length, alignment) {
	let offset = arena.alloc(length, alignment);
	if (offset < 0) {
		// Data recorded so far in this batch still references the current buffer: submit first.
		submit();
		arena.grow(arena.used + length + alignment);
		offset = arena.alloc(length, alignment);
	}
	arena.cpu.set(bytes.subarray(src, src + length), offset);
	return offset;
}

// ─── Ring processing ───────────────────────────────────────────────────────────────────────────────
function execute(op, o, size) {
	switch (op) {
		case OP.NOP: case OP.WRAP: return;
		case OP.CREATE_TEXTURE: createTexture(o); return;
		case OP.DESTROY_TEXTURE: {
			const id = view.getUint32(o, true), entry = textures.get(id);
			if (entry) {
				pendingDestroys.push(entry.texture);
				textures.delete(id);
				bindGroupCache = new Map();
				bindGroupCacheResets++;
			}
			return;
		}
		case OP.UPLOAD_TEXTURE: uploadTexture(o, size); return;
		case OP.CREATE_BUFFER: {
			const id = view.getUint32(o, true), usageBits = view.getUint32(o + 4, true);
			const length = readOffset(o + 8);
			let usage = GPUBufferUsage.COPY_DST;
			if (usageBits & 1) usage |= GPUBufferUsage.VERTEX;
			if (usageBits & 2) usage |= GPUBufferUsage.INDEX;
			buffers.set(id, device.createBuffer({ size: Math.max(4, Math.ceil(length / 4) * 4), usage }));
			return;
		}
		case OP.DESTROY_BUFFER: {
			const id = view.getUint32(o, true), buffer = buffers.get(id);
			if (buffer) {
				pendingDestroys.push(buffer);
				buffers.delete(id);
			}
			return;
		}
		case OP.UPLOAD_BUFFER: {
			const buffer = buffers.get(view.getUint32(o, true));
			const offset = readOffset(o + 8);
			const length = Math.min(size - 16, buffer ? buffer.size - offset : 0) & ~3;
			if (buffer && length > 0) device.queue.writeBuffer(buffer, offset, memory.buffer, o + 16, length);
			return;
		}
		case OP.CREATE_SAMPLER: createSampler(o); return;
		case OP.CREATE_PIPELINE: return startPipeline(o);
		case OP.BEGIN_PASS: beginPass(o); return;
		case OP.END_PASS: endPass(); return;
		case OP.DRAW: draw(o); return;
		case OP.COPY_TEXTURE: {
			const u32 = (at) => view.getUint32(o + at, true);
			const source = textures.get(u32(0)), destination = textures.get(u32(20));
			if (!source || !destination) return;
			endPass();
			beginEncoder();
			const is3d = destination.desc.dimension === '3d';
			encoder.copyTextureToTexture(
				{ texture: source.texture, mipLevel: u32(4), origin: [u32(12), u32(16), u32(8)] },
				{ texture: destination.texture, mipLevel: u32(24), origin: [u32(32), u32(36), is3d ? u32(28) : u32(28)] },
				[u32(40), u32(44), 1]);
			return;
		}
		case OP.CONVERT_TEXTURE: convertTexture(o); return;
		case OP.CLEAR_RECT: clearRect(o); return;
		case OP.CONSTANTS: {
			const id = view.getUint32(o, true), length = view.getUint32(o + 4, true);
			bankOffsets.set(id, arenaWrite(constants, o + 8, length, 256));
			return;
		}
		case OP.TRANSIENT: {
			const id = view.getUint32(o, true), kind = view.getUint32(o + 4, true);
			const arena = kind === 0 ? transientIndices : transientVertices;
			transients.set(id, { arena, offset: arenaWrite(arena, o + 8, size - 8, 4) });
			return;
		}
		case OP.PRESENT: {
			const frame = view.getUint32(o + 12, true);
			const completedAddress = readOffset(o + 16);
			present(o);
			submit(true);
			// Retail throttles at two outstanding presents. Acknowledge actual GPU
			// completion in guest byte order, including when the canvas is hidden.
			device.queue.onSubmittedWorkDone().then(() => {
				acknowledgePresent(completedAddress, frame);
			});
			constants.reset();
			transientIndices.reset();
			transientVertices.reset();
			bankOffsets.clear();
			transients.clear();
			utility.uniformOffset = 0;
			return;
		}
		case OP.FENCE: {
			const value = view.getUint32(o, true);
			submit();
			device.queue.onSubmittedWorkDone().then(() => {
				refreshViews();
				Atomics.store(words, ringBase / 4 + HEADER.fence, value);
				Atomics.notify(words, ringBase / 4 + HEADER.fence);
			});
			return;
		}
		case OP.LOG: return;
		default:
			throw new Error('unknown GPU command ' + op);
	}
}

async function run() {
	const h = ringBase / 4;
	Atomics.store(words, h + HEADER.state, 1);
	for (;;) {
		refreshViews();
		const head = Atomics.load(words, h + HEADER.head) >>> 0;
		let tail = Atomics.load(words, h + HEADER.tail) >>> 0;
		if (head === tail) {
			if (encoder) submit();
			const wait = Atomics.waitAsync(words, h + HEADER.head, head | 0, 1000);
			if (wait.async) await wait.value;
			continue;
		}
		let executed = 0;
		const decodeStarted = performance.now();
		let compileWaitMs = 0;
		prepareQueuedPipelines(tail, head);
		while (tail !== head) {
			refreshViews();
			const offset = tail & (capacity - 1);
			const o = dataBase + offset;
			const op = view.getUint32(o, true), size = view.getUint32(o + 4, true);
			if (op === OP.WRAP) {
				tail = (tail + (capacity - offset)) >>> 0;
				continue;
			}
			const pipelineId = op === OP.CREATE_PIPELINE ? view.getUint32(o + 8, true) : 0;
			try {
				const pending = execute(op, o + 8, size);
				// Keep draw ordering while the browser compiles off the worker's
				// event loop. Retain this ring payload until compilation finishes.
				if (op === OP.CREATE_PIPELINE) {
					const waitStarted = performance.now();
					try { await pending; }
					finally { compileWaitMs += performance.now() - waitStarted; }
				}
			} catch (error) {
				if (errorsLogged++ < 50) log('command ' + op + ' failed: ' + (error && error.message || error));
				Atomics.add(words, h + HEADER.errors, 1);
			}
			tail = (tail + 8 + size) >>> 0;
			if (op === OP.CREATE_PIPELINE) {
				pipelineTasks.delete(pipelineId);
				prepareQueuedPipelines(tail, head);
			}
			executed++;
			// Release ring space promptly for a producer blocked on a full ring.
			if ((executed & 63) === 0) {
				Atomics.store(words, h + HEADER.tail, tail | 0);
				Atomics.notify(words, h + HEADER.tail);
			}
		}
		Atomics.store(words, h + HEADER.tail, tail | 0);
		Atomics.notify(words, h + HEADER.tail);
		Atomics.add(words, h + HEADER.executed, executed);
		decodeMs += performance.now() - decodeStarted - compileWaitMs;
		decodedCommands += executed;
		// Yield so the canvas can present and promises (fences) resolve.
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

async function initialize(message) {
	memory = message.memory;
	ringBase = message.ring;
	refreshViews();
	capacity = words[ringBase / 4 + HEADER.capacity] >>> 0;
	dataBase = ringBase + RING_HEADER_BYTES;
	const fail = (text) => {
		log(text);
		Atomics.store(words, ringBase / 4 + HEADER.state, 2);
		self.postMessage({ error: text });
	};
	if (!navigator.gpu) return fail('WebGPU is not available in this browser');
	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
	if (!adapter) return fail('No WebGPU adapter');
	const required = [];
	for (const feature of ['texture-compression-bc', 'float32-filterable', 'depth32float-stencil8', 'clip-distances']) {
		if (adapter.features.has(feature)) required.push(feature);
	}
	if (message.profileGPU && adapter.features.has('timestamp-query')) required.push('timestamp-query');
	adapterFeatures = new Set(required);
	device = await adapter.requestDevice({ requiredFeatures: required, requiredLimits: {
		maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, 1 << 30),
		maxBufferSize: Math.min(adapter.limits.maxBufferSize, 1 << 30),
		maxInterStageShaderVariables: adapter.limits.maxInterStageShaderVariables,
		maxVertexAttributes: adapter.limits.maxVertexAttributes,
	} });
	device.onuncapturederror = (event) => {
		refreshViews();
		Atomics.add(words, ringBase / 4 + HEADER.errors, 1);
		if (errorsLogged++ < 50) log('WebGPU error: ' + event.error.message);
	};
	device.lost.then((info) => fail('WebGPU device lost: ' + info.message));
	log('device ready; features: ' + required.join(', '));
	if (adapterFeatures.has('timestamp-query')) {
		timestampQuery = device.createQuerySet({ type: 'timestamp', count: TIMESTAMP_COUNT });
		timestampResolve = device.createBuffer({ size: TIMESTAMP_COUNT * 8,
			usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
		for (let i = 0; i < 3; i++) timestampReadbacks.push({ busy: false,
			buffer: device.createBuffer({ size: TIMESTAMP_COUNT * 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) });
	}
	if (!adapterFeatures.has('texture-compression-bc')) log('warning: no BC texture support; compressed textures will fail');

	context = message.canvas.getContext('webgpu');
	canvasFormat = navigator.gpu.getPreferredCanvasFormat();
	context.configure({ device, format: canvasFormat, alphaMode: 'opaque' });

	group0Layout = device.createBindGroupLayout({ entries: [
		{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
			buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 16 } },
		{ binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }] });
	constants = new Arena(GPUBufferUsage.STORAGE, 32 << 20, 'constants');
	drawUniforms = new Arena(GPUBufferUsage.UNIFORM, 16 << 20, 'draw uniforms');
	transientIndices = new Arena(GPUBufferUsage.INDEX, 8 << 20, 'transient indices');
	transientVertices = new Arena(GPUBufferUsage.VERTEX, 16 << 20, 'transient vertices');
	zeroBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.VERTEX });
	for (const dim of ['2d', '2d-array', '3d', 'cube']) {
		const texture = device.createTexture({ size: [1, 1, dim === 'cube' ? 6 : 1], dimension: dim === '3d' ? '3d' : '2d',
			format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING });
		fallbackTextures[dim] = texture.createView({ dimension: dim });
	}
	fallbackSampler = { nearest: device.createSampler(), linear: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) };
	createUtility();

	const [metaResponse, packResponse] = await Promise.all([fetch('shaders/pack_meta.json'), fetch('shaders/pack.json')]);
	if (!metaResponse.ok || !packResponse.ok) return fail('shader pack missing (run web/tools/build_shader_pack.py)');
	shaderMeta = await metaResponse.json();
	shaderSource = await packResponse.json();
	log('shader pack loaded: ' + Object.keys(shaderSource).length + ' shaders');
	await prepareShaders();
	await warmPipelineCache();
	self.postMessage({ ready: true });
	return run();
}

self.onmessage = (event) => {
	const message = event.data;
	if (message.init) {
		initialize(message).catch((error) => {
			log('initialization failed: ' + (error && error.stack || error));
			refreshViews();
			Atomics.store(words, ringBase / 4 + HEADER.state, 2);
			self.postMessage({ error: String(error) });
		});
	} else if (message.resize && context) {
		context.canvas.width = message.width;
		context.canvas.height = message.height;
	} else if (message.stats) {
		const now = performance.now();
		const sorted = [...frameIntervals].sort((a, b) => a - b);
		const gpuSorted = [...gpuFrameTimes].sort((a, b) => a - b);
		self.postMessage({ stats: { frames: frameCount,
			fps: statsTime ? (frameCount - statsFrames) * 1000 / (now - statsTime) : 0,
			frameP95Ms: sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.95)] : 0,
			maxFrameMs: sorted.length ? sorted[sorted.length - 1] : 0,
			pipelines: pipelines.size, textures: textures.size, pipelineCompileMs, maxPipelineCompileMs,
			warmPipelineHits,
			decodeMs, decodedCommands,
			bindGroupCreates, bindGroupCacheResets, bindGroupCacheSize: bindGroupCache.size,
			gpuPassP95Ms: gpuSorted.length ? gpuSorted[Math.floor((gpuSorted.length - 1) * 0.95)] : null,
			gpuPassMeanMs: gpuSorted.length ? gpuSorted.reduce((sum, ms) => sum + ms, 0) / gpuSorted.length : null,
			skippedTimingPasses,
			errors: errorsLogged } });
		statsTime = now; statsFrames = frameCount;
	}
};
