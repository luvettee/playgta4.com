// Page bootstrap: checks the browser, then starts the engine (liberty.js / liberty.wasm).
'use strict';

(function () {
	const statusEl = document.getElementById('boot-status');
	const progressEl = document.getElementById('boot-progress');
	const checksEl = document.getElementById('boot-checks');
	const logEl = document.getElementById('log');
	const params = new URLSearchParams(location.search);
	let nativeFatal = '';
	const audioProfilePrevious = new Map();

	function status(text, pct) {
		statusEl.textContent = text;
		if (pct !== undefined) progressEl.style.width = pct + '%';
	}

	function fatal(title, message) {
		document.getElementById('fatal-title').textContent = title;
		document.getElementById('fatal-message').textContent = nativeFatal || message;
		document.getElementById('fatal').hidden = false;
		document.getElementById('boot').classList.add('boot-hidden');
	}

	const logLines = [];
	function log(line, isError) {
		line = String(line);
		(isError ? console.warn : console.log)(line);
		if (line.includes('[FATAL]')) {
			nativeFatal = line;
			fatal('The engine aborted', line);
		}
		logLines.push(line);
		if (logLines.length > 400) logLines.shift();
		if (!logEl.hidden) logEl.textContent = logLines.join('\n');
		// Mirror to the dev server's terminal (web/server.js POST /log) when ?log=1.
		if (params.get('log') === '1') fetch('/log', { method: 'POST', body: line }).catch(() => {});
	}
	const fullscreenButton = document.getElementById('fullscreen');
	function toggleFullscreen() {
		const action = document.fullscreenElement ? document.exitFullscreen() :
			document.documentElement.requestFullscreen();
		action.catch((error) => log('Fullscreen failed: ' + error.message, true));
	}
	fullscreenButton?.addEventListener('click', toggleFullscreen);
	document.addEventListener('fullscreenchange', () => {
		if (fullscreenButton) fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
	});
	window.addEventListener('keydown', (event) => {
		if (event.altKey && event.key === 'Enter') {
			event.preventDefault();
			event.stopImmediatePropagation();
			toggleFullscreen();
			return;
		}
		if (event.key === 'F9') {
			logEl.hidden = !logEl.hidden;
			logEl.textContent = logLines.join('\n');
		}
	}, true);

	function memory64Supported() {
		try {
			new WebAssembly.Memory({ initial: 1, maximum: 2, index: 'i64' });
			return true;
		} catch (e) {
			return false;
		}
	}

	const checks = [
		['Cross-origin isolation (threads)', self.crossOriginIsolated === true,
			'Open the page through web/server.js; it sends the COOP/COEP headers.'],
		['SharedArrayBuffer', typeof SharedArrayBuffer !== 'undefined', 'Requires cross-origin isolation.'],
		['WebAssembly memory64', memory64Supported(), 'Use a current Chrome, Edge or Firefox.'],
		['WebGPU', !!navigator.gpu, 'Use a current Chrome or Edge (or enable WebGPU).'],
	];
	let ok = true;
	for (const [name, passed, hint] of checks) {
		const li = document.createElement('li');
		li.className = passed ? 'ok' : 'bad';
		li.textContent = (passed ? '✓ ' : '✗ ') + name + (passed ? '' : ' — ' + hint);
		checksEl.appendChild(li);
		ok = ok && passed;
	}
	if (!ok && params.get('force') !== '1') {
		status('This browser cannot run the game (see above). Add ?force=1 to try anyway.');
		return;
	}

	// The GPU worker owns the WebGPU device and the #screen canvas. It starts once the renderer
	// (gta4_web) announces its command ring in shared memory.
	const screen = document.getElementById('screen');
	const gpu = new Worker('gpu_worker.js');
	let gpuStarted = false;
	gpu.onmessage = (event) => {
		if (event.data.log) log('[gpu] ' + event.data.log, false);
		if (event.data.stats) log('[gpu trace] ' + JSON.stringify(event.data.stats));
		if (event.data.progress) {
			const progress = event.data.progress;
			const percent = Math.round(progress.completed / progress.total * 100);
			status(`${progress.label}… ${percent}%`, 40 + percent * 0.6);
		}
		if (event.data.error) fatal('Graphics failed', event.data.error);
		if (event.data.ready) {
			status('Graphics ready.', 100);
			document.getElementById('boot').classList.add('boot-hidden');
		}
	};
	gpu.onerror = (event) => fatal('Graphics worker failed', event.message || 'The GPU worker stopped.');
	function pixelSize() {
		const ratio = window.devicePixelRatio || 1;
		return { width: Math.round(window.innerWidth * ratio), height: Math.round(window.innerHeight * ratio) };
	}
	window.addEventListener('resize', () => {
		if (gpuStarted) gpu.postMessage(Object.assign({ resize: true }, pixelSize()));
	});
	let engine = null;
	const tracedContexts = new Set();
	function traceGuest(stackPointer, linkRegister, base, source = 'guest') {
		if (params.get('trace') !== '1' || tracedContexts.has(stackPointer) || tracedContexts.size >= 8) return;
		tracedContexts.add(stackPointer);

		let samples = 0;
		const timer = setInterval(() => {
			if (++samples === 30) clearInterval(timer);
			const view = new DataView(engine.wasmMemory.buffer);
			const hex = (n) => n.toString(16).padStart(8, '0');
			const host = (address) => {
				if (address >= 0xe0000000) return base + 0x100001000 + address - 0xe0000000;
				if (address >= 0xc0000000) return base + 0x100000000 + address - 0xc0000000;
				if (address >= 0xa0000000) return base + 0x100000000 + address - 0xa0000000;
				if (address >= 0x90000000) return base + address - 0x10000000;
				if (address >= 0x7f000000 && address < 0x80000000) return base + 0x100000000 + address - 0x7f000000;
				return base + address;
			};
			let sp = view.getUint32(stackPointer, true);
			const frames = [];
			for (let depth = 0; sp && depth < 12; depth++) {
				const at = host(sp);
				if (at < 0 || at + 12 > view.byteLength) break;
				const next = view.getUint32(at);
				if (next <= sp) break;
				const savedLink = host(next) - 8;
				if (savedLink < 0 || savedLink + 4 > view.byteLength) break;
				frames.push(hex(sp) + ':' + hex(view.getUint32(savedLink)));
				sp = next;
			}
			const registers = [3, 5, 6, 7, 8, 9, 10, 11, 27, 28, 29, 30, 31].map((n) =>
				'r' + n + '=' + hex(view.getUint32(stackPointer - 16 + (n === 3 ? 0 : n * 8), true)));
			log('[guest trace] source=' + source + ' lr=' + hex(view.getUint32(linkRegister, true)) + ' ' + registers.join(' ') + ' stack=' + frames.join(' '));
			const screenIndex = view.getUint32(host(0x831d5340));
			const screenRecord = host(0x831d5498 + screenIndex * 400);
			log('[presentation trace] active=' + view.getUint8(host(0x831d5335)) +
				' pending=' + view.getUint8(host(0x831d5348)) + ' screen=' + screenIndex +
				' count=' + view.getUint32(host(0x831d5344)) +
				' elapsed=' + view.getFloat32(host(0x831d5338)) +
				(screenIndex < 64 && screenRecord + 12 <= view.byteLength ?
					' duration=' + view.getUint32(screenRecord) + ' marker=' + view.getUint32(screenRecord + 8) : ''));
			const pathAt = host(view.getUint32(stackPointer - 16 + 29 * 8, true));
			const pathBytes = new Uint8Array(view.buffer, pathAt, Math.min(128, view.byteLength - pathAt));
			log('[guest trace] path=' + new TextDecoder().decode(pathBytes.slice(0, pathBytes.indexOf(0) < 0 ? 128 : pathBytes.indexOf(0))));
		}, 3000);
	}
	function startGpu(ring) {
		if (gpuStarted) return;
		gpuStarted = true;
		const size = pixelSize();
		screen.width = size.width;
		screen.height = size.height;
		const offscreen = screen.transferControlToOffscreen();
		gpu.postMessage({ init: true, memory: engine.wasmMemory, ring, canvas: offscreen,
			profileGPU: params.get('perf') === '1' && params.get('gpuProfile') !== '0' }, [offscreen]);
		if (params.get('trace') === '1') {
			let samples = 0;
			const timer = setInterval(() => {
				gpu.postMessage({ stats: true });
				if (++samples === 5) clearInterval(timer);
			}, 5000);
		}
		status('Graphics starting\u2026', 40);
	}

	status('Downloading the engine…', 5);
	const script = document.createElement('script');
	script.src = 'liberty.js';
	script.onerror = () => fatal('Engine missing', 'liberty.js was not found. Build it with ./web/build.sh.');
	script.onload = () => {
		// Runtime logging is opt-in on desktop; in the browser the console is the only log.
		const customArgs = (params.get('args') || '').split(' ').filter(Boolean);
		const customFlags = new Set(customArgs.map(arg => arg.split('=')[0]));
		// Keep the browser render graph independent of the initial window shape.
		// Use the original reflection/shadow budgets and avoid Retina scene rendering.
		const defaults = ['--diagnostics=true', '--diagnostics_categories=logging',
			'--fullscreen=false', '--resolution=720p', '--gta4_aspect_ratio=16:9',
			'--gta4_reflection_resolution=original', '--gta4_shadow_map_base_size=256',
			'--gta4_shadow_distance_scale=1', '--gta4_draw_distance_scale=1'];
		const args = defaults.filter(arg => !customFlags.has(arg.split('=')[0]) &&
			!(arg.startsWith('--resolution=') &&
				(customFlags.has('--video_mode_width') || customFlags.has('--video_mode_height'))))
			.concat(customArgs);
		engine = {
			canvas: document.getElementById('canvas'),
			prepareAudioOutput: (module) => LibertyAudioOutput.prepare(module),
			arguments: args,
			print: (line) => log(line, false),
			printErr: (line) => log(line, true),
			setStatus: (text) => text && status(text),
			onAudioProgress: (info) => {
				const percent = info.total ? Math.floor(info.completed / info.total * 100) : 0;
				status(`Preparing audio… ${percent}%`, 10 + percent * 0.2);
			},
			onIoReady: (info) => {
				log(`Audio prepared: ${(info.audioBytes / 1048576).toFixed(1)} MB.`, false);
				status(`Audio ready. Starting ${info.files} game files…`, 30);
				if (params.get('trace') === '1' || params.get('perf') === '1') {
					engine.ioWorker.addEventListener('message', (event) => {
						if (event.data.stats) log('[io trace] ' + JSON.stringify(event.data));
					});
					setInterval(() => {
						engine.ioWorker.postMessage({ stats: true });
						if (gpuStarted) gpu.postMessage({ stats: true });
						if (engine.audioOutputStats) log('[audio trace] ' + JSON.stringify(engine.audioOutputStats()));
						if (engine._liberty_audio_profile && params.get('audioProfile') !== '0') {
							const at = Number(engine._liberty_audio_profile());
							const count = new Uint32Array(engine.wasmMemory.buffer, at, 1)[0];
							const values = new Uint32Array(engine.wasmMemory.buffer, at + 4, count * 4);
							const profile = [];
							for (let i = 0; i < count; ++i) {
								const row = Array.from(values.subarray(i * 4, i * 4 + 4));
								if (!row[0]) continue;
								const previous = audioProfilePrevious.get(row[0]) || [row[0], 0, 0, 0];
								profile.push({ fn: row[0].toString(16), calls: (row[1] - previous[1]) >>> 0,
									ms: ((row[2] - previous[2]) >>> 0) / 1000,
									selfMs: ((row[3] - previous[3]) >>> 0) / 1000 });
								audioProfilePrevious.set(row[0], row);
							}
							log('[audio profile] ' + JSON.stringify(profile.sort((a, b) => b.selfMs - a.selfMs)));
						}
						if (engine._liberty_audio_stats) {
							const at = Number(engine._liberty_audio_stats());
							const stats = new Uint32Array(engine.wasmMemory.buffer, at, 11);
							const peak = new DataView(engine.wasmMemory.buffer).getFloat32(at + 24, true);
							log('[audio mix] ' + JSON.stringify({ submitted: stats[0], consumed: stats[1],
								silent: stats[2], queued: stats[3], clipped: stats[4], nonFinite: stats[5], peak,
								mixerCalls: stats[7], mixerMs: stats[8] / 1000, mixerMaxMs: stats[9] / 1000,
								callback: stats[10].toString(16) }));
						}
					}, 5000);
				}
			},
			onRuntimeInitialized: () => {
				status('Audio ready. Engine starting…', 30);
				if ((params.get('perf') === '1' || params.get('trace') === '1') &&
					params.get('audioProfile') !== '0' && engine._liberty_audio_profile_enable) {
					engine._liberty_audio_profile_enable(1);
				}
			},
			onAbort: (what) => fatal('The engine aborted',
				what ? String(what) : 'The native runtime aborted. Press F9 to view the engine log.'),
			onExit: (code) => code && fatal('The engine exited', 'exit code ' + code),
			onGpuRing: (ring) => startGpu(ring),
			onGuestTrace: traceGuest,
		};
		createLibertyModule(engine).catch((error) => fatal('The engine failed to start', String(error && error.stack || error)));
	};
	document.body.appendChild(script);
})();
