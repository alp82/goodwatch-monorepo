// Strict allowlist: never persist raw logs, queries, error messages, accounts or credentials.
import { createHash } from 'node:crypto';
export const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
export const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const timing = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function sanitizeEvent(value) {
  if (!value || typeof value !== 'object' || !iso(value.at)) return null;
  const base = { event: value.event, at: value.at };
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
  const known = ['search.lifecycle.v1', 'search.history-write.v1', 'search.rejection.v1'].includes(raw?.event);
  const data = sanitizeEvent(raw);
  if (!data) return known ? { malformed: true } : { ignored: true };
  const record = { type: 'telemetry', source: { role: source.role, containerId: source.containerId, dockerAt }, data };
  record.key = createHash('sha256').update(JSON.stringify(record)).digest('hex');
  return { record };
}
