// PROTOTYPE - throwaway. One title per franchise in a row (round 14). A franchise is a movie's TMDB collection
// (r14b.server.ts); without one, the title's name before any colon, and its first two words ("Star Wars",
// "Star Trek"), so Star Trek Beyond and the Star Trek show count as one too.
import type { IntroData } from "../../../clip"

const series = (data: IntroData) => ((data.extra.r14b as { series?: Record<string, number> } | null)?.series ?? {})

const tmdbOf = (key: string | number) => {
	const k = Number(key)
	return k >= 2_000_000_000_000 ? null : k - 1_000_000_000_000
}

export function onePerFranchise<T extends { key: string | number; title: string }>(data: IntroData, titles: T[], n: number): T[] {
	const map = series(data)
	const seen = new Set<string>()
	const out: T[] = []
	for (const t of titles) {
		const id = tmdbOf(t.key)
		const name = t.title.toLowerCase().replace(/^the\s+/, "")
		const keys = [
			id !== null && map[String(id)] ? `c:${map[String(id)]}` : null,
			`n:${name.split(":")[0].trim()}`,
			`w:${name.split(/[\s:]+/).slice(0, 2).join(" ")}`,
		].filter((x): x is string => Boolean(x))
		if (keys.some((k) => seen.has(k))) continue
		for (const k of keys) seen.add(k)
		out.push(t)
		if (out.length >= n) break
	}
	return out
}
