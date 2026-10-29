// Find in title, the page's own part: one small index of what the page shows (sections, services, scores, fingerprint
// scales, episodes, questions, facts, keywords, tropes), built in the browser from the page's data. People come from
// the server instead (useFindItems), so the whole cast and crew is found, not only the page's first people.
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { SCALE_GROUPS, readScale } from "~/ui/details/fingerprint/scales"
import {
	fingerprintInput,
	scoreLines,
	titleFacts,
	tropeNames,
} from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import type { StreamingLink } from "~/utils/streaming-links"

type Media = MovieResult | ShowResult

/** A section as find knows it: its id, its name, its gist, and other words that should find it. */
export interface FindSection {
	id: string
	label: string
	peek: string | null
	aliases?: string
}

export interface FindEntry {
	key: string
	/** The section it sits in. */
	section: string
	/** What the row says first: a service, an episode, a question. */
	title: string
	/** One muted line of context. */
	context: string
	/** Text the page shows for the item, to find and ring it in its section; none means the section itself. */
	needle?: string
	/** Extra words that should match (episode codes, kinds). */
	aliases?: string
	/** Sections sort first; the rest keep index order. */
	rank: number
}

/** Lower case, no accents, words of letters and digits (and a few signs: "%", "$", ".", "&"). */
export const normalize = (s: string) =>
	s
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9%$.&]+/g, " ")
		.trim()

const pad = (n: number) => String(n).padStart(2, "0")

export function buildFindIndex({
	media,
	country,
	sections,
	questions,
	grid,
	stream,
	rentBuy,
}: {
	media: Media
	country: string
	sections: FindSection[]
	questions: TitleQuestion[]
	grid: EpisodeGrid | null
	stream: StreamingLink[]
	rentBuy: StreamingLink[]
}): FindEntry[] {
	const has = new Set(sections.map((s) => s.id))
	const out: FindEntry[] = []
	const add = (e: Omit<FindEntry, "key">) =>
		has.has(e.section) && out.push({ ...e, key: `${e.section}:${out.length}` })

	for (const s of sections)
		add({
			section: s.id,
			title: s.label,
			context: s.peek ?? "",
			aliases: s.aliases,
			rank: 0,
		})

	// Where to watch
	for (const s of stream)
		add({
			section: "watch",
			title: s.name,
			context: "Stream",
			needle: s.name,
			aliases: "stream watch",
			rank: 1,
		})
	for (const s of rentBuy)
		if (!stream.some((x) => x.name === s.name))
			add({
				section: "watch",
				title: s.name,
				context: s.type === "buy" ? "Buy" : "Rent",
				needle: s.name,
				aliases: "rent buy",
				rank: 1,
			})

	// Scores
	for (const s of scoreLines(media))
		add({
			section: "scores",
			title: `${s.label} ${s.value}`,
			context: "Score",
			aliases: "rating score",
			rank: 1,
		})

	// Fingerprint scales: "Pace: Very slow"
	const t = fingerprintInput(media)
	if (t)
		for (const g of SCALE_GROUPS)
			for (const sc of g.scales)
				add({
					section: "fingerprint",
					title: `${sc.name}: ${readScale(sc, t).word}`,
					context: `Fingerprint · ${g.name}`,
					needle: sc.name,
					aliases: `${sc.left} ${sc.right}`,
					rank: 2,
				})
	for (const tag of media.fingerprint?.essenceTags ?? [])
		add({
			section: "story",
			title: tag,
			context: "Essence",
			needle: tag,
			rank: 2,
		})

	// Episodes (shows): "S1E9 · The We We Are"
	if (grid)
		for (const season of grid.seasons)
			for (const e of season.episodes) {
				if (!e.name) continue
				const code = `S${season.number}E${e.number}`
				add({
					section: "episodes",
					title: `${code} · ${e.name}`,
					context: e.unrated
						? "Episode · not rated yet"
						: `Episode · IMDb ${e.score.toFixed(1)}`,
					needle: e.name,
					aliases: `s${season.number}e${e.number} s${pad(season.number)}e${pad(e.number)} ${season.number}x${pad(e.number)} season ${season.number} episode ${e.number}`,
					rank: 2,
				})
			}

	// Questions
	for (const q of questions)
		add({
			section: "faq",
			title: q.q,
			context: q.a,
			needle: q.q,
			aliases: "question answer",
			rank: 3,
		})

	// Facts and keywords
	for (const f of titleFacts(media, country))
		add({
			section: "facts",
			title: `${f.label}: ${f.value}`,
			context: "Fact",
			needle: f.label,
			rank: 3,
		})
	for (const k of media.details.keywords ?? [])
		add({ section: "facts", title: k, context: "Keyword", needle: k, rank: 4 })

	// Tropes
	for (const name of tropeNames(media).names)
		add({
			section: "tropes",
			title: name,
			context: "Trope",
			needle: name,
			rank: 4,
		})

	return out
}

export interface FindHit {
	entry: FindEntry
	/** Where the query sits in the title, for the amber part. */
	at: [number, number] | null
}

/** Every word of the query must appear; title matches beat context matches, word starts beat the middle. */
export function findIn(
	index: FindEntry[],
	query: string,
	limit = 40,
): FindHit[] {
	const q = normalize(query)
	if (!q) return []
	const words = q.split(" ")
	// Short words count only at a word's start ("we" finds "The We We Are", not "Sweet" or "Lower").
	const hit = (text: string, w: string) =>
		w.length < 3 ? ` ${text}`.includes(` ${w}`) : text.includes(w)
	const scored: { hit: FindHit; score: number }[] = []
	for (const entry of index) {
		const title = normalize(entry.title)
		const hay = `${title} ${normalize(entry.context)} ${normalize(entry.aliases ?? "")}`
		if (!words.every((w) => hit(hay, w))) continue
		let score = entry.rank * 10
		// A match only in the context line (a section's gist) ranks under direct matches.
		const named = `${title} ${normalize(entry.aliases ?? "")}`
		if (!words.every((w) => hit(named, w))) score += 45
		if (title.startsWith(q)) score -= 30
		else if (title.includes(` ${q}`)) score -= 20
		else if (title.includes(q)) score -= 10
		else if (words.every((w) => title.includes(w))) score -= 5
		const i = entry.title.toLowerCase().indexOf(query.trim().toLowerCase())
		scored.push({
			hit: { entry, at: i >= 0 ? [i, i + query.trim().length] : null },
			score,
		})
	}
	return scored
		.sort((a, b) => a.score - b.score)
		.slice(0, limit)
		.map((x) => x.hit)
}
