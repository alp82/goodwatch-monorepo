// THROWAWAY #709. Node 24+, no dependencies, no application initialization.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtures, performanceFixture } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const readerPath = resolve(root, 'goodwatch-webapp/app/server/imports/wishlist-suggestions.server.ts');
const source = await readFile(readerPath, 'utf8');
// Only pure helpers: no DB, Redis, configuration or service imports are evaluated.
const { withBackendTimeout } = await import(pathToFileURL(resolve(root, 'goodwatch-webapp/app/utils/backend-timeout.ts')));
const { canonicalTitleId } = await import(pathToFileURL(resolve(root, 'goodwatch-webapp/app/utils/title-identity.ts')));
const hash = value => createHash('sha256').update(value).digest('hex');
const key = (type, id) => `${type}:${canonicalTitleId(type, Number(id))}`;
const seam = { withBackendTimeout, canonicalTitleId,
  chunks: (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i*n, (i+1)*n)),
  marks: n => Array(n).fill('?').join(','), WishlistMatchError: class extends Error {},
  matchingGroups: async () => seam.groups,
  searchQuery: (...args) => seam.query(...args),
};
globalThis.__providerIdBenchmark = seam;
let imports = 0;
async function loadReader() {
  let code = stripTypeScriptTypes(source);
  const importLines = code.match(/import\s+[\s\S]*?from\s+["'][^"']+["'];?/g) ?? [];
  // Five VALUE imports remain after stripping; the sixth source declaration is
  // `import type` and is erased by stripTypeScriptTypes (not counted here).
  assert.equal(importLines.length, 5, 'Review seam adaptation when production imports change');
  code = code.replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];?/g, '');
  code = `const {withBackendTimeout,canonicalTitleId,searchQuery,chunks,marks,WishlistMatchError,matchingGroups}=globalThis.__providerIdBenchmark;\n${code}\nexport {nativeId};\n// instance ${imports++}`;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
