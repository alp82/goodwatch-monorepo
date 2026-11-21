// PROTOTYPE - throwaway (prototype/explore-r4). The kit gallery's data: one real example of everything the data kit
// returns, for the page that shows every kit component.
import { type Ingredient, ing } from "../kit/address"
import type { LoadArgs } from "../kit/contract"
import { loadBench } from "../concepts/lab/slots/card/bench.server"

export async function loadGallery(args: LoadArgs) {
	const { kit, url } = args
	// Round 5: the card bench (every card variant × family × size) lives at ?bench=cards.
	if (url.searchParams.get("bench") === "cards")
		return (await loadBench(args)) as unknown as GalleryData
	const cozy = [ing("mood", "cozy")]
	const comedy = [ing("genre", "comedy")]
	const scary = [ing("mood", "scary")]
	const pair = [ing("mood", "cozy"), ing("genre", "comedy")]
	const t0 = performance.now()
	const timed = async <T>(name: string, run: () => Promise<T> | T) => {
		const s = performance.now()
		const value = await run()
		return { name, ms: Math.round(performance.now() - s), value }
	}
	const moods = kit.members("mood")
	const venn = (["a", "b"] as const).includes(url.searchParams.get("venn") as "a")
		? (url.searchParams.get("venn") as "a" | "b")
		: "both"
	const level = (["touch", "plenty", "full"] as const).find(
		(l) => l === url.searchParams.get("level"),
	)
	const sort = (["popular", "top", "newest"] as const).find(
		(s) => s === url.searchParams.get("sort"),
	)
	const parts = {
		moodCards: await timed("16 mood cards (showcase × 16)", () =>
			Promise.all(
				moods.map(async (place) => ({
					place,
					titles: await kit.showcase([place as Ingredient], 3),
				})),
			),
		),
		popular: await timed("popular(14)", () => kit.popular(14)),
		traits: await timed("traits(cozy)", () => kit.traits(cozy, { n: 4, less: 2 })),
		genreCards: await timed("genre cards (showcase × 8)", () =>
			Promise.all(
				kit
					.members("genre")
					.slice(0, 8)
					.map(async (place) => ({
						place,
						titles: await kit.showcase([place], 3),
						words: kit.traits([place], { n: 2 }).more,
					})),
			),
		),
		serviceCards: await timed("service cards", () =>
			Promise.all(
				kit
					.members("service")
					.slice(0, 4)
					.map(async (place) => ({
						place,
						titles: await kit.showcase([place], 3, { by: "best" }),
						profile: kit.serviceProfile(place.slug),
					})),
			),
		),
		countries: await timed("members(country)", () =>
			kit.members("country").map((p) => ({ place: p, n: kit.count([p]) })),
		),
		kinds: await timed("kinds(comedy)", () => kit.kinds(comedy, 6)),
		neighbors: await timed("neighbors(cozy)", () => kit.neighbors(cozy[0], { n: 4 })),
		neighborsAll: await timed("neighbors(cozy, all families)", () =>
			kit.neighbors(cozy[0], { n: 4, within: "all", titles: 0 }),
		),
		intensity: await timed("intensity(scary)", () => kit.intensity(scary, 8)),
		dials: await timed("dials(cozy)", () => kit.dials(cozy[0])),
		era: await timed("era(1990s)", () => kit.era("1990s", 2)),
		best: await timed("best() top 12", () => kit.best({ limit: 12 })),
		bestCozy: await timed("best(cozy, 2010s)", () =>
			kit.best({ parts: [...cozy, ing("decade", "2010s")], limit: 5 }),
		),
		people: await timed("people(comedy)", () => kit.people(comedy, 5)),
		awards: await timed("awards(drama)", () => kit.awards([ing("genre", "drama")], 6)),
		blend: await timed("blend(cozy + comedy)", () => kit.blend(pair, { suggestions: 6 })),
		famous: await timed("famousBlends(8)", () => kit.famousBlends(8)),
		defining: await timed("showcase(cozy, lines)", () =>
			kit.showcase(cozy, 3, { lines: true, used: new Set() }),
		),
		list: await timed("list(cozy + comedy)", () =>
			kit.list(pair, {
				size: 12,
				venn,
				level,
				sort,
				mine: url.searchParams.get("mine") === "1",
				unseen: url.searchParams.get("unseen") === "1",
			}),
		),
		print: await timed("print(horror)", () => kit.print([ing("genre", "horror")])),
	}
	return {
		...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.value])),
		timings: Object.values(parts).map((p) => ({ name: p.name, ms: p.ms })),
		totalMs: Math.round(performance.now() - t0),
		names: {
			pair: kit.name(pair),
			three: kit.name([
				ing("mood", "dark"),
				ing("genre", "thriller"),
				ing("country", "south-korea"),
			]),
			best: kit.name([...cozy, ing("decade", "2010s")], { best: true }),
			service: kit.name([
				ing("genre", "action"),
				ing("decade", "1990s"),
				ing("service", "netflix"),
			]),
		},
		cozy: kit.ref(cozy[0]),
		comedy: kit.ref(comedy[0]),
		venn,
		level: level ?? null,
	} as unknown as GalleryData
}

type V<K extends keyof import("../kit/data.server").Kit> = Awaited<
	ReturnType<Extract<import("../kit/data.server").Kit[K], (...a: never[]) => unknown>>
>
import type { PlaceRef, ShowTitle, TraitWord } from "../kit/types"

export interface GalleryData {
	moodCards: { place: PlaceRef; titles: ShowTitle[] }[]
	popular: ShowTitle[]
	traits: { more: TraitWord[]; less: TraitWord[] }
	genreCards: { place: PlaceRef; titles: ShowTitle[]; words: TraitWord[] }[]
	serviceCards: { place: PlaceRef; titles: ShowTitle[]; profile: V<"serviceProfile"> }[]
	countries: { place: PlaceRef; n: number }[]
	kinds: V<"kinds">
	neighbors: V<"neighbors">
	neighborsAll: V<"neighbors">
	intensity: V<"intensity">
	dials: V<"dials">
	era: V<"era">
	best: V<"best">
	bestCozy: V<"best">
	people: V<"people">
	awards: V<"awards">
	blend: V<"blend">
	famous: V<"famousBlends">
	defining: ShowTitle[]
	list: V<"list">
	print: V<"print">
	timings: { name: string; ms: number }[]
	totalMs: number
	names: Record<string, string>
	cozy: PlaceRef
	comedy: PlaceRef
	venn: "a" | "both" | "b"
	level: "touch" | "plenty" | "full" | null
}
