// PROTOTYPE (start page lab, round 4): the "More moods" vocabulary for stage h and i: Discover's own moods, themes,
// styles and genres with their names and colors, in groups, plus the few moods the row shows and a recent list.
import { GENRE_COLOR } from "~/domain/genre-colors"
import { MOODS } from "~/domain/moods"
import { STYLES, THEMES } from "~/domain/themes-styles"

export type VocabGroup = "moods" | "themes" | "styles" | "genres"

export type VocabItem = {
	id: string
	label: string
	color: string
	group: VocabGroup
	/** Set for a Discover mood: it answers with the mood's own titles. */
	moodKey?: string
}

export const GROUP_NAMES: Record<VocabGroup, string> = {
	moods: "Moods",
	themes: "What it’s about",
	styles: "How it’s told",
	genres: "Genres",
}

/** The most common moods, shown in the row; everything else waits behind More moods. */
export const ROW_MOODS = ["feelgood", "funny", "crime", "mind", "scary", "romance"]

const moods: VocabItem[] = MOODS.map((m) => ({ id: `mood:${m.key}`, label: m.name, color: m.hue, group: "moods", moodKey: m.key }))
const themes: VocabItem[] = THEMES.map((t) => ({ id: `theme:${t.id}`, label: t.name, color: t.color, group: "themes" }))
const styles: VocabItem[] = STYLES.map((s) => ({ id: `style:${s.id}`, label: s.name, color: s.color, group: "styles" }))

// Genres a mood, theme or style already names (or TV-only ones) stay out, so no word shows twice.
const taken = new Set([...moods, ...themes, ...styles].map((v) => v.label.toLowerCase()))
const SKIP_GENRES = new Set(["Action", "Animation", "TV Movie", "Kids", "Reality", "Soap", "Talk", "News", "Romance"])
const genres: VocabItem[] = Object.entries(GENRE_COLOR)
	.filter(([name]) => !SKIP_GENRES.has(name) && !taken.has(name.toLowerCase()))
	.map(([name, color]) => ({ id: `genre:${name.toLowerCase().replace(/\s+/g, "-")}`, label: name, color, group: "genres" }))

export const VOCAB: VocabItem[] = [...moods, ...themes, ...styles, ...genres]
export const VOCAB_BY_ID = new Map(VOCAB.map((v) => [v.id, v]))
const byLabel = new Map(VOCAB.map((v) => [v.label, v]))

/** The vocabulary item a stage source stands for (a mood key, or a prompt whose text is a label), if any. */
export function vocabOf(source: { kind: string; key?: string; q?: string; lead?: string | null }): VocabItem | null {
	if (source.kind === "mood" && source.key) return VOCAB_BY_ID.get(`mood:${source.key}`) ?? null
	// PROTOTYPE · Round 15: stage l/m's picks stand for their first word (the room's light follows it).
	if (source.kind === "mix") return source.lead ? (VOCAB_BY_ID.get(source.lead) ?? null) : null
	if (source.kind === "prompt" && source.q) return byLabel.get(source.q) ?? null
	return null
}

/** What people pick most, across the groups (shown first in the sheet). */
export const POPULAR_IDS = [
	"mood:feelgood",
	"mood:crime",
	"style:slow",
	"theme:true",
	"mood:mind",
	"style:animated",
	"theme:future",
	"mood:heavy",
	"genre:thriller",
	"theme:sports",
]

export function groupsOf(query: string): { group: VocabGroup; items: VocabItem[] }[] {
	const q = query.trim().toLowerCase()
	const hit = (v: VocabItem) => !q || v.label.toLowerCase().includes(q) || GROUP_NAMES[v.group].toLowerCase().includes(q)
	return (Object.keys(GROUP_NAMES) as VocabGroup[])
		.map((group) => ({ group, items: VOCAB.filter((v) => v.group === group && hit(v)) }))
		.filter((g) => g.items.length)
}

const RECENT_KEY = "start-lab-hi-recent"
export function readRecent(): string[] {
	try {
		const raw = sessionStorage.getItem(RECENT_KEY)
		const list = raw ? (JSON.parse(raw) as unknown) : []
		return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string" && VOCAB_BY_ID.has(id)).slice(0, 6) : []
	} catch {
		return []
	}
}
export function pushRecent(id: string): string[] {
	const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 6)
	try {
		sessionStorage.setItem(RECENT_KEY, JSON.stringify(next))
	} catch {}
	return next
}
