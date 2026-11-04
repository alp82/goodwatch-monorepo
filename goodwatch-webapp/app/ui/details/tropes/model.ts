// The tropes' data in the browser and the Tropes sub-page's list state.
// The index (every trope, the signature tropes' write-ups) comes with the sub-page's HTML; the other write-ups load
// when a trope without one opens or a find needs them (useAllTropes merges them in). "What it is" in full is read
// per trope when asked for. Filters: a find field over the name, the meaning and the write-up's spoiler-free text,
// and one-of tabs (All · Signature · Rare · Yours), where Rare is honest arithmetic (few catalog titles carry it) and
// Yours is the member's top tropes.
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { tropeByName, tropeRecsPath } from "~/domain/trope-recs"
import { useMyTropes } from "~/ui/trope-recs/api"
import type { TropeOpening } from "~/utils/trope-opening"
import type { Paragraph } from "./excerpt"
import {
	type AllTropesResponse,
	type PageTrope,
	RARE,
	type TropeTexts,
	type TropesIndex,
	type TropesTeaser,
	tropeTextsKey,
	tropesIndexKey,
	tropesTeaserKey,
	withTexts,
} from "./tropes-data"

export type { AllTropesResponse, PageTrope }

type Kind = "movie" | "show"

async function getJson<T>(
	params: Record<string, string>,
	signal: AbortSignal,
	what: string,
): Promise<T> {
	const response = await fetch(
		`/api/title-tropes?${new URLSearchParams(params)}`,
		{ signal },
	)
	if (!response.ok) throw new Error(`Loading ${what} failed.`)
	return response.json()
}

/** Every trope of the title, the signature tropes' write-ups with them. The sub-page's loader fills it. */
export function useTropesIndex(type: Kind, id: number, enabled = true) {
	return useQuery<TropesIndex>({
		queryKey: tropesIndexKey(type, id),
		enabled,
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) =>
			getJson({ type, id: String(id) }, signal, "the tropes"),
	})
}

/** Every write-up of the title's tropes, once `enabled`. */
export function useTropeTexts(type: Kind, id: number, enabled: boolean) {
	return useQuery<TropeTexts>({
		queryKey: tropeTextsKey(type, id),
		enabled,
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) =>
			getJson({ type, id: String(id), part: "texts" }, signal, "the write-ups"),
	})
}

/**
 * Every trope with its text: the index at once, the write-ups merged in once `texts` asks for them (by default as
 * soon as the index is there). `enabled` false waits for both.
 */
export function useAllTropes(
	type: Kind,
	id: number,
	enabled = true,
	texts = true,
) {
	const index = useTropesIndex(type, id, enabled)
	const all = useTropeTexts(type, id, enabled && texts && !!index.data)
	const data = useMemo(
		() => (index.data ? withTexts(index.data, all.data) : undefined),
		[index.data, all.data],
	)
	return {
		data,
		isPending: index.isPending,
		isError: index.isError,
		/** The write-ups are merged in. */
		texts: !!all.data,
	}
}

/** The title page's two signature cards and the count. The title page's loader fills it. */
export function useTropesTeaser(type: Kind, id: number) {
	return useQuery<TropesTeaser>({
		queryKey: tropesTeaserKey(type, id),
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) =>
			getJson({ type, id: String(id), part: "teaser" }, signal, "the tropes"),
	})
}

/** The description opening for one trope, once `enabled`. */
export function useTropeOpening(url: string, enabled: boolean) {
	return useQuery<{ opening: TropeOpening | null }>({
		queryKey: ["trope-opening", url],
		enabled: enabled && !!url,
		staleTime: 30 * 60_000,
		queryFn: ({ signal }) => getJson({ trope: url }, signal, "the description"),
	})
}

const fold = (s: string) =>
	s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()

/** The write-up without its spoilers, for finding and for snippets: nothing covered ever shows uncovered. */
export const openText = (ps: Paragraph[] | null | undefined) =>
	(ps ?? [])
		.map((p) => p.map((r) => (r.spoiler ? " … " : r.text)).join(""))
		.join(" ")

/** A–Z ignores leading quotes ("\"Bringer of War\" Music" sorts under B); digits go under #. */
export const letterOf = (name: string) => {
	const c = name
		.replace(/^[^\p{L}\p{N}]+/u, "")
		.charAt(0)
		.toUpperCase()
	return /[A-Z]/.test(c) ? c : "#"
}
export const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]

export type Filter = "all" | "signature" | "rare" | "yours"

export interface Row extends PageTrope {
	/** The member's picks with it, when it is among their top tropes. */
	picks: string | null
	rare: boolean
	/** The muted line: the meaning, or where the find matched only the write-up, the words around the match. */
	line: string | null
	/** The line is from this title's write-up (a find match) rather than the meaning. */
	lineFromWriteUp: boolean
}

