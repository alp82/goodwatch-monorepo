// The fingerprint band: one segment per area, as wide as the area is strong, striped by the area's traits. Stripe
// widths and their order come from a seeded random number per title, so every title gets its own band and the
// server and the browser draw the same one.

import * as F from "~/ui/fingerprint/fingerprintText"
import { seededRandomFromString } from "~/utils/random"
import type { Area, Scores, TraitKey } from "./areas"

// seededRandomFromString spreads differences early in the string far better than at its end, so the part that
// changes from stripe to stripe goes first and the title last.
const random = (part: string, seed: string) =>
	seededRandomFromString(`${part}|${seed}`)

/** A segment's share of the band's width: a tier-0 area still gets a sliver. */
export const segmentGrow = (tier: number) => tier + 1.5

export interface Stripe {
	id: string
	/** Relative width within the segment. */
	width: number
	/** How bright the stripe is, from 0 to 10. */
	brightness: number
}

/**
 * The stripes of one area's segment: a few per trait (more for a higher score), the area's own traits and the
 * traits that explain it, shuffled by the title.
 */
export function areaStripes(area: Area, s: Scores, seed: string): Stripe[] {
	const own = F.PILLAR_KEYS[area]
	const keys: TraitKey[] = [
		...own,
		...F.RELATED_KEYS[area].filter((k) => !own.includes(k)),
	]
	const stripes: (Stripe & { order: number })[] = []
	for (const k of keys) {
		const count = 1 + Math.round(s[k] / 1.6)
		for (let i = 0; i < count; i++) {
			const r = random(`${i}:${k}`, seed)
			stripes.push({
				id: `${k}${i}`,
				// Three decimals are far below a pixel and keep the server's HTML short.
				width: Math.round((0.35 + r * 1.3) * (0.6 + s[k] / 20) * 1000) / 1000,
				brightness: Math.max(0, Math.min(10, s[k] + (r - 0.5) * 4)),
				order: random(`order ${i}:${k}`, seed),
			})
		}
	}
	return stripes
		.sort((a, b) => a.order - b.order)
		.map(({ order, ...stripe }) => stripe)
}

/** A stripe's color: the area's color mixed into the page's dark background by brightness. */
export const stripeColor = (hex: string, brightness: number) =>
	`color-mix(in srgb, ${hex} ${Math.round(8 + brightness * 9.2)}%, #0c0a09)`
