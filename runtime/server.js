// Local host for the LibertyRecomp web build.
//
// Serves out/build/web/dist on http://localhost:3000 with the headers the runtime needs:
//   - COOP + COEP: cross-origin isolation, required for SharedArrayBuffer (wasm pthreads, the GPU/IO/audio rings).
//   - Range / 206: the io worker reads small blocks out of multi-GB .rpf archives; without ranges a block read
//     would download the whole archive.
//   - application/wasm: streaming compilation of the engine module.
//
// Game files are NOT part of the build. Point --game at the folder you extracted from your own copy of the game
// (the same folder the desktop installer produces: it contains default.xex, common/, xbox360/, ...). It is mounted
// read-only at /game/. To use a disc image instead, run `python3 web/tools/extract_game.py`: it unpacks
// web/game/*.iso (+ a matching title update) into web/game/extracted, which is then picked up by default.
//
// Usage:  node web/server.js [--port 3000] [--game /path/to/extracted/game] [--dist out/build/web/dist]
'use strict';
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

function arg(name, fallback) {
	const i = process.argv.indexOf('--' + name);
	return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const REPO = path.resolve(__dirname, '..');
const DIST = path.resolve(arg('dist', path.join(REPO, 'out', 'build', 'web', 'dist')));
// web/game/extracted is what web/tools/extract_game.py unpacks the disc image + title update into (gitignored).
const LOCAL_GAME = path.join(__dirname, 'game', 'extracted');
const DEFAULT_GAME = fs.existsSync(path.join(LOCAL_GAME, 'default.xex')) ? LOCAL_GAME : {
	darwin: path.join(os.homedir(), 'Library', 'Application Support', 'LibertyRecomp', 'game'),
	linux: path.join(os.homedir(), '.local', 'share', 'LibertyRecomp', 'game'),
	win32: path.join(process.env.LOCALAPPDATA || '', 'LibertyRecomp', 'game'),
}[process.platform];
const GAME = path.resolve(arg('game', process.env.LIBERTY_GAME_DIR || DEFAULT_GAME || ''));
const PORT = Number(arg('port', process.env.PORT || 3000));
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.wasm': 'application/wasm',
	'.wgsl': 'text/plain; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.data': 'application/octet-stream',
};
const mimeFor = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

const ISO_HEADERS = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp',
	'Cross-Origin-Resource-Policy': 'same-origin',
};

function send(res, status, headers, body) {
	res.writeHead(status, { ...ISO_HEADERS, ...headers });
	res.end(body);
}

// Resolve `rel` inside `base`, or null on traversal.
function resolveUnder(base, rel) {
	let s;
	try {
		s = decodeURIComponent(rel);
	} catch {
		return null;
	}
	if (s.includes('\0')) return null;
	const abs = path.resolve(base, s.replace(/^\/+/, ''));
	if (abs !== base && !abs.startsWith(base + path.sep)) return null;
	return abs;
}

function parseRange(header, size) {
	if (!header) return null;
	const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!m) return null;
	let start, end;
	if (m[1] === '') {
		const n = Number(m[2]);
		if (!(n > 0)) return null;
		start = Math.max(0, size - n);
		end = size - 1;
	} else {
		start = Number(m[1]);
		end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
	}
	if (!(start <= end) || start >= size) return null;
	return { start, end };
}

// Game files are immutable while the server runs: cache stat() results.
const statCache = new Map();
async function cachedStat(abs) {
	let st = statCache.get(abs);
	if (!st) {
		st = await fsp.stat(abs).catch(() => null);
		statCache.set(abs, st);
	}
	return st;
}

// `immutable` marks game files, whose stat() results are cached; build output (liberty.js/.wasm)
// changes on every rebuild and is always stat()ed fresh.
// Large text assets (the 85 MB WGSL shader pack, liberty.js) are gzipped once per version.
const gzipCache = new Map(); // abs -> { mtimeMs, data }
async function serveCompressed(req, res, abs, st, cacheControl) {
	let entry = gzipCache.get(abs);
	if (!entry || entry.mtimeMs !== st.mtimeMs) {
		const raw = await fsp.readFile(abs);
		entry = { mtimeMs: st.mtimeMs, data: zlib.gzipSync(raw, { level: 6 }) };
		gzipCache.set(abs, entry);
	}
	res.writeHead(200, { ...ISO_HEADERS, 'Content-Type': mimeFor(abs), 'Content-Encoding': 'gzip',
		'Content-Length': entry.data.length, 'Cache-Control': cacheControl, Vary: 'Accept-Encoding' });
	res.end(req.method === 'HEAD' ? undefined : entry.data);
}

