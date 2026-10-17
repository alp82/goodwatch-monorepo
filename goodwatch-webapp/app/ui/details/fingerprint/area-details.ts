// What the details region shows for a selected area (its strongest traits and the more-like-this links), and the
// "Good for" line under the headline.

import * as F from "~/ui/fingerprint/fingerprintText"
import type { Area, TraitKey } from "./areas"

export interface AreaTrait {
	key: TraitKey
	score: number
	/** False for a trait outside the area's formula that still explains it. */
	own: boolean
}

/** The area's own traits strongest first, then up to two strong related traits from outside its formula. */
export function areaTraits(t: F.TitleInput, area: Area): AreaTrait[] {
	const { own, related } = F.pillarAttributes(t, area)
	return [
		...own.slice(0, 4).map((a) => ({ ...a, own: true })),
		...related
			.filter((a) => a.score >= 7)
			.slice(0, 2)
			.map((a) => ({ ...a, own: false })),
	]
}

const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }
const withoutEmoji = (label: string) =>
	label.replace(/\s*\p{Extended_Pictographic}.*$/u, "")

export interface AreaLink {
	label: string
	url: string
	/** The Discover link with the area filter, drawn in the area's color. */
	primary: boolean
}

/**
 * More like this: Discover filtered to the area at the title's tier (capped at high), then up to two mood pages
 * this title is on whose rules use the area's traits. Capped, so the details keep a predictable height.
 */
export function areaLinks(t: F.TitleInput, area: Area): AreaLink[] {
	const tier = t.fingerprint.pillars[area]
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const links: AreaLink[] = []
	if (tier >= 1) {
		const minTier = Math.min(3, tier)
		links.push({
			label: `More ${kind} with ${FILTER_WORD[minTier]} ${area.toLowerCase()}`,
			url: `/discover/${kind}?fingerprintPillars=${area}&fingerprintPillarMinTier=${minTier}`,
			primary: true,
		})
	}
	const moods = F.moodsForKeys(t, [
		...F.PILLAR_KEYS[area],
		...F.RELATED_KEYS[area],
	]).slice(0, 2)
	for (const m of moods)
		links.push({
			label: `${withoutEmoji(m.label)} ${kind}`,
			url: m.url,
			primary: false,
		})
	return links
}

// Generic audiences say little, so specific occasions come first.
const LOW_INFO = [
	"Adults",
	"Public Viewing Safe",
	"Solo Watch",
	"Intergenerational",
	"Partner Watch",
]

/** Up to three audiences and occasions from the viewing guide, lower case, specific ones first. */
export function goodFor(t: F.TitleInput): string[] {
	const all = [
		...t.fingerprint.socialSuitability,
		...t.fingerprint.viewingContext,
	].map((x) => x.name)
	return [
		...all.filter((x) => !LOW_INFO.includes(x)),
		...all.filter((x) => LOW_INFO.includes(x)),
	]
		.slice(0, 3)
		.map((x) => x.toLowerCase())
}
