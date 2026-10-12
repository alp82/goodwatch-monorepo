import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { once } from 'node:events';
const script = new URL('./read-index.mjs', import.meta.url).pathname;
const names = ['title_table','term_statistics','word_frequencies','collocations','name_index','peers','negation_labels','alternate_cuts','intent_examples','mix_vectors'];
async function fixture(run, mutate = () => {}) {
  const blobs = new Map(), calls = [];
  const files = Object.fromEntries(names.map(name => {
    const b = gzipSync(Buffer.from(JSON.stringify({ publicFixture: name })));
    const sha1 = createHash('sha1').update(b).digest('hex'); blobs.set(sha1, b);
    return [name, { sha1, bytes: b.length }];
  }));
  const manifest = { format: 1, build_id: 'fixture-v1', created_at: '2026-10-13T00:00:00Z', previous_build_id: null, files,
    profiles: { collection: 'search_reference_profiles', points: 0 } };
  const server = http.createServer(async (req, res) => {
    calls.push({ method: req.method, path: req.url });
    if (req.url === '/_sql') {
      const chunks = []; for await (const c of req) chunks.push(c);
      assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { stmt: "SELECT manifest FROM search_index_builds WHERE build_id = 'current'" });
      res.end(JSON.stringify({ rows: [[manifest]] }));
    } else {
      if (mutate(req, res, blobs) === true) return;
      const b = blobs.get(req.url.split('/').at(-1));
      if (!b) { res.writeHead(404); res.end(); } else res.end(b);
    }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const env = { PATH: process.env.PATH, CRATE_HOSTS: '127.0.0.1', CRATE_PORT: String(server.address().port), CRATE_USER: 'fixture', CRATE_PASS: 'fixture-private-value' };
  async function child(mode, input = '') {
    const c = spawn(process.execPath, [script, mode], { env }); const stdout = [], stderr = [];
    c.stdout.on('data', b => stdout.push(b)); c.stderr.on('data', b => stderr.push(b)); c.stdin.end(input);
    const [code, signal] = await once(c, 'close'); return { code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) };
  }
  try { await run({ child, calls, manifest }); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('manifest-only performs exactly fixed SELECT and no blob GET; pinned all-ten stream ends verified', async () => {
  await fixture(async ({ child, calls }) => {
    const first = await child('--manifest-only'); assert.equal(first.code, 0); assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { method: 'POST', path: '/_sql' });
    const second = await child('--download-pinned', first.stdout); assert.equal(second.code, 0);
    assert.equal(second.stdout.subarray(0, 8).toString(), 'GWIDX001'); assert.equal(second.stdout.subarray(-8).toString(), 'GWIDXEND');
    assert.equal(calls.filter(x => x.method === 'GET').length, 10);
    let at = 8;
    const frame = () => { const n = second.stdout.readUInt32BE(at); at += 4; const value = JSON.parse(second.stdout.subarray(at, at + n)); at += n; return value; };
    const header = frame(); assert.equal(header.fileCount, 10);
    for (const name of names) { const f = frame(); assert.equal(f.name, name); const bytes = second.stdout.subarray(at, at + f.bytes); at += f.bytes;
      assert.equal(createHash('sha1').update(bytes).digest('hex'), f.sha1); }
    const terminal = frame(); assert.equal(terminal.complete, true); assert.equal(terminal.files.length, 10); assert.equal(at + 8, second.stdout.length);
    assert.equal(second.stdout.includes(Buffer.from('fixture-private-value')), false);
  });
});
test('redirect outside exact configured origins refuses; no terminal complete frame', async () => {
  await fixture(async ({ child }) => {
    const first = await child('--manifest-only'), second = await child('--download-pinned', first.stdout);
    assert.equal(second.code, 1); assert.equal(second.stdout.subarray(-8).toString() === 'GWIDXEND', false);
    assert.equal(JSON.parse(second.stderr).reason, 'redirect_scope');
  }, (req, res) => { res.writeHead(307, { Location: 'http://localhost:1' + req.url }); res.end(); return true; });
});
test('wrong blob checksum or declared size cannot emit complete terminal receipt', async () => {
  await fixture(async ({ child }) => {
    const first = await child('--manifest-only'), second = await child('--download-pinned', first.stdout);
    assert.equal(second.code, 1); assert.equal(second.stdout.subarray(-8).toString() === 'GWIDXEND', false);
    assert.ok(['blob_declared_size', 'blob_checksum_or_size'].includes(JSON.parse(second.stderr).reason));
  }, (req, res, blobs) => { const original = blobs.get(req.url.split('/').at(-1)); const wrong = Buffer.from(original); wrong[wrong.length - 1] ^= 1; res.end(wrong); return true; });
});
test('altered pinned manifest refuses before any GET', async () => {
  await fixture(async ({ child, calls }) => {
    const first = await child('--manifest-only'), value = JSON.parse(first.stdout); value.manifest.build_id = 'changed';
    const second = await child('--download-pinned', JSON.stringify(value)); assert.equal(second.code, 1); assert.equal(second.stdout.length, 0);
    assert.equal(calls.filter(x => x.method === 'GET').length, 0); assert.equal(JSON.parse(second.stderr).reason, 'input_identity');
  });
});
