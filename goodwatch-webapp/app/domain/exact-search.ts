import { citedYear } from "./cited-year.ts"

export type ExactEntity = {
	kind: "trope" | "title"
	id: string
	label: string
	names: readonly string[]
	year?: number
}
export type ExactSearch = Pick<
	ExactEntity,
	"kind" | "id" | "label" | "year"
> & { wholeQuery?: boolean }
export const exactName = (text: string) =>
	text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()

/** Materialize a confirmed reading as a real, removable/shareable Discover filter. Own choices win. */
export function exactSearchParams(
	existing: URLSearchParams,
	exact: ExactSearch,
): URLSearchParams {
	const params = new URLSearchParams(existing)
	params.delete("q")
	params.delete("asked")
	params.delete("off")
	params.delete("page")
	const field = exact.kind === "trope" ? "trope" : "similar"
	if (!params.has(field)) params.set(field, exact.id)
	return params
}

/** Whole names only. No prefix/fuzzy guesses, no essence tags, no arbitrary remake selection. */
export function chooseExactSearch(
	query: string,
	lookup: (name: string) => readonly ExactEntity[],
	concepts: ReadonlySet<string> = new Set(),
): ExactSearch | null {
	const raw = query.trim()
	const quoted = /^(?:"[^"]+"|“[^”]+”)$/.test(raw)
	const text = quoted ? raw.slice(1, -1) : raw
	const reference =
		/^(?:(?:movies?|shows?|series)\s+)?(?:like|similar to)\s+(.+)$/i.exec(text)
	const options = [text, ...(reference ? [reference[1]] : [])]
	for (const candidate of options) {
		const year = citedYear(candidate)
		const name = year?.title ?? candidate
		const matches = lookup(exactName(name)).filter(
			(e) =>
				(!year || (e.kind === "title" && e.year === year.year)) &&
				(!reference || candidate === text || e.kind === "title"),
		)
		const unique = new Map(matches.map((e) => [`${e.kind}:${e.id}`, e]))
		if (!unique.size) continue
		if (
			unique.size !== 1 ||
			(!quoted && !year && !reference && concepts.has(exactName(name)))
		)
			return null
		const [found] = unique.values()
		// Recognizing a name does not request recommendations. Leave title lookups to the ordinary search,
		// including quoted names, aliases and years. Even a title beginning with "Like" is still its own name.
		if (found.kind === "title" && (!reference || candidate === text))
			return null
		return {
			kind: found.kind,
			id: found.id,
			label: found.label,
			...(found.year ? { year: found.year } : {}),
		}
	}
	return null
}
