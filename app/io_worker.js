// IO worker: serves every game-file read of the engine threads (web/platform/web_io.cpp).
//
// Engine threads cannot use fetch() (they are blocked in wasm, and synchronous XHR from many
// workers piles up garbage those workers never collect). Each thread writes a request into its
// slot of a table in shared wasm memory and sleeps on the slot; this worker, which has a normal
// event loop, fetches the byte range from the server and streams it straight into the wasm heap.
//
// Protocol (int32 words; keep in sync with web_io.cpp):
//   header [0] doorbell (incremented + notified per request)  [1] slot allocator  [2] slot count
//   slot i (16 words at 16 + 16*i): [0] state 0 idle / 1 requested / 3 taken / 2 done,
//   [1] file id, [2..3] offset lo/hi, [4..5] destination lo/hi, [6] length, [7] result
'use strict';

const HEADER_WORDS = 16;
const SLOT_WORDS = 16;
const EIO = 5;

let memory = null;
let table = 0; // word index of the table in the heap
let files = [];
let words = null;
let bytes = null;
let inFlight = 0;
let stats = { requests: 0, bytes: 0, fetches: 0, cacheHits: 0, readMs: 0, maxReadMs: 0, slowReads: 0 };
const READ_BLOCK_BYTES = 256 * 1024;
const MAX_CACHED_BLOCKS = 128; // 32 MB, independent of total game size.
const readBlocks = new Map();
const pendingBlocks = new Map();
// Startup audio stays available while unrelated game reads churn the LRU.
const preparedBlocks = new Map();
const MAX_PREPARED_BYTES = 48 * 1024 * 1024;

function views() {
	// Growing wasm memory replaces its buffer; refresh the views when that happens.
	if (!words || words.buffer !== memory.buffer) {
		words = new Int32Array(memory.buffer);
		bytes = new Uint8Array(memory.buffer);
	}
}

function fileUrl(id) {
	return '/game/' + files[id][0].split('/').map(encodeURIComponent).join('/');
}

// Keep large transfers streaming, and coalesce small sequential reads into
// reusable blocks. Game files are immutable for the lifetime of the worker.
async function streamRange(id, offset, end, consume) {
	stats.fetches++;
	const response = await fetch(fileUrl(id), { headers: { Range: `bytes=${offset}-${end - 1}` }, signal: AbortSignal.timeout(30000) });
	if (response.status !== 206 && response.status !== 200) throw new Error('HTTP ' + response.status);
	let skip = response.status === 200 ? offset : 0;
	let written = 0;
	const reader = response.body.getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			let chunk = value;
			const drop = Math.min(skip, chunk.length);
			chunk = chunk.subarray(drop);
			skip -= drop;
			const take = Math.min(chunk.length, end - offset - written);
			if (take) {
				consume(chunk.subarray(0, take), written);
				written += take;
			}
			if (written === end - offset) break;
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	return written;
}

async function readBlock(id, start) {
	const key = id + ':' + start;
	if (preparedBlocks.has(key)) {
		stats.cacheHits++;
		return preparedBlocks.get(key);
	}
	if (readBlocks.has(key)) {
		const data = readBlocks.get(key);
		readBlocks.delete(key);
		readBlocks.set(key, data);
		stats.cacheHits++;
		return data;
	}
	if (pendingBlocks.has(key)) {
		stats.cacheHits++;
		return pendingBlocks.get(key);
	}
	const pending = (async () => {
		const end = Math.min(start + READ_BLOCK_BYTES, files[id][1]);
		const data = new Uint8Array(end - start);
		const written = await streamRange(id, start, end, (chunk, at) => data.set(chunk, at));
		// Do not retain short responses; a subsequent read can retry the server.
		if (written !== data.length) return data.subarray(0, written);
		readBlocks.set(key, data);
		while (readBlocks.size > MAX_CACHED_BLOCKS) readBlocks.delete(readBlocks.keys().next().value);
		return data;
	})();
	pendingBlocks.set(key, pending);
	try { return await pending; }
	finally { pendingBlocks.delete(key); }
}

function preparedRange(id, offset, end) {
	for (let start = Math.floor(offset / READ_BLOCK_BYTES) * READ_BLOCK_BYTES;
		start < end; start += READ_BLOCK_BYTES) {
		if (!preparedBlocks.has(id + ':' + start)) return false;
	}
	return true;
}

