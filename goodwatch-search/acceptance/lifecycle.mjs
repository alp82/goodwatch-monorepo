import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { iso, commit } from './events.mjs';
import { percentile, SEVEN_DAYS } from './history.mjs';
export function verifyLifecycle(records, { start, end, expectedCommit, maxHeartbeatGapMs = 45000, now = Date.now() }) {
  if (!iso(start) || !iso(end) || !commit(expectedCommit)) throw new Error('Explicit UTC window and deployed full SHA required');
  const lo = Date.parse(start), hi = Date.parse(end);
  if (hi <= lo) throw new Error('Invalid window');
  const times = [], full = [], accepted = new Map(), finished = new Map(), duplicates = [], heartbeats = [], problems = [];
  let collectorRestarts = 0, deliveredCohort = 0, acknowledgementsAfterStart = 0;
  let historySucceeded = 0, historyFailed = 0, rejections = 0, failed = 0, aborted = 0, warningRows = 0, missingFirst = 0, wrongCommit = 0;
  const keys = new Set();
  for (const record of records) {
    if (record.key) { if (keys.has(record.key)) continue; keys.add(record.key); }
    const at = Date.parse(record.at ?? record.data?.at);
    if (record.type === 'collector.started' && at > lo && at < hi) collectorRestarts++;
    if (record.type === 'collector.heartbeat') heartbeats.push(record);
    if (record.type === 'collector.problem' && at >= lo && at < hi) problems.push({ at: record.at, kind: record.kind, role: record.role });
    if (record.type !== 'telemetry') continue;
    const event = record.data;
    if (event.event === 'search.lifecycle.v1') {
      if (event.phase === 'accepted' && at >= lo && at < hi) {
        if (accepted.has(event.id)) duplicates.push(event.id);
        accepted.set(event.id, event);
        if (event.commit !== expectedCommit) wrongCommit++;
      }
      if (event.phase === 'finished') {
        if (finished.has(event.id)) duplicates.push(event.id);
        finished.set(event.id, event);
      }
    }
    if (at >= lo && event.event === 'search.history-write.v1') acknowledgementsAfterStart++;
    if (at >= lo && at < hi) {
      if (event.event === 'search.rejection.v1') rejections++;
      if (event.event === 'search.history-write.v1') event.recorded ? historySucceeded++ : historyFailed++;
    }
  }
  const unfinished = [];
  for (const [id, begun] of accepted) {
    const done = finished.get(id);
    if (!done || Date.parse(done.at) < Date.parse(begun.at)) { unfinished.push(id); continue; }
    if (done.commit !== expectedCommit) wrongCommit++;
    if (done.status === 'failed') failed++;
    if (done.status === 'aborted') aborted++;
    if (done.titleLookupFailed || done.descriptionFailed) warningRows++;
    if (done.firstResultsMs !== null) { times.push(done.firstResultsMs); deliveredCohort++; }
    else if (done.status === 'completed') missingFirst++;
    if (done.status === 'completed' && done.computationMs !== null) full.push(done.computationMs);
  }
  heartbeats.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  // A heartbeat before the beginning and after the end fence the whole observation window.
  const before = heartbeats.filter(h => Date.parse(h.at) <= lo).at(-1);
  const after = heartbeats.find(h => Date.parse(h.at) >= hi);
  const fenced = before && after ? heartbeats.filter(h => Date.parse(h.at) >= Date.parse(before.at) && Date.parse(h.at) <= Date.parse(after.at)) : [];
  const gaps = [];
  for (let i = 1; i < fenced.length; i++) {
    const elapsed = Date.parse(fenced[i].at) - Date.parse(fenced[i - 1].at);
    if (elapsed > maxHeartbeatGapMs) gaps.push({ from: fenced[i - 1].at, to: fenced[i].at, elapsed_ms: elapsed });
  }
  const invalidRoles = fenced.filter(h => !['a', 'b'].every(role => h.roles?.some(r => r.role === role && r.running === true && r.commit === expectedCommit && /^[a-f0-9]{64}$/.test(r.containerId)))).length;
  const checks = {
    full_seven_day_window: hi - lo >= SEVEN_DAYS,
    window_closed: Number.isFinite(now) && hi <= now,
    no_collector_restarts_inside_window: collectorRestarts === 0,
    heartbeat_fences_complete: Boolean(before && after),
    no_heartbeat_gaps: gaps.length === 0,
    both_roles_running_expected_commit: invalidRoles === 0,
    no_collector_problems: problems.length === 0,
    has_accepted_searches: accepted.size > 0,
    no_missing_finished_events: unfinished.length === 0,
    no_duplicate_lifecycle_phases: duplicates.length === 0,
    expected_commit_only: wrongCommit === 0,
    completed_rows_have_first_results: missingFirst === 0,
    first_results_p95_below_1500: times.length > 0 && percentile(times, .95) < 1500,
    no_failed_requests: failed === 0,
    no_result_lookup_warnings: warningRows === 0,
    no_admission_rejections: rejections === 0,
    no_failed_history_writes: historyFailed === 0,
    enough_history_acknowledgements_for_delivered_cohort: acknowledgementsAfterStart >= deliveredCohort,
  };
  return {
    window_start: start, window_end: end, expected_commit: expectedCommit,
    accepted_requests: accepted.size, finished_requests: accepted.size - unfinished.length,
    failed_requests: failed, aborted_requests: aborted, lookup_warning_requests: warningRows,
    missing_finished_count: unfinished.length, duplicate_phase_count: duplicates.length,
    history_acknowledgements: { recorded: historySucceeded, failed: historyFailed, including_after_window_end: acknowledgementsAfterStart, expected_delivered_cohort: deliveredCohort }, admission_rejections: rejections,
    first_results: { n: times.length, p95_nearest_rank_ms: percentile(times, .95) },
    full_search_computation: { n: full.length, p95_nearest_rank_ms: percentile(full, .95) },
    coverage_gaps: gaps, collector_problems: problems, checks,
    lifecycle_acceptance_pass: Object.values(checks).every(Boolean),
    seven_day_acceptance_pass: false,
    limits: [
      'Coverage is requests reaching instrumented search roles; upstream proxy/transport errors need independent ingress evidence.',
      'HTTP validation responses before accepted telemetry are outside this search cohort; busy and wrong-role rejections are included.',
      'Heartbeat coverage checks detect known collection gaps but cannot prove a Docker logging sink never dropped output.',
      'History acknowledgements are unlinked to lifecycle UUIDs; timestamps and counts corroborate storage but cannot establish exact row/request correspondence across window boundaries.',
      'Finished events after window_end are used for requests accepted inside the window. An unfinished request blocks acceptance.',
      'Collector problems and role unavailability conservatively block acceptance, even if replay subsequently recovers some events.',
      'Full search computation ends when the final batch is built, before final route enrichment/enqueue; first results includes enrichment/enqueue. Neither measures browser receive or paint. Same-key intentional probes remain indistinguishable.',
    ],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [path, start, end, expectedCommit] = process.argv.slice(2);
    const text = readFileSync(path, 'utf8');
    if (text && !text.endsWith('\n')) throw new Error('Incomplete journal record');
    const records = text.split('\n').filter(Boolean).map(line => JSON.parse(line));
    const result = verifyLifecycle(records, { start, end, expectedCommit });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.lifecycle_acceptance_pass ? 3 : 1;
  } catch { process.stderr.write('Lifecycle verification failed: invalid journal/window/SHA.\n'); process.exitCode = 2; }
}
