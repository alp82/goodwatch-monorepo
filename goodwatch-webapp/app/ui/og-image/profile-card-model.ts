// What the member profile cards show (/u/<handle> and one card per tab), and the pure rules behind them: which
// fingerprint attributes become picks, and the relative facts on the tab cards. No counts and no viewer type: every
// fact is a share, a shape or a word (owner decision, 2026-10-23).
import type { FamilyId } from "../../server/taste-portrait/view.ts"
import { PROFILE_CARD_COPY } from "./copy.ts"

export type ProfileCardTab = keyof typeof PROFILE_CARD_COPY.tabs
/** The tabs with a card of their own: /u/<handle>/<tab>. */
export const PROFILE_CARD_TABS = Object.keys(
	PROFILE_CARD_COPY.tabs,
) as ProfileCardTab[]

/**
 * Sections of the Taste tab with a card of their own: /u/<handle>/taste/<view>. They sit under the Taste tab's path,
 * so they can't collide with a profile tab, and that page keeps the Taste card for its own link preview.
 */
export const PROFILE_CARD_VIEWS = ["everyone", "sides"] as const
export type ProfileCardView = (typeof PROFILE_CARD_VIEWS)[number]

/** Every card path of a profile, for forgetting them all after a settings change. */
export const profileCardPaths = (handle: string) => [
	`/u/${handle}`,
	...PROFILE_CARD_TABS.map((tab) => `/u/${handle}/${tab}`),
	...PROFILE_CARD_VIEWS.map((view) => `/u/${handle}/taste/${view}`),
]

/** What the print needs of an attribute (the Whorl's shape). */
export interface CardAttribute {
	key: string
	label: string
	family: FamilyId
	edge: number
}

export interface CardPerson {
	handle: string
	/** A data URI or remote address (the renderer inlines it); null draws the initial. */
	avatar: string | null
	/** The initial's gradient: from, to, ink. */
	avatarColors: [string, string, string]
}

/** The /u/<handle> card. */
export interface OgProfileContent extends CardPerson {
	kind: "profile"
	/** The fingerprint, or null when the taste isn't public or not formed. */
	print: CardAttribute[] | null
	/** Up to four of the strongest pulls, at most two per family. */
	picks: CardAttribute[]
	/** Without a print: favorites' posters (when the scores are public). */
	posters: (string | null)[]
}

export type ProfileTabVisual =
	| { type: "scores"; spread: number[]; posters: (string | null)[] }
	| {
			type: "posters"
			kicker: string | null
			posters: (string | null)[]
			split: { name: string; share: number; color: string }[] | null
	  }
	| { type: "shows"; shows: { poster: string | null; progress: number }[] }
	| { type: "lists"; lists: { title: string; posters: (string | null)[] }[] }
	| {
			type: "taste"
			print: CardAttribute[]
			groups: { name: string; size: number; average: number | null }[]
	  }

/** A /u/<handle>/<tab> card: the main card's header with the tab's name, one visual, one line. */
export interface OgProfileTabContent extends CardPerson {
	kind: "profile-tab"
	title: string
	line: string
	visual: ProfileTabVisual
}

/** The strongest pulls (positive edge), strongest first, at most `perFamily` from one family. */
export function pickAttributes<T extends { family: string; edge: number }>(
	attributes: T[],
	count = 4,
	perFamily = 2,
): T[] {
	const picks: T[] = []
	const used = new Map<string, number>()
	for (const a of [...attributes].sort((x, y) => y.edge - x.edge)) {
		if (a.edge <= 0 || picks.length >= count) break
		const n = used.get(a.family) ?? 0
		if (n >= perFamily) continue
		used.set(a.family, n + 1)
		picks.push(a)
	}
	return picks
}

/** "Usually a 7 · 40% get 8 or more" from the 1-10 spread; null without scores. */
export function scoresLine(spread: number[]): string | null {
	const total = spread.reduce((s, n) => s + n, 0)
	if (!total) return null
	const mean = spread.reduce((s, n, i) => s + n * (i + 1), 0) / total
	const high = spread.slice(7).reduce((s, n) => s + n, 0) / total
	return `Usually a ${Math.round(mean)} · ${Math.round(high * 100)}% get 8 or more`
}

/** The decade with the most titles, "2000s"; null without any. */
export function peakDecade(
	decades: { decade: number; count: number }[],
): string | null {
	const top = [...decades]
		.filter((d) => d.count > 0)
		.sort((a, b) => b.count - a.count || b.decade - a.decade)[0]
	return top ? `${top.decade}s` : null
}

/** "Mostly movies", "Mostly shows" or "Movies and shows alike" from the movie share, 0 to 1. */
export function mediumWord(movieShare: number): string {
	if (movieShare >= 0.65) return "Mostly movies"
	if (movieShare <= 0.35) return "Mostly shows"
	return "Movies and shows alike"
}

/** "novelty and absurdist humor", lowercase, for a sentence. */
export const pullWords = (picks: { label: string }[]) =>
	picks
		.slice(0, 2)
		.map((p) => p.label.toLowerCase())
		.join(" and ")

