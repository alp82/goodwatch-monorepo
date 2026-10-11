import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeEvent } from './events.mjs';
import { verifyLifecycle } from './lifecycle.mjs';
const sample = { event: 'search.qdrant-http.v1', at: '2026-10-11T12:00:00Z', id: '12345678-1234-1234-1234-123456789012', role: 'search', commit: 'a'.repeat(40), kind: 'query_batch', status: 'completed', reason: 'none', httpStatus: 200, queryCount: 3, reusedSocket: true, socketMs: 1, dnsMs: null, connectMs: null, secureConnectMs: null, headersMs: 1500, responseEndMs: 1550, parseMs: 2, totalMs: 1553, serverMs: 1400, responseBytes: 999 };
test('strict numeric HTTP evidence persists without payload or acceptance counts', () => {
 assert.deepEqual(sanitizeEvent({ ...sample, body: 'secret', error: 'secret', query: 'secret', account: 'secret' }), sample);
 for (const override of [{ socketMs: -1 }, { serverMs: 'secret' }, { reason: 'secret' }, { kind: 'secret' }, { id: 'secret' }, { queryCount: 1.5 }]) assert.equal(sanitizeEvent({ ...sample, ...override }), null);
 const result = verifyLifecycle([{ type: 'telemetry', data: sample }], { start: sample.at, end: '2026-10-18T12:00:00Z', expectedCommit: sample.commit });
 assert.equal(result.accepted_requests, 0);
 assert.equal(result.finished_requests, 0);
});