export function useTropesPage(data: AllTropesResponse | undefined) {
	const [q, setQ] = useState("")
	const [filter, setFilter] = useState<Filter>("all")
	const [open, setOpen] = useState<string | null>(null)
	const mine = useMyTropes(true).data?.tropes

	const base = useMemo(() => {
		const byName = tropeByName(mine ?? [])
		const ids = new Map((mine ?? []).map((t) => [t.id, t]))
		return (data?.tropes ?? []).map((t) => {
			const found = ids.get(t.id) ?? byName(t.name)
			return {
				...t,
				picks: found ? tropeRecsPath({ trope: found.id }) : null,
				rare: t.titles != null && t.titles <= RARE,
				hay: fold(`${t.name}\n${t.meaning ?? ""}`),
				body: openText(t.paragraphs),
			}
		})
	}, [data, mine])
	const signatureIds = data?.signature ?? []
	const signatureSet = useMemo(() => new Set(signatureIds), [signatureIds])

	const keeps: Record<
		Filter,
		(t: Pick<Row, "id" | "rare" | "picks">) => boolean
	> = {
		all: () => true,
		signature: (t) => signatureSet.has(t.id),
		rare: (t) => t.rare,
		yours: (t) => !!t.picks,
	}
	const needle = fold(q.trim())
	const found = useMemo(() => {
		return base.flatMap((t): Row[] => {
			if (!needle || t.hay.includes(needle))
				return [{ ...t, line: t.meaning, lineFromWriteUp: false }]
			const at = fold(t.body).indexOf(needle)
			if (at < 0) return []
			return [
				{
					...t,
					line: snippet(t.body, at, needle.length),
					lineFromWriteUp: true,
				},
			]
		})
	}, [base, needle])
	const rows = found.filter(keeps[filter])
	const yours = found.filter(keeps.yours).length
	const chips = [
		{ key: "all", label: "All", count: found.length },
		{
			key: "signature",
			label: "Signature",
			count: found.filter(keeps.signature).length,
		},
		{ key: "rare", label: "Rare", count: found.filter(keeps.rare).length },
		...(yours || filter === "yours"
			? [{ key: "yours", label: "Yours", count: yours }]
			: []),
	]
	const byId = new Map(base.map((t) => [t.id, t]))
	const signature = signatureIds.flatMap((id) => {
		const t = byId.get(id)
		return t ? [{ ...t, line: t.meaning, lineFromWriteUp: false } as Row] : []
	})

	return {
		q,
		setQ,
		filter,
		setFilter: (f: string) => setFilter(f as Filter),
		chips,
		rows,
		total: data?.total ?? 0,
		signature,
		open,
		setOpen,
		toggle: (id: string) => setOpen((now) => (now === id ? null : id)),
		clear: () => {
			setQ("")
			setFilter("all")
		},
	}
}
export type TropesPageState = ReturnType<typeof useTropesPage>

/** The words around a find match in a write-up, from the word start a little before it. */
export function snippet(text: string, at: number, length: number) {
	const from = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 40)) + 1)
	const out = text.slice(from, at + length + 120).trim()
	return `${from > 0 ? "…" : ""}${out}`
}

/** The DOM id of a trope's row, for jumping to it. */
export const rowId = (id: string) =>
	`trope-${id.replace(/[^A-Za-z0-9]+/g, "-").slice(-80)}`

/** The DOM id of a letter's group in the list. */
export const letterId = (l: string) => `tropes-letter-${l === "#" ? "0" : l}`

/** "Also in": other titles with the trope, most popular and best scored first (api.trope-titles). */
export interface AlsoInTitle {
	type: "movie" | "show"
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
}
export function useAlsoIn(
	url: string,
	enabled: boolean,
	skip: { type: Kind; id: number },
) {
	return useQuery<{ titles: AlsoInTitle[] }>({
		queryKey: ["trope-titles", url, skip.type, skip.id],
		enabled: enabled && !!url,
		staleTime: 30 * 60_000,
		queryFn: async ({ signal }) => {
			const q = new URLSearchParams({
				url,
				type: skip.type,
				id: String(skip.id),
				n: "8",
			})
			const response = await fetch(`/api/trope-titles?${q}`, { signal })
			if (!response.ok) throw new Error("Loading the titles failed.")
			return response.json()
		},
	})
}

/** How common, 0 (in a handful of titles) to 1 (in ~20,000), on a log scale: the rarity meter's fill. */
export const commonness = (titles: number) =>
	// Rounded: the server's and the browser's logarithms can differ in the last digit (a hydration mismatch).
	Math.round(
		1000 *
			Math.min(
				1,
				Math.max(0.04, Math.log10(Math.max(2, titles)) / Math.log10(20_000)),
			),
	) / 1000
