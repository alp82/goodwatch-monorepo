import { execute, query } from "~/utils/crate"
import { duplicateProviderMapping } from "~/utils/streaming-links"
import { type TitleKey, titleKey } from "~/utils/title-key"

// Which subscription services carry each title, per country, in webapp memory. On my services needs this for
// thousands of titles per request, so no request reads it from Crate. A country loads in the background on first use
// and refreshes every 6 hours; until its first load finishes, callers get `null` and fall back to the titles'
// `streaming_availabilities` column with approximate counts.
//
// Layout per country: the title keys sorted in a Float64Array, and for each title a run of service indexes (offsets
// into one Uint16Array). The United States has about 390 subscription services, so a fixed bitset per title would
// need 13 words (52 bytes) for an average of about 4 services; the runs need about 20 bytes per title in all.

const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000
const RETRY_AFTER_MS = 5 * 60 * 1000
// The countries of the most members load at boot. Members by country on September 27, 2026: US 131, NL 36, DE 32,
// GB 26, IN 18, then 8 or fewer.
const PRELOAD_COUNTRIES = 4
const SUBSCRIPTION_TYPES = ["flatrate", "free", "ads"]
const YIELD_EVERY_ROWS = 50_000

interface CountryIndex {
	keys: Float64Array // sorted title keys
	offsets: Uint32Array // services of keys[i] are entries[offsets[i]..offsets[i + 1]]
	entries: Uint16Array // indexes into services
	services: number[] // service ids, duplicates mapped to their base service
	loadedAt: number
}

export interface AvailabilityIndexStats {
	country: string
	titles: number
	entries: number
	services: number
	bytes: number
	rows: number
	queryMs: number
	buildMs: number
	loadedAt: Date
}

// Duplicate provider ids map to the service they belong to (Amazon Video and Prime Video to Amazon Prime Video).
const baseServiceOf = new Map<number, number>()
for (const [base, duplicates] of Object.entries(duplicateProviderMapping)) {
	for (const duplicate of duplicates) baseServiceOf.set(duplicate, Number(base))
}
const baseService = (id: number) => baseServiceOf.get(id) ?? id

const indexes = new Map<string, CountryIndex>()
const stats = new Map<string, AvailabilityIndexStats>()
const queued = new Set<string>()
const failedAt = new Map<string, number>()
let queue: Promise<void> = Promise.resolve()

const isCountryCode = (country: string) => /^[A-Z]{2}$/.test(country)

/** The services that carry each title in the country, or `null` for every title while the country loads. */
export function servicesFor(
	country: string,
	keys: TitleKey[],
): (number[] | null)[] {
	const index = loadedIndex(country)
	if (!index) return keys.map(() => null)
	return keys.map((key) => {
		const row = findRow(index, key)
		if (row < 0) return []
		const services: number[] = []
		for (let i = index.offsets[row]; i < index.offsets[row + 1]; i++) {
			services.push(index.services[index.entries[i]])
		}
		return services
	})
}

/** Whether any of the services carries the title in the country, or `null` while the country loads. */
export function isOnServices(
	country: string,
	services: number[],
	key: TitleKey,
): boolean | null {
	const index = loadedIndex(country)
	if (!index) return null
	const row = findRow(index, key)
	if (row < 0) return false
	for (let i = index.offsets[row]; i < index.offsets[row + 1]; i++) {
		const service = index.services[index.entries[i]]
		for (const wanted of services) {
			if (baseService(wanted) === service) return true
		}
	}
	return false
}

/**
 * A country's loaded index for engines that test many titles per request (the title filter), or `null` while the
 * country loads. The services of the title at `row` are `services[entries[i]]` for i from offsets[row] to
 * offsets[row + 1]. Views, not copies: don't write.
 */
export interface CountryServices {
	readonly loadedAt: number
	/** Service ids, duplicates mapped to their base service. */
	readonly services: readonly number[]
	readonly offsets: Uint32Array
	readonly entries: Uint16Array
	/** The row of a title, or -1 when no subscription service carries it. */
	rowOf(key: TitleKey): number
	/** The index of a service in `services` (duplicates count as their base service), or -1 when none carries it. */
	indexOfService(serviceId: number): number
}

export function countryServices(country: string): CountryServices | null {
	const index = loadedIndex(country)
	if (!index) return null
	const at = new Map(index.services.map((service, i) => [service, i]))
	return {
		loadedAt: index.loadedAt,
		services: index.services,
		offsets: index.offsets,
		entries: index.entries,
		rowOf: (key) => findRow(index, key),
		indexOfService: (serviceId) => at.get(baseService(serviceId)) ?? -1,
	}
}

/** Size and load time of each loaded country, for logs and measurements. */
export function availabilityIndexStats(): AvailabilityIndexStats[] {
	return [...stats.values()]
}

/** Loads the countries of the most members in the background. Called once when this module first loads. */
export function preloadAvailability(): void {
	query<{ country: string }>(
		`SELECT value AS country, count(*) AS members
		 FROM user_setting
		 WHERE key = 'country_default'
		 GROUP BY value
		 ORDER BY members DESC
		 LIMIT ?`,
		[PRELOAD_COUNTRIES],
	).then(
		(rows) => {
			for (const { country } of rows) {
				if (isCountryCode(country)) scheduleLoad(country)
			}
		},
		(error) => console.error("Availability index: preload failed", error),
	)
}

