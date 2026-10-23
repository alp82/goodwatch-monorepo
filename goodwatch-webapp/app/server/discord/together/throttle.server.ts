import { randomBytes } from "node:crypto"
import { sessionKey, SESSION_TTL } from "./store.server.ts"
export interface EditState {
	/** Atomically mark dirty and acquire a 3 s lock, clearing dirty only on acquisition. */
	acquire(id: string): Promise<boolean>
	/** Release the in-flight lease and keep the edit cooldown for another 3 s. */
	released(id: string): Promise<void>
	dirty(id: string): Promise<boolean>
	markDirty(id: string): Promise<void>
	last(id: string): Promise<string | null>
	saved(id: string, signature: string): Promise<void>
}
export interface PublicEdit {
	signature: string
	edit(): Promise<void>
}
/** A holder always checks once after the lock window, including changes arriving after its edit. */
export function createPublicUpdater(
	state: EditState,
	latest: (id: string) => Promise<PublicEdit | null>,
	schedule: (work: () => void, ms: number) => void = (work, ms) => {
		setTimeout(work, ms).unref?.()
	},
	onError: () => void = () =>
		console.error("DISCORD together public update failed"),
) {
	async function flush(id: string) {
		if (!(await state.acquire(id))) return
		try {
			const update = await latest(id)
			if (update && update.signature !== (await state.last(id))) {
				await update.edit()
				await state.saved(id, update.signature)
			}
		} catch {
			await state.markDirty(id)
			onError()
		} finally {
			await state.released(id).catch(onError)
			// Unconditional: a press can set dirty just after the edit's final read.
			schedule(() => {
				void trailing(id).catch(onError)
			}, 3050)
		}
	}
	async function trailing(id: string) {
		if (await state.dirty(id)) await flush(id)
	}
	return {
		changed: async (id: string) => {
			await state.markDirty(id)
			await flush(id)
		},
	}
}
export const EDIT_LOCK_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
if redis.call('SET', KEYS[1], '1', 'NX', 'PX', 3000) then
 redis.call('SET', KEYS[3], ARGV[1], 'PX', 60000)
 redis.call('DEL', KEYS[2])
 return 1
end
return 0
`
// The lease keeps a slow title read or a Discord 429 retry from overlapping a newer edit.
export const EDIT_RELEASE_SCRIPT = `
if redis.call('GET', KEYS[2]) == ARGV[1] then
 redis.call('SET', KEYS[1], '1', 'PX', 3000)
 redis.call('DEL', KEYS[2])
end
return 1
`
export async function publicEditState(): Promise<EditState> {
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) throw new Error("Together storage unavailable")
	const lease = randomBytes(12).toString("hex")
	const key = (id: string, field: string) => `${sessionKey(id)}:public:${field}`
	return {
		acquire: async (id) =>
			Number(
				await withRedisDeadline(
					redis.eval(
						EDIT_LOCK_SCRIPT,
						3,
						key(id, "lock"),
						key(id, "dirty"),
						key(id, "editing"),
						lease,
					),
				),
			) === 1,
		released: async (id) => {
			await withRedisDeadline(
				redis.eval(
					EDIT_RELEASE_SCRIPT,
					2,
					key(id, "lock"),
					key(id, "editing"),
					lease,
				),
			)
		},
		dirty: async (id) =>
			!!(await withRedisDeadline(redis.get(key(id, "dirty")))),
		markDirty: async (id) => {
			await withRedisDeadline(
				redis.set(key(id, "dirty"), "1", "EX", SESSION_TTL),
			)
		},
		last: (id) => withRedisDeadline(redis.get(key(id, "last"))),
		saved: async (id, value) => {
			await withRedisDeadline(
				redis.set(key(id, "last"), value, "EX", SESSION_TTL),
			)
		},
	}
}
