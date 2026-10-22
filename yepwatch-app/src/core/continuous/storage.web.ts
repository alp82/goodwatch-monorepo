import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/proposal';
const key = (id: string) => `yepwatch.v3.pending.${id}`;
/** Own pending command only, no bearer or account data; HttpOnly cookies authenticate HTTP. */
export async function readPending(id: string): Promise<CommandEnvelope | null> {
  const raw = sessionStorage.getItem(key(id));
  return raw ? JSON.parse(raw) : null;
}
export async function writePending(id: string, value: CommandEnvelope | null) {
  if (value) sessionStorage.setItem(key(id), JSON.stringify(value));
  else sessionStorage.removeItem(key(id));
}
