import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/proposal';
/** An outstanding command belongs to one room session, even after changing accounts on this device. */
type Persist<R> = (roomId: string, envelope: CommandEnvelope | null, retryAt?: number, sessionKey?: string) => R;
export function sessionCommandStorage(roomId: string, persist: Persist<Promise<void>>, persistNow?: Persist<void>) {
  let sessionKey: string | undefined;
  return {
    useSession(key: string | undefined) { sessionKey = key; },
    write(envelope: CommandEnvelope | null, retryAt?: number) { return persist(roomId, envelope, retryAt, sessionKey); },
    writeNow: persistNow && ((envelope: CommandEnvelope) => persistNow(roomId, envelope, 0, sessionKey)),
  };
}
