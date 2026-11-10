import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/proposal';
/** An outstanding command belongs to one room session, even after changing accounts on this device. */
export function sessionCommandStorage(roomId: string, persist: (roomId: string, envelope: CommandEnvelope | null, retryAt?: number, sessionKey?: string) => Promise<void>) {
  let sessionKey: string | undefined;
  return {
    useSession(key: string | undefined) { sessionKey = key; },
    write(envelope: CommandEnvelope | null, retryAt?: number) { return persist(roomId, envelope, retryAt, sessionKey); },
  };
}
