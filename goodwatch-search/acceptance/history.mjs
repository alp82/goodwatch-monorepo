import http from 'node:http';
import { createDecipheriv } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1];
}
export function authenticates(ciphertext, key) {
  try {
    const bytes = Buffer.from(ciphertext, 'base64');
    if (bytes.length < 29) return false;
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    // Plaintext never parsed, retained, or emitted.
    decipher.update(bytes.subarray(28));
    decipher.final();
    return true;
  } catch { return false; }
}
const finiteTiming = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const present = value => value !== null && value !== undefined && value !== '';
function count(map, value) { const key = present(value) ? String(value) : 'null'; map[key] = (map[key] ?? 0) + 1; }
function timings(values) { return { n: values.length, p50_ms: percentile(values, .5), p95_nearest_rank_ms: percentile(values, .95), max_ms: values.length ? values.reduce((maximum, value) => Math.max(maximum, value), 0) : null }; }
export function summarize(rows, { start, end, now, sourceCount = rows.length, authentic = () => true }) {
  const startMs = Date.parse(start), endMs = Date.parse(end), nowMs = Date.parse(now);
  if (![startMs, endMs, nowMs].every(Number.isFinite) || endMs <= startMs) throw new Error('Invalid UTC window');
  const first = [], full = [], outcomes = {}, reasons = {}, fallbacks = {}, rankers = {}, days = {};
  let production = 0, foreign = 0, missingFirst = 0, invalidFull = 0, failed = 0, aborted = 0, errors = 0, fallbackCount = 0, outside = 0;
  for (const row of rows) {
    if (!authentic(row.ciphertext)) { foreign++; continue; }
    production++;
    if (!(Number(row.created_at) >= startMs && Number(row.created_at) < endMs)) outside++;
    const stage = row.stage_ms ?? {};
    count(outcomes, row.outcome); count(reasons, row.reason); count(fallbacks, row.ranker_fallback); count(rankers, row.ranker_version);
    count(days, new Date(Number(row.created_at)).toISOString().slice(0, 10));
    if (finiteTiming(stage.firstResults)) first.push(stage.firstResults); else missingFirst++;
    if (stage.completionFailed) failed++;
    if (stage.completionAborted) aborted++;
    if (present(row.reason)) errors++;
    if (present(row.ranker_fallback)) fallbackCount++;
    if (!stage.completionFailed && !stage.completionAborted) {
      if (finiteTiming(row.elapsed_ms)) full.push(row.elapsed_ms); else invalidFull++;
    }
  }
  const checks = {
    seven_days_elapsed_after_window_start: endMs - startMs >= SEVEN_DAYS && nowMs >= endMs,
    source_rows_complete: sourceCount === rows.length,
    has_production_rows: production > 0,
    all_production_rows_inside_window: outside === 0,
    all_production_rows_have_first_results: missingFirst === 0,
    valid_completed_latency: invalidFull === 0,
    p95_first_results_below_1500: first.length > 0 && percentile(first, .95) < 1500,
    no_recorded_reasons: errors === 0,
    no_ranker_fallbacks: fallbackCount === 0,
    no_late_completion_failures: failed === 0,
  };
  return {
    window_start: new Date(startMs).toISOString(), window_end: new Date(endMs).toISOString(), audit_at: new Date(nowMs).toISOString(),
    window_basis: 'search_history created_at is history insertion time, not request start time',
    total_rows: rows.length, source_count: sourceCount, production_rows: production, foreign_key_rows_excluded: foreign,
    production_outcomes: outcomes, production_reasons: reasons, production_fallbacks: fallbacks, production_rankers: rankers, daily_production_counts: days,
    first_results: timings(first), full_completion: timings(full), missing_first_results_rows: missingFirst,
    completion_failed_rows: failed, completion_aborted_rows: aborted, checks,
    history_acceptance_pass: Object.values(checks).every(Boolean),
    seven_day_acceptance_pass: false,
    acceptance_status: 'needs independent production error coverage',
    limits: [
      'Same-key development and intentional probes cannot be distinguished from organic traffic.',
      'First-results timing measures server response enqueue after route enrichment, not browser receive or paint. Full completion reports search computation through final batch construction, before final route enrichment/enqueue.',
      'Delivered aborted searches are included in first-results latency; aborted and failed completions are excluded from full-completion latency.',
      'Failures before usable delivery, rejected requests, history-write failures, and searches still running are not reliably represented in search_history. Corroborate production HTTP/runtime error telemetry before asserting seven-day error-free acceptance.',
      'Use the final deployment UTC boundary and independently confirm both role SHAs; historical total timing is never substituted for firstResults.',
    ],
  };
}
async function sql(stmt, args = []) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: process.env.CRATE_HOSTS?.split(',')[0], port: Number(process.env.CRATE_PORT || 4200), path: '/_sql', method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(process.env.CRATE_USER + ':' + process.env.CRATE_PASS).toString('base64'), 'content-type': 'application/json' } }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; }); res.on('error', () => reject(new Error('Crate response failed')));
      res.on('end', () => { try { const result = JSON.parse(body); if (res.statusCode !== 200 || result.error) throw new Error(); resolve(result); } catch { reject(new Error('Crate query failed')); } });
    });
    req.setTimeout(15000, () => req.destroy()); req.on('error', () => reject(new Error('Crate request failed')));
    req.end(JSON.stringify({ stmt, args }));
  });
}
export async function main(argv = process.argv.slice(2)) {
  const [start, end] = argv;
  if (!start?.endsWith('Z') || !end?.endsWith('Z') || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) throw new Error('Supply explicit start/end ISO UTC timestamps ending Z');
  const key = Buffer.from(process.env.SEARCH_STORAGE_KEY ?? '', 'hex');
  if (key.length !== 32 || !process.env.CRATE_HOSTS || !process.env.CRATE_USER || !process.env.CRATE_PASS) throw new Error('Required live container environment unavailable');
  const args = [Date.parse(start), Date.parse(end)];
  const snapshot = await sql('SELECT CURRENT_TIMESTAMP, count(*) FROM doc.search_history WHERE created_at >= ? AND created_at < ?', args);
  const [now, sourceCount] = snapshot.rows[0];
  if (Date.parse(end) > Number(now)) throw new Error('Window is still open; do not query an unfinished seven-day interval');
  const rows = [];
  for (let offset = 0; offset < Number(sourceCount); offset += 1000) {
    const page = await sql('SELECT created_at,ciphertext,elapsed_ms,outcome,reason,ranker_version,ranker_fallback,stage_ms FROM doc.search_history WHERE created_at >= ? AND created_at < ? ORDER BY created_at,id LIMIT 1000 OFFSET ?', [...args, offset]);
    rows.push(...page.rows.map(values => Object.fromEntries(page.cols.map((name, i) => [name, values[i]]))));
  }
  const result = summarize(rows, { start, end, now: new Date(Number(now)).toISOString(), sourceCount: Number(sourceCount), authentic: ciphertext => authenticates(ciphertext, key) });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.history_acceptance_pass ? 3 : 1; // 3 means history checks pass, independent error coverage still required.
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 2; });
