/**
 * Synthetic catalog and idea search for local multiplayer runs (YEPWATCH_LOCAL_FIXTURES=1):
 * no GoodWatch database, search role or account service. The deck goes through the real
 * deck, idea interleaving and attribution code; only the reads and the interpreter are fake.
 */
import { createContinuousCatalog } from "./continuous-catalog.ts"
import type { CatalogDisplay, CatalogReads } from "./catalog-adapter.ts"
import { proposalCatalog } from "./proposal-catalog.server.ts"
import { roomIntentKeys, type InterpretRoom } from "./proposal-intent.ts"
import { matchingIdeaIds } from "./proposal-redesign.ts"
import type { ProposalCatalog, ProposalRoom } from "./proposal-types.ts"
import { providerCatalog, type ProviderCatalogRow } from "./provider-catalog.ts"
import { fixtureEpisodes } from "./test-support.ts"

const PROVIDERS: [number, string][] = [
	[8, "Netflix"],
	[1796, "Netflix Standard with Ads"],
	[9, "Amazon Prime Video"],
	[10, "Amazon Video"],
	[337, "Disney Plus"],
	[350, "Apple TV+"],
	[1899, "HBO Max"],
	[531, "Paramount Plus"]
]
const COUNTRIES = [
	{ code: "DE", name: "Germany" },
	{ code: "US", name: "United States" },
	{ code: "GB", name: "United Kingdom" }
]
const rows: ProviderCatalogRow[] = PROVIDERS.map(([id, name], i) => ({
	tmdb_id: id,
	name,
	logo_path: null,
	order_by_country: Object.fromEntries(COUNTRIES.map((c) => [c.code, i])),
	order_default: i
}))
const STREAMING = PROVIDERS.map(([id]) => id).filter((id) => id !== 10)
const WORDS = [
	"funny", "mystery", "space", "family", "rainy", "twist", "cartoon", "short",
	"cosy", "heist", "romance", "horror", "western", "musical", "war", "sports"
]
/** 600 titles: movies and new shows, two words each, offered on two services. */
const TITLES: CatalogDisplay[] = Array.from({ length: 600 }, (_, n) => {
	const i = n + 1
	const show = i % 3 === 0
	const words = [WORDS[i % WORDS.length], WORDS[(i * 7) % WORDS.length]]
	return {
		key: (show ? 2_000_000_000_000 : 1_000_000_000_000) + i,
		tmdbId: i,
		mediaType: show ? "show" : "movie",
		title: `${words[0][0].toUpperCase()}${words[0].slice(1)} ${words[1]} ${i}`,
		year: 1990 + (i % 35),
		overview: `A ${words.join(", ")} title.`,
		posterUrl: null,
		runtimeMinutes: show ? 30 : 80 + (i % 60),
		goodwatchScore: 50 + (i % 50),
		genres: words
	}
})
const byKey = new Map(TITLES.map((t) => [t.key, t]))
const servicesOf = (t: CatalogDisplay) => [
	STREAMING[t.tmdbId % STREAMING.length],
	STREAMING[(t.tmdbId * 5 + 3) % STREAMING.length]
]

const reads: CatalogReads = {
	async rankedKeys() {
		return TITLES.map((t) => t.key)
	},
	async displays(keys) {
		return new Map(
			keys.flatMap((k) => (byKey.has(k) ? [[k, byKey.get(k)!] as const] : []))
		)
	},
	async episodes() {
		return fixtureEpisodes
	},
	async availability(titles, screens) {
		return new Map(
			titles.map((t) => [
				t.key,
				screens.map((s) => {
					const offered = servicesOf(t).filter((id) => s.serviceIds.includes(id))
					return {
						screenId: s.id,
						state: offered.length ? "watchable" : "no_match",
						scope: "title",
						checkedAt: Date.now(),
						offers: offered.map((id) => ({
							serviceId: id,
							name: PROVIDERS.find(([p]) => p === id)![1],
							url: `https://example.invalid/watch/${id}/${t.tmdbId}`,
							kind: "provider",
							offerType: "flatrate"
						}))
					}
				})
			])
		) as Awaited<ReturnType<CatalogReads["availability"]>>
	}
}

async function metadata(country?: string | null) {
	return {
		countries: COUNTRIES,
		...providerCatalog(rows, country && /^[A-Z]{2}$/.test(country) ? country : "US"),
		moods: []
	}
}

function localCatalog(): ProposalCatalog {
	const base = createContinuousCatalog(reads, metadata, {
		rank: async (room, keys) => roomIntentKeys(room as ProposalRoom, keys)
	})
	const catalog = proposalCatalog(base)
	return {
		...catalog,
		async page(room) {
			const page = await catalog.page(room)
			return {
				...page,
				candidates: page.candidates.map((c) => ({
					...c,
					ideaIds: matchingIdeaIds(room, c)
				}))
			}
		}
	}
}

/** Titles whose words appear in the idea, best score first; other ideas get a stable slice. */
const interpret: InterpretRoom = async (prompt) => {
	const words = prompt.toLowerCase().split(/\W+/)
	let hits = TITLES.filter((t) => t.genres!.some((g) => words.includes(g)))
	if (!hits.length) {
		const seed = [...prompt].reduce((a, c) => a + c.charCodeAt(0), 0)
		hits = TITLES.filter((t) => (t.tmdbId + seed) % 9 === 0)
	}
	return {
		prompt,
		attributes: words
			.filter((w) => WORDS.includes(w))
			.map((w) => ({ text: w, kind: "want" as const })),
		rankedKeys: hits
			.sort((a, b) => (b.goodwatchScore ?? 0) - (a.goodwatchScore ?? 0))
			.map((t) => t.key),
		interpretedAt: Date.now()
	}
}

export const localFixture = { catalog: localCatalog(), interpret }