// ---------- Taste tab sections: you vs everyone, taste groups ----------

/** A rated title of the everyone view, with its title resolved. */
export interface EveryoneRowInput {
	title: string
	poster: string | null
	/** Their score, 1 to 10. */
	mine: number
	/** GoodWatch score, 0 to 100, as the everyone view has it. */
	everyone: number
}

export interface EveryoneTake {
	title: string
	poster: string
	/** Their score, 1 to 10. */
	mine: number
	/** Everyone's score in points out of 10, one decimal. */
	everyone: number
}

/** /u/<handle>/taste/everyone: titles they score far from everyone, each on a 1 to 10 line. */
export interface OgProfileEveryoneContent extends CardPerson {
	kind: "profile-everyone"
	/** One or two: the strongest above everyone, then the strongest below. */
	takes: EveryoneTake[]
}

export interface SideInput {
	id: string
	name: string
	family: FamilyId
	/** Posters of the titles they love there, most typical first. */
	posters: (string | null)[]
}

export interface CardSide {
	name: string
	family: FamilyId
	/** Up to three. */
	posters: string[]
}

/** /u/<handle>/taste/sides: "Loves X, and just as much Y", the two taste groups least alike. No numbers. */
export interface OgProfileSidesContent extends CardPerson {
	kind: "profile-sides"
	first: CardSide
	second: CardSide
}

const take = (r: EveryoneRowInput): EveryoneTake => ({
	title: r.title,
	poster: r.poster as string,
	mine: r.mine,
	everyone: Math.round(r.everyone) / 10,
})

/**
 * The two titles the everyone card shows: the one they score furthest above everyone and the one furthest below, by
 * the plain gap between the two scores. With one side empty, the two strongest of the other. Rows without a poster or title are
 * skipped. Null when scores are hidden from guests, the view isn't ready, or no row is left: the card falls back to the
 * main one.
 */
export function everyoneTakes(
	view: {
		status: "ready" | "empty" | "unavailable"
		higher: EveryoneRowInput[]
		lower: EveryoneRowInput[]
	} | null,
	scoresVisible: boolean,
): EveryoneTake[] | null {
	if (!scoresVisible || !view || view.status !== "ready") return null
	// The view's lists rank by a gap adjusted for the member's generosity; the card shows plain scores, so it ranks by
	// the plain gap between the two numbers it draws.
	const gap = (r: EveryoneRowInput) => r.mine - Math.round(r.everyone) / 10
	const seen = new Set<EveryoneRowInput>()
	const rows = [...view.higher, ...view.lower].filter(
		(r) => r.title && r.poster && !seen.has(r) && seen.add(r),
	)
	const above = rows.filter((r) => gap(r) > 0).sort((a, b) => gap(b) - gap(a))
	const below = rows.filter((r) => gap(r) < 0).sort((a, b) => gap(a) - gap(b))
	const picked =
		above.length && below.length
			? [above[0], below[0]]
			: [...above, ...below]
					.sort((a, b) => Math.abs(gap(b)) - Math.abs(gap(a)))
					.slice(0, 2)
	return picked.length ? picked.map(take) : null
}

/**
 * The two taste groups the sides card shows: the view's headline pair (the two least alike), else the first and the
 * last. Null with fewer than two groups or a view that isn't ready.
 */
export function sidesPair(
	view: {
		status: "ready" | "empty" | "unavailable"
		headline: { first: string; second: string } | null
		sides: SideInput[]
	} | null,
): [CardSide, CardSide] | null {
	if (!view || view.status !== "ready" || view.sides.length < 2) return null
	const byId = (id: string | undefined) => view.sides.find((s) => s.id === id)
	const first = byId(view.headline?.first) ?? view.sides[0]
	const second =
		byId(view.headline?.second) ?? view.sides[view.sides.length - 1]
	if (first === second) return null
	const side = (s: SideInput): CardSide => ({
		name: s.name,
		family: s.family,
		posters: s.posters.filter((p): p is string => Boolean(p)).slice(0, 3),
	})
	return [side(first), side(second)]
}

/**
 * Centers for two numbers of `width` over markers at `a` and `b` in a box `box` wide: over their markers, pushed apart
 * symmetrically when they would overlap, and shifted together to stay inside the box.
 */
export function labelCenters(
	a: number,
	b: number,
	width: number,
	box: number,
): [number, number] {
	const min = width / 2
	const max = box - width / 2
	const clamp = (x: number) => Math.min(max, Math.max(min, x))
	const gap = Math.abs(a - b)
	if (gap >= width) return [clamp(a), clamp(b)]
	const push = (width - gap) / 2
	const lo = Math.min(a, b) - push
	const hi = Math.max(a, b) + push
	const shift = lo < min ? min - lo : hi > max ? max - hi : 0
	return a <= b ? [lo + shift, hi + shift] : [hi + shift, lo + shift]
}
