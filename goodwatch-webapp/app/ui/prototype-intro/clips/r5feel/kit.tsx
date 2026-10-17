// PROTOTYPE - throwaway. Shared pieces of the round 5 "r5feel" clips (chapter 4, how it feels; chapter 5, search).
import type { CSSProperties, ReactNode } from "react"
import type { R5Attr, R5FeelData, R5Search } from "~/server/prototype-intro/r5feel.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

export const r5 = (data: IntroData) => (data.extra.r5feel ?? null) as R5FeelData | null

/** A delay (ms at k = 1) and other vars for a moving part. */
export const at = (ms: number, more: Record<string, string | number> = {}) => ({ "--d": `${ms}ms`, ...more }) as CSSProperties

export const img = (path: string | null | undefined, size: string) => (path ? tmdbImageUrl(path, size) : "")

/**
 * The attributes a viewer would say out loud: the strongest, as one plain word ("Spectacular", "Wondrous").
 */
export function sayable(top: R5Attr[], n = 4) {
	// Plain feeling words only: "technology-focused" or "sound-led" read as jargon on a landing page.
	return top
		.filter((a) => !/centrality/.test(a.key) && !/-(focused|led)$/.test(a.adjective) && !a.adjective.includes(" "))
		.slice(0, n)
		.map((a) => ({
			...a,
			word: a.adjective.charAt(0).toUpperCase() + a.adjective.slice(1),
			hex: a.color.replace(/0?\.\d+\)$/, "1)"),
		}))
}

export function Root({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`lpc-r5f ${className}`}>{children}</div>
}

export const Missing = () => (
	<div className="lpc-r5f">
		<div className="absolute inset-0 flex items-center justify-center text-[2.4cqw] text-white/50">No data loaded.</div>
	</div>
)

/**
 * When each reading chip shows while the phrase types: as soon as the word that asks for it has been typed. The
 * reading is the real one for the whole phrase; `triggers` maps a chip (by key, or its text) to the word that
 * carries it. Chips with no trigger show with the last word; the quoted-phrase chips are left out.
 */
export function liveChips(
	s: R5Search,
	triggers: Record<string, string>,
	start: number,
	perChar: number,
	opts: { wants?: number; avoids?: number } = {},
) {
	const { wants = 5, avoids = 1 } = opts
	const words = s.q.split(" ")
	const endOf = (word: string) => {
		let i = 0
		for (const w of words) {
			i += w.length
			if (w === word) return i
			i += 1
		}
		return s.q.length
	}
	const chips = s.reading.filter((c) => c.kind !== "phrase")
	const w = chips.filter((c) => c.kind !== "avoid" && c.kind !== "excluded").slice(0, wants)
	const a = chips.filter((c) => c.kind === "avoid" || c.kind === "excluded").slice(0, avoids)
	return [...w, ...a]
		.map((c) => {
			const word = triggers[c.key ?? c.text] ?? words[words.length - 1]
			return { chip: c, ms: start + endOf(word) * perChar + 140 }
		})
		.sort((x, y) => x.ms - y.ms)
}

/** Best known first (the search's own results), at most `perFranchise` that start with the same words. */
export function famous<T extends { title: string; poster: string | null; score: number | null }>(
	titles: T[],
	n: number,
	opts: { minScore?: number; perFranchise?: number } = {},
) {
	const { minScore = 0, perFranchise = 2 } = opts
	const seen = new Map<string, number>()
	const out: T[] = []
	for (const t of titles) {
		if (!t.poster || (t.score ?? 0) < minScore) continue
		const stem = t.title.split(/[:\s]/).slice(0, 3).join(" ")
		const c = seen.get(stem) ?? 0
		if (c >= perFranchise) continue
		seen.set(stem, c + 1)
		out.push(t)
		if (out.length >= n) break
	}
	return out
}
