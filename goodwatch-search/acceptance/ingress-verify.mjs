import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { iso } from './events.mjs';
import { hosts } from './ingress-events.mjs';
import { approvedLogging, imageId } from './ingress-config.mjs';
import { SEVEN_DAYS } from './history.mjs';
export function verifyIngress(records, { start, end, host, expectedImageId, now = Date.now(), maxHeartbeatGapMs = 45000 }) {
  if (!iso(start) || !iso(end) || !hosts.includes(host) || !imageId(expectedImageId)) throw new Error('Explicit UTC window and fixed host required');
  const lo = Date.parse(start), hi = Date.parse(end);
  if (hi <= lo) throw new Error('Invalid window');
  const keys = new Set(), responses = [], beats = [], collection = [];
  let invalid = 0;
  for (const r of records) {
    if (r.key) { if (keys.has(r.key)) continue; keys.add(r.key); }
    if (r.type === 'ingress') {
      const d = r.data, s = r.source;
      if (!d || !s || s.host !== host || !/^[a-f0-9]{64}$/.test(s.containerId) || !iso(s.dockerAt) || !iso(d.at) || d.method !== 'POST' || d.route !== 'search' || !Number.isSafeInteger(d.status) || d.status < 0 || d.status > 599 || Date.parse(s.dockerAt) < Date.parse(d.at)) { invalid++; continue; }
      if (Date.parse(d.at) >= lo && Date.parse(d.at) < hi) responses.push(r);
    } else if (r.type?.startsWith('collector.')) {
      if (!iso(r.at) || r.host !== host) { invalid++; continue; }
      collection.push(r);
      if (r.type === 'collector.heartbeat') beats.push(r);
    } else invalid++;
  }
  const drain = responses.reduce((at, r) => Math.max(at, Date.parse(r.source.dockerAt)), hi);
  const statuses = {}, counts = { five_xx: 0, four_xx: 0, no_status: 0 };
  for (const r of responses) {
    const status = r.data.status; statuses[status] = (statuses[status] ?? 0) + 1;
    if (status >= 500) counts.five_xx++;
    else if (status >= 400) counts.four_xx++;
    if (status < 100) counts.no_status++;
  }
  beats.sort((a,b) => Date.parse(a.at)-Date.parse(b.at));
  const before = beats.filter(r => Date.parse(r.at) <= lo).at(-1);
  const after = beats.find(r => Date.parse(r.at) >= drain);
  const fenced = before && after ? beats.filter(r => Date.parse(r.at) >= Date.parse(before.at) && Date.parse(r.at) <= Date.parse(after.at)) : [];
  let gaps = 0, unavailable = 0;
  for (let i=0; i<fenced.length; i++) {
    if (i && Date.parse(fenced[i].at)-Date.parse(fenced[i-1].at) > maxHeartbeatGapMs) gaps++;
    if (!fenced[i].sources?.some(s => s.host === host && s.running === true && s.accessLoggingReady === true && s.imageId === expectedImageId && s.loggingFingerprint === approvedLogging(host).fingerprint && /^[a-f0-9]{64}$/.test(s.containerId))) unavailable++;
  }
  const relevant = collection.filter(r => Date.parse(r.at) >= lo && Date.parse(r.at) <= drain);
  const restarts = relevant.filter(r => r.type === 'collector.started' && Date.parse(r.at) > lo).length;
  const problems = relevant.filter(r => r.type === 'collector.problem' || r.type === 'collector.stopped').length;
  const checks = {
    full_seven_day_window: hi-lo >= SEVEN_DAYS,
    window_and_observed_drain_closed: Number.isFinite(now) && drain <= now,
    valid_journal_records: invalid === 0,
    heartbeat_fences_complete: Boolean(before && after),
    no_heartbeat_gaps: gaps === 0,
    proxy_running_with_approved_logging_and_image: unavailable === 0,
    no_collector_restarts: restarts === 0,
    no_collection_problems: problems === 0,
    has_routed_post_responses: responses.length > 0,
    no_proxy_or_origin_5xx: counts.five_xx === 0,
    all_responses_have_http_status: counts.no_status === 0,
  };
  return {
    host, expected_image_id: expectedImageId, approved_logging_fingerprint: approvedLogging(host).fingerprint, window_start: start, window_end: end, observed_drain_cutoff: new Date(drain).toISOString(),
    routed_post_responses: responses.length, statuses, ...counts,
    heartbeat_gap_count: gaps, unavailable_heartbeat_count: unavailable,
    collector_restart_count: restarts, collection_problem_count: problems, invalid_record_count: invalid,
    checks, ingress_response_checks_pass: Object.values(checks).every(Boolean), seven_day_acceptance_pass: false,
    limits: [
      'Use both host summaries together with history and application lifecycle evidence; this summary alone never establishes full acceptance.',
      'Only POST on the fixed search router is collected. POST on the palette path is conservatively included. Other routers/methods and unmatched requests are ignored; routing loss cannot be ruled out from these logs.',
      '4xx statuses are reported but do not fail the HTTP 5xx check. Review them alongside application rejections and failures.',
      'StartUTC defines the response cohort. Finishes after the window end are included when observed. Requests still pending without an access record require the application lifecycle drain check and cannot be proven complete from access logs alone.',
      'Heartbeat fences detect known collector outages, not silent Docker sink loss. DNS, TLS and connection failures before router selection remain outside coverage.',
    ],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [path,start,end,host,expectedImageId] = process.argv.slice(2);
    const text = readFileSync(path,'utf8');
    if (text && !text.endsWith('\n')) throw new Error();
    const records = text.split('\n').filter(Boolean).map(JSON.parse);
    const result = verifyIngress(records,{start,end,host,expectedImageId});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    process.exitCode = result.ingress_response_checks_pass ? 3 : 1;
  } catch { process.stderr.write('Ingress verification failed: invalid journal/window/host.\n'); process.exitCode=2; }
}
