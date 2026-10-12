// Standalone read-only diagnostic. stdout is PUBLIC JSON or binary framing.
// No application imports, database mutation, Qdrant, query model or search call.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';

const NAMES = ['title_table', 'term_statistics', 'word_frequencies', 'collocations',
  'name_index', 'peers', 'negation_labels', 'alternate_cuts', 'intent_examples', 'mix_vectors'];
const MiB = 1024 * 1024;
const MAX_MANIFEST = 256 * 1024;
const MAX_FILE = 256 * MiB;
const MAX_TOTAL = 512 * MiB;
const CALL_MS = 20_000;
const MODE = process.argv[2];
const START = Date.now();
const OVERALL_MS = MODE === '--manifest-only' ? 45_000 : 240_000;
const sha = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const fail = reason => { throw Object.assign(new Error(reason), { fixedReason: reason }); };
const require = (ok, reason) => { if (!ok) fail(reason); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const canonical = value => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(v => JSON.parse(canonical(v)))
    : Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))]))
  : value);

function validateManifest(m) {
  require(exact(m, ['format', 'build_id', 'created_at', 'previous_build_id', 'files', 'profiles'])
    || exact(m, ['format', 'build_id', 'created_at', 'previous_build_id', 'files', 'profiles', 'stats']), 'manifest_schema');
  // build_indexes.py:447-455 adds build.stats; index_builders.py:712-826
  // emits only these public integer counts. Pin retained stats bytes too.
  if (Object.hasOwn(m, 'stats')) {
    const allowed = new Set(['titles','persons','studios','name_keys','resolved_keys','entities','terms',
      'terms_without_id','shows_with_fallback_creators','profiles','peers','negation_labels',
      'alternate_cut_pairs','collocations','words','spell_vocabulary']);
    require(m.stats && typeof m.stats === 'object' && !Array.isArray(m.stats)
      && exact(m.stats, [...allowed])
      && Object.entries(m.stats).every(([key, value]) => allowed.has(key)
        && Number.isSafeInteger(value) && value >= 0), 'manifest_stats');
  }
  require(m.format === 1 && typeof m.build_id === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(m.build_id), 'manifest_build');
  require(typeof m.created_at === 'string' && m.created_at.length <= 64 && Number.isFinite(Date.parse(m.created_at)), 'manifest_date');
  require(m.previous_build_id === null || typeof m.previous_build_id === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(m.previous_build_id), 'manifest_previous');
  require(exact(m.files, NAMES), 'manifest_files');
  let total = 0;
  for (const name of NAMES) {
    const entry = m.files[name];
    require(exact(entry, ['sha1', 'bytes']) && /^[a-f0-9]{40}$/.test(entry.sha1)
      && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_FILE, 'manifest_file_bounds');
    total += entry.bytes;
  }
  require(total <= MAX_TOTAL, 'manifest_total_bounds');
  require(exact(m.profiles, ['collection', 'points']) && m.profiles.collection === 'search_reference_profiles'
    && Number.isSafeInteger(m.profiles.points) && m.profiles.points >= 0, 'manifest_profiles');
  return m;
}

function configuration() {
  const hosts = [...new Set((process.env.CRATE_HOSTS || '').split(',').map(v => v.trim()).filter(Boolean))];
  const port = Number(process.env.CRATE_PORT || '4200');
  require(hosts.length > 0 && hosts.length <= 8 && Number.isInteger(port) && port > 0 && port <= 65535, 'configuration');
  const origins = hosts.map(host => {
    require(/^[A-Za-z0-9.-]+$/.test(host), 'configuration_host');
    const u = new URL(`http://${host}:${port}/`);
    return u.origin;
  });
  const auth = 'Basic ' + Buffer.from(`${process.env.CRATE_USER || ''}:${process.env.CRATE_PASS || ''}`).toString('base64');
  return { origins, auth };
}

function scopedUrl(url, config, pathname) {
  require(url.protocol === 'http:' && config.origins.includes(url.origin) && !url.username && !url.password
    && !url.search && !url.hash && url.pathname === pathname, 'redirect_scope');
  return url;
}

async function open(url, method, config, body) {
  const remaining = OVERALL_MS - (Date.now() - START);
  require(remaining > 0, 'overall_timeout');
  return await new Promise((resolve, reject) => {
    const req = http.request(url, { method, agent: false, headers: {
      Authorization: config.auth, Connection: 'close',
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
    } });
    const timer = setTimeout(() => req.destroy(Object.assign(new Error('request_timeout'), { fixedReason: 'request_timeout' })), Math.min(CALL_MS, remaining));
    timer.unref();
    req.once('error', reject);
    req.once('response', res => { res.once('close', () => clearTimeout(timer)); resolve(res); });
    req.once('close', () => clearTimeout(timer));
    req.end(body);
  });
}

