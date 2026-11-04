// Every reason a title can be "like this one", as the data More like this's shelves show:
//   series   the movie's collection in release order (movies only)
//   mix      titles that share the picked effects: the title's rarest pair until someone picks (mix-pick.ts)
//   similar  the related map's nearest titles (the loader's, else /api/title-more-like-this)
//   people   the director / writer / composer / leads (a show: creator, director, composer, leads), each one offered
//            only when they have other titles here
//   genre    the loader's genre row for the first genre, a genre row for any other of the title's genres
// Titles of the series and the page's own title are left out of the others; the others may share titles, so a
// control on one never empties another. Requests wait until the section comes near (useSectionNear).
import { useQueries } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useMemo } from "react"
import type { EffectReading } from "~/domain/fingerprint-effects/effects"
import { POPULATION_MEDIANS } from "~/domain/fingerprint-effects/population-medians"
import { useMovieCollection } from "~/routes/api.movie.collection"
import type { GenreRow } from "~/server/genre-row/genre-row.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useSectionNear } from "~/ui/details/below-fold"
import { printGeometry } from "~/ui/details/fingerprint-section/Shape"
import {
	type MixAnswer,
	useRarePairs,
	useSharedTitles,
} from "~/ui/details/fingerprint-section/population"
import {
	type Reading,
	printAttributes,
	readTitle,
} from "~/ui/details/fingerprint-section/reading"
import {
	byId,
	nextSelection,
	startSelection,
} from "~/ui/details/fingerprint-section/selection"
import { usePeople } from "~/ui/details/people/usePeople"
import { useMixPick } from "./mix-pick"
import {
	type As,
	type ShelfTitle,
	personWork,
	personWorkKey,
	seriesName,
	shelfKey,
	useGenreTitles,
	usePersonWork,
	useSimilar,
} from "./shelf-data"

type Media = MovieResult | ShowResult

export const fmt = (n: number) => n.toLocaleString("en-US")
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** "takes you somewhere else and draws you into power games", the effect names in white. */
export function effectWords(rs: EffectReading[]): ReactNode {
	return rs.map((r, i) => (
		<span key={r.effect.id}>
			{i > 0 && (i === rs.length - 1 ? " and " : ", ")}
			<span className="text-white">{lowerFirst(r.effect.name)}</span>
		</span>
	))
}

/**
 * One of the title's rare mixes, the Feels the same control's presets: a pair from the rarest pairs answer, or a trio
 * (the pair plus its strongest other effect) whose count the mix endpoint answered.
 */
