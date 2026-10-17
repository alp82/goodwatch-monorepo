import { canonicalTitleId } from "../../utils/title-identity.ts"
import { titleKey } from "../../utils/title-key.ts"
import { tmdbImageUrl } from "../../utils/tmdb-image.ts"

/** The poster grid shows cards about 110 px wide; it asks for w342 itself on high-density screens. */
export const POSTER_SIZE = "w185"
/** Wide cards fill about 680 px; w780 covers them at a pixel ratio of 1, and the widget may ask for w1280. */
export const BACKDROP_SIZE = "w780"

interface Sources {
	loadTaste: (viewer: { kind: "member"; userId: string }) => Promise<{
		signal: string
		liked: number
		match(keys: number[]): (number | null)[]
	}>
	getDisplayFields: (keys: number[]) => Promise<
		Map<
			number,
			{
				runtime: number | null
				poster_path?: string | null
				backdrop_path?: string | null
				tagline?: string | null
				goodwatch_overall_score_normalized_percent?: number | null
			}
		>
	>
}

/** Presentation only: never store derived member scores in catalog caches or durable write receipts. */
export async function enrichTitleResults(
	userId: string,
	data: Record<string, unknown>,
	/**
	 * `posters` adds what the poster cards show: poster_url, backdrop_url and goodwatch_score. `taglines` adds the
	 * tagline (Watch next's single card). `sources` replaces the readers in tests.
	 */
	options: { posters?: boolean; taglines?: boolean; sources?: Sources } = {},
): Promise<Record<string, unknown>> {
	const ids = new Map<string, number>()
	const visit = (value: unknown) => {
		if (!value || typeof value !== "object") return
		const row = value as Record<string, unknown>
		if (typeof row.id === "string" && /^(movie|show):[1-9]\d*$/.test(row.id)) {
			const [kind, raw] = row.id.split(":")
			const type = kind === "show" ? "show" : "movie"
			ids.set(row.id, titleKey(type, canonicalTitleId(type, Number(raw))))
		}
		for (const child of Object.values(row)) visit(child)
	}
	visit(data)
	if (!ids.size) return data
	const { loadTaste, getDisplayFields }: Sources =
		options.sources ??
		(await Promise.all([
			import("../taste/index.server"),
			import("../title-cards.server"),
		]).then(([taste, cards]) => ({
			loadTaste: taste.loadTaste,
			getDisplayFields: cards.getDisplayFields,
		})))
	const keys = [...new Set(ids.values())]
	// Derived presentation must not hide an already committed write when a metadata read fails.
	const [taste, batches] = await Promise.all([
		loadTaste({ kind: "member", userId }).catch(() => null),
		Promise.allSettled(
			Array.from({ length: Math.ceil(keys.length / 60) }, (_, i) =>
				getDisplayFields(keys.slice(i * 60, (i + 1) * 60)),
			),
		),
	])
	const displays = new Map<
		number,
		{
			runtime: number | null
			poster_path?: string | null
			backdrop_path?: string | null
			tagline?: string | null
			goodwatch_overall_score_normalized_percent?: number | null
		}
	>()
	for (const batch of batches)
		if (batch.status === "fulfilled")
			for (const [key, value] of batch.value) displays.set(key, value)
	const matches = taste?.match(keys) ?? keys.map(() => null)
	const byKey = new Map(keys.map((key, i) => [key, matches[i]]))
	const map = (value: unknown): unknown => {
		if (!value || typeof value !== "object") return value
		if (Array.isArray(value)) return value.map(map)
		const row = value as Record<string, unknown>
		const next = Object.fromEntries(
			Object.entries(row).map(([key, child]) => [key, map(child)]),
		)
		const key = typeof row.id === "string" ? ids.get(row.id) : undefined
		if (key === undefined) return next
		const match = byKey.get(key) ?? null
		const display = displays.get(key)
		const poster = display?.poster_path
		const backdrop = display?.backdrop_path
		const score = display?.goodwatch_overall_score_normalized_percent
		return {
			...next,
			runtime_minutes:
				displays.get(key)?.runtime ?? row.runtime_minutes ?? null,
			match,
			match_label: match === null ? null : `${match}% taste match`,
			...(options.posters
				? {
						poster_url: poster ? tmdbImageUrl(poster, POSTER_SIZE) : null,
						backdrop_url: backdrop
							? tmdbImageUrl(backdrop, BACKDROP_SIZE)
							: null,
						// A tool's own score (Discover reads the catalog snapshot) wins over the display field.
						goodwatch_score:
							typeof row.goodwatch_score === "number"
								? row.goodwatch_score
								: typeof score === "number"
									? Math.round(score)
									: null,
					}
				: {}),
			...(options.taglines ? { tagline: display?.tagline || null } : {}),
		}
	}
	return {
		...(map(data) as Record<string, unknown>),
		taste: { signal: taste?.signal ?? "unavailable", liked: taste?.liked ?? 0 },
	}
}