async function prepareAudio() {
	const plan = [];
	let total = 0;
	let configurations = 0;
	const banks = new Set();
	for (let id = 0; id < files.length; id++) {
		const [path, size] = files[id];
		const config = /^(?:xbox360\/)?audio\/config\//i.test(path);
		const match = /^(?:xbox360\/)?audio\/sfx\/([^/]+)\.rpf$/i.exec(path);
		if (!config && !match) continue;
		if (config) configurations++;
		const bank = match && match[1].toLowerCase();
		if (bank) banks.add(bank);
		const full = config || ['loading', 'resident', 'general'].includes(bank);
		const length = full ? size : Math.min(size, READ_BLOCK_BYTES);
		for (let start = 0; start < length; start += READ_BLOCK_BYTES) {
			const bytes = Math.min(READ_BLOCK_BYTES, size - start);
			total += bytes;
			plan.push({ id, start, bytes });
		}
	}
	if (!configurations || !['loading', 'resident', 'general'].every(bank => banks.has(bank))) {
		throw new Error('Startup audio files are missing. Prepare the extracted game files before starting.');
	}
	if (total > MAX_PREPARED_BYTES) throw new Error('Startup audio exceeds the 48 MB preparation budget.');
	let completed = 0;
	let next = 0;
	self.postMessage({ audioProgress: true, completed, total });
	// Four bounded requests keep startup responsive without flooding the server.
	await Promise.all(Array.from({ length: Math.min(4, plan.length) }, async () => {
		while (next < plan.length) {
			const { id, start, bytes } = plan[next++];
			let data;
			for (let attempt = 0; attempt < 2; attempt++) {
				try {
					data = await readBlock(id, start);
					if (data.length !== bytes) throw new Error('Incomplete audio response');
					break;
				} catch (error) {
					if (attempt === 1) throw new Error(files[id][0] + ': ' + error.message);
				}
			}
			const key = id + ':' + start;
			preparedBlocks.set(key, data);
			readBlocks.delete(key);
			completed += bytes;
			self.postMessage({ audioProgress: true, completed, total });
		}
	}));
	return total;
}

async function serve(slot) {
	const started = performance.now();
	views();
	const id = words[slot + 1];
	const offset = (words[slot + 2] >>> 0) + (words[slot + 3] >>> 0) * 0x100000000;
	const destination = (words[slot + 4] >>> 0) + (words[slot + 5] >>> 0) * 0x100000000;
	const length = words[slot + 6] >>> 0;
	let result;
	try {
		if (!files[id]) throw new Error('unknown file id ' + id);
		const size = files[id][1];
		const end = Math.min(offset + length, size);
		if (offset >= end) {
			result = 0;
		} else {
			let written = 0;
			if (length > READ_BLOCK_BYTES && !preparedRange(id, offset, end)) {
				written = await streamRange(id, offset, end, (chunk, at) => {
					views();
					bytes.set(chunk, destination + at);
				});
			} else {
				while (offset + written < end) {
					const at = offset + written;
					const start = Math.floor(at / READ_BLOCK_BYTES) * READ_BLOCK_BYTES;
					const block = await readBlock(id, start);
					const within = at - start;
					const take = Math.min(end - at, block.length - within);
					if (take <= 0) break;
					views();
					bytes.set(block.subarray(within, within + take), destination + written);
					written += take;
					if (block.length < Math.min(READ_BLOCK_BYTES, size - start)) break;
				}
			}
			result = written;
			stats.requests++;
			stats.bytes += written;
		}
	} catch (error) {
		console.error('[io] read failed', files[id] && files[id][0], offset, length, error);
		result = -EIO;
	}
	const elapsed = performance.now() - started;
	stats.readMs += elapsed;
	stats.maxReadMs = Math.max(stats.maxReadMs, elapsed);
	if (elapsed > 16.7) stats.slowReads++;
	views();
	words[slot + 7] = result;
	Atomics.store(words, slot, 2);
	Atomics.notify(words, slot);
	inFlight--;
}

async function run() {
	let seen = -1;
	for (;;) {
		views();
		const bell = Atomics.load(words, table);
		if (bell === seen) {
			if (Atomics.waitAsync) {
				const wait = Atomics.waitAsync(words, table, bell, 1000);
				if (wait.async) await wait.value;
			} else {
				await new Promise((resolve) => setTimeout(resolve, 1));
			}
			continue;
		}
		seen = bell;
		const count = Atomics.load(words, table + 2) || 256;
		for (let i = 0; i < count; i++) {
			const slot = table + HEADER_WORDS + i * SLOT_WORDS;
			if (Atomics.compareExchange(words, slot, 1, 3) === 1) {
				inFlight++;
				serve(slot);
			}
		}
	}
}

self.onmessage = async (event) => {
	const message = event.data;
	if (message.init) {
		memory = message.memory;
		table = message.table / 4;
		try {
			const response = await fetch('/game/index.json', { signal: AbortSignal.timeout(30000) });
			if (!response.ok) throw new Error('Game file index: HTTP ' + response.status);
			files = (await response.json()).files;
			const audioBytes = await prepareAudio();
			self.postMessage({ ready: true, files: files.length, audioBytes });
			run();
		} catch (error) {
			self.postMessage({ startupError: error.message });
		}
	} else if (message.stats) {
		self.postMessage({ stats, inFlight });
	}
};
