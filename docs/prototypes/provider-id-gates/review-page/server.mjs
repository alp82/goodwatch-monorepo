// Local review page for the #709 private review packet.
// Serves on 127.0.0.1 only. Changes only `review` and optional `notes`.
// No dependencies: node server.mjs [PACKET] [--port N]
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, rename, copyFile, realpath, constants, open } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const requestedPort = portFlag >= 0 ? Number(args.splice(portFlag, 2)[1]) : 0;
const packetPath = resolve(args[0] ?? join(process.env.HOME, 'goodwatch-private/709/review.json'));
const aggregateScript = resolve(here, '..', 'private-review.mjs');

const CODES = ['c', 'w', 'a', '?', 'n', '-'];
const FULL = { unreviewed: '-', correct: 'c', wrong: 'w', ambiguous: 'a', absent: 'n', unknown: '?' };
const toCode = r => FULL[r] ?? r;

// Refuse packets inside a Git working tree so review data never lands in a repo.
function insideGit(dir) {
  try { execFileSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' }); return true; }
  catch { return false; }
}
if (!existsSync(packetPath)) throw new Error(`Packet not found: ${packetPath}`);
if (insideGit(dirname(await realpath(packetPath)))) throw new Error('Packet is inside a Git working tree. Keep it under ~/goodwatch-private/.');

const readPacket = async () => JSON.parse(await readFile(packetPath, 'utf8'));
const first = await readPacket();
if (!Array.isArray(first.entries)) throw new Error('Packet has no entries array');

// One backup of the untouched original, next to the packet. Never overwritten.
const backupPath = `${packetPath}.orig`;
try { await copyFile(packetPath, backupPath, constants.COPYFILE_EXCL); console.log(`Backup written: ${backupPath}`); }
catch (e) { if (e.code !== 'EEXIST') throw e; }

// Read-modify-write per change, serialized, written atomically (temp file + rename).
let queue = Promise.resolve();
function applyChange({ index, review, notes }) {
  const run = queue.then(async () => {
    const packet = await readPacket();
    const entry = packet.entries.find(e => e.index === index);
    if (!entry) throw httpError(404, `No entry ${index}`);
    if (review !== undefined) {
      if (!CODES.includes(review)) throw httpError(400, `Unknown review code ${review}`);
      const hasProposal = Boolean(entry.historicalProposal);
      if (review === 'n' && hasProposal) throw httpError(400, 'n is only for rows with no proposal. Use w if the proposal is wrong.');
      if ((review === 'c' || review === 'w') && !hasProposal) throw httpError(400, 'This row has no proposal. Use n, a or ?.');
      if ((review === 'c' || review === 'w') && entry.referenceTarget) {
        const proposed = `${entry.historicalProposal.mediaType}:${entry.historicalProposal.tmdb_id}`;
        if ((proposed === entry.referenceTarget) !== (review === 'c')) throw httpError(400, `referenceTarget ${entry.referenceTarget} contradicts ${review}. Edit the packet by hand.`);
      }
      entry.review = review;
    }
    if (notes !== undefined) {
      if (typeof notes !== 'string' || notes.length > 2000) throw httpError(400, 'Notes must be text up to 2000 characters');
      if (notes.trim()) entry.notes = notes.trim(); else delete entry.notes;
    }
    const tmp = join(dirname(packetPath), `.${basename(packetPath)}.${process.pid}.tmp`);
    const fh = await open(tmp, 'w', 0o600);
    try { await fh.writeFile(`${JSON.stringify(packet, null, 2)}\n`); await fh.sync(); } finally { await fh.close(); }
    await rename(tmp, packetPath);
    return publicEntry(entry);
  });
  queue = run.catch(() => {});
  return run;
}

const httpError = (status, message) => Object.assign(new Error(message), { status });
const publicEntry = e => ({
  index: e.index, source: e.source, historicalProposal: e.historicalProposal ?? null,
  review: toCode(e.review), notes: e.notes ?? '', referenceTarget: e.referenceTarget ?? null,
});

// TMDB key for posters: env, else the webapp .env of this checkout or the main checkout.
function tmdbKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY;
  const roots = [];
  try {
    roots.push(execFileSync('git', ['-C', here, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
    roots.push(dirname(resolve(here, execFileSync('git', ['-C', here, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim())));
  } catch {}
  for (const root of roots) {
    const file = join(root, 'goodwatch-webapp/.env');
    if (!existsSync(file)) continue;
    const m = /^TMDB_API_KEY=["']?([^"'\s]+)/m.exec(readFileSync(file, 'utf8'));
    if (m) return m[1];
  }
  return null;
}
const TMDB_KEY = tmdbKey();
const tmdbCache = new Map();
async function tmdbDetails(type, id) {
  const key = `${type}:${id}`;
  if (!tmdbCache.has(key)) {
    tmdbCache.set(key, (async () => {
      if (!TMDB_KEY) return { available: false };
      const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}`, { signal: AbortSignal.timeout(8000) });
      if (res.status === 404) return { available: true, missing: true };
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      const d = await res.json();
      return {
        available: true,
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w185${d.poster_path}` : null,
        overview: d.overview ?? '',
        date: d.release_date ?? d.first_air_date ?? null,
        lastAirDate: d.last_air_date ?? null,
        originalLanguage: d.original_language ?? null,
        countries: (d.origin_country ?? d.production_countries?.map(c => c.iso_3166_1) ?? []).slice(0, 3),
        seasons: d.number_of_seasons ?? null,
        runtime: d.runtime ?? null,
      };
    })().catch(e => { tmdbCache.delete(key); throw e; }));
  }
  return tmdbCache.get(key);
}

const token = randomBytes(16).toString('hex');
const html = await readFile(join(here, 'index.html'), 'utf8');
let port;

const server = http.createServer(async (req, res) => {
  const send = (status, body, type = 'application/json') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  try {
    // Only same-machine requests aimed at this exact host (blocks DNS rebinding).
    if (req.headers.host !== `127.0.0.1:${port}`) return send(403, { error: 'Wrong host' });
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/' && req.method === 'GET') {
      if (url.searchParams.get('t') !== token) return send(403, 'Open the URL printed in the terminal.', 'text/plain');
      return send(200, html.replace('__TOKEN__', token), 'text/html; charset=utf-8');
    }
    if (req.headers['x-review-token'] !== token) return send(403, { error: 'Missing token' });
    if (url.pathname === '/api/packet' && req.method === 'GET') {
      const packet = await readPacket();
      return send(200, {
        packetPath, backupPath,
        aggregateCommand: `node ${JSON.stringify(aggregateScript)} aggregate ${JSON.stringify(packetPath)}`,
        posters: Boolean(TMDB_KEY),
        entries: packet.entries.map(publicEntry),
      });
    }
    if (url.pathname === '/api/review' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 10000) throw httpError(413, 'Too large'); }
      const { index, review, notes } = JSON.parse(body);
      return send(200, await applyChange({ index, review, notes }));
    }
    const m = /^\/api\/tmdb\/(movie|tv)\/(\d+)$/.exec(url.pathname);
    if (m && req.method === 'GET') return send(200, await tmdbDetails(m[1], m[2]));
    send(404, { error: 'Not found' });
  } catch (e) {
    send(e.status ?? 500, { error: e.message });
  }
});

server.listen(requestedPort, '127.0.0.1', () => {
  port = server.address().port;
  console.log(`Reviewing ${first.entries.length} rows in ${packetPath}`);
  console.log(TMDB_KEY ? 'Posters: on (TMDB lookups at runtime, nothing stored)' : 'Posters: off (no TMDB_API_KEY found)');
  console.log(`Open: http://127.0.0.1:${port}/?t=${token}`);
  console.log(`Server pid ${process.pid}. Stop with Ctrl+C.`);
});
