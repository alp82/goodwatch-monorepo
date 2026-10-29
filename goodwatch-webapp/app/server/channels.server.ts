import { isOnServices, availabilityLoadedAt } from "./availability-index.server"
import {
	channelPath,
	guessKeys,
	pathWords,
	serviceKeys,
	toChannel,
	type ChannelName,
	type ChannelsResponse,
} from "./channels"
import { poolCandidates } from "./living-room/pool-keys.server"
import { popularHomeKeys } from "./living-room/popular-keys.server"
import { loadedTitleTable } from "./search-ranking/search-index.server"
import {
	cachedDisplayNames,
	getCachedDisplayFields,
} from "./title-cards.server"
import type { TitleSnapshot } from "./title-snapshot/snapshot.server"

const nobody = {
	seen: new Set<number>(),
	skipped: new Set<number>(),
	hidden: new Set<number>(),
	wishlist: new Set<number>(),
	services: [],
}
type Channels = ChannelsResponse
const memo = new Map<string, { until: number; result: Promise<Channels> }>()
let nameTable: ReturnType<typeof loadedTitleTable> | undefined
/** Title names by length: a guess differs by one character at most, so it only reads three lengths. */
let namesByLength = new Map<number, ChannelName[]>()
let namesUntil = 0

function indexNames(entries: ChannelName[]) {
	const byLength = new Map<number, ChannelName[]>()
	for (const entry of entries) {
		const bucket = byLength.get(entry.name.length)
		if (bucket) bucket.push(entry)
		else byLength.set(entry.name.length, [entry])
	}
	return byLength
}

/** The names a path's words could match: the same length, or one character more or less. */
function namesNear(path: string): ChannelName[] {
	const length = pathWords(path).join(" ").length
	return [length - 1, length, length + 1].flatMap((n) => namesByLength.get(n) ?? [])
}

/** Whether the service lists could be filled: the country's availability is loaded. */
export function servicesReady(country: string): boolean {
	return availabilityLoadedAt(country) !== null
}

/**
 * Country and canonical path only; neither progress nor account identity enters this bounded cache.
 *
 * Guesses by id in the path (`/movie/603-…`, the shape of the site's own links) work everywhere. Guesses by name
 * read the search index's names where this process has loaded it (search roles); page roles have no list of every
 * title in memory, so there they know only the titles this process displayed in the last minutes. The title
 * snapshot holds no names.
 */
export function loadChannels(
	snapshot: TitleSnapshot,
	country: string,
	path: string,
): Promise<Channels> {
	const table = loadedTitleTable()
	// The search index's names are rebuilt only when a new build loads. Without one (page-only roles), the names
	// come from the display cache, which changes as pages are served: those are read again every 30 seconds.
	if (table !== nameTable || (!table && Date.now() >= namesUntil)) {
		nameTable = table
		namesByLength = indexNames(
			table
				? table.pointIds.map((key, row) => ({
						key,
						name: pathWords(table.titles[row]).join(" "),
						popularity: table.popularity[row],
					}))
				: cachedDisplayNames().map(({ key, title }) => ({
						key,
						name: pathWords(title).join(" "),
						popularity: snapshot.facts(key)?.popularity ?? 0,
					})),
		)
		namesUntil = Date.now() + 30_000
		memo.clear()
	}
	const today = Math.floor(Date.now() / 86_400_000)
	const cacheKey = JSON.stringify([
		snapshot.version,
		today,
		country,
		availabilityLoadedAt(country),
		channelPath(path),
	])
	const hit = memo.get(cacheKey)
	if (hit && hit.until > Date.now()) return hit.result
	const result = buildChannels(snapshot, country, path)
	memo.set(cacheKey, { until: Date.now() + 30_000, result })
	if (memo.size > 256) memo.delete(memo.keys().next().value!)
	result.catch(() => {
		if (memo.get(cacheKey)?.result === result) memo.delete(cacheKey)
	})
	return result
}

async function buildChannels(
	snapshot: TitleSnapshot,
	country: string,
	path: string,
): Promise<Channels> {
	const eligible = (key: number) => {
		const facts = snapshot.facts(key)
		return !!facts && facts.hasBackdrop && !facts.adult
	}
	const guesses = guessKeys(path, namesNear(path), eligible)
	const candidates = poolCandidates(
		snapshot,
		Math.floor(Date.now() / 86_400_000),
	)
	const withBackdrop = {
		...candidates,
		all: candidates.all.filter(({ key }) => eligible(key)),
	}
	const popular = popularHomeKeys(withBackdrop, nobody, () => null, 16).keys
	const keys = withBackdrop.all.map(({ key }) => key)
	// Only a country whose availability is already loaded: asking about another one would start its load from Crate.
	const loaded = availabilityLoadedAt(country) !== null
	const netflix = loaded
		? serviceKeys(keys, (key) => isOnServices(country, [8], key), 16)
		: []
	const prime = loaded
		? serviceKeys(keys, (key) => isOnServices(country, [9], key), 16)
		: []
	// At most 51 cache reads. Cold displays are skipped; this endpoint never fills them from Crate.
	const displays = await getCachedDisplayFields([
		...new Set([...guesses, ...popular, ...netflix, ...prime]),
	])
	const channels = (selected: number[], limit: number) =>
		selected
			.flatMap((key) => {
				const display = displays.get(key)
				const channel = display && toChannel(display)
				return channel ? [channel] : []
			})
			.slice(0, limit)
	return {
		guesses: channels(guesses, 3),
		popular: channels(popular, 12),
		netflix: channels(netflix, 12),
		prime: channels(prime, 12),
	}
}
