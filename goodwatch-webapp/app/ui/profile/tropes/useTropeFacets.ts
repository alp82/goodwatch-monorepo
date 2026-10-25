// The Tropes tab's filter state: the filters, the titles they keep, the ranked and sorted tropes, and each choice
// with its count, picture and toggle for the filter bar.
import { useMemo, useState } from "react"
import type { TropesPreview } from "~/server/profile/tropes-preview"
import type { ProfileTropes } from "~/server/profile/tropes.server"
import {
	type Facets,
	KINDS,
	MINS,
	NO_FACETS,
	NO_HUE,
	choiceStats,
	eraLabel,
	eraOf,
	erasOf,
	genreHue,
	keeps,
	rankTropes,
	sortTropes,
} from "./model"

export interface Choice {
	id: string
	label: string
	on: boolean
	/** Titles it leaves, the other filters applied. */
	count: number
	hue: string
	/** A backdrop path for the tile picture. */
	picture: string | null
	toggle: () => void
}

export type TropeFacets = ReturnType<typeof useTropeFacets>

export function useTropeFacets(
	data: ProfileTropes,
	owner: boolean,
	preview?: TropesPreview,
) {
	const { pool, titles } = data
	const [f, setF] = useState<Facets>(NO_FACETS)
	const set = (patch: Partial<Facets>) => setF((now) => ({ ...now, ...patch }))
	const seenSet = useMemo(() => new Set(data.seen), [data.seen])
	const seen = (key: string) => seenSet.has(key)

	const subset = useMemo(() => pool.filter((t) => keeps(t, f)), [pool, f])
	/** The filtered titles that carry a ranked trope, for the counts. */
	const carrying = useMemo(
		() => preview?.carrying ?? subset.filter((t) => t.r.length > 0).length,
		[subset, preview],
	)
	const { ranked, usual } = useMemo(
		() =>
			preview
				? { ranked: preview.ranked, usual: preview.usual }
				: rankTropes(data, subset),
		[data, subset, preview],
	)
	const tropes = useMemo(() => sortTropes(ranked, f.sort), [ranked, f.sort])
	const eras = useMemo(() => preview?.eras ?? erasOf(pool), [pool, preview])
	const stats = (
		id: string,
		skip: keyof Facets,
		test: Parameters<typeof choiceStats>[4],
	) => preview?.choices[id] ?? choiceStats(pool, titles, f, skip, test)

	const kindChoices: Choice[] = KINDS.map((k) => ({
		id: k.key,
		label: k.label,
		on: f.kind === k.key,
		hue: NO_HUE,
		...stats(
			k.key,
			"kind",
			(t) => k.key === "all" || t.m === (k.key === "movie" ? 0 : 1),
		),
		toggle: () => set({ kind: k.key }),
	}))
	const genreChoices: Choice[] = data.genres
		.map((name, i) => ({
			id: `g${i}`,
			label: name,
			on: f.genres.includes(i),
			hue: genreHue(name),
			...stats(`g${i}`, "genres", (t) => t.g.includes(i)),
			toggle: () =>
				setF((now) => ({
					...now,
					genres: now.genres.includes(i)
						? now.genres.filter((g) => g !== i)
						: [...now.genres, i],
				})),
		}))
		.sort((a, b) => b.count - a.count)
	const eraChoices: Choice[] = eras.map((e) => ({
		id: `e${e}`,
		label: eraLabel(e),
		on: f.eras.includes(e),
		hue: NO_HUE,
		...stats(`e${e}`, "eras", (t) => t.y != null && eraOf(t.y) === e),
		toggle: () =>
			setF((now) => ({
				...now,
				eras: now.eras.includes(e)
					? now.eras.filter((x) => x !== e)
					: [...now.eras, e],
			})),
	}))
	const minChoices: Choice[] = MINS.map((m) => ({
		id: m.key,
		label:
			m.key === "any" ? m.label : `${owner ? "You" : "They"} scored ${m.label}`,
		on: f.min === m.key,
		hue: NO_HUE,
		...stats(
			`min-${m.key}`,
			"min",
			(t) => m.key === "any" || t.s >= Number(m.key),
		),
		toggle: () => set({ min: m.key }),
	}))

	/** The picks other than the defaults, as removable chips. */
	const picked: Choice[] = [
		...kindChoices
			.filter((c) => c.on && c.id !== "all")
			.map((c) => ({ ...c, toggle: () => set({ kind: "all" }) })),
		...genreChoices.filter((c) => c.on),
		...eraChoices.filter((c) => c.on),
		...minChoices
			.filter((c) => c.on && c.id !== "any")
			.map((c) => ({ ...c, toggle: () => set({ min: "any" }) })),
	]

	return {
		owner,
		ready: !preview,
		f,
		set,
		reset: () => setF((now) => ({ ...NO_FACETS, sort: now.sort })),
		subset,
		carrying,
		tropes,
		total: preview?.total ?? tropes.length,
		usual,
		seen,
		titles,
		kindChoices,
		genreChoices,
		eraChoices,
		minChoices,
		picked,
	}
}
