// The data under the eras pages: every decade of the kind with its
// story, and what each decade could not stop making titles about (its obsessions) with every obsession's life
// through the decades.
import { ing } from "~/domain/browse/address"
import type { Places } from "~/server/browse/places.server"
import { copyFor } from "~/domain/browse/copy-lookup"
import type { PlaceRef, ShowTitle } from "~/domain/browse/types"
import { FAMILY_COLOR } from "~/domain/fingerprint-effects/palette"
import { familyOf } from "~/domain/fingerprint-families"
import { OBSESSIONS } from "~/ui/browse/eras/words"

export interface Obsession {
	key: string
	/** The trait's own place: /movies/traits/<slug>. */
	slug: string
	noun: string
	color: string
	/** Per decade, oldest first: how much of it that decade had, 0-1 across its own life (1 is its peak). */
	life: number[]
	/** The index of the decade where it peaked. */
	peak: number
}

export interface DecadeTime {
	place: PlaceRef
	startYear: number
	short: string | null
	lede: string | null
	/** Keys of its obsessions, strongest first. */
	obsessions: string[]
}

export interface Times {
	/** Oldest first. */
	decades: DecadeTime[]
	/** Every obsession some decade has, by key. */
	words: Record<string, Obsession>
}

/**
 * What each decade had more of than titles usually do, measured in how far the decade's average stands from the
 * usual, in units of how much decades differ on that attribute at all. That way a decade is not "about real life"
 * only because real life is everywhere.
 */
export function times(atlas: Places, perDecade = 5): Times {
	const members = atlas.members("decade")
	const keys = OBSESSIONS.map((o) => o.key)
	const usual = atlas.usual(keys)
	const levels = members.map((d) => atlas.levels([ing("decade", d.slug)], keys))
	const spread = keys.map((_, k) => {
		const col = levels.map((l) => l[k])
		const m = col.reduce((a, b) => a + b, 0) / Math.max(1, col.length)
		return Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, col.length)) || 1
	})
	const words: Record<string, Obsession> = {}
	const decades = members.map((d, i): DecadeTime => {
		const copy = copyFor(atlas.kind, "decade", d.slug)
		const ranked = keys
			.map((key, k) => ({
				key,
				k,
				// Above the usual, and it has to be something the decade really has (not 1.2 against 0.8).
				z: (levels[i][k] - usual[k].mean) / spread[k],
				has: levels[i][k],
			}))
			.filter((x) => x.z > 0.1 && x.has >= 1.6)
			.sort((a, b) => b.z - a.z)
			// Clearly above the usual; a decade close to the average on everything still gets its top four.
			.filter((x, n) => x.z > 0.35 || n < Math.min(4, perDecade))
			.slice(0, perDecade)
		for (const r of ranked) {
			if (words[r.key]) continue
			const col = levels.map((l) => l[r.k])
			const lo = Math.min(...col)
			const hi = Math.max(...col)
			const life = col.map((v) => (hi > lo ? Math.round(((v - lo) / (hi - lo)) * 100) / 100 : 0.5))
			const o = OBSESSIONS[r.k]
			words[r.key] = {
				key: r.key,
				slug: r.key.replace(/_/g, "-"),
				noun: o.noun,
				color: FAMILY_COLOR[(familyOf(r.key as never) ?? "story") as keyof typeof FAMILY_COLOR],
				life,
				peak: life.indexOf(Math.max(...life)),
			}
		}
		return {
			place: d,
			startYear: Number.parseInt(d.label, 10),
			short: copy?.short ?? null,
			lede: copy?.lede ?? null,
			obsessions: ranked.map((r) => r.key),
		}
	})
	return { decades, words }
}

export interface YearFrame {
	year: number
	titles: ShowTitle[]
}

/** A mood or genre that a decade had more or less of than the decade before. */
export interface Shift {
	label: string
	place: PlaceRef | null
}

export interface DecadeYears {
	years: YearFrame[]
	/** Against the decade before. */
	rose: Shift[]
	fell: Shift[]
}

const frameMemo = new Map<string, { at: number; value: Record<string, DecadeYears> }>()

/**
 * Every decade's years with their standout titles (best-loved first) and what rose and fell against the decade
 * before, by decade slug. Years without a well-known title are left out. Kept for half an hour: it reads a few
 * thousand title cards the first time.
 */
export async function decadeYears(
	atlas: Places,
	perYear: number,
	opts: { lines?: boolean } = {},
): Promise<Record<string, DecadeYears>> {
	// A member's cards carry what they have seen and rated, so only a guest's are kept.
	const guest = !atlas.viewer.member
	const id = `${atlas.kind}|${perYear}|${opts.lines ? 1 : 0}`
	const hit = guest ? frameMemo.get(id) : undefined
	if (hit && Date.now() - hit.at < 30 * 60_000) return hit.value
	const value: Record<string, DecadeYears> = {}
	const shift = (x: { label: string; place: PlaceRef | null }): Shift => ({
		label: x.label,
		place: x.place,
	})
	for (const d of atlas.members("decade")) {
		const era = await atlas.era(d.slug, perYear, opts)
		value[d.slug] = {
			years: (era?.years ?? []).filter((y) => y.titles.length > 0),
			rose: (era?.rose ?? []).map(shift),
			fell: (era?.fell ?? []).map(shift),
		}
	}
	if (guest) frameMemo.set(id, { at: Date.now(), value })
	return value
}

/** A title for a real poster card, without the fields no card on these pages draws (the payload holds hundreds). */
export const lean = (t: ShowTitle): ShowTitle => ({
	to: t.to,
	line: t.line,
	card: { ...t.card, backdrop_path: null, tagline: null, reasons: [] } as ShowTitle["card"],
})
