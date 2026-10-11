import { createHash } from 'node:crypto';
import { iso } from './events.mjs';
export const hosts = ['abio', 'vector1'];
const routers = { abio: 'gw-search-https@file', vector1: 'gw-search-from-abio@file' };
export function sanitizeIngress(value, host) {
  if (!hosts.includes(host) || !value || value.RouterName !== routers[host] || value.RequestMethod !== 'POST') return null;
  if (!iso(value.StartUTC) || !Number.isSafeInteger(value.DownstreamStatus) || value.DownstreamStatus < 0 || value.DownstreamStatus > 599) return null;
  return { at: value.StartUTC, route: 'search', method: 'POST', status: value.DownstreamStatus };
}
export function parseIngressLine(line, source) {
  const split = line.indexOf(' '), dockerAt = line.slice(0, split);
  if (split < 0 || !iso(dockerAt)) return { ignored: true };
  let raw;
  try { raw = JSON.parse(line.slice(split + 1)); } catch { return { ignored: true }; }
  const known = raw?.RouterName === routers[source.host] && raw?.RequestMethod === 'POST';
  const data = sanitizeIngress(raw, source.host);
  if (!data) return known ? { malformed: true } : { ignored: true };
  const record = { type: 'ingress', source: { host: source.host, containerId: source.containerId, dockerAt }, data };
  record.key = createHash('sha256').update(JSON.stringify(record)).digest('hex');
  return { record };
}