// Fail closed against accidental network use, including production connection paths.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Offline benchmark forbids network'); };
const { syncBuiltinESMExports } = await import('node:module');
const net = (await import('node:net')).default;
net.Socket.prototype.connect = function () { throw new Error('Offline benchmark forbids sockets'); };
syncBuiltinESMExports();
const reader = await loadReader();
const groups = (f, count = 1) => Array.from({ length: count }, (_, i) => ({
  representativeIndex: i, item: { wishlistOriginal: {
    title: f.source.title, year: f.source.year,
    wishlistEvidence: { source: 'netflix', sourceId: count === 1 ? f.source.sourceId : String(8001 + i) },
  } }, hasMoreEvidence: false,
  evidenceVariants: f.conflict ? [{ title: 'Contradictory observation', year: null }] : [],
}));
const stats = () => ({ requests: 0, rowsConsumed: 0, active: 0, peak: 0, aborted: 0, startedAfterAbort: 0, maxRows: 0 });
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
function catalog(f, s, { delayMs = 0, stall = false, failSibling = false } = {}) {
  return async (sql, args, signal) => {
    if (signal.aborted) { s.startedAfterAbort++; signal.throwIfAborted(); }
    assert.match(sql, /^SELECT /);
    s.requests++; s.active++; s.peak = Math.max(s.peak, s.active);
    try {
      if ((f.fail || failSibling) && sql.includes('FROM show ')) throw new Error('Synthetic lane failure');
      await delay(stall ? 60_000 : delayMs, signal);
      let rows;
      const type = sql.includes('FROM movie ') ? 'movie' : 'show';
      if (sql.includes('MATCH((title,original_title)')) rows = f.names[type].slice(0, 10).map(tmdb_id => ({ tmdb_id }));
      else if (sql.includes('FROM translation ')) rows = f.translation.slice(0, 101);
      else if (sql.includes('FROM alternative_title ')) rows = f.alternative_title.slice(0, 101);
      else if (sql.includes('FROM streaming_availability ')) rows = f.offers.filter(r => r.media_type === args[0] && args.slice(1).includes(r.media_tmdb_id)).slice(0, 5001);
      else if (/FROM (movie|show) WHERE tmdb_id IN/.test(sql)) rows = f[type].filter(r => args.includes(r.tmdb_id));
      else throw new Error('Unrecognized SQL: fixture must fail closed');
      s.rowsConsumed += rows.length; s.maxRows = Math.max(s.maxRows, rows.length);
      return rows;
    } catch (e) { if (signal.aborted) s.aborted++; throw e; }
    finally { s.active--; }
  };
}
function configure(f, count = 1, options = {}) {
  seam.groups = groups(f, count);
  const s = stats(); seam.query = catalog(f, s, options); return s;
}
// Complete synthetic snapshot only. Production would require a read-only refresh,
// provenance, completeness/overflow markers and a separately reviewed reference.
function buildIndex(f) {
  const start = performance.now();
  const map = new Map();
  const catalogRows = new Map();
  const catalogs = {movie:f.snapshotMovie ?? f.movie, show:f.snapshotShow ?? f.show};
  for (const type of ['movie', 'show']) for (const row of catalogs[type]) catalogRows.set(key(type, row.tmdb_id), row);
  for (const offer of f.snapshotOffers ?? f.offers) {
    const id = reader.nativeId(offer.stream_url);
    if (!id) continue;
    if (!map.has(id)) map.set(id, new Map());
    const identity = key(offer.media_type, offer.media_tmdb_id);
    const targets = map.get(id);
    const evidence = targets.get(identity) ?? [];
    evidence.push(offer); targets.set(identity, evidence);
  }
  return { map, catalogRows, buildMs: performance.now() - start, rowsInspected: (f.snapshotOffers ?? f.offers).length + catalogs.movie.length + catalogs.show.length };
}
function indexLookup(f, index, group, signal, counters = { indexRowsInspected: 0 }) {
  if (signal?.aborted) return { state: 'unavailable', reason: 'cancelled' };
  const original = group.item.wishlistOriginal;
  if (!/^[1-9]\d{0,19}$/.test(original.wishlistEvidence.sourceId ?? '')) return { state: 'manual', reason: 'unsupported_source' };
  if (f.conflict) return { state: 'manual', reason: 'conflicting_source_evidence' };
  const targets = index.map.get(original.wishlistEvidence.sourceId);
  if (!targets?.size) return { state: 'manual', reason: 'no_native_id_match' };
  // Preserve even stale conflicts; don't turn stale conflict removal into uniqueness.
  if (targets.size !== 1) return { state: 'manual', reason: 'ambiguous_native_id' };
  const [identity, evidence] = [...targets][0];
  if (!evidence.some(e => { counters.indexRowsInspected++; return e.ageDays !== null && e.ageDays >= 0 && e.ageDays <= 30; })) return { state: 'manual', reason: 'stale_or_unknown_age' };
  const [type, id] = identity.split(':');
  counters.indexRowsInspected++;
  const row = index.catalogRows.get(`${type}:${id}`);
  if (!row || row.adult) return { state: 'manual', reason: 'missing_target' };
  if (original.year !== null && original.year !== row.release_year) return { state: 'manual', reason: 'source_metadata_conflict' };
  return { state: 'suggested', proposal: { mediaType: type, tmdbId: row.tmdb_id } };
}
function classify(f, result) {
  const proposed = result.proposal ? key(result.proposal.mediaType, result.proposal.tmdbId) : null;
  return { name: f.name, supplementary: f.supplementary ?? false, eligible: f.source.sourceId !== null, expected: f.expected, mustAbstain: f.mustAbstain ?? f.expected === null,
    state: result.state, reason: result.reason ?? null, proposed,
    correct: result.state === 'suggested' && proposed === f.expected && !f.mustAbstain,
    correctButUncertifiable: result.state === 'suggested' && f.expected === null && proposed === f.truth,
    wrong: result.state === 'suggested' && f.expected !== null && proposed !== f.expected,
    originalPolicyAbstentionViolation: result.state === 'suggested' && (f.expected === null || f.mustAbstain === true),
  };
}
function summarize(rows) {
  const e = rows.filter(r => r.eligible), proposed = e.filter(r => r.state === 'suggested');
  const correct = e.filter(r => r.correct).length, matchable = e.filter(r => r.expected && !r.mustAbstain).length;
  return { allGroups: rows.length, eligible: e.length, matchable,
    proposed: proposed.length, correct, wrong: e.filter(r => r.wrong).length, uncertified: e.filter(r => r.state === 'suggested' && r.expected === null).length,
    originalPolicyAbstentionViolation: e.filter(r => r.originalPolicyAbstentionViolation).length,
    correctButUncertifiable: e.filter(r => r.correctButUncertifiable).length,
    certifiedFraction: { numerator: correct, denominator: proposed.length, inferential: false },
    coverage: { numerator: correct, denominator: e.length }, matchableCoverage: { numerator: correct, denominator: matchable },
    ambiguity: e.filter(r => r.reason === 'ambiguous_native_id').length,
    manual: e.filter(r => r.state === 'manual').length, unavailable: e.filter(r => r.state === 'unavailable').length,
    allGroupsManual: rows.filter(r => r.state === 'manual').length,
  };
}
const semantic = { bounded: [], index: [] };
for (const f of fixtures) {
  const s = configure(f);
  const result = (await reader.getWishlistSuggestions('synthetic', 'synthetic')).groups[0];
  semantic.bounded.push({ ...classify(f, result), cost: s });
  const index = buildIndex(f);
  semantic.index.push({ ...classify(f, indexLookup(f, index, groups(f)[0])), build: { rowsInspected: index.rowsInspected, ms: index.buildMs } });
}
// Truth/cost structural checks are harness validity checks, not assertions that a route wins.
assert.equal(fixtures.length, new Set(fixtures.map(f => f.name)).size);
assert.equal(semantic.bounded.find(r => r.name === 'retired').proposed, 'movie:10679');
assert.equal(semantic.bounded.find(r => r.name === 'alias-overflow').state, 'unavailable');
assert.equal(semantic.index.find(r => r.name === 'hidden-conflict').reason, 'ambiguous_native_id');

