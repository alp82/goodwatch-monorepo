// Strict allowlist: never persist raw logs, queries, error messages, accounts or credentials.
import { createHash } from 'node:crypto';
export const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) && Number.isFinite(Date.parse(value));
export const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const timing = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function sanitizeEvent(value) {
  if (!value || typeof value !== 'object' || !iso(value.at)) return null;
  const base = { event: value.event, at: value.at };
  if (value.event === 'search.qdrant-http.v1') {
    if (!uuid(value.id) || !['search', 'page'].includes(value.role) || !(value.commit === null || commit(value.commit)) || value.kind !== 'query_batch' || !['completed', 'failed'].includes(value.status) || !['none', 'transport', 'timeout', 'http_status', 'invalid_response'].includes(value.reason) || typeof value.reusedSocket !== 'boolean') return null;
    if (!(value.httpStatus === null || Number.isInteger(value.httpStatus) && value.httpStatus >= 0 && value.httpStatus <= 599) || !Number.isInteger(value.queryCount) || value.queryCount < 0 || !Number.isInteger(value.responseBytes) || value.responseBytes < 0) return null;
    if ((value.status === 'completed') !== (value.reason === 'none')) return null;
    const spans = ['socketMs', 'dnsMs', 'connectMs', 'secureConnectMs', 'headersMs', 'responseEndMs', 'parseMs', 'serverMs', 'totalMs'];
    if (!spans.every(name => timing(value[name])) || value.totalMs === null) return null;
    return { ...base, id: value.id, role: value.role, commit: value.commit, kind: value.kind, status: value.status, reason: value.reason, httpStatus: value.httpStatus, queryCount: value.queryCount, reusedSocket: value.reusedSocket, ...Object.fromEntries(spans.map(name => [name, value[name]])), responseBytes: value.responseBytes };
  }
  if (value.event === 'search.lifecycle.v1') {
    if (!uuid(value.id) || value.role !== 'search' || !(value.commit === null || commit(value.commit))) return null;
    Object.assign(base, { id: value.id, role: value.role, commit: value.commit, phase: value.phase });
    if (value.phase === 'accepted') return base;
    if (value.phase !== 'finished' || !['completed', 'failed', 'aborted'].includes(value.status) || !timing(value.firstResultsMs) || !timing(value.computationMs) || !timing(value.lifetimeMs) || value.lifetimeMs === null || typeof value.titleLookupFailed !== 'boolean' || typeof value.descriptionFailed !== 'boolean') return null;
    return { ...base, status: value.status, firstResultsMs: value.firstResultsMs, computationMs: value.computationMs, lifetimeMs: value.lifetimeMs, titleLookupFailed: value.titleLookupFailed, descriptionFailed: value.descriptionFailed };
  }
  if (value.event === 'search.history-write.v1' && typeof value.recorded === 'boolean') return { ...base, recorded: value.recorded };
  if (value.event === 'search.rejection.v1' && ['wrong_role', 'busy'].includes(value.reason)) return { ...base, reason: value.reason };
  return null;
}
export function parseDockerLine(line, source) {
  const split = line.indexOf(' ');
  const dockerAt = line.slice(0, split);
  if (split < 0 || !iso(dockerAt)) return { ignored: true };
  let raw;
  try { raw = JSON.parse(line.slice(split + 1)); } catch { return { ignored: true }; }
  const known = ['search.lifecycle.v1', 'search.history-write.v1', 'search.rejection.v1', 'search.qdrant-http.v1'].includes(raw?.event);
  const data = sanitizeEvent(raw);
  if (!data) return known ? { malformed: true } : { ignored: true };
  const record = { type: 'telemetry', source: { role: source.role, containerId: source.containerId, dockerAt }, data };
  record.key = createHash('sha256').update(JSON.stringify(record)).digest('hex');
  return { record };
}