async function boundedBody(res, limit) {
  const chunks = []; let bytes = 0;
  for await (const chunk of res) {
    bytes += chunk.length;
    if (bytes > limit) { res.destroy(); fail('response_bound'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readManifest(config) {
  const body = JSON.stringify({ stmt: "SELECT manifest FROM search_index_builds WHERE build_id = 'current'" });
  for (let i = 0; i < config.origins.length; i++) {
    try {
      const res = await open(new URL(config.origins[i] + '/_sql'), 'POST', config, body);
      if (res.statusCode !== 200) { res.destroy(); fail('manifest_http_status'); }
      const parsed = JSON.parse((await boundedBody(res, MAX_MANIFEST)).toString('utf8'));
      require(Array.isArray(parsed.rows) && parsed.rows.length === 1 && Array.isArray(parsed.rows[0]) && parsed.rows[0].length === 1, 'manifest_rows');
      const raw = parsed.rows[0][0];
      return validateManifest(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch (error) {
      if (i === config.origins.length - 1) throw error;
    }
  }
  fail('manifest_unavailable');
}

async function write(bytes) {
  require(Date.now() - START < OVERALL_MS, 'overall_timeout');
  if (!process.stdout.write(bytes)) {
    await Promise.race([once(process.stdout, 'drain'), new Promise((_, reject) => {
      const timer = setTimeout(() => reject(Object.assign(new Error('output_timeout'), { fixedReason: 'output_timeout' })), CALL_MS);
      timer.unref();
    })]);
  }
}
async function frame(value) {
  const body = Buffer.from(canonical(value));
  require(body.length <= MAX_MANIFEST, 'frame_bound');
  const n = Buffer.alloc(4); n.writeUInt32BE(body.length);
  await write(n); await write(body);
}
async function stdin() {
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length; require(bytes <= MAX_MANIFEST, 'input_bound'); chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function download(config, manifest) {
  const identity = sha(canonical(manifest));
  require(sha(canonical(await readManifest(config))) === identity, 'manifest_changed_before');
  await write(Buffer.from('GWIDX001'));
  await frame({ schema: 'search.index-binary-header.readonly.v1', manifest, manifestSha256: identity, fileCount: NAMES.length });
  const verified = [];
  for (const name of NAMES) {
    const entry = manifest.files[name];
    const pathname = '/_blobs/search_index_files/' + entry.sha1;
    let url = new URL(config.origins[0] + pathname), res;
    for (let hop = 0; hop < 4; hop++) {
      res = await open(scopedUrl(url, config, pathname), 'GET', config);
      if (![301, 302, 307].includes(res.statusCode)) break;
      const location = res.headers.location; res.destroy();
      require(typeof location === 'string', 'redirect_missing');
      url = scopedUrl(new URL(location, url), config, pathname); res = null;
    }
    require(res && res.statusCode === 200, 'blob_http_status');
    if (res.headers['content-length'] !== undefined)
      require(String(entry.bytes) === res.headers['content-length'], 'blob_declared_size');
    await frame({ name, bytes: entry.bytes, sha1: entry.sha1 });
    const h1 = createHash('sha1'), h256 = createHash('sha256'); let bytes = 0;
    let prefix = Buffer.alloc(0);
    for await (const chunk of res) {
      bytes += chunk.length;
      if (bytes > entry.bytes) { res.destroy(); fail('blob_size'); }
      if (prefix.length < 2) prefix = Buffer.concat([prefix, chunk]).subarray(0, 2);
      h1.update(chunk); h256.update(chunk); await write(chunk);
    }
    require(bytes === entry.bytes && h1.digest('hex') === entry.sha1, 'blob_checksum_or_size');
    require(prefix[0] === 0x1f && prefix[1] === 0x8b, 'blob_gzip_header');
    verified.push({ name, bytes, sha1: entry.sha1, sha256: h256.digest('hex') });
  }
  require(sha(canonical(await readManifest(config))) === identity, 'manifest_changed_after');
  await frame({ schema: 'search.index-binary-complete.readonly.v1', complete: true, manifestSha256: identity, files: verified });
  await write(Buffer.from('GWIDXEND'));
}

try {
  require(process.argv.length === 3 && ['--manifest-only', '--download-pinned'].includes(MODE), 'explicit_mode');
  const config = configuration();
  if (MODE === '--manifest-only') {
    const manifest = await readManifest(config);
    await write(Buffer.from(canonical({ schema: 'search.index-manifest.readonly.v1', manifest,
      manifestSha256: sha(canonical(manifest)), totalCompressedBytes: NAMES.reduce((s, n) => s + manifest.files[n].bytes, 0) }) + '\n'));
  } else {
    const record = await stdin();
    require(exact(record, ['schema', 'manifest', 'manifestSha256', 'totalCompressedBytes'])
      && record.schema === 'search.index-manifest.readonly.v1', 'input_schema');
    const manifest = validateManifest(record.manifest);
    require(record.manifestSha256 === sha(canonical(manifest))
      && record.totalCompressedBytes === NAMES.reduce((s, n) => s + manifest.files[n].bytes, 0), 'input_identity');
    await download(config, manifest);
  }
} catch (error) {
  process.stderr.write(JSON.stringify({ schema: 'search.index-readonly-refusal.v1', complete: false,
    reason: typeof error?.fixedReason === 'string' ? error.fixedReason : 'readonly_transport_or_parse_failed' }) + '\n');
  process.exitCode = 1;
}
