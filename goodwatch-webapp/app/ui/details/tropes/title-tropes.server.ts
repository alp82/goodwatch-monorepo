// A title's tropes for its Tropes section and sub-page: every trope the title carries, each with its text. SELECT only.
// Per trope: the name (the catalog page's heading where known), what it means in one line (the description's first
// sentence, read as a 900-character prefix so a 24,000-character description never crosses), this title's write-up
// (paragraphs with the spoilers marked, about 900 characters), its first spoiler-free sentence, and how many titles
// in the catalog carry the trope (for "Rare" and the signature rank). The description opening ("What it is", with
// links and spoilers) is read one trope at a time when a row opens: loadTropeOpening.
// The whole read is kept in the data cache (titleTropes); the pages get it in cuts (tropes-data.ts): the sub-page's
// HTML carries the index (tropesPageState), the title page's the two cards (tropesTeaserState), the write-ups come
// to the browser on demand (api.title-tropes).
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import { readTropeDescriptions } from "~/server/profile/trope-catalog.server"
import {
	type TropePageReferences,
	createTropeReferenceReader,
} from "~/server/profile/trope-pages"
import { htmlToText } from "~/server/profile/trope-text"
import { tropeTarget } from "~/server/profile/trope-uri-pool"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import type { TropeOpening } from "~/utils/trope-opening"
import { type Paragraph, safeTeaser } from "./excerpt"
import {
	type AllTropesResponse,
	type PageTrope,
	type TropesTeaser,
	tropesIndexKey,
	tropesIndexOf,
	tropesTeaserKey,
	tropesTeaserOf,
} from "./tropes-data"

interface Row {
	name: string
	url: string | null
	length: number | null
}

const read = <T extends {}>(
	sql: string,
	params: (string | number)[],
	timeoutMs = 4000,
) => query<T>(sql, params, { timeoutMs })
const resolve = createTropeReferenceReader((sql, params) =>
	read(sql, params as (string | number)[], 2500),
)

async function batched<T extends {}>(
	keys: string[],
	size: number,
	run: (batch: string[]) => Promise<T[]>,
) {
	const out: T[] = []
	const batches: string[][] = []
	for (let i = 0; i < keys.length; i += size)
		batches.push(keys.slice(i, i + size))
	let next = 0
	await Promise.all(
		Array.from({ length: Math.min(4, batches.length) }, async () => {
			while (next < batches.length) out.push(...(await run(batches[next++])))
		}),
	)
	return out
}

const within = <T>(work: Promise<T>, ms: number, fallback: T) =>
	Promise.race([
		work.catch(() => fallback),
		new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
	])

