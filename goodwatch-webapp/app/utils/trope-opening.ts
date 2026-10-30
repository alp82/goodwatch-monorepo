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
/** With one paragraph left and none to give up, a description up to this many characters shows whole instead. */
export const WHOLE_STRETCH = 2400

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
/** Python's str.isspace set, so `blank` agrees with the validator's `not text.strip()` (JavaScript's trim differs). */
const PY_SPACE = new Set([
	0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0,
	0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
	0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
])
const blank = (text: string) => {
	for (let i = 0; i < text.length; i++)
		if (!PY_SPACE.has(text.charCodeAt(i))) return false
	return true
}

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
	if (typeof text !== "string" || blank(text)) return false
	const edges = boundaries(text)
	if (!edges) return false
	for (const key of ["links", "spoilers", "em"] as const) {
		// Only an absent field defaults; an explicit null is invalid, as in Python's `block.get(key, [])`.
		const ranges = Object.prototype.hasOwnProperty.call(block, key)
			? block[key]
			: []
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
 * after the cut instead, as long as the opening keeps one. With a one-paragraph opening, a description up to 2,400
 * characters shows whole; a longer one keeps its one paragraph left, and the link then shows no count.
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
	if (counted(rest) === 1) {
		if (paragraphs > 1) {
			rest = [head[head.length - 1], ...rest]
			head.pop()
		} else if (blocks.reduce((n, b) => n + size(b), 0) <= WHOLE_STRETCH)
			return { head: blocks, rest: [] }
	}
	return { head, rest }
}

/**
 * A short first paragraph that asks the reader to play music while reading ("For added atmosphere, play this video
 * while reading on."). It points at media the page doesn't carry, so the opening skips it.
 */
export function isReaderNote(text: string): boolean {
	return (
		text.length < 220 &&
		/\b(play|playing|listen|run)\b/i.test(text) &&
		/\b(read|reading|reader|article|page)\b|going through/i.test(text) &&
		/atmosphere|effect|experience|\bwhile\b|\bas you\b|\bbefore\b/i.test(text)
	)
}

/** Ranges after `cut`, moved back by it; a range that starts before the cut is dropped. */
function shifted<T extends [number, number, ...unknown[]]>(
	ranges: T[] | undefined,
	cut: number,
): T[] | undefined {
	const out = (ranges ?? [])
		.filter(([s]) => s >= cut)
		.map(([s, e, ...rest]) => [s - cut, e - cut, ...rest] as T)
	return out.length ? out : undefined
}

/**
 * The blocks without a reader note before the first paragraph (headings stay), as long as something else is left.
 * A note can also be the first sentence of a longer first paragraph; then only that sentence goes.
 */
export function withoutReaderNote(blocks: DocBlock[]): DocBlock[] {
	let i = 0
	while (blocks[i]?.kind === "heading") i++
	const first = blocks[i]
	if (first?.kind !== "p") return blocks
	if (isReaderNote(first.text))
		return counted(blocks.slice(i + 1)) > 0
			? [...blocks.slice(0, i), ...blocks.slice(i + 1)]
			: blocks
	const sentence = /^(.+?[.!?)])\s+(?=\S)/.exec(first.text)
	if (!sentence || !isReaderNote(sentence[1])) return blocks
	const cut = sentence[0].length
	const trimmed: DocBlock = { kind: "p", text: first.text.slice(cut) }
	const links = shifted(first.links, cut)
	const spoilers = shifted(first.spoilers, cut)
	const em = shifted(first.em, cut)
	if (links) trimmed.links = links
	if (spoilers) trimmed.spoilers = spoilers
	if (em) trimmed.em = em
	return [...blocks.slice(0, i), trimmed, ...blocks.slice(i + 1)]
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
	const blocks = withoutReaderNote(
		parseDescriptionDoc(doc)?.blocks ?? plainBlocks(text),
	)
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

/** A closed band can't uncover anything, so each spoiler becomes "…"; null when nothing else is left. */
function withoutSpoilers(m: MarkedText | undefined): string | null {
	if (!m) return null
	let out = ""
	let at = 0
	for (const [s, e] of m.spoilers ?? []) {
		out += `${m.text.slice(at, s)}…`
		at = e
	}
	out += m.text.slice(at)
	return /[\p{L}\p{N}]/u.test(out.replace(/…/g, "")) ? out : null
}

/** The opening's first text, spoilers masked, for a closed band's one-line teaser. */
export function openingLead(opening: TropeOpening | null | undefined) {
	for (const b of opening?.blocks ?? []) {
		if (b.kind === "p") return withoutSpoilers(b)
		if (b.kind === "list") return withoutSpoilers(b.items[0])
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
