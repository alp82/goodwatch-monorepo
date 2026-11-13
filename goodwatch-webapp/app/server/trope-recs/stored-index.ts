// The last built candidate index, kept in Valkey so that a restarted process reads it instead of building it again.
//
// A build reads about 1.1 million trope association rows from Crate in a few hundred queries. Every deploy restarts
// the webapp, and in November 2026 deploys came every 20 minutes, so the build ran several times an hour and was the
// heaviest statement on the shared cluster (see docs/implementation/trope-recs.md).
//
// - One value is gzip of: a 4-byte length, the JSON of everything but the associations, then the associations as
//   typed arrays (per title an end offset, then every trope position and every definingness). It is split into
//   chunks of at most 1 MB; the meta key names the chunks and is written last, so a reader sees a complete generation.
// - A build claims a lock first, so two processes of an overlapping deploy don't both build. The builder releases it
//   when it is done or failed; a waiter tries to claim it again on every poll, so a builder that died is replaced
//   when its lock expires.
// - Every failure here is reported and treated as "no stored copy": the process builds as it did before.
//
// This module takes its Redis client and its clock as arguments, so it runs in tests.
import { randomUUID } from "node:crypto"
import { promisify } from "node:util"
import { gunzip, gzip } from "node:zlib"
import type { MediaKey } from "../../types/user-data.ts"
import { timeSlice } from "../time-slice.ts"
import type { Candidate, CandidateIndex } from "./ranking.ts"

const PREFIX = "trope-recs:index:v1"
const META_KEY = `${PREFIX}:meta`
const LOCK_KEY = `${PREFIX}:lock`
export const CHUNK_BYTES = 1024 * 1024
/** A stored copy outlives the in-memory generation, so a process started late in the hour still finds it. */
export const STORED_SECONDS = 3 * 60 * 60
export const LOCK_SECONDS = 10 * 60

export interface StoredIndexRedis {
	get(key: string): Promise<string | null>
	getBuffer(key: string): Promise<Buffer | null>
	setex(key: string, seconds: number, value: string | Buffer): Promise<unknown>
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
		mode: "NX",
	): Promise<unknown>
	eval(
		script: string,
		keys: number,
		key: string,
		token: string,
	): Promise<unknown>
}
/** Deletes the lock only while it still holds this claim's token. */
const RELEASE =
	"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0"
interface Meta {
	builtAt: number
	id: string
	chunks: number
}
export interface Stored {
	value: CandidateIndex
	builtAt: number
}

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

export async function encodeIndex(index: CandidateIndex): Promise<Buffer> {
	let pairs = 0
	for (const title of index.titles) pairs += title.tropes.length
	const ends = new Uint32Array(index.titles.length)
	const positions = new Uint32Array(pairs)
	const defining = new Int16Array(pairs)
	let at = 0
	index.titles.forEach((title, t) => {
		for (const { i, d } of title.tropes) {
			positions[at] = i
			defining[at] = d
			at++
		}
		ends[t] = at
	})
	const head = Buffer.from(
		JSON.stringify({
			titles: index.titles.map(({ tropes: _, ...title }) => title),
			tropes: index.tropes,
			names: index.names,
			references: index.references,
		}),
	)
	const length = Buffer.alloc(4)
	length.writeUInt32LE(head.length)
	return gzipAsync(
		Buffer.concat([
			length,
			head,
			Buffer.from(ends.buffer),
			Buffer.from(positions.buffer),
			Buffer.from(defining.buffer),
		]),
	)
}

/** Copies a range into a fresh, aligned buffer for a typed array view. */
function aligned(bytes: Buffer, start: number, end: number) {
	if (end > bytes.length) throw new Error("Stored candidate index is truncated")
	const copy = new ArrayBuffer(end - start)
	new Uint8Array(copy).set(bytes.subarray(start, end))
	return copy
}

export async function decodeIndex(
	gzipped: Buffer,
	slice = timeSlice(),
): Promise<CandidateIndex> {
	const bytes = await gunzipAsync(gzipped)
	const headLength = bytes.readUInt32LE(0)
	const head = JSON.parse(bytes.subarray(4, 4 + headLength).toString()) as {
		titles: (Omit<Candidate, "tropes"> & { id: MediaKey })[]
		tropes: string[]
		names: string[]
		references: string[][]
	}
	let at = 4 + headLength
	const count = head.titles.length
	const ends = new Uint32Array(aligned(bytes, at, (at += count * 4)))
	const pairs = count ? ends[count - 1] : 0
	const positions = new Uint32Array(aligned(bytes, at, (at += pairs * 4)))
	const defining = new Int16Array(aligned(bytes, at, (at += pairs * 2)))
	if (at !== bytes.length)
		throw new Error("Stored candidate index has an unexpected length")
	const titles: Candidate[] = []
	let start = 0
	for (let t = 0; t < count; t++) {
		if (slice.due()) await slice.pause()
		const tropes: Candidate["tropes"] = []
		for (let k = start; k < ends[t]; k++)
			tropes.push({ i: positions[k], d: defining[k] })
		start = ends[t]
		titles.push({ ...head.titles[t], tropes })
	}
	return {
		titles,
		tropes: head.tropes,
		names: head.names,
		references: head.references,
	}
}