/** Every trope the title carries, each with its text (uncached; titleTropes caches it). */
export async function loadTitleTropes(
	type: "movie" | "show",
	id: number,
): Promise<AllTropesResponse> {
	const [rows, details] = await Promise.all([
		read<Row>(
			"SELECT name, url, coalesce(content_length, 0) AS length FROM trope WHERE media_type = ? AND media_tmdb_id = ? ORDER BY name, url LIMIT 5000",
			[type, id],
		),
		read<{ tropes: string[] | null }>(
			`SELECT tropes FROM ${type} WHERE tmdb_id = ? LIMIT 1`,
			[id],
		),
	])
	const lead = new Set(leadRun(details[0]?.tropes ?? []))
	const urls = [...new Set(rows.flatMap((r) => r.url ?? []))]
	const references = await resolve(urls).catch((): TropePageReferences => ({}))

	// One entry per target, keeping its longest write-up.
	const byTarget = new Map<
		string,
		{ row: Row; title: string | null; lead: boolean }
	>()
	for (const row of rows) {
		const target = tropeTarget(row.name, row.url, references)
		const old = byTarget.get(target)
		const title = (row.url && references[row.url]?.title) || old?.title || null
		const isLead = lead.has(row.name) || !!old?.lead
		if (!old || (row.length ?? 0) > (old.row.length ?? 0))
			byTarget.set(target, { row, title, lead: isLead })
		else old.lead = isLead
	}
	const targets = [...byTarget.entries()]
	const pages = targets.map(([t]) => t).filter((t) => t.startsWith("https://"))
	const kept = targets.map(([, t]) => t.row).filter((r) => r.url)
	const keptUrls = [...new Set(kept.map((r) => r.url as string))]

	const [descriptions, contents, counts] = await Promise.all([
		batched(pages, 300, (b) =>
			read<{ url: string; title: string | null; head: string | null }>(
				`SELECT url, title, substr(description, 1, 900) AS head FROM trope_catalog_page WHERE url IN (${b.map(() => "?").join(",")}) LIMIT ${b.length}`,
				b,
			),
		).catch(() => []),
		batched(keptUrls, 250, (b) =>
			read<{ name: string; url: string | null; content: string | null }>(
				// The per-title name column is full-text indexed: read by URL, as the profile's excerpts do.
				`SELECT name, url, content FROM trope WHERE media_type = ? AND media_tmdb_id = ? AND url IN (${b.map(() => "?").join(",")}) LIMIT ${b.length * 4}`,
				[type, id, ...b],
			),
		),
		// How common each trope is: optional, dropped when slow.
		within(
			batched(keptUrls, 400, (b) =>
				read<{ url: string; n: number }>(
					`SELECT url, count(*) AS n FROM trope WHERE url IN (${b.map(() => "?").join(",")}) GROUP BY url LIMIT ${b.length}`,
					b,
					2500,
				),
			),
			2500,
			[] as { url: string; n: number }[],
		),
	])
	const described = new Map(descriptions.map((d) => [d.url, d]))
	const contentOf = new Map(
		contents.map((c) => [`${c.name}\u0000${c.url ?? ""}`, c.content ?? ""]),
	)
	const countOf = new Map(counts.map((c) => [c.url, Number(c.n)]))

	const tropes: PageTrope[] = targets.map(([target, t]) => {
		const d = described.get(target)
		const html = contentOf.get(`${t.row.name}\u0000${t.row.url ?? ""}`) ?? ""
		const paragraphs = html ? excerptParagraphs(html) : []
		return {
			id: target,
			name: d?.title?.trim() || t.title || t.row.name,
			url: target.startsWith("https://") ? target : "",
			meaning: meaningOf(d?.head ?? null),
			paragraphs: paragraphs.length ? paragraphs : null,
			teaser: safeTeaser(paragraphs, 200),
			length: t.row.length ?? 0,
			titles: (t.row.url && countOf.get(t.row.url)) || null,
			lead: t.lead,
		}
	})
	tropes.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)))
	return { tropes, total: tropes.length, signature: signatureOf(tropes) }
}

// A title's tropes change when the TV Tropes import runs (weekly at most): a day is fresh enough. The whole read is
// 30 KB to 1.8 MB (The Simpsons, 2,108 tropes) and takes 0.3 to 2.7 s cold.
const TROPES_CACHE = "title-tropes-v1"
const TROPES_TTL_MINUTES = 12 * 60

/** The whole read, from the data cache. */
export const titleTropes = (type: "movie" | "show", id: number) =>
	cached<{ type: "movie" | "show"; id: number }, AllTropesResponse>({
		name: TROPES_CACHE,
		params: { type, id },
		ttlMinutes: TROPES_TTL_MINUTES,
		staleMinutes: TROPES_TTL_MINUTES,
		target: ({ type, id }: { type: "movie" | "show"; id: number }) =>
			loadTitleTropes(type, id),
	})

// The title page reads only its two cards, so they are kept on their own (about 1 KB) and a title page doesn't read
// the whole list from the data cache.
const TEASER_CACHE = "title-tropes-teaser-v1"

/** The title page's two signature cards and the count, from the data cache. */
export const titleTropesTeaser = (type: "movie" | "show", id: number) =>
	cached<{ type: "movie" | "show"; id: number }, TropesTeaser>({
		name: TEASER_CACHE,
		params: { type, id },
		ttlMinutes: TROPES_TTL_MINUTES,
		staleMinutes: TROPES_TTL_MINUTES,
		target: async ({ type, id }: { type: "movie" | "show"; id: number }) =>
			tropesTeaserOf(await titleTropes(type, id)),
	})

