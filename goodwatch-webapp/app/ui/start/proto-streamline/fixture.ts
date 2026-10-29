// PROTOTYPE (start-streamline): an offline stand-in for the start page's search and results, so the prototype runs
// on the harness without production data. In the browser only: `fetch` answers /api/discover/results from the
// fixture cards, and start-search.ts asks `fixtureSearch` instead of the combined search while it's installed.
import { WORDS } from "~/domain/taste-picker"
import type { TitleKey } from "~/utils/title-key"

type Card = { key: number } & Record<string, unknown>

let cards: Promise<Card[]> | null = null
const loadCards = () => {
	cards ??= fetch("/prototype/start-streamline-fixture")
		.then((r) => r.json())
		.then((b: { cards: Card[] }) => b.cards)
		.catch(() => [])
	return cards
}

const hash = (s: string) => {
	let h = 2166136261
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
	return h >>> 0
}

const shuffled = <T,>(list: readonly T[], seed: number) => {
	const out = [...list]
	let s = seed || 1
	for (let i = out.length - 1; i > 0; i--) {
		s = (Math.imul(s, 1103515245) + 12345) >>> 0
		const j = s % (i + 1)
		;[out[i], out[j]] = [out[j], out[i]]
	}
	return out
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The fixture search: about 0.9 s, like the real typed search. */
export async function fixtureSearch(
	text: string,
): Promise<{ ranked: TitleKey[]; reading: [] }> {
	const all = await loadCards()
	await wait(900)
	if (/^(zzz|nothing)/i.test(text)) return { ranked: [], reading: [] }
	const ranked = shuffled(all, hash(text)).map((c) => c.key as TitleKey)
	return { ranked, reading: [] }
}

const counts = (seed: number) => {
	const out = { moods: {}, themes: {}, styles: {} } as Record<
		"moods" | "themes" | "styles",
		Record<string, number>
	>
	for (const w of WORDS) {
		const bucket =
			w.kind === "mood" ? "moods" : w.kind === "theme" ? "themes" : "styles"
		out[bucket][w.key] = 12 + (hash(`${w.id}${seed}`) % 180)
	}
	return out
}

export function installFixture() {
	const w = window as unknown as {
		__pstFixture?: boolean
		fetch: typeof fetch
	}
	if (w.__pstFixture) return
	w.__pstFixture = true
	void loadCards()
	const real = w.fetch.bind(window)
	w.fetch = async (input, init) => {
		const url = new URL(
			typeof input === "string" || input instanceof URL ? input : input.url,
			window.location.href,
		)
		if (url.pathname !== "/api/discover/results") return real(input, init)
		const all = await loadCards()
		await wait(250)
		const ranked = url.searchParams.get("ranked")
		const seed = hash(url.searchParams.toString())
		const keys = ranked
			? ranked.split(",").map(Number)
			: shuffled(all, seed).map((c) => c.key)
		const byKey = new Map(all.map((c) => [Number(c.key), c]))
		const picked = keys
			.map((k) => byKey.get(k))
			.filter((c): c is Card => !!c)
			// More picks narrow the list a little, so totals move.
			.slice(0, Math.max(6, all.length - 3 * (url.searchParams.getAll("moods").length)))
		const body = {
			cards: picked,
			keys: picked.map((c) => c.key),
			total: ranked ? picked.length : 40 + (seed % 400),
			optionCounts: counts(seed),
		}
		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}
}

export const fixtureOn = () =>
	typeof window !== "undefined" &&
	!!(window as unknown as { __pstFixture?: boolean }).__pstFixture
