// The shared store for the hashed files of the client build, in Valkey.
//
// A deploy updates the webapp instances one after the other, so for some minutes they run different builds, and a
// request for a hashed file can reach the instance whose build doesn't have it. Every process writes its own build's
// hashed files here, and reads a file of another build from here on a miss (see static-files.server.ts). Valkey is
// what both instances already share, so an instance needs no address of the other one and passes no request on.
//
// - Only paths that look like a hashed build file are read (`isBuildFilePath`), a stored file has a size limit, and a
//   read has a time limit. A path that the store doesn't have is remembered for a few seconds.
// - Every key has an expiry. A running process writes its files again before they expire, so the files of a build
//   stay for a day after its last process has gone. Names carry a content hash: a file that two builds share is one
//   key.
// - A value is one byte for the encoding (0: as it is, 1: Brotli) and then the bytes.
//
// This module takes its Redis client and its clock as arguments, so it runs in tests.
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { brotliDecompress } from "node:zlib"

export const BUILD_FILE_PREFIX = "build-file:v1:"
export const BUILD_FILE_STORE_SECONDS = 24 * 60 * 60
export const BUILD_FILE_REPUBLISH_MS = 8 * 60 * 60 * 1000
// The wait before the next attempt after a publish with failed writes.
export const BUILD_FILE_RETRY_MS = 60 * 1000
// A publish stops after this many failed writes. With Valkey down, each further write would wait for its time limit.
const PUBLISH_MAX_FAILURES = 16
export const BUILD_FILE_MAX_BYTES = 2 * 1024 * 1024
export const BUILD_FILE_MEMORY_MAX_BYTES = 32 * 1024 * 1024
export type BuildFile = { identity: Buffer; br?: Buffer }
type Redis = {
	getBuffer(key: string): Promise<Buffer | null>
	setex(key: string, seconds: number, value: Buffer): Promise<unknown>
}
type Dependencies = {
	redis: () => Redis | null | undefined
	now?: () => number
	readTimeoutMs?: number
	writeTimeoutMs?: number
	memoryMaxBytes?: number
	onStoreHit?: (path: string) => void
}
export type PublishFile = {
	urlPath: string
	path: string
	encoding: "identity" | "br"
	size: number
}
export function isBuildFilePath(
	path: string,
	assetsPrefix: string,
	contentTypes: Record<string, string>,
): boolean {
	if (!path.startsWith(assetsPrefix)) return false
	const name = path.slice(assetsPrefix.length)
	const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase()
	return (
		/^[A-Za-z0-9_][A-Za-z0-9_.~()-]{0,199}$/.test(name) &&
		!name.includes("..") &&
		name.includes(".") &&
		!["map", "br", "gz", "html"].includes(extension) &&
		Object.prototype.hasOwnProperty.call(contentTypes, extension)
	)
}
async function bounded<T>(operation: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error("Build file store timeout")),
					ms,
				)
			}),
		])
	} finally {
		clearTimeout(timer)
	}
}
const decompress = promisify(brotliDecompress)
export function createBuildFileStore(deps: Dependencies) {
	const now = deps.now ?? Date.now
	const memory = new Map<string, BuildFile>()
	const missing = new Map<string, number>()
	const pending = new Map<string, Promise<BuildFile | null>>()
	const counts = { memoryHits: 0, storeHits: 0, misses: 0, errors: 0 }
	let bytes = 0
	const size = (file: BuildFile) =>
		file.identity.length + (file.br?.length ?? 0)
	async function publish(files: PublishFile[]) {
		const result = { written: 0, skipped: 0, failed: 0 }
		let redis: Redis | null | undefined
		try {
			redis = deps.redis()
		} catch {
			/* A disconnected store must not prevent startup. */
		}
		if (!redis) return { ...result, failed: files.length }
		const client = redis
		let next = 0
		await Promise.all(
			Array.from({ length: Math.min(8, files.length) }, async () => {
				while (next < files.length) {
					const file = files[next++]
					if (result.failed >= PUBLISH_MAX_FAILURES) {
						result.failed++
						continue
					}
					if (file.size > BUILD_FILE_MAX_BYTES) {
						result.skipped++
						continue
					}
					try {
						const body = await readFile(file.path)
						if (body.length > BUILD_FILE_MAX_BYTES) {
							result.skipped++
							continue
						}
						await bounded(
							client.setex(
								BUILD_FILE_PREFIX + file.urlPath,
								BUILD_FILE_STORE_SECONDS,
								Buffer.concat([
									Buffer.from([file.encoding === "br" ? 1 : 0]),
									body,
								]),
							),
							deps.writeTimeoutMs ?? 2000,
						)
						result.written++
					} catch {
						result.failed++
					}
				}
			}),
		)
		return result
	}
	async function read(path: string): Promise<BuildFile | null> {
		try {
			const client = deps.redis()
			if (!client) throw new Error("Build file store unavailable")
			const value = await bounded(
				client.getBuffer(BUILD_FILE_PREFIX + path),
				deps.readTimeoutMs ?? 1000,
			)
			if (value === null) {
				const oldest = missing.keys().next()
				if (missing.size >= 2000 && !oldest.done) missing.delete(oldest.value)
				missing.set(path, now() + 5000)
				counts.misses++
				return null
			}
			if (
				!value.length ||
				value.length > BUILD_FILE_MAX_BYTES + 1 ||
				value[0] > 1
			)
				throw new Error("Invalid build file")
			const body = value.subarray(1)
			const file: BuildFile =
				value[0] === 1
					? {
							identity: await decompress(body, {
								maxOutputLength: 16 * 1024 * 1024,
							}),
							br: body,
						}
					: { identity: body }
			const limit = deps.memoryMaxBytes ?? BUILD_FILE_MEMORY_MAX_BYTES
			if (size(file) <= limit) {
				while (bytes + size(file) > limit && memory.size) {
					const oldest = memory.entries().next()
					if (oldest.done) break
					bytes -= size(oldest.value[1])
					memory.delete(oldest.value[0])
				}
				memory.set(path, file)
				bytes += size(file)
			}
			counts.storeHits++
			deps.onStoreHit?.(path)
			return file
		} catch {
			counts.errors++
			return null
		}
	}
	function lookup(path: string): Promise<BuildFile | null> {
		const file = memory.get(path)
		if (file) {
			memory.delete(path)
			memory.set(path, file)
			counts.memoryHits++
			return Promise.resolve(file)
		}
		if ((missing.get(path) ?? 0) > now()) {
			counts.misses++
			return Promise.resolve(null)
		}
		missing.delete(path)
		const active = pending.get(path)
		if (active) return active
		if (pending.size >= 32) return Promise.resolve(null)
		const result = read(path).finally(() => pending.delete(path))
		pending.set(path, result)
		return result
	}
	return { publish, lookup, stats: () => ({ ...counts }) }
}