export interface Recipe {
	ids: string[]
	effects: EffectReading[]
	/** Population titles with all of it. */
	both: number
	/** "1 in 70": the population over `both`. */
	oneIn: number
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((x) => b.includes(x))

async function mixJson(type: "movie" | "show", key: string, exclude: number) {
	const res = await fetch(
		`/api/fingerprint/mix?type=${type}&effects=${key}&exclude=${exclude}`,
	)
	if (!res.ok) throw new Error(`mix: ${res.status}`)
	return { key, ...((await res.json()) as MixAnswer) }
}

export interface PersonOption {
	key: string
	/** "Director". */
	role: string
	/** "Directed by". */
	verb: string
	as: As
	id: number
	name: string
}

/**
 * Everything the shelves show. `genreRow`: the loader's genre row; `similar`: the loader's Similar shelf (undefined:
 * the browser asks for it).
 */
export function useShelfSources(
	media: Media,
	genreRow?: GenreRow,
	similarFromLoader?: ShelfTitle[],
) {
	const type = media.mediaType
	const id = media.details.tmdb_id
	const self = shelfKey({ type, tmdbId: id })
	const near = useSectionNear()
	const noun = type === "movie" ? "movies" : "shows"

	// The series.
	const seriesRef = media.mediaType === "movie" ? media.movie_series : undefined
	const collection = useMovieCollection({
		collectionId: seriesRef?.id.toString() ?? "",
		movieIds: (seriesRef?.movie_ids ?? []).map(String).join(","),
	})
	const seriesTitles: ShelfTitle[] = useMemo(
		() =>
			[...(collection.data?.movies ?? [])]
				.sort((a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999))
				.map((m) => ({
					type: "movie" as const,
					tmdbId: m.tmdb_id,
					title: m.title,
					year: m.release_year ?? null,
					poster: m.poster_path ?? null,
					goodwatch: m.goodwatch_overall_score_normalized_percent ?? null,
				})),
		[collection.data],
	)
	const here = seriesTitles.findIndex((t) => shelfKey(t) === self)
	const named = seriesName(seriesTitles.map((t) => t.title))
	const series =
		seriesTitles.length > 1 && here >= 0
			? {
					titles: seriesTitles,
					here,
					name: named ?? "In this series",
					/** Whether the name came from the films' names (else it is the fallback). */
					named: named !== null,
					note: `Film ${here + 1} of ${seriesTitles.length}${
						here > 0 ? ` · after ${seriesTitles[here - 1].title}` : ""
					}${here < seriesTitles.length - 1 ? ` · then ${seriesTitles[here + 1].title}` : ""}`,
				}
			: null
	const outside = useMemo(
		() => new Set([self, ...seriesTitles.map(shelfKey)]),
		[self, seriesTitles],
	)
	const clean = (ts: readonly ShelfTitle[], max = 64) =>
		ts.filter((t) => !outside.has(shelfKey(t))).slice(0, max)

	// The effect mix.
	const reading: Reading | null = useMemo(
		() =>
			media.fingerprint
				? readTitle({
						title: media.details.title,
						titleLang: media.details.presentation?.title.language,
						mediaType: type,
						year: media.details.release_year,
						genres: media.details.genres,
						fingerprint: media.fingerprint,
					})
				: null,
		[media, type],
	)
	const pairs = useRarePairs(type, id, near && !!reading)
	const start = useMemo(
		() =>
			pairs.data && reading ? startSelection(pairs.data.pairs, reading) : [],
		[pairs.data, reading],
	)
	const [picked, setPicked] = useMixPick(id)
	const selected = picked ?? start
	const selectedKey = selected.join(",")
	const shared = useSharedTitles(type, selected, id)
	const selectedEffects = reading
		? selected
				.map((x) => byId(reading, x))
				.filter((r): r is EffectReading => !!r)
		: []
	const options = reading
		? [
				...reading.rows.map((p) => p.r),
				...selectedEffects.filter(
					(r) => !reading.rows.some((p) => p.r.effect.id === r.effect.id),
				),
			]
		: []
	const toggle = (effect: string) =>
		reading &&
		setPicked(nextSelection(selected, { kind: "effect", id: effect }, reading))
	const answer = selected.length ? shared.data : undefined
	const mixTitles: ShelfTitle[] = clean(
		(answer?.titles ?? []).map((t) => ({
			type,
			tmdbId: t.tmdbId,
			title: t.title,
			year: t.year,
			poster: t.poster,
			goodwatch: t.goodwatch,
		})),
	)
	const pairCount =
		selected.length === 2
			? pairs.data?.pairs.find(
					(p) =>
						(p.a === selected[0] && p.b === selected[1]) ||
						(p.a === selected[1] && p.b === selected[0]),
				)?.both
			: undefined
	const isStart = picked === null || picked.join(",") === start.join(",")
	const of = pairs.data?.of

	// The rare mixes, the presets of the Feels control. The start pair first, then the next rarest pairs (up
	// to five), then up to two trios with enough titles to fill a shelf. A trio's query is useSharedTitles' own (same
	// key), so picking it shows its titles at once.
	const pairRecipes: Recipe[] = useMemo(() => {
		if (!reading || !pairs.data) return []
		const known = pairs.data.pairs.filter(
			(p) => byId(reading, p.a) && byId(reading, p.b),
		)
		const first = known.find((p) => sameIds([p.a, p.b], start))
		const ordered = [
			...(first ? [first] : []),
			...known.filter((p) => p !== first),
		].slice(0, 5)
		return ordered.map((p) => ({
			ids: [p.a, p.b],
			effects: [byId(reading, p.a), byId(reading, p.b)] as EffectReading[],
			both: p.both,
			oneIn: Math.max(1, Math.round(pairs.data.of / Math.max(1, p.both))),
		}))
	}, [reading, pairs.data, start])
	const trioIds = useMemo(() => {
		if (!reading) return []
		const out: string[][] = []
		for (const p of pairRecipes.slice(0, 3)) {
			const third = reading.rows.find((row) => !p.ids.includes(row.r.effect.id))
			if (!third) continue
			const ids = [...p.ids, third.r.effect.id]
			if (!out.some((o) => sameIds(o, ids))) out.push(ids)
		}
		return out
	}, [pairRecipes, reading])
	const trioAnswers = useQueries({
		queries: trioIds.map((ids) => ({
			queryKey: ["fingerprint-mix", type, ids.join(","), id],
			queryFn: () => mixJson(type, ids.join(","), id),
			enabled: near,
			staleTime: 5 * 60_000,
		})),
	})
	const recipes: Recipe[] = [
		...pairRecipes,
		...trioIds
			.map((ids, i) => ({ ids, total: trioAnswers[i]?.data?.total ?? 0 }))
			.filter((t) => t.total >= 6 && reading)
			.slice(0, 2)
			.map((t) => ({
				ids: t.ids,
				effects: t.ids.map((x) =>
					byId(reading as Reading, x),
				) as EffectReading[],
				both: t.total,
				oneIn: Math.max(1, Math.round((of ?? 0) / t.total)),
			})),
	]
	const scores = media.fingerprint?.scores
	const geo = useMemo(
		() =>
			near && scores
				? printGeometry(printAttributes(scores, POPULATION_MEDIANS[type]))
				: null,
		[near, scores, type],
	)
	const mixNote = !selected.length
		? "Pick one to three of its effects"
		: isStart && pairCount && of
			? `Its rarest pair: only ${fmt(pairCount)} of the ${fmt(of)} most popular ${noun} do both`
			: answer && answer.key === selectedKey && of
				? `${fmt(answer.total)} of the ${fmt(of)} most popular ${noun} ${selected.length === 1 ? "do this" : selected.length === 2 ? "do both" : "do all three"}, strongest first`
				: "Strongest first"
	const mix = {
		ready: !!reading && (pairs.isFetched || picked !== null),
		options,
		selected,
		effects: selectedEffects,
		toggle,
		reset: () => setPicked(null),
		/** Picks these effects at once (a rare mix). */
		set: (ids: string[]) => setPicked(ids.slice(0, 3)),
		start,
		isStart,
		/** The rare mixes, and the one picked (-1: a mix of one's own). */
		recipes,
		recipeAt: recipes.findIndex((r) => sameIds(r.ids, selected)),
		of: of ?? 0,
		total: answer && answer.key === selectedKey ? answer.total : null,
		reading,
		/** The print's geometry for the control's mini print (one RidgeSprite per page: FEELS_RIDGES). */
		geo,
		titles: mixTitles,
		key: selectedKey,
		busy: selected.length > 0 && answer?.key !== selectedKey,
		note: mixNote,
	}

	// The related map.
	const similarQ = useSimilar(type, id, near, similarFromLoader)
	const similar = {
		titles: clean(similarQ.data?.titles ?? []),
		loaded: similarQ.isFetched || !!similarFromLoader,
	}

	// The people.
	const creators = usePeople({
		mediaType: type,
		tmdbId: id,
		kind: "crew",
		q: "creator",
		pageSize: 6,
		enabled: type === "show" && near,
	})
	const people: PersonOption[] = []
	const add = (
		p: { id: number; name: string } | null | undefined,
		role: string,
		verb: string,
		as: As,
	) => {
		if (p && !people.some((x) => x.id === p.id))
			people.push({
				key: `${as}:${p.id}`,
				role,
				verb,
				as,
				id: p.id,
				name: p.name,
			})
	}
	if (type === "movie")
		add(media.crew.directors[0], "Director", "Directed by", "Directing")
	else
		add(
			creators.rows.find((r) => r.roles.includes("Creator")),
			"Creator",
			"Created by",
			"Creator",
		)
	// A show's leading director (most episodes) too: shows often have no creator with other titles.
	if (type === "show")
		add(media.crew.directors[0], "Director", "Directed by", "Directing")
	// The first writer and composer who isn't already offered (Villeneuve directs and co-writes Dune).
	add(
		media.crew.writers.find((p) => !people.some((x) => x.id === p.id)),
		"Writer",
		"Written by",
		"Writing",
	)
	add(
		media.crew.composers.find((p) => !people.some((x) => x.id === p.id)),
		"Composer",
		"Music by",
		"Sound",
	)
	add(media.cast[0], "Lead", "Starring", "Acting")
	add(media.cast[1], "Co-lead", "Starring", "Acting")

	// Only the people with other titles here are offered (a show's creator often has none).
	const work = useQueries({
		queries: people.map((p) => ({
			queryKey: personWorkKey(type, id, p.id, p.as),
			queryFn: () => personWork(type, id, p.id, p.as),
			enabled: near,
			staleTime: 5 * 60_000,
		})),
	})
	const working = people.filter(
		(_, i) => (work[i]?.data?.titles.length ?? 0) > 0,
	)

	// The genres: the loader's row is the first; the title's other genres fetch theirs.
	const genres = (media.details.genres ?? []).slice(0, 4)

	return {
		type,
		id,
		self,
		near,
		noun,
		title: media.details.title,
		media,
		series,
		mix,
		similar,
		people: working,
		genres,
		genreRow,
		clean,
	}
}

export type Sources = ReturnType<typeof useShelfSources>

export function usePersonShelf(src: Sources, option: PersonOption | null) {
	const q = usePersonWork(
		src.type,
		src.id,
		option?.id ?? null,
		option?.as ?? "Directing",
		src.near,
	)
	return {
		titles: src.clean(q.data?.titles ?? []),
		busy: q.isPlaceholderData,
		loaded: q.isFetched,
	}
}

/** `genre`: null for the loader's row. */
export function useGenreShelf(src: Sources, genre: string | null) {
	const first = src.genres[0] ?? null
	const fromLoader = genre === null || (genre === first && !!src.genreRow)
	const q = useGenreTitles(
		src.type,
		src.id,
		fromLoader && src.genreRow ? null : (genre ?? first),
		src.series?.titles.map((t) => t.tmdbId) ?? [],
		src.near,
	)
	if (fromLoader && src.genreRow)
		return {
			heading: src.genreRow.heading,
			path: src.genreRow.path,
			titles: src.clean(
				src.genreRow.titles.map((t) => ({
					type: src.type,
					tmdbId: t.tmdb_id,
					title: t.title,
					year: t.release_year,
					poster: t.poster_path,
					goodwatch: t.goodwatch_overall_score_normalized_percent,
				})),
			),
			busy: false,
			loaded: true,
		}
	const name = genre ?? first ?? ""
	return {
		heading: q.data?.heading ?? `More ${name.toLowerCase()} ${src.noun}`,
		path: q.data?.path ?? null,
		titles: src.clean(q.data?.titles ?? []),
		busy: q.isPlaceholderData,
		loaded: q.isFetched || !name,
	}
}
