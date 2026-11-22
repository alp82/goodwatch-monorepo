// One scheduled container, independent of the page servers. Read just the manifest and three
// completion markers on a repeat run. The normal web request can always build the same entry.
import { setTimeout as delay } from "node:timers/promises"
import { failedMediaResult, withMediaReadHealth } from "~/server/media-read-health.server"
import { getTitleSnapshot, publishedSnapshotVersion } from "~/server/title-snapshot/index.server"
import {
	cacheEntryKey,
	cachePhysicalTtlSeconds,
	getRedisCluster,
	serializeCacheEntry,
} from "~/utils/cache"
import { defaultLocale } from "~/utils/locale"
import { browseCacheEntry, browsePageDay, pageCacheMinutes } from "../page-cache.server"
import { unmarked } from "../page-marks"

async function waitFor<T>(read: () => T | null, timeout: number) {
	const deadline = Date.now() + timeout
	while (Date.now() < deadline) {
		const result = read()
		if (result) return result
		await delay(250)
	}
	throw new Error("Timed out waiting for the Explore catalog or cache")
}

async function prepare() {
	const redis = await waitFor(getRedisCluster, 15_000)
	const version = await publishedSnapshotVersion()
	const day = browsePageDay()
	const locale = { ...defaultLocale, services: [] }
	const pending = []
	for (const kind of ["movie", "show", "all"] as const) {
		const entry = browseCacheEntry("hub", kind, locale, version, day)
		const key = cacheEntryKey(entry.name, entry.params)
		const marker = `{${key}}:prepared`
		// A simultaneous on-demand render can replace this entry. Match its contents so an
		// incomplete result cannot inherit the earlier preparation marker.
		const prepared = await redis.eval(
			"local page = redis.call('GET', KEYS[1]); return page and redis.sha1hex(page) == redis.call('GET', KEYS[2]) and 1 or 0",
			2,
			key,
			marker,
		)
		if (!prepared) pending.push({ kind, key, marker })
	}
	if (!pending.length) return
	// Importing the availability index starts a read. Keep it and all catalog consumers off
	// the frequent path that only checks whether the three prepared Redis entries are current.
	const [
		{ TROPES },
		{ availabilityLoaded },
		{ guestContext },
		{ placesForContext },
		{ allTropeMembersLoaded },
		{ ensureTropes },
		{ buildHub },
	] = await Promise.all([
		import("~/domain/tropes/catalog"),
		import("~/server/availability-index.server"),
		import("~/server/viewer.server"),
		import("../places.server"),
		import("../trope-members.server"),
		import("../tropes.server"),
		import("./hub.server"),
	])
	const ctx = { ...guestContext(undefined, locale.country), language: locale.language }
	const snapshot = await waitFor(getTitleSnapshot, 100_000)
	if (snapshot.version !== version) throw new Error("Catalog changed during preparation")
	const [available] = await Promise.all([
		availabilityLoaded(defaultLocale.country, 90_000),
		ensureTropes(),
	])
	if (!available || !allTropeMembersLoaded(TROPES.map((t) => t.id)))
		throw new Error("Catalog dependencies incomplete")
	const ttl = cachePhysicalTtlSeconds(pageCacheMinutes.ttlMinutes, pageCacheMinutes.staleMinutes)
	for (const { kind, key, marker } of pending) {
		const start = performance.now()
		const data = await withMediaReadHealth(async () => {
			const atlas = await placesForContext(kind, defaultLocale.country, () => ctx)
			return buildHub(atlas, true)
		})
		if (
			failedMediaResult(data) ||
			!data.streamingReady ||
			!data.services.length ||
			!data.lists[0]?.rows.length ||
			[data.moods, data.genres, data.countries, data.decades].some(
				(family) => !family.some((place) => place.titles.length),
			)
		)
			throw new Error(`Incomplete ${kind} hub`)
		if ((await publishedSnapshotVersion()) !== version || day !== browsePageDay())
			throw new Error("Catalog changed during preparation")
		// The marker and page occupy one cluster slot. A failed command or interrupted worker
		// leaves the previous complete entry intact, and a retry skips each finished hub.
		await redis.eval(
			"redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2]); return redis.call('SET', KEYS[2], redis.sha1hex(ARGV[1]), 'EX', ARGV[2])",
			2,
			key,
			marker,
			serializeCacheEntry({ ...unmarked(data) }),
			ttl,
		)
		console.info(
			`Prepared Explore ${kind} for ${version} in ${Math.round(performance.now() - start)} ms`,
		)
	}
}

try {
	await prepare()
	process.exit(0)
} catch (error) {
	console.error(
		"Explore hub preparation failed:",
		error instanceof Error ? error.name + ": " + error.message : "unknown error",
	)
	process.exit(1)
}
