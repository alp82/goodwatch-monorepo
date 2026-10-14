import type { LocalizationRecord } from "../utils/media-language.ts"
import { MediaPreferencesConflict } from "./media-preferences-store.server.ts"

// Bound per-process state; account revisions additionally enforce ordering across instances.
const RETAIN_MS = 30 * 60_000
const MAX_CLIENTS = 10_000
const latest = new Map<
	string,
	{
		sequence: number
		at: number
		queueKey: string
		record?: LocalizationRecord
	}
>()
const queues = new Map<string, Promise<void>>()

/** Serialize each member (or guest client) and suppress superseded responses before Set-Cookie is built. */
export async function orderedMediaSave<T>(
	owner: string,
	clientId: string,
	sequence: number,
	save: (
		isLatest: () => boolean,
		remember: (record: LocalizationRecord) => void,
	) => Promise<T>,
): Promise<T> {
	const key = `${owner}:${clientId}`
	const queueKey = owner === "guest" ? key : owner
	const now = Date.now()
	for (const [key, entry] of latest)
		if (now - entry.at > RETAIN_MS && !queues.has(entry.queueKey))
			latest.delete(key)
	const prior = latest.get(key)
	if (prior && sequence < prior.sequence) throw new MediaPreferencesConflict()
	latest.delete(key)
	latest.set(key, { sequence, at: now, queueKey, record: prior?.record })
	if (latest.size > MAX_CLIENTS) {
		for (const [oldKey, oldEntry] of latest) {
			if (oldKey !== key && !queues.has(oldEntry.queueKey)) {
				latest.delete(oldKey)
				break
			}
		}
	}
	const before = queues.get(queueKey) ?? Promise.resolve()
	let release!: () => void
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	const tail = before.then(() => held)
	queues.set(queueKey, tail)
	const isLatest = () => latest.get(key)?.sequence === sequence
	await before
	try {
		if (!isLatest()) throw new MediaPreferencesConflict()
		const result = await save(isLatest, (record) => {
			const state = latest.get(key)
			if (
				state &&
				(!state.record ||
					(record.writer?.sequence ?? 0) >=
						(state.record.writer?.sequence ?? 0))
			)
				state.record = record
		})
		if (!isLatest()) throw new MediaPreferencesConflict()
		return result
	} finally {
		release()
		if (queues.get(queueKey) === tail) queues.delete(queueKey)
	}
}

export function resetMediaSaveOrderForTest() {
	latest.clear()
	queues.clear()
}

export function currentMediaSaveRecord(owner: string, clientId: string) {
	return latest.get(`${owner}:${clientId}`)?.record ?? null
}