export function storedIndex(deps: {
	redis: () => StoredIndexRedis | null | undefined
	now?: () => number
	onError?: (error: unknown) => void
}) {
	const now = deps.now ?? Date.now
	const report =
		deps.onError ??
		((error: unknown) =>
			console.error("Trope recommendations: stored candidate index:", error))
	return {
		/** The stored generation, or null when there is none, Valkey is unavailable or the copy is damaged. */
		async load(): Promise<Stored | null> {
			const redis = deps.redis()
			if (!redis) return null
			try {
				const raw = await redis.get(META_KEY)
				if (!raw) return null
				const meta = JSON.parse(raw) as Meta
				if (!Number.isFinite(meta.builtAt) || !(meta.chunks > 0)) return null
				const chunks: Buffer[] = []
				for (let n = 0; n < meta.chunks; n++) {
					const chunk = await redis.getBuffer(`${PREFIX}:${meta.id}:${n}`)
					if (!chunk) return null
					chunks.push(chunk)
				}
				return {
					value: await decodeIndex(Buffer.concat(chunks)),
					builtAt: meta.builtAt,
				}
			} catch (error) {
				report(error)
				return null
			}
		},
		async save(value: CandidateIndex, builtAt: number) {
			const redis = deps.redis()
			if (!redis) return
			try {
				const bytes = await encodeIndex(value)
				const id = String(builtAt)
				let chunks = 0
				for (let at = 0; at < bytes.length; at += CHUNK_BYTES)
					await redis.setex(
						`${PREFIX}:${id}:${chunks++}`,
						STORED_SECONDS,
						bytes.subarray(at, at + CHUNK_BYTES),
					)
				const meta: Meta = { builtAt, id, chunks }
				await redis.setex(META_KEY, STORED_SECONDS, JSON.stringify(meta))
			} catch (error) {
				report(error)
			}
		},
		/**
		 * A claim when this process may build: it took the lock (the claim then holds its token), or Valkey can't say
		 * that another process holds it. Null while another process holds the lock.
		 */
		async claim(): Promise<{ token?: string } | null> {
			const redis = deps.redis()
			if (!redis) return {}
			const token = randomUUID()
			try {
				const taken = await redis.set(LOCK_KEY, token, "EX", LOCK_SECONDS, "NX")
				return taken === "OK" ? { token } : null
			} catch (error) {
				report(error)
				return {}
			}
		},
		async release(claim: { token?: string }) {
			const redis = deps.redis()
			if (!redis || !claim.token) return
			try {
				await redis.eval(RELEASE, 1, LOCK_KEY, claim.token)
			} catch (error) {
				report(error)
			}
		},
	}
}

type Store = ReturnType<typeof storedIndex>

/**
 * The fresh stored generation when there is one; otherwise a build, which is stored afterwards. While another process
 * holds the lock this waits for its copy and tries to claim the lock again on every poll; past twice the lock's
 * lifetime it builds without the lock.
 */
export async function loadOrBuild(
	store: Store,
	build: () => Promise<CandidateIndex>,
	{
		maxAgeMs,
		now = Date.now,
		wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
		pollMs = 15_000,
	}: {
		maxAgeMs: number
		now?: () => number
		wait?: (ms: number) => Promise<unknown>
		pollMs?: number
	},
): Promise<Stored> {
	const fresh = (stored: Stored | null) =>
		stored && now() - stored.builtAt < maxAgeMs ? stored : null
	const found = fresh(await store.load())
	if (found) return found
	const giveUp = now() + 2 * LOCK_SECONDS * 1000
	let claim = await store.claim()
	while (!claim) {
		if (now() >= giveUp) {
			claim = {}
			break
		}
		await wait(pollMs)
		const arrived = fresh(await store.load())
		if (arrived) return arrived
		claim = await store.claim()
	}
	try {
		const value = await build()
		const builtAt = now()
		await store.save(value, builtAt)
		return { value, builtAt }
	} finally {
		await store.release(claim)
	}
}
