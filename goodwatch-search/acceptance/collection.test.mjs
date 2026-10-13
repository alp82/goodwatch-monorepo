import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDockerLine } from './events.mjs';
import { Journal } from './collect.mjs';
import { verifyLifecycle } from './lifecycle.mjs';
const sha = 'a'.repeat(40), cid = 'b'.repeat(64), rotated = 'c'.repeat(64);
const start = '2026-10-11T12:00:00.000Z', end = '2026-10-18T12:00:00.000Z';
const id = '12345678-1234-1234-1234-123456789012';
const options = { start, end, expectedCommit: sha, now: Date.parse(end) };
const source = { role: 'a', containerId: cid };
const base = { event: 'search.lifecycle.v1', at: '2026-10-11T12:01:00.000Z', id, role: 'search', commit: sha, phase: 'accepted' };
const done = { ...base, at: '2026-10-11T12:01:01.000Z', phase: 'finished', status: 'completed', firstResultsMs: 200, computationMs: 800, lifetimeMs: 1000, titleLookupFailed: false, descriptionFailed: false };
const event = (data, from = source) => parseDockerLine(`${data.at} ${JSON.stringify(data)}`, from).record;
const beats = [];
for (let at = Date.parse(start); at <= Date.parse(end); at += 30000) beats.push({ type: 'collector.heartbeat', at: new Date(at).toISOString(), roles: ['a', 'b'].map(role => ({ role, containerId: cid, running: true, commit: sha })) });
const good = [...beats, event(base), event(done), event({ event: 'search.history-write.v1', at: done.at, recorded: true })];
test('allowlist removes query/accounts/errors/headers and ignores unrelated logs', () => {
  const parsed = parseDockerLine(`${base.at} ${JSON.stringify({ ...base, text: 'secret-query', accountId: 'secret-account', error: 'secret-error', authorization: 'secret-key' })}`, source);
  assert.deepEqual(parsed.record.data, base);
  assert.equal(JSON.stringify(parsed).includes('secret'), false);
  assert.deepEqual(parseDockerLine(`${base.at} private arbitrary output`, source), { ignored: true });
  assert.deepEqual(parseDockerLine(`${base.at} ${JSON.stringify({ ...done, firstResultsMs: '10' })}`, source), { malformed: true });
});
test('durable replay deduplicates after restart and retains rotated sources and unlinked acknowledgements', () => {
  const directory = mkdtempSync(join(tmpdir(), 'search-collection-test-'));
  try {
    let journal = new Journal(directory);
    const accepted = event({ ...base, query: 'never persist me' });
    assert.equal(journal.append(accepted), true); journal.close();
    journal = new Journal(directory);
    assert.equal(journal.append(accepted), false);
    assert.equal(journal.append(event(done, { ...source, containerId: rotated })), true);
    assert.equal(journal.append(event({ event: 'search.rejection.v1', at: done.at, reason: 'busy' })), true);
    journal.close();
    const records = readFileSync(join(directory, 'events.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 3);
    assert.equal(records[1].source.containerId, rotated);
    assert.equal(JSON.stringify(records).includes('never persist me'), false);
    appendFileSync(join(directory, 'events.ndjson'), '{');
    assert.throws(() => new Journal(directory), /incomplete/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('complete role lifecycle can pass internal checks but never asserts ingress-wide acceptance', () => {
  const result = verifyLifecycle(good, options);
  assert.equal(result.lifecycle_acceptance_pass, true);
  assert.equal(result.first_results.p95_nearest_rank_ms, 200);
  assert.equal(result.seven_day_acceptance_pass, false);
});
test('a sanitizer-admissible completed request missing computation fails the seven-day lifecycle audit', () => {
  const completed = event({ ...done, computationMs: null });
  assert.ok(completed, 'null computation is accepted by the collector sanitizer');
  const result = verifyLifecycle([...beats, event(base), completed, event({ event: 'search.history-write.v1', at: done.at, recorded: true })], options);
  assert.equal(result.checks.completed_rows_have_computation, false);
  assert.equal(result.missing_completed_computation_count, 1);
  assert.equal(result.full_search_computation.n, 0);
  assert.equal(result.lifecycle_acceptance_pass, false);
});
test('completed computation requires a finite nonnegative number, including legitimate zero', () => {
  const withComputation = computationMs => [...beats, event(base), { type: 'telemetry', data: { ...done, computationMs } }, event({ event: 'search.history-write.v1', at: done.at, recorded: true })];
  // These malformed values normally fail collector sanitization; direct verifier inputs must not count them either.
  for (const value of [undefined, NaN, Infinity, -1]) {
    const result = verifyLifecycle(withComputation(value), options);
    assert.equal(result.checks.completed_rows_have_computation, false);
    assert.equal(result.missing_completed_computation_count, 1);
    assert.equal(result.full_search_computation.n, 0);
    assert.equal(result.lifecycle_acceptance_pass, false);
  }
  for (const value of [0, 800]) {
    const completed = event({ ...done, computationMs: value });
    assert.ok(completed);
    const result = verifyLifecycle([...beats, event(base), completed, event({ event: 'search.history-write.v1', at: done.at, recorded: true })], options);
    assert.equal(result.checks.completed_rows_have_computation, true);
    assert.equal(result.missing_completed_computation_count, 0);
    assert.equal(result.full_search_computation.n, 1);
    assert.equal(result.full_search_computation.p95_nearest_rank_ms, value);
    assert.equal(result.lifecycle_acceptance_pass, true);
  }
});
test('failed and aborted requests without computation remain excluded from full-completion samples', () => {
  for (const status of ['failed', 'aborted']) {
    const result = verifyLifecycle([...beats, event(base), event({ ...done, status, computationMs: null }), event({ event: 'search.history-write.v1', at: done.at, recorded: true })], options);
    assert.equal(result.checks.completed_rows_have_computation, true);
    assert.equal(result.missing_completed_computation_count, 0);
    assert.equal(result.full_search_computation.n, 0);
    assert.equal(result.failed_requests, status === 'failed' ? 1 : 0);
    assert.equal(result.aborted_requests, status === 'aborted' ? 1 : 0);
  }
});
test('missing finish, late failure, lookup warnings and failed history each block coverage', () => {
  assert.equal(verifyLifecycle([...beats, event(base)], options).checks.no_missing_finished_events, false);
  for (const changed of [{ status: 'failed' }, { titleLookupFailed: true }, { firstResultsMs: null }]) {
    assert.equal(verifyLifecycle([...beats, event(base), event({ ...done, ...changed })], options).lifecycle_acceptance_pass, false);
  }
  assert.equal(verifyLifecycle([...good, event({ event: 'search.history-write.v1', at: done.at, recorded: false })], options).checks.no_failed_history_writes, false);
});
test('aborted delivered searches contribute first-results timing and have no full completion sample', () => {
  const result = verifyLifecycle([...beats, event(base), event({ ...done, status: 'aborted', firstResultsMs: 1500, computationMs: null })], options);
  assert.equal(result.first_results.p95_nearest_rank_ms, 1500);
  assert.equal(result.checks.first_results_p95_below_1500, false);
  assert.equal(result.full_search_computation.n, 0);
});
test('finished beyond end belongs to accepted cohort while accepted beyond end does not', () => {
  const accepted = { ...base, at: '2026-10-18T11:59:59Z' };
  const finished = { ...done, at: '2026-10-18T12:00:01Z' };
  const result = verifyLifecycle([...beats, event(accepted), event(finished), event({ ...base, at: end, id: '87654321-1234-1234-1234-123456789012' })], options);
  assert.equal(result.accepted_requests, 1); assert.equal(result.finished_requests, 1);
});
test('collector gaps, missing fences, wrong commit and admission rejection block acceptance', () => {
  assert.equal(verifyLifecycle(good.filter(r => r.type !== 'collector.heartbeat' || r.at < '2026-10-12T00:00:00Z' || r.at > '2026-10-13T00:00:00Z'), options).checks.no_heartbeat_gaps, false);
  assert.equal(verifyLifecycle(good.filter(r => r.at !== start), options).checks.heartbeat_fences_complete, false);
  assert.equal(verifyLifecycle([...good, { type: 'collector.problem', at: done.at, kind: 'docker_inspect', role: 'a' }], options).checks.no_collector_problems, false);
  assert.equal(verifyLifecycle([...beats, event({ ...base, commit: 'd'.repeat(40) }), event(done)], options).checks.expected_commit_only, false);
  assert.equal(verifyLifecycle([...good, event({ event: 'search.rejection.v1', at: done.at, reason: 'busy' })], options).checks.no_admission_rejections, false);
});
test('replayed journal records are deduped but conflicting repeated lifecycle phase blocks acceptance', () => {
  assert.equal(verifyLifecycle([...good, event(base)], options).checks.no_duplicate_lifecycle_phases, true);
  assert.equal(verifyLifecycle([...good, event({ ...base, at: '2026-10-11T12:01:00.001Z' })], options).checks.no_duplicate_lifecycle_phases, false);
});

test('collector follows real child streams, survives a container replacement and resumes with dedupe', async () => {
  const { writeFileSync, chmodSync } = await import('node:fs');
  const { spawn } = await import('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'search-collector-integration-'));
  const evidence = join(directory, 'evidence'), state = join(directory, 'state');
  const executable = join(directory, 'docker');
  writeFileSync(state, 'first');
  writeFileSync(executable, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2), last = args.at(-1);
if (args[0] === 'inspect') {
 const rotated = last.endsWith('-a') && readFileSync(process.env.FAKE_STATE,'utf8') === 'second';
 console.log(JSON.stringify({containerId: rotated ? '${rotated}' : '${cid}', startedAt:'${start}', running:true, commit:'${sha}'}));
} else {
 const data = last === '${rotated}' ? ${JSON.stringify(done)} : ${JSON.stringify(base)};
 console.log(data.at+' '+JSON.stringify({...data,query:'private text not for disk'}));
 console.error('unrelated secret stderr');
 setInterval(()=>{},1000);
}
`);
  chmodSync(executable, 0o700);
  const launch = () => spawn(process.execPath, ['--input-type=module', '-e', `import {collect} from ${JSON.stringify(new URL('./collect.mjs', import.meta.url).href)}; await collect(${JSON.stringify(evidence)},${JSON.stringify(start)},{pollMs:25});`], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, FAKE_STATE: state }, stdio: 'ignore' });
  const journal = () => { try { return readFileSync(join(evidence, 'events.ndjson'), 'utf8').split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } };
  const wait = async predicate => { for (let i=0;i<200;i++) { if (predicate()) return; await new Promise(done=>setTimeout(done,25)); } throw new Error('Fake collector did not reach expected state'); };
  const stop = child => new Promise(resolve => { child.once('close', resolve); child.kill('SIGTERM'); });
  let child = launch();
  try {
    await wait(()=>journal().some(r=>r.type==='telemetry' && r.data.phase==='accepted'));
    writeFileSync(state,'second');
    await wait(()=>journal().some(r=>r.type==='telemetry' && r.source.containerId===rotated && r.data.phase==='finished'));
    await stop(child);
    const before = journal().filter(r=>r.type==='telemetry').length;
    child = launch();
    await wait(()=>journal().filter(r=>r.type==='collector.started').length===2);
    await new Promise(done=>setTimeout(done,200));
    await stop(child);
    assert.equal(journal().filter(r=>r.type==='telemetry').length,before);
    assert.equal(readFileSync(join(evidence,'events.ndjson'),'utf8').includes('private text'),false);
    assert.equal(readFileSync(join(evidence,'events.ndjson'),'utf8').includes('secret stderr'),false);
    assert.ok(journal().some(r=>r.type==='collector.heartbeat'));
  } finally { child.kill('SIGKILL'); rmSync(directory,{recursive:true,force:true}); }
});

test('an open window or short collector restart fails even with complete-looking replay', () => {
  assert.equal(verifyLifecycle(good, { ...options, now: Date.parse(start) }).checks.window_closed, false);
  assert.equal(verifyLifecycle([...good, { type: 'collector.started', at: done.at, since: start }], options).checks.no_collector_restarts_inside_window, false);
});

test('a delivered request without any history acknowledgement cannot pass storage coverage', () => {
  const result = verifyLifecycle([...beats, event(base), event(done)], options);
  assert.equal(result.checks.enough_history_acknowledgements_for_delivered_cohort, false);
});

const lateAccepted = { ...base, at: '2026-10-18T11:59:59.000Z' };
const lateFinished = { ...done, at: '2026-10-18T12:00:05.000Z' };
const drainHeartbeat = { ...beats.at(-1), at: '2026-10-18T12:00:06.000Z' };
const drained = [...beats, event(lateAccepted), event(lateFinished), drainHeartbeat];
const drainedOptions = { ...options, now: Date.parse(drainHeartbeat.at) };
test('failed history write after END before cohort finishes blocks acceptance', () => {
  const result = verifyLifecycle([...drained, event({ event: 'search.history-write.v1', at: '2026-10-18T12:00:02.000Z', recorded: false })], drainedOptions);
  assert.equal(result.checks.no_failed_history_writes, false);
  assert.equal(result.history_acknowledgements.failed, 1);
});
test('drain needs heartbeat coverage and excludes unrelated acknowledgements after its cutoff', () => {
  const result = verifyLifecycle([...drained, event({ event: 'search.history-write.v1', at: drainHeartbeat.at, recorded: true })], drainedOptions);
  assert.equal(result.checks.enough_history_acknowledgements_for_delivered_cohort, false);
  assert.equal(result.history_acknowledgements.including_after_window_end, 0);
  assert.equal(verifyLifecycle(drained.filter(r => r !== drainHeartbeat), drainedOptions).checks.heartbeat_fences_complete, false);
});
test('collection problems and collector restart during cohort drain block acceptance', () => {
  const at = '2026-10-18T12:00:02.000Z';
  assert.equal(verifyLifecycle([...drained, { type: 'collector.problem', at, kind: 'docker_inspect', role: 'a' }], drainedOptions).checks.no_collector_problems, false);
  assert.equal(verifyLifecycle([...drained, { type: 'collector.started', at, since: start }], drainedOptions).checks.no_collector_restarts_inside_window, false);
});

test('timestamps cannot carry arbitrary private text; Docker nanoseconds remain accepted', () => {
  const malicious = { ...base, at: base.at + ' (private query)' };
  assert.deepEqual(parseDockerLine(`${base.at} ${JSON.stringify(malicious)}`, source), { malformed: true });
  assert.deepEqual(parseDockerLine(`${base.at} (private query) ${JSON.stringify(base)}`, source), { ignored: true });
  const nanos = parseDockerLine(`2026-10-11T12:01:00.123456789Z ${JSON.stringify(base)}`, source);
  assert.ok(nanos.record);
  assert.equal(JSON.stringify(nanos).includes('private query'), false);
});
