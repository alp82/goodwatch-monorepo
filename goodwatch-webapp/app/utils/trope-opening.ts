// The opening of a TV Tropes description for the profile Tropes tab: the stored description document (version 1,
// `trope_catalog.description_doc`) or, without a valid one, the plain text split on blank lines, cut to the part the
// band shows. The server sends only the opening and how many paragraphs follow; the rest stays on TV Tropes.
// Spec: docs/implementation/trope-description-doc.md. The Python validator this mirrors:
// goodwatch-flows/windmill/f/tvtropes_catalog/description_docs.py.

/** `[start, end)` in UTF-16 code units of the block's text, so JavaScript can slice directly. */
export type Range = [number, number]
export interface MarkedText {
	text: string
	links?: [number, number, string][]
	spoilers?: Range[]
	em?: Range[]
}
export type DocBlock =
	| ({ kind: "p" } & MarkedText)
	| ({ kind: "heading" } & MarkedText)
	| { kind: "list"; items: (MarkedText & { depth: number })[] }
export interface DescriptionDoc {
	v: 1
	source: "archive" | "crawl" | "plain"
	blocks: DocBlock[]
}

/**
 * What the page receives. Links carry the wiki page path ("Main/ComedicSociopathy") instead of the whole address to
 * keep the payload small; `pageHref` rebuilds it. `more` counts the paragraphs after the opening (a list counts as
 * one, headings don't); 0 means the opening is the whole description.
 */
export interface TropeOpening {
	blocks: DocBlock[]
	more: number
}

/** A description up to this many characters shows whole. */
export const WHOLE = 1800
/** A longer one shows whole paragraphs until at least this many characters... */
export const OPENING_MIN = 1000
/** ...but never goes past this many once one paragraph is in. */
export const OPENING_MAX = 1400

const WIKI = "https://tvtropes.org/pmwiki/pmwiki.php/"
const PAGE = /^([A-Za-z]+)\/[A-Za-z0-9_]+$/

/** A wiki page path ("Main/X") to its address; null for anything else, so no other address can be built. */
export function pageHref(path: string): string | null {
	const match = PAGE.exec(path)
	return match && match[1].toLowerCase() !== "administrivia"
		? WIKI + path
		: null
}

const TEXT_KEYS = new Set(["text", "links", "spoilers", "em"])
const isInt = (value: unknown): value is number => Number.isInteger(value)

/** Offsets that fall between whole characters; null when the text holds a lone surrogate. */
function boundaries(text: string): Set<number> | null {
	const edges = new Set([0])
	for (let i = 0; i < text.length; i++) {
		const unit = text.charCodeAt(i)
		if (unit >= 0xd800 && unit <= 0xdbff) {
			const low = text.charCodeAt(i + 1)
			if (!(low >= 0xdc00 && low <= 0xdfff)) return null
			i++
		} else if (unit >= 0xdc00 && unit <= 0xdfff) return null
		edges.add(i + 1)
	}
	return edges
}

function validText(block: Record<string, unknown>, extra: string) {
	for (const key of Object.keys(block))
		if (!TEXT_KEYS.has(key) && key !== extra) return false
	const text = block.text
	if (typeof text !== "string" || !text.trim()) return false
	const edges = boundaries(text)
	if (!edges) return false
	for (const key of ["links", "spoilers", "em"] as const) {
		const ranges = block[key] ?? []
		if (!Array.isArray(ranges)) return false
		let previous = 0
		for (const span of ranges) {
			if (
				!Array.isArray(span) ||
				span.length !== (key === "links" ? 3 : 2) ||
				!isInt(span[0]) ||
				!isInt(span[1]) ||
				!(previous <= span[0] && span[0] < span[1]) ||
				!edges.has(span[0]) ||
				!edges.has(span[1])
			)
				return false
			if (
				key === "links" &&
				(typeof span[2] !== "string" ||
					!span[2].startsWith(WIKI) ||
					!pageHref(span[2].slice(WIKI.length)))
			)
				return false
			previous = span[1]
		}
	}
	return true
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value)

/** The stored JSON text as a version-1 document, or null when it is missing, malformed or breaks a rule. */
export function parseDescriptionDoc(raw: unknown): DescriptionDoc | null {
	let doc: unknown = raw
	if (typeof raw === "string") {
		try {
			doc = JSON.parse(raw)
		} catch {
			return null
		}
	}
	if (
		!isObject(doc) ||
		Object.keys(doc).length !== 3 ||
		doc.v !== 1 ||
		!["archive", "crawl", "plain"].includes(doc.source as string) ||
		!Array.isArray(doc.blocks) ||
		!doc.blocks.length
	)
		return null
	for (const block of doc.blocks) {
		if (!isObject(block)) return null
		if (block.kind === "p" || block.kind === "heading") {
			if (!validText(block, "kind")) return null
		} else if (block.kind === "list") {
			if (
				Object.keys(block).length !== 2 ||
				!Array.isArray(block.items) ||
				!block.items.length
			)
				return null
			for (const item of block.items)
				if (
					!isObject(item) ||
					!validText(item, "depth") ||
					!isInt(item.depth) ||
					item.depth < 0
				)
					return null
		} else return null
	}
	return doc as unknown as DescriptionDoc
}

/** Without a document: paragraphs from the plain text's blank lines, no links. */
export function plainBlocks(text: string | null | undefined): DocBlock[] {
	return (text ?? "")
		.split(/\n[ \t]*\n/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => ({ kind: "p", text: p }))
}

const size = (b: DocBlock) =>
	b.kind === "list"
		? b.items.reduce((n, i) => n + i.text.length, 0)
		: b.text.length
