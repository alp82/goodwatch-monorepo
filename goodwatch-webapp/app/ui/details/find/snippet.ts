// Find's results show where the words matched: the
// spans of the query's words in a line (accents and case ignored, short words only at a word's start, as findIn
// matches), and an excerpt of a long text from a few words before the first match, cut with "…".

export type Span = [number, number]

/** One folded char per char of `s` (lower case, accents dropped), so indexes stay those of `s`. */
const fold = (s: string) =>
	Array.from(s, (c) =>
		c.length === 1
			? (c.normalize("NFD").replace(/\p{M}/gu, "")[0] ?? c).toLowerCase()
			: c,
	).join("")

const words = (query: string) =>
	fold(query)
		.split(/[^\p{L}\p{N}%$.&]+/u)
		.filter(Boolean)

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c)

/** Where the query's words sit in `text`, merged and in order. */
export function matchSpans(text: string, query: string): Span[] {
	const t =
		text.length === Array.from(text).length ? fold(text) : text.toLowerCase()
	const spans: Span[] = []
	for (const w of words(query)) {
		for (let i = t.indexOf(w); i !== -1; i = t.indexOf(w, i + 1)) {
			if (w.length < 3 && isWordChar(t[i - 1])) continue
			spans.push([i, i + w.length])
		}
	}
	spans.sort((a, b) => a[0] - b[0])
	const out: Span[] = []
	for (const s of spans) {
		const last = out[out.length - 1]
		if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1])
		else out.push([s[0], s[1]])
	}
	return out
}

/** Chars of lead-in kept before the first match (a few words). */
const LEAD = 22

/** `text` from a few words before its first match ("…" where cut), with the matches' spans in the excerpt. */
export function excerpt(
	text: string,
	query: string,
	lead = LEAD,
): { text: string; spans: Span[] } | null {
	const spans = matchSpans(text, query)
	if (!spans.length) return null
	const first = spans[0][0]
	if (first <= lead + 8) return { text, spans }
	// Start at a word's start, about `lead` chars before the match.
	let start = first - lead
	while (start < first && isWordChar(text[start - 1])) start++
	while (start < first && !isWordChar(text[start])) start++
	const shift = start - 1
	return {
		text: `…${text.slice(start)}`,
		spans: spans
			.filter((s) => s[0] >= start)
			.map(([a, b]) => [a - shift, b - shift] as Span),
	}
}

/** A result's second line: its context around the first match, else its long text's, else the context as it is. */
export function contextLine(
	context: string,
	body: string | undefined,
	query: string,
): { text: string; spans: Span[] } {
	return (
		excerpt(context, query) ??
		(body ? excerpt(body.replace(/\s+/g, " ").trim(), query) : null) ?? {
			text: context,
			spans: [],
		}
	)
}
