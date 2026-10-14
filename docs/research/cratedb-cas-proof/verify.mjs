import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Endpoints and Docker targets are intentionally fixed to this local project.
const directory = fileURLToPath(new URL('.', import.meta.url));
const dockerHost = process.env.DOCKER_HOST;
assert.ok(/^unix:\/\/(\/run\/user\/\d+\/docker\.sock|\/var\/run\/docker\.sock)$/.test(dockerHost ?? ''),
  'Use run.sh with a local Unix Docker socket');
const endpoints = [15430, 15431, 15432].map(port => `http://127.0.0.1:${port}/_sql`);
const table = 'doc.cas_proof_530';
const observations = { startedAt: new Date().toISOString(), tests: {} };
const output = process.argv[2];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const compose = (...args) => execFileSync('docker', [
  '--host', dockerHost, 'compose', '-f', `${directory}compose.yaml`, '-p', 'goodwatch-cas-530', ...args,
], { encoding: 'utf8', timeout: 60000 });

async function sql(stmt, args = [], node = 0, timeout = 30000) {
  try {
    const response = await fetch(endpoints[node], {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stmt, args }), signal: AbortSignal.timeout(timeout),
    });
    return { status: response.status, ...await response.json() };
  } catch (error) {
    return { transportError: error.message };
  }
}
function ok(result) {
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.transportError, undefined, JSON.stringify(result));
  assert.equal(result.status, 200, JSON.stringify(result));
  return result;
}
async function waitFor(label, check, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
function record(name, value) {
  observations.tests[name] = value;
  console.log(`${name}: ${JSON.stringify(value)}`);
}
const read = (id, node = 0, timeout = 30000) => sql(`SELECT id, n, used_at, op, _seq_no, _primary_term FROM ${table} WHERE id = ?`, [id], node, timeout);
const insert = id => sql(`INSERT INTO ${table} (id, n) VALUES (?, 0)`, [id]);
const refresh = () => sql(`REFRESH TABLE ${table}`);
const rowcounts = results => results.map(result => ok(result).rowcount);
const race = make => Promise.all(Array.from({ length: 24 }, (_, i) => make(i, i % 3)));

try {
  await waitFor('three local nodes', async () => {
    const result = await sql('SELECT name, version[\'number\'] FROM sys.nodes ORDER BY name');
    return result.rows?.length === 3;
  });
  observations.nodes = ok(await sql('SELECT name, version[\'number\'] FROM sys.nodes ORDER BY name')).rows;
  assert.deepEqual(observations.nodes, ['node1', 'node2', 'node3'].map(name => [name, '5.10.12']));
  observations.image = compose('images', '--format', 'json');
  ok(await sql(`CREATE TABLE ${table} (
    id TEXT PRIMARY KEY, n INTEGER, used_at TIMESTAMPTZ, op TEXT
  ) CLUSTERED INTO 1 SHARDS WITH (
    number_of_replicas = '2', refresh_interval = -1,
    "write.wait_for_active_shards" = 1, "translog.durability" = 'REQUEST'
  )`));
  await waitFor('three started shard copies', async () => {
    const result = await sql("SELECT count(*) FROM sys.shards WHERE table_name = 'cas_proof_530' AND state = 'STARTED'");
    return result.rows?.[0]?.[0] === 3;
  });
  observations.settings = ok(await sql("SELECT settings FROM information_schema.tables WHERE table_name = 'cas_proof_530'")).rows;

  ok(await insert('get'));
  const plan = ok(await sql(`EXPLAIN SELECT * FROM ${table} WHERE id = ? AND used_at IS NULL`, ['get']));
  const before = ok(await sql(`SELECT * FROM ${table} WHERE n = 0`));
  const getAcrossNodes = await Promise.all(endpoints.map((_, node) => sql(
    `SELECT id, n FROM ${table} WHERE id = ? AND n = 0 AND used_at IS NULL`, ['get'], node,
  )));
  getAcrossNodes.forEach(result => assert.equal(ok(result).rowcount, 1));
  ok(await sql(`UPDATE ${table} SET used_at = 1 WHERE id = ?`, ['get']));
  const filtered = ok(await sql(`SELECT id FROM ${table} WHERE id = ? AND used_at IS NULL`, ['get']));
  assert.equal(before.rowcount, 0);
  assert.equal(filtered.rowcount, 0);
  record('realtime_extra_predicates', { plan: plan.rows, nonPkBeforeRefresh: before.rowcount,
    getAcrossNodes: rowcounts(getAcrossNodes), afterUpdateFalsePredicate: filtered.rowcount });

  const casRounds = [];
  for (let round = 0; round < 20; round++) {
    const id = `cas-${round}`;
    ok(await insert(id));
    const row = ok(await read(id)).rows[0];
    const counts = rowcounts(await race((i, node) => sql(
      `UPDATE ${table} SET n = n + 1, op = ? WHERE id = ? AND _seq_no = ? AND _primary_term = ?`,
      [`cas-${i}`, id, row[4], row[5]], node,
    )));
    assert.equal(counts.filter(count => count === 1).length, 1);
    assert.equal(counts.filter(count => count === 0).length, 23);
    assert.equal(ok(await read(id)).rows[0][1], 1);
    casRounds.push(counts);
  }
  record('cas_update', { contenders: 24, rounds: casRounds });
  const casBusinessPredicate = await sql(
    `UPDATE ${table} SET n = 2 WHERE id = ? AND _seq_no = ? AND _primary_term = ? AND used_at IS NULL`,
    ['cas-0', ...ok(await read('cas-0')).rows[0].slice(4)],
  );
  record('cas_extra_predicate', casBusinessPredicate);

  ok(await insert('unsafe-unrefreshed'));
  const missed = ok(await sql(`UPDATE ${table} SET used_at = 1 WHERE id = ? AND used_at IS NULL`, ['unsafe-unrefreshed']));
  assert.equal(missed.rowcount, 0);
  const unsafeRounds = [];
  for (let round = 0; round < 10; round++) {
    const id = `unsafe-${round}`;
    ok(await insert(id));
    ok(await refresh());
    const counts = rowcounts(await race((i, node) => sql(
      `UPDATE ${table} SET used_at = ?, n = n + 1 WHERE id = ? AND used_at IS NULL`, [i + 1, id], node,
    )));
    const final = ok(await read(id)).rows[0];
    assert.ok(counts.filter(count => count === 1).length > 1);
    unsafeRounds.push({ counts, finalN: final[1] });
  }
  record('update_by_query', { explain: await sql(
    `EXPLAIN UPDATE ${table} SET used_at = 1 WHERE id = ? AND used_at IS NULL`, ['unsafe-0'],
  ), missedBeforeRefresh: missed.rowcount, rounds: unsafeRounds });

  const deleteRounds = [];
  const casDeleteRounds = [];
  for (let round = 0; round < 10; round++) {
    const id = `delete-${round}`;
    ok(await insert(id));
    const counts = rowcounts(await race((_, node) => sql(`DELETE FROM ${table} WHERE id = ?`, [id], node)));
    assert.equal(counts.filter(count => count === 1).length, 1);
    assert.equal(counts.filter(count => count === 0).length, 23);
    assert.equal(ok(await read(id)).rowcount, 0);
    deleteRounds.push(counts);
    const casId = `cas-delete-${round}`;
    ok(await insert(casId));
    const row = ok(await read(casId)).rows[0];
    const casCounts = rowcounts(await race((_, node) => sql(
      `DELETE FROM ${table} WHERE id = ? AND _seq_no = ? AND _primary_term = ?`, [casId, row[4], row[5]], node,
    )));
    assert.equal(casCounts.filter(count => count === 1).length, 1);
    assert.equal(casCounts.filter(count => count === 0).length, 23);
    casDeleteRounds.push(casCounts);
  }
  record('delete_by_id', { explain: await sql(`EXPLAIN DELETE FROM ${table} WHERE id = ?`, ['x']),
    rounds: deleteRounds, casRounds: casDeleteRounds, returning: await sql(`DELETE FROM ${table} WHERE id = ? RETURNING id`, ['x']) });

  const insertRounds = [];
  const conflictRounds = [];
  for (let round = 0; round < 10; round++) {
    const results = await race((_, node) => sql(`INSERT INTO ${table} (id, n) VALUES (?, 0)`, [`insert-${round}`], node));
    assert.equal(results.filter(result => result.rowcount === 1).length, 1);
    assert.equal(results.filter(result => result.error?.code === 4091).length, 23);
    insertRounds.push({ winners: 1, duplicateErrors: results.filter(result => result.error).map(result => ({ status: result.status, code: result.error.code })) });
    const counts = rowcounts(await race((_, node) => sql(
      `INSERT INTO ${table} (id, n) VALUES (?, 0) ON CONFLICT DO NOTHING`, [`conflict-${round}`], node,
    )));
    assert.equal(counts.filter(count => count === 1).length, 1);
    assert.equal(counts.filter(count => count === 0).length, 23);
    conflictRounds.push(counts);
  }
  record('inserts', { duplicateExample: await insert('insert-0'), rounds: insertRounds, doNothingRounds: conflictRounds });

  // Hold one replica's acknowledgement, observe application on the primary,
  // and stop that primary while the original request is demonstrably pending.
  // The SQL coordinator is the other replica, so its HTTP connection survives.
  const failoverRounds = [];
  observations.tests.primary_failover = { rounds: failoverRounds };
  for (let round = 0; round < 6; round++) {
    const kind = round < 3 ? 'update' : 'delete';
    const placement = ok(await sql("SELECT primary, node['name'] FROM sys.shards WHERE table_name = 'cas_proof_530' AND state = 'STARTED' ORDER BY primary DESC")).rows;
    assert.equal(placement.length, 3);
    const primary = placement.find(row => row[0])[1];
    const replicas = placement.filter(row => !row[0]).map(row => row[1]);
    const coordinator = Number(replicas[0].slice(-1)) - 1;
    const primaryIndex = Number(primary.slice(-1)) - 1;
    const heldReplica = replicas[1];
    const id = `failover-${round}`;
    ok(await insert(id));
    const original = ok(await read(id)).rows[0];
    const stmt = kind === 'update'
      ? `UPDATE ${table} SET n = n + 1, op = ? WHERE id = ? AND _seq_no = ? AND _primary_term = ?`
      : `DELETE FROM ${table} WHERE id = ? AND _seq_no = ? AND _primary_term = ?`;
    const args = kind === 'update'
      ? [`operation-${round}`, id, original[4], original[5]] : [id, original[4], original[5]];
    compose('pause', heldReplica);
    let settled = false;
    const started = Date.now();
    const pending = sql(stmt, args, coordinator, 90000).then(result => { settled = true; return result; });
    let applied;
    await waitFor('mutation visible before acknowledgement', async () => {
      // PK Get may choose a replica even through the primary's HTTP endpoint.
      // Bound each poll, and retain the successful read instead of re-reading
      // while one replica is paused.
      const result = await read(id, primaryIndex, 1000);
      const visible = kind === 'update' ? result.rows?.[0]?.[1] === 1 : result.rowcount === 0;
      if (visible) applied = ok(result);
      return visible;
    }, 20000);
    const beforeStop = { pending: !settled, rows: applied.rows };
    assert.equal(beforeStop.pending, true);
    compose('stop', '--timeout', '0', primary);
    compose('unpause', heldReplica);
    await waitFor('primary promoted on surviving coordinator', async () => {
      const result = await sql("SELECT node['name'] FROM sys.shards WHERE table_name = 'cas_proof_530' AND primary = true AND state = 'STARTED'", [], coordinator);
      return result.rows?.[0]?.[0] !== primary && result.rows?.length === 1;
    });
    const originalResponse = await pending;
    const retried = ok(await sql(stmt, args, coordinator));
    const final = ok(await read(id, coordinator));
    assert.equal(retried.rowcount, 0);
    if (kind === 'update') {
      assert.equal(final.rows[0][1], 1);
      assert.equal(final.rows[0][3], args[0]);
    } else {
      assert.equal(final.rowcount, 0);
    }
    failoverRounds.push({ kind, placement, primary, coordinator: replicas[0], heldReplica,
      beforeStop, originalResponse, retryResponse: retried, final, elapsedMs: Date.now() - started });
    console.log(`primary_failover_round: ${JSON.stringify(failoverRounds.at(-1))}`);
    compose('start', primary);
    await waitFor('all shard copies recovered', async () => {
      const result = await sql("SELECT count(*) FROM sys.shards WHERE table_name = 'cas_proof_530' AND state = 'STARTED'", [], coordinator);
      return result.rows?.[0]?.[0] === 3;
    });
  }
  record('primary_failover', { rounds: failoverRounds });
  observations.finishedAt = new Date().toISOString();
  observations.passed = true;
} catch (error) {
  observations.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
  console.error(error);
} finally {
  writeFileSync(output, `${JSON.stringify(observations, null, 2)}\n`);
}
