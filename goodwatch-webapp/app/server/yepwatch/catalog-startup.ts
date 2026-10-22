import { RoomError } from './errors.ts'
/** Wait only for the existing process-local loader; never retry a room command or guess offers. */
export async function requireCatalogSnapshot<T>(read: () => T | null, options: { timeoutMs?: number; now?: () => number; wait?: (ms: number) => Promise<void> } = {}): Promise<T> {
  const now = options.now ?? Date.now
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const deadline = now() + (options.timeoutMs ?? 2000)
  for (;;) {
    const snapshot = read()
    if (snapshot) return snapshot
    const remaining = deadline - now()
    if (remaining <= 0) throw new RoomError('catalog_unavailable', 'The GoodWatch catalog is still loading or unavailable. Please retry shortly; your room and settings were not changed.', 503, true, { type: 'catalog', reason: 'catalog_loading', actions: ['retry'] })
    await wait(Math.min(25, remaining))
  }
}