/**
 * The Tropes sub-page's data for its loader: the index as a dehydrated query (the key useAllTropes reads), so its
 * HTML holds every trope. `complete` is false when the read failed (the page then loads the index in the browser).
 */
export async function tropesPageState(
	type: "movie" | "show",
	id: number,
): Promise<{
	state: DehydratedState
	complete: boolean
	total: number | null
}> {
	const client = new QueryClient()
	try {
		const all = await titleTropes(type, id)
		client.setQueryData(tropesIndexKey(type, id), tropesIndexOf(all))
		return { state: dehydrate(client), complete: true, total: all.total }
	} catch (error) {
		console.error("Tropes page read failed", {
			type,
			id,
			error: error instanceof Error ? error.message : error,
		})
		return { state: dehydrate(client), complete: false, total: null }
	}
}

/**
 * The title page's Tropes section for its loader: the two signature cards as a dehydrated query (the key
 * useTropesTeaser reads), waited for `budgetMs` at most. `complete` is false when the read ran out of time or failed
 * (the section then loads its cards in the browser, and no cache may keep the page).
 */
export async function tropesTeaserState(
	type: "movie" | "show",
	id: number,
	budgetMs: number,
): Promise<{ state: DehydratedState; complete: boolean }> {
	const client = new QueryClient()
	let timer: ReturnType<typeof setTimeout> | undefined
	const work = titleTropesTeaser(type, id).then((teaser) => {
		client.setQueryData(tropesTeaserKey(type, id), teaser)
		return true
	})
	const complete = await Promise.race([
		work.catch((error: unknown) => {
			console.error("Title page tropes read failed", {
				type,
				id,
				error: error instanceof Error ? error.message : error,
			})
			return false
		}),
		new Promise<false>((resolve) => {
			timer = setTimeout(() => resolve(false), budgetMs)
		}),
	]).finally(() => clearTimeout(timer))
	return { state: dehydrate(client), complete }
}

/** The description opening for one trope, as the profile shows it. */
export async function loadTropeOpening(
	url: string,
): Promise<TropeOpening | null> {
	const d = await readTropeDescriptions([url])
	return d[url]?.opening ?? null
}

/** A–Z ignores the leading quote or article-free punctuation ("\"Bringer of War\" Music" sorts under B). */
export const sortKey = (name: string) =>
	name.replace(/^[^\p{L}\p{N}]+/u, "").toLowerCase()

/**
 * The most telling: the page's own signature run first, then by how much TV Tropes says about it here (write-up
 * length) weighed by how few titles share it (log inverse frequency). Only tropes with a spoiler-free line, a meaning
 * and a write-up of some substance qualify.
 */
function signatureOf(tropes: PageTrope[], n = 6) {
	const fit = tropes.filter((t) => t.teaser && t.meaning && t.length >= 250)
	const score = (t: PageTrope) =>
		t.length * Math.log(20_000 / Math.max(3, t.titles ?? 400))
	// At most two from one name family ("Adaptation …", "Adaptational …"), so the lead isn't one kind.
	const family = (t: PageTrope) => sortKey(t.name).slice(0, 5)
	const out: PageTrope[] = []
	for (const t of [...fit].sort(
		(a, b) => Number(b.lead) - Number(a.lead) || score(b) - score(a),
	)) {
		if (out.length >= n) break
		if (out.filter((o) => family(o) === family(t)).length < 2) out.push(t)
	}
	return out.map((t) => t.id)
}

/** The leading run some pages list before their A to Z (the same rule orderTropes uses). */
function leadRun(tropes: string[]) {
	let start = tropes.length - 1
	while (start > 0 && tropes[start - 1].localeCompare(tropes[start]) <= 0)
		start--
	return start > 10 ? [] : tropes.slice(0, start)
}