const counted = (blocks: DocBlock[]) =>
	blocks.filter((b) => b.kind !== "heading").length

/**
 * Up to 1,800 characters: everything. Longer: whole paragraphs until at least 1,000 characters, never past 1,400 once
 * one is in, stopping at the first list or heading. Never exactly one paragraph left: the last opening paragraph moves
 * after the cut instead, as long as the opening keeps one.
 */
export function cutOpening(blocks: DocBlock[]): {
	head: DocBlock[]
	rest: DocBlock[]
} {
	if (blocks.reduce((n, b) => n + size(b), 0) <= WHOLE)
		return { head: blocks, rest: [] }
	const head: DocBlock[] = []
	let i = 0
	// A label before the first paragraph stays with it.
	while (blocks[i]?.kind === "heading") head.push(blocks[i++])
	const first = blocks[i]
	if (first?.kind === "list") {
		// No paragraph opens the text: show the list's first items instead.
		let n = 0
		let k = 0
		while (
			k < first.items.length &&
			(k === 0 || n + first.items[k].text.length <= OPENING_MAX)
		)
			n += first.items[k++].text.length
		head.push({ kind: "list", items: first.items.slice(0, k) })
		const left = first.items.slice(k)
		return {
			head,
			rest: [
				...(left.length ? [{ kind: "list" as const, items: left }] : []),
				...blocks.slice(i + 1),
			],
		}
	}
	let n = 0
	let paragraphs = 0
	for (; i < blocks.length; i++) {
		const b = blocks[i]
		if (
			b.kind !== "p" ||
			(paragraphs && (n >= OPENING_MIN || n + b.text.length > OPENING_MAX))
		)
			break
		head.push(b)
		n += b.text.length
		paragraphs++
	}
	let rest = blocks.slice(i)
	if (counted(rest) === 1 && paragraphs > 1) {
		rest = [head[head.length - 1], ...rest]
		head.pop()
	}
	return { head, rest }
}

/** Page paths for links, and no empty range lists. */
function compact(m: MarkedText): MarkedText {
	const out: MarkedText = { text: m.text }
	if (m.links?.length)
		out.links = m.links.map(([s, e, url]) => [s, e, url.slice(WIKI.length)])
	if (m.spoilers?.length) out.spoilers = m.spoilers
	if (m.em?.length) out.em = m.em
	return out
}

/** The opening the page shows, from a valid document or else the plain text; null when there is no text at all. */
export function tropeOpening(
	doc: unknown,
	text: string | null | undefined,
): TropeOpening | null {
	const blocks = parseDescriptionDoc(doc)?.blocks ?? plainBlocks(text)
	if (!blocks.length) return null
	const { head, rest } = cutOpening(blocks)
	return {
		blocks: head.map((b) =>
			b.kind === "list"
				? {
						kind: "list",
						items: b.items.map((i) => ({ ...compact(i), depth: i.depth })),
					}
				: b.kind === "heading"
					? { kind: "heading", text: b.text }
					: { kind: "p", ...compact(b) },
		),
		more: counted(rest),
	}
}

/** The opening's first text, for a closed band's one-line teaser. */
export function openingLead(opening: TropeOpening | null | undefined) {
	for (const b of opening?.blocks ?? []) {
		if (b.kind === "p") return b.text
		if (b.kind === "list") return b.items[0]?.text ?? null
	}
	return null
}

export interface MarkPart {
	key: number
	text: string
	em: boolean
}
export interface LinkRun {
	key: number
	/** The TV Tropes address, or null for plain text. */
	href: string | null
	parts: MarkPart[]
}
export interface SpoilerRun {
	key: number
	spoiler: boolean
	links: LinkRun[]
}

/**
 * The text cut at every range edge and grouped for rendering: spoiler runs outside (one tap uncovers one whole
 * spoiler), link runs inside them (one link per run), emphasis on the smallest parts. Offsets are UTF-16, like
 * JavaScript strings. Links carry page paths, as in `TropeOpening`. A link crossing a spoiler edge splits into two.
 */
export function markRuns(m: MarkedText): SpoilerRun[] {
	const cuts = new Set([0, m.text.length])
	for (const [s, e] of [
		...(m.links ?? []),
		...(m.spoilers ?? []),
		...(m.em ?? []),
	])
		cuts.add(s).add(e)
	const edges = [...cuts]
		.filter((c) => c >= 0 && c <= m.text.length)
		.sort((a, b) => a - b)
	const inside = (
		ranges: readonly (readonly [number, number, ...unknown[]])[] | undefined,
		s: number,
		e: number,
	) => (ranges ?? []).findIndex(([a, b]) => a <= s && e <= b)
	const runs: SpoilerRun[] = []
	// Which spoiler and link the last run and link run belong to (-1 for none).
	let spoilerAt = Number.NaN
	let linkAt = Number.NaN
	for (let i = 0; i < edges.length - 1; i++) {
		const [s, e] = [edges[i], edges[i + 1]]
		const spoiler = inside(m.spoilers, s, e)
		const link = inside(m.links, s, e)
		if (spoiler !== spoilerAt) {
			runs.push({ key: s, spoiler: spoiler >= 0, links: [] })
			spoilerAt = spoiler
			linkAt = Number.NaN
		}
		const run = runs[runs.length - 1]
		if (link !== linkAt) {
			const path = link >= 0 ? m.links?.[link][2] : undefined
			run.links.push({
				key: s,
				href: path === undefined ? null : pageHref(path),
				parts: [],
			})
			linkAt = link
		}
		run.links[run.links.length - 1].parts.push({
			key: s,
			text: m.text.slice(s, e),
			em: inside(m.em, s, e) >= 0,
		})
	}
	return runs
}
