import {
	presentationLanguage,
	hasValidMediaPresentation,
} from "./media-presentation.ts"
import { parseTitleKey } from "./title-key.ts"
import type { CanonicalMediaRow } from "./media-overlay-core.ts"
export type Kind = "movie" | "show"
type ObjectValue = Record<string, unknown>
const hintOf = (name: string): Kind | undefined =>
	/^(movies|movie|known_for_movies)$/i.test(name)
		? "movie"
		: /^(shows|show|known_for_shows)$/i.test(name)
			? "show"
			: undefined
const mediaKind = (value: unknown): Kind | undefined =>
	value === "movie"
		? "movie"
		: value === "show" || value === "tv"
			? "show"
			: undefined

/** Catalog payload adapter, after the caller's matching, ordering and cached read. People and collections are not works.
 * A whole graph is one overlay batch; aliases retain their original shape and canonical stable IDs.
 */
export async function localizeTitlePayload<T>(
	payload: T,
	language: string,
	hint: Kind | undefined,
	overlay: <R extends CanonicalMediaRow>(
		rows: readonly R[],
		language: string,
	) => Promise<
		(R & {
			canonical_title: string
			presentation: import("./media-presentation").MediaPresentation
		})[]
	>,
	options: { maxTitles?: number } = {},
): Promise<T> {
	const selected = presentationLanguage(language)
	const keys = new Set<string>()
	const found: {
		object: ObjectValue
		row: CanonicalMediaRow
		camel: boolean
		name: boolean
	}[] = []
	const visit = (value: unknown, inherited?: Kind, inheritedId?: number) => {
		if (Array.isArray(value)) {
			value.forEach((child) => visit(child, inherited))
			return
		}
		if (!value || typeof value !== "object" || value instanceof Date) return
		const object = value as ObjectValue
		const storedKey =
			typeof object.key === "string"
				? /^(movie|show)[:-](\d+)$/.exec(object.key)
				: null
		const numericKey =
			typeof object.key === "number" && object.key >= 1e12 && object.key < 3e12
				? parseTitleKey(object.key)
				: null
		const kind =
			mediaKind(object.media_type ?? object.mediaType ?? object.type) ??
			mediaKind(storedKey?.[1]) ??
			numericKey?.mediaType ??
			inherited ??
			hint
		const id = Number(
			object.tmdb_id ??
				object.tmdbId ??
				storedKey?.[2] ??
				numericKey?.tmdbId ??
				(kind ? object.id : undefined) ??
				inheritedId,
		)
		// Nested details inherit their enclosing work's kind; only explicit catalog identity can become a title.
		if (
			kind &&
			Number.isSafeInteger(id) &&
			id > 0 &&
			("title" in object || "poster_path" in object || "posterPath" in object)
		) {
			const key = `${kind}-${id}`
			if (
				!hasValidMediaPresentation(object, selected) &&
				(keys.has(key) ||
					keys.size < (options.maxTitles ?? Number.POSITIVE_INFINITY))
			) {
				keys.add(key)
				found.push({
					object,
					camel: "posterPath" in object,
					name: false,
					row: {
						...object,
						title: (object.title ?? object.name) as string | null | undefined,
						original_title: (object.original_title ??
							object.original_name ??
							object.original) as string | null | undefined,
						original_language_code: (object.original_language_code ??
							object.original_language) as string | null | undefined,
						media_type: kind,
						tmdb_id: id,
						poster_path:
							typeof (
								object.poster_path ??
								object.posterPath ??
								object.poster
							) === "string"
								? String(
										object.poster_path ?? object.posterPath ?? object.poster,
									).replace(/^https:\/\/image.tmdb.org\/t\/p\/[^/]+/, "")
								: null,
					} as CanonicalMediaRow,
				})
			}
		}
		for (const [key, child] of Object.entries(object)) {
			if (key === "presentation" || key === "textPresentation") continue
			// A page's genre labels, cast and generated prose remain English. Don't infer movie identity into cast.
			const single =
				key === "only" && Array.isArray(object.ids) && object.ids.length === 1
			visit(
				child,
				hintOf(key) ??
					(key === "details" || key === "discovery" || single
						? kind
						: undefined),
				single ? Number((object.ids as number[])[0]) : undefined,
			)
		}
	}
	visit(payload, hint)
	if (!found.length) return payload
	const presented = await overlay(
		found.map((item) => item.row),
		language,
	)
	const replacements = new Map<object, ObjectValue>()
	found.forEach(({ object, camel }, index) => {
		const row = presented[index]
		const copy: ObjectValue = {
			...object,
			title: row.title,
			canonical_title: row.canonical_title,
			presentation: row.presentation,
		}
		if (
			"name" in object &&
			(object.media_type === "show" || object.media_type === "tv")
		)
			copy.name = row.title
		if ("poster_path" in object)
			copy.poster_path =
				row.poster_path &&
				typeof object.poster_path === "string" &&
				object.poster_path.startsWith("https://image.tmdb.org/t/p/")
					? object.poster_path.replace(
							/(https:\/\/image.tmdb.org\/t\/p\/[^/]+).*/,
							`$1${row.poster_path}`,
						)
					: row.poster_path
		if (camel) copy.posterPath = row.poster_path
		if ("poster" in object)
			copy.poster =
				row.poster_path &&
				typeof object.poster === "string" &&
				object.poster.startsWith("https://image.tmdb.org/t/p/")
					? object.poster.replace(
							/(https:\/\/image.tmdb.org\/t\/p\/[^/]+).*/,
							`$1${row.poster_path}`,
						)
					: row.poster_path
		if ("synopsis" in object) copy.synopsis = row.synopsis
		if ("overview" in object) copy.overview = row.overview ?? row.synopsis
		if ("tagline" in object) copy.tagline = row.tagline
		replacements.set(object, copy)
	})
	const copyGraph = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(copyGraph)
		if (!value || typeof value !== "object" || value instanceof Date)
			return value
		return Object.fromEntries(
			Object.entries(replacements.get(value) ?? value).map(([key, child]) => [
				key,
				copyGraph(child),
			]),
		)
	}
	return copyGraph(payload) as T
}