const quantiles = a => { const v = [...a].sort((x,y) => x-y); return { n: v.length, min: v[0], p50: v[Math.ceil(v.length*.5)-1], p95: v[Math.ceil(v.length*.95)-1], max: v.at(-1) }; };
const samples = Number(process.env.BENCH_SAMPLES ?? 200);
assert.ok(Number.isSafeInteger(samples) && samples >= 200 && samples <= 2000);
const latency = {};
for (const mode of ['cold', 'warm']) {
  const elapsed = [], requests = [], rows = []; let peak = 0;
  for (let i=0; i<samples; i++) {
    const s = configure(performanceFixture, 10, { delayMs: 2 });
    const started = performance.now();
    const module = mode === 'cold' ? await loadReader() : reader;
    const result = await module.getWishlistSuggestions('synthetic', 'synthetic');
    assert.equal(result.groups.length,10); assert.ok(result.groups.every(r=>r.state==='suggested'));
    elapsed.push(performance.now()-started); requests.push(s.requests); rows.push(s.rowsConsumed); peak=Math.max(peak,s.peak);
  }
  latency[`bounded-${mode}`] = {pageMs:quantiles(elapsed),requestsPerPage:quantiles(requests),rowsConsumedPerPage:quantiles(rows),peakConcurrentReads:peak};
}
const operations = [];
for (const mode of ['pre-aborted', 'in-flight', 'failed-sibling', 'group-deadline']) {
  const controller = new AbortController();
  const s = configure(performanceFixture, 10, { stall: mode !== 'pre-aborted', failSibling: mode === 'failed-sibling' });
  if (mode === 'pre-aborted') controller.abort();
  const start = performance.now();
  const promise = reader.getWishlistSuggestions('synthetic', 'synthetic', 0, controller.signal);
  let abortAt;
  if (mode === 'in-flight') { await delay(10); abortAt = performance.now(); controller.abort(); }
  const result = await promise;
  await delay(0);
  assert.ok(result.groups.every(r => r.state === 'unavailable'));
  assert.equal(s.active, 0); assert.equal(s.startedAfterAbort, 0); assert.ok(s.peak <= 6);
  if (mode === 'pre-aborted') assert.equal(s.requests, 0);
  const durationMs = performance.now()-start;
  const abortReturnMs = abortAt ? performance.now()-abortAt : null;
  if (abortReturnMs !== null) assert.ok(abortReturnMs < 100);
  operations.push({ mode, durationMs, abortReturnMs, ...s });
}
const multi = configure(performanceFixture, 10, { delayMs: 2 });
await Promise.all(Array.from({length: 4}, () => reader.getWishlistSuggestions('synthetic', 'synthetic')));
assert.ok(multi.peak <= 24);
const cancelled = new AbortController(); cancelled.abort();
assert.equal(indexLookup(performanceFixture, buildIndex(performanceFixture), groups(performanceFixture)[0], cancelled.signal).state, 'unavailable');
const indexCancelled = { preAborted: 'unavailable', requests: 0, note: 'Synchronous small snapshot build cannot be interrupted mid-loop; only lookup pre-abort checked. No scalable cancellation claim.' };
const dense = { ...performanceFixture, offers: Array.from({length:5000}, (_, i) => performanceFixture.offers[i % 10]) };
const denseStats = configure(dense, 10);
const denseResult = await reader.getWishlistSuggestions('synthetic', 'synthetic');
assert.ok(denseResult.groups.every(r => r.state === 'suggested'));
const result = {
  densePage: { ...denseStats, suggested: denseResult.groups.length, pageRowGatePassed: denseStats.rowsConsumed <= 50000 },
  schema: 1, generatedAt: new Date().toISOString(), runtime: process.version, platform: `${process.platform}/${process.arch}`,
  sourceSha256: hash(source), fixturesSha256: hash(await readFile(resolve(here, 'fixtures.mjs'))),
  network: 'Denied fetch and net.Socket.connect; no application boot or credentials loaded',
  semantic: { bounded: summarize(semantic.bounded.filter(r => !r.supplementary)), index: summarize(semantic.index.filter(r => !r.supplementary)),
    mirrors: {bounded: summarize(semantic.bounded.filter(r => r.supplementary)), index: summarize(semantic.index.filter(r => r.supplementary))}, cases: semantic },
  latency, operations, simultaneousPages: { pages: 4, ...multi }, indexCancellation: indexCancelled,
  percentiles: 'Descriptive nearest rank only; 200+ sequential calls on one fixture per reader mode, not independent representative invocations; latency gate UNEVALUATED',
};
await writeFile(resolve(here, 'results.local.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ semantic: { bounded: result.semantic.bounded, index: result.semantic.index }, latency, operations, simultaneousPages: result.simultaneousPages }, null, 2));
// Stable semantic evidence is committed; durations and timestamps remain local.
const stable = { sourceSha256:result.sourceSha256, fixturesSha256:result.fixturesSha256, ...result.semantic, cases: Object.fromEntries(Object.entries(semantic).map(([route,rows]) => [route, rows.map(({build,...r}) => ({...r, ...(build ? {buildRowsInspected:build.rowsInspected} : {})}))])) };
await writeFile(resolve(here, 'semantic-results.json'), `${JSON.stringify(stable, null, 2)}\n`);
globalThis.fetch = originalFetch;