/** The description's first sentence, skipping an opening quotation and its attribution line. */
function meaningOf(head: string | null) {
	if (!head) return null
	const paragraph = head
		.split(/\n+/)
		.map((p) => p.trim())
		.find(
			(p) =>
				p.length > 30 &&
				!/^["“'‘—–-]/.test(p) &&
				!/^(?:This|The following) (?:page|trope) /i.test(p),
		)
	if (!paragraph) return null
	const sentences = paragraph.match(/[^.!?]+[.!?]+["”')\]]*(?=\s|$)/g) ?? [
		paragraph,
	]
	// A short opener ("This is the opposite of X.") says little alone: take the next sentence too.
	const first =
		sentences[0].length < 70 && sentences[1]
			? `${sentences[0]} ${sentences[1].trim()}`.trim()
			: sentences[0].trim()
	return first.length > 220 ? `${first.slice(0, 219).trimEnd()}…` : first
}

const MAX = 900

/** Paragraphs of runs, trimmed to about `max` characters at a paragraph or sentence end. */
function excerptParagraphs(html: string, max = MAX): Paragraph[] {
	const out: Paragraph[] = []
	let current: Paragraph = []
	const spans: boolean[] = []
	let spoiler = 0
	const flush = () => {
		const trimmed = tidy(current)
		if (trimmed.length) out.push(trimmed)
		current = []
	}
	const push = (raw: string) => {
		const text = htmlToText(raw)
		if (!text) return
		const last = current.at(-1)
		const s = spoiler > 0
		const lead = raw.match(/^\s/) && current.length ? " " : ""
		const trail = raw.match(/\s$/) ? " " : ""
		if (last && !!last.spoiler === s) last.text += lead + text + trail
		else
			current.push({
				text: lead + text + trail,
				...(s ? { spoiler: true } : {}),
			})
	}
	for (const token of html.split(/(<[^>]*>)/)) {
		if (!token.startsWith("<")) {
			push(token)
			continue
		}
		const tag = /^<\/?\s*([a-z0-9]+)/i.exec(token)?.[1]?.toLowerCase()
		const closing = token.startsWith("</")
		if (
			tag === "li" ||
			tag === "p" ||
			tag === "br" ||
			tag === "ul" ||
			tag === "ol" ||
			tag === "div"
		) {
			flush()
			continue
		}
		if (tag === "span") {
			if (closing) {
				if (spans.pop()) spoiler--
			} else {
				const isSpoiler = /class\s*=\s*["'][^"']*\bspoiler\b/i.test(token)
				spans.push(isSpoiler)
				if (isSpoiler) spoiler++
			}
		}
	}
	flush()
	return trim(out, max)
}

function tidy(p: Paragraph): Paragraph {
	// TV Tropes' "invoked" icon label runs into the next word ("invokedIn-Universe").
	const runs = p
		.map((r) => ({
			...r,
			text: r.text.replace(/\s+/g, " ").replace(/\binvoked(?=[A-Z])/g, ""),
		}))
		.filter((r) => r.text.trim())
	if (runs.length) {
		runs[0].text = runs[0].text.trimStart()
		runs[runs.length - 1].text = runs[runs.length - 1].text.trimEnd()
	}
	return runs.filter((r) => r.text)
}

function trim(paragraphs: Paragraph[], max: number): Paragraph[] {
	const out: Paragraph[] = []
	let used = 0
	for (const p of paragraphs) {
		const length = p.reduce((a, r) => a + r.text.length, 0)
		if (used + length <= max) {
			out.push(p)
			used += length
			continue
		}
		if (!out.length) out.push(cut(p, max))
		break
	}
	return out
}

function cut(p: Paragraph, max: number): Paragraph {
	const out: Paragraph = []
	let used = 0
	for (const r of p) {
		if (used + r.text.length <= max) {
			out.push(r)
			used += r.text.length
			continue
		}
		const room = r.text.slice(0, max - used)
		const end = room.search(/[.!?]["')\]]*\s[^.!?]*$/)
		out.push({
			...r,
			text: end > 0 ? room.slice(0, end + 1) : `${room.trimEnd()}…`,
		})
		break
	}
	return out
}
