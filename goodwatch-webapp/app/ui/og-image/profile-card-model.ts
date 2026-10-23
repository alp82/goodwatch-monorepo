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
