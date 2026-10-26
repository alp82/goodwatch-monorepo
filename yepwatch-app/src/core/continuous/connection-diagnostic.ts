/** Local, bounded diagnostic values only. Never retain URLs, bodies, headers or raw error text. */
export type ConnectionStage = 'address' | 'request' | 'response';
export interface ConnectionDiagnostic {
  stage: ConnectionStage;
  reason: 'timeout' | 'cancelled' | 'configuration' | 'response' | 'tls' | 'dns' | 'offline' | 'network';
  status: number | null;
  elapsedMs: number;
}
export function connectionDiagnostic(error: unknown, stage: ConnectionStage, status: number | undefined, elapsedMs: number, timedOut: boolean, cancelled: boolean): ConnectionDiagnostic {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const reason = timedOut ? 'timeout' : cancelled ? 'cancelled' : stage === 'address' ? 'configuration' : stage === 'response' ? 'response'
    : /ssl|certificate|secure connection/.test(message) ? 'tls'
    : /hostname|unknownhost|dns|resolve host/.test(message) ? 'dns'
    : /offline|not connected to the internet/.test(message) ? 'offline' : 'network';
  return { stage, reason, status: status ?? null, elapsedMs: Math.max(0, Math.min(60_000, Math.round(elapsedMs))) };
}
