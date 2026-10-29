import {
	type CoreScores,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"
import {
	EFFECTS,
	type Effect,
	type Key,
	readEffect,
	readEffects,
} from "./effects"

export type MediaType = "movie" | "show"
export interface PopulationTitle {
	tmdbId: number
	title: string
	year: number | null
	poster: string | null
	goodwatch: number | null
	scores: CoreScores
}
export interface Population {
	titles: PopulationTitle[]
	strengths: Map<string, number[]>
	countedSets: Set<string>[]
}

export function buildPopulation(titles: PopulationTitle[]): Population {
	const strengths = new Map(EFFECTS.map((e) => [e.id, [] as number[]]))
	const countedSets = titles.map((title) => {
		const counted = new Set<string>()
		for (const effect of EFFECTS) {
			const reading = readEffect(effect, title.scores)
			strengths.get(effect.id)?.push(reading.strength)
			if (reading.counts) counted.add(effect.id)
		}
		return counted
	})
	return { titles, strengths, countedSets }
}

export function rarestPairs(population: Population, scores: CoreScores) {
	const mine = readEffects(scores)
		.filter((r) => r.counts)
		.slice(0, 8)
	const pairs: { a: string; b: string; both: number; mean: number }[] = []
	for (let i = 0; i < mine.length; i++) {
		for (let j = i + 1; j < mine.length; j++) {
			const a = mine[i]
			const b = mine[j]
			pairs.push({
				a: a.effect.id,
				b: b.effect.id,
				both: population.countedSets.filter(
					(s) => s.has(a.effect.id) && s.has(b.effect.id),
				).length,
				mean: (a.strength + b.strength) / 2,
			})
		}
	}
	return {
		of: population.titles.length,
		pairs: pairs
			.sort((a, b) => a.both - b.both || b.mean - a.mean)
			.slice(0, 20)
			.map(({ a, b, both }) => ({ a, b, both })),
	}
}

const SMALL = new Set(["the", "of", "a", "an", "and"])
export function franchise(title: string) {
	const base = title
		.toLowerCase()
		.split(/:| - /)[0]
		.replace(/\bpart\b.*$/, "")
		.replace(/\b(\d+|ii|iii|iv|v|vi)\s*$/, "")
	return base
		.split(/[^a-z0-9'-]+/)
		.filter((w) => w && !SMALL.has(w))
		.slice(0, 2)
		.join(" ")
}

export function ingredientKeys(
	scores: CoreScores,
	effects: readonly Effect[],
): Key[] {
	const keys = new Set(
		effects.flatMap((e) =>
			e.parts
				.filter((p) => p.w > 0)
				.flatMap((p) => (typeof p.key === "string" ? [p.key] : [...p.key])),
		),
	)
	return [...keys]
		.filter((k) => scores[k] >= 6)
		.sort((a, b) => scores[b] - scores[a])
		.slice(0, 3)
}

export function pickTitles(
	population: Population,
	effects: readonly Effect[],
	exclude: number,
	excludedTitle?: string,
) {
	if (!effects.length) return { total: 0, titles: [] }
	const hits = population.titles
		.flatMap((title, i) => {
			if (
				title.tmdbId === exclude ||
				!effects.every((e) => population.countedSets[i].has(e.id))
			)
				return []
			return [
				{
					title,
					i,
					strength: Math.min(
						...effects.map((e) => population.strengths.get(e.id)?.[i] ?? 0),
					),
				},
			]
		})
		.sort((a, b) => b.strength - a.strength || a.i - b.i)
	const own =
		excludedTitle ?? population.titles.find((t) => t.tmdbId === exclude)?.title
	const seen = new Set(own === undefined ? [] : [franchise(own)])
	const titles: {
		tmdbId: number
		title: string
		year: number | null
		poster: string
		goodwatch: number | null
		keys: Key[]
	}[] = []
	for (const { title } of hits) {
		if (titles.length >= 64) break
		if (!title.poster) continue
		const key = franchise(title.title)
		if (key && seen.has(key)) continue
		if (key) seen.add(key)
		titles.push({
			tmdbId: title.tmdbId,
			title: title.title,
			year: title.year,
			poster: title.poster,
			goodwatch: title.goodwatch,
			keys: ingredientKeys(title.scores, effects),
		})
	}
	return { total: hits.length, titles }
}

export function populationMedians(
	titles: readonly PopulationTitle[],
): CoreScores {
	if (!titles.length)
		throw new Error("Cannot compute medians of an empty population")
	return Object.fromEntries(
		VALID_FINGERPRINT_KEYS.map((key) => {
			const values = titles.map((t) => t.scores[key] ?? 0).sort((a, b) => a - b)
			return [key, values[Math.floor(values.length / 2)]]
		}),
	) as CoreScores
}

export function parseMediaType(params: URLSearchParams): MediaType {
	const type = params.get("type")
	if (type !== "movie" && type !== "show")
		throw new Response("Invalid type", { status: 400 })
	return type
}
export function parseTitleId(params: URLSearchParams, key: string): number {
	const value = params.get(key) ?? ""
	const id = Number(value)
	if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0)
		throw new Response(`Invalid ${key}`, { status: 400 })
	return id
}
export function parseEffects(params: URLSearchParams): Effect[] {
	const ids = (params.get("effects") ?? "").split(",")
	if (ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length)
		throw new Response("Select one to three effects", { status: 400 })
	return ids.map((id) => {
		const effect = EFFECTS.find((e) => e.id === id)
		if (!effect) throw new Response("Unknown effect", { status: 400 })
		return effect
	})
}