// Returns the loaded index, and schedules a load when the country has none yet or its index is older than 6 hours.
function loadedIndex(countryCode: string): CountryIndex | null {
	const country = countryCode.toUpperCase()
	if (!isCountryCode(country)) return null
	const index = indexes.get(country) ?? null
	if (!index || Date.now() - index.loadedAt > REFRESH_AFTER_MS) {
		const failed = failedAt.get(country)
		if (!failed || Date.now() - failed > RETRY_AFTER_MS) scheduleLoad(country)
	}
	return index
}

// One load at a time, so several new countries don't send their large reads to Crate at once.
function scheduleLoad(country: string) {
	if (queued.has(country)) return
	queued.add(country)
	queue = queue.then(async () => {
		try {
			await loadCountry(country)
			failedAt.delete(country)
		} catch (error) {
			failedAt.set(country, Date.now())
			console.error(`Availability index: loading ${country} failed`, error)
		} finally {
			queued.delete(country)
		}
	})
}

async function loadCountry(country: string) {
	const started = performance.now()
	// One row per title with its services grouped by Crate. Measured from the production host on September 27, 2026,
	// for the United States: the ungrouped rows (672,527) were faster in Crate (1.0 to 1.1 s against 1.6 to 1.9 s) but
	// parsing them held the event loop for 430 to 490 ms; the grouped rows (168,578) hold it for 110 to 130 ms.
	// `execute` returns rows as arrays; `query` would build an object per row.
	const result = await execute(
		`SELECT media_type, media_tmdb_id, collect_set(streaming_service_id)
		 FROM streaming_availability
		 WHERE country_code = ? AND streaming_type IN (?, ?, ?)
		 GROUP BY media_type, media_tmdb_id`,
		[country, ...SUBSCRIPTION_TYPES],
	)
	const rows = result.rows as [string, number, number[]][]
	const queryMs = performance.now() - started

	const buildStarted = performance.now()
	const index = await buildIndex(rows)
	const buildMs = performance.now() - buildStarted

	indexes.set(country, index)
	const bytes =
		index.keys.byteLength +
		index.offsets.byteLength +
		index.entries.byteLength +
		index.services.length * 8
	stats.set(country, {
		country,
		titles: index.keys.length,
		entries: index.entries.length,
		services: index.services.length,
		bytes,
		rows: rows.length,
		queryMs: Math.round(queryMs),
		buildMs: Math.round(buildMs),
		loadedAt: new Date(index.loadedAt),
	})
	console.info(
		`Availability index: ${country} loaded ${index.keys.length} titles from ${rows.length} rows ` +
			`(query ${Math.round(queryMs)} ms, build ${Math.round(buildMs)} ms, ${(bytes / 1024 / 1024).toFixed(1)} MB)`,
	)
}

async function buildIndex(
	rows: [string, number, number[]][],
): Promise<CountryIndex> {
	const services: number[] = []
	const serviceIndex = new Map<number, number>()
	const rowKeys = new Float64Array(rows.length)
	for (let i = 0; i < rows.length; i++) {
		const [mediaType, tmdbId] = rows[i]
		rowKeys[i] = titleKey(mediaType === "show" ? "show" : "movie", tmdbId)
	}
	const keys = rowKeys.slice().sort()

	const offsets = new Uint32Array(rows.length + 1)
	const rowAt = new Uint32Array(rows.length)
	for (let i = 0; i < rows.length; i++) {
		if (i % YIELD_EVERY_ROWS === 0) await yieldToRequests()
		const at = binarySearch(keys, rowKeys[i])
		rowAt[i] = at
		offsets[at + 1] = rows[i][2].length
	}
	for (let t = 0; t < rows.length; t++) offsets[t + 1] += offsets[t]

	// Runs get room for every listed service, then drop repeats while compacting: Amazon Video and Prime Video both
	// map to Amazon Prime Video.
	const loose = new Uint16Array(offsets[rows.length])
	for (let i = 0; i < rows.length; i++) {
		if (i % YIELD_EVERY_ROWS === 0) await yieldToRequests()
		let fill = offsets[rowAt[i]]
		for (const serviceId of rows[i][2]) {
			const service = baseService(serviceId)
			let at = serviceIndex.get(service)
			if (at === undefined) {
				at = services.length
				services.push(service)
				serviceIndex.set(service, at)
			}
			loose[fill++] = at
		}
	}
	let size = 0
	for (let t = 0; t < rows.length; t++) {
		const from = offsets[t]
		const to = offsets[t + 1]
		const start = size
		offsets[t] = start
		for (let i = from; i < to; i++) {
			let repeated = false
			for (let j = start; j < size && !repeated; j++)
				repeated = loose[j] === loose[i]
			if (!repeated) loose[size++] = loose[i]
		}
	}
	offsets[rows.length] = size

	return {
		keys,
		offsets,
		entries: loose.slice(0, size),
		services,
		loadedAt: Date.now(),
	}
}

// Building an index takes up to about 100 ms; in slices, requests arriving meanwhile wait a few ms at most.
const yieldToRequests = () =>
	new Promise<void>((resolve) => setImmediate(resolve))

function findRow(index: CountryIndex, key: TitleKey): number {
	return binarySearch(index.keys, key)
}

function binarySearch(keys: Float64Array, key: number): number {
	let low = 0
	let high = keys.length - 1
	while (low <= high) {
		const mid = (low + high) >>> 1
		const value = keys[mid]
		if (value === key) return mid
		if (value < key) low = mid + 1
		else high = mid - 1
	}
	return -1
}

preloadAvailability()