async function serveFile(req, res, abs, cacheControl, immutable = false) {
	const st = immutable ? await cachedStat(abs) : await fsp.stat(abs).catch(() => null);
	if (!st || !st.isFile()) return send(res, 404, { 'Cache-Control': 'no-store' }, 'not found');
	const ext = path.extname(abs).toLowerCase();
	if (!immutable && !req.headers.range && (ext === '.json' || ext === '.js') && st.size > 64 * 1024 &&
		/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
		return serveCompressed(req, res, abs, st, cacheControl);
	}
	const headers = { 'Content-Type': mimeFor(abs), 'Accept-Ranges': 'bytes', 'Cache-Control': cacheControl };
	const r = parseRange(req.headers.range, st.size);
	if (req.headers.range && !r) {
		return send(res, 416, { 'Content-Range': `bytes */${st.size}` }, '');
	}
	const start = r ? r.start : 0;
	const end = r ? r.end : st.size - 1;
	headers['Content-Length'] = st.size === 0 ? 0 : end - start + 1;
	if (r) headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
	res.writeHead(r ? 206 : 200, { ...ISO_HEADERS, ...headers });
	if (req.method === 'HEAD' || st.size === 0) return res.end();
	fs.createReadStream(abs, { start, end, highWaterMark: 1 << 20 })
		.on('error', () => res.destroy())
		.pipe(res);
}

// GET /game/index.json: flat listing of the game folder (path + size), so the io worker can open files by id
// and answer stat()/readdir() without a round trip per call.
let gameIndex = null;
async function buildGameIndex() {
	const out = [];
	async function walk(dir, rel) {
		let entries;
		try {
			entries = await fsp.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			if (e.name.startsWith('.')) continue;
			const abs = path.join(dir, e.name);
			const r = rel ? rel + '/' + e.name : e.name;
			if (e.isDirectory()) await walk(abs, r);
			else if (e.isFile()) out.push([r, (await fsp.stat(abs)).size]);
		}
	}
	await walk(GAME, '');
	return { root: 'game:', files: out };
}

const server = http.createServer(async (req, res) => {
	let url;
	try {
		url = new URL(req.url, 'http://localhost');
	} catch {
		return send(res, 400, {}, 'bad request');
	}
	const p = url.pathname;
	try {
		if (p === '/favicon.ico') return send(res, 204, { 'Cache-Control': 'max-age=86400' }, '');
		if (p === '/game/index.json') {
			if (!fs.existsSync(GAME)) return send(res, 404, { 'Cache-Control': 'no-store' }, 'no game folder');
			gameIndex = gameIndex || (await buildGameIndex());
			return send(res, 200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }, JSON.stringify(gameIndex));
		}
		if (p.startsWith('/game/')) {
			const abs = resolveUnder(GAME, p.slice('/game/'.length));
			if (!abs) return send(res, 400, {}, 'bad path');
			return await serveFile(req, res, abs, 'public, max-age=31536000, immutable', true);
		}
		// Only the generated runtime pair is inconsistent while linking. Keep
		// the shell, workers and shader assets available to running sessions.
		if (/^\/liberty\.(?:js|wasm)(?:\.map)?$/.test(p) &&
			fs.existsSync(path.join(DIST, '.liberty-linking'))) {
			return send(res, 503, { 'Cache-Control': 'no-store', 'Retry-After': '2' },
				'Engine build in progress. Reload after the build completes.');
		}
		let abs = resolveUnder(DIST, p);
		if (!abs) return send(res, 400, {}, 'bad path');
		const st = await fsp.stat(abs).catch(() => null);
		if (st && st.isDirectory()) abs = path.join(abs, 'index.html');
		return await serveFile(req, res, abs, 'no-cache');
	} catch (e) {
		console.error('[serve] ' + p + ': ' + e.message);
		if (!res.headersSent) send(res, 500, {}, 'server error');
		else res.destroy();
	}
});

server.on('connection', (socket) => {
	socket.setNoDelay(true);
	socket.setKeepAlive(true, 30000);
});
server.keepAliveTimeout = 60000;

server.on('error', (error) => {
 console.error(error.code === 'EADDRINUSE' ? 'Port ' + PORT + ' is already in use. Choose another with --port.' : error.message);
 process.exitCode = 1;
});
server.listen(PORT, HOST, () => {
	console.log('LibertyRecomp web: http://localhost:' + PORT + '/');
	console.log('  build: ' + DIST + (fs.existsSync(DIST) ? '' : '   (missing: run ./web/build.sh first)'));
	console.log('  game:  ' + GAME + (fs.existsSync(GAME) ? '' : '   (missing: pass --game /path/to/extracted/game)'));
});
