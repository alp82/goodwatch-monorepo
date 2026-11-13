// E2E_SERVER_TIMING_LOG lines (lib/harness.ts). Pure: no Playwright here.
/**
 * The E2E_SERVER_TIMING_LOG line for one POST answer: the Server-Timing (durations only) of a create, join, realtime
 * ticket or command. `kind`: create, join, ticket or the command's type. A command the server answered as a replay
 * (receipt.replayed true) is left out: the same envelope sent again (a resend after a lost answer, the saved command
 * after a reload) comes back as a replay of the stored receipt, whose timing is a lookup, not the command's.
 * Null for anything else.
 */
export function serverTimingLine(path: string, postData: string | null, status: number, body: unknown, serverTiming: string | undefined, t = Date.now()) {
  if (!path.includes('/proposal/rooms')) return null;
  let kind: unknown = path.endsWith('/proposal/rooms') ? 'create' : path.endsWith('/join') ? 'join' : path.endsWith('/realtime-ticket') ? 'ticket' : null;
  let commandId: unknown;
  if (path.endsWith('/commands')) {
    let envelope: { commandId?: unknown; command?: { type?: unknown } } | null = null;
    try { envelope = postData ? JSON.parse(postData) : null; } catch { return null; }
    const receipt = (body as { receipt?: { replayed?: unknown } } | null)?.receipt;
    if (receipt?.replayed === true) return null;
    kind = envelope?.command?.type;
    commandId = envelope?.commandId;
  }
  if (typeof kind !== 'string' || !kind) return null;
  return JSON.stringify({ t, kind, status, ...(commandId !== undefined ? { commandId } : {}), serverTiming: serverTiming ?? null });
}
