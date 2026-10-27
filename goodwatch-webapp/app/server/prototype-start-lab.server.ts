// PROTOTYPE (start page lab, 2026-10-27): the lab's data, read from fixture JSON only. No database, no search, no
// endpoint: the server runs with blank endpoints (prototype-start-lab.sh).
// - START_LAB_FIXTURES (default ~/.cache/start-lab/fixtures): intro.json (a capture of /api/intro), talked.json
//   (/api/talked-about-now), guest.json and member.json (captured through the GoodWatch MCP; member.json is the
//   owner's own data and stays out of git).
// - public/prototype-start-lab/scenes/<id>.json: the generated room scenes, paired with their `-portrait` versions.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { TitleCard } from "~/server/title-cards.server"
import type { SceneMeta, ScenePair } from "~/ui/prototype-start-lab/scene/types"
import type { TalkedRow } from "~/domain/talked-about-now"

/** A title as the lab's variants get it: a TitleCard, so the site's own cards render it unchanged. */
export type LabCard = TitleCard

type RawCard = {
	id?: string
	key?: number | string
	media_type?: string
	mediaType?: string
	tmdb_id?: number
	tmdbId?: number
	title?: string
	name?: string
	year?: number | null
	release_year?: number | null
	score?: number | null
	goodwatch_score?: number | null
	goodwatch_overall_score_normalized_percent?: number | null
	goodwatch_overall_score_voting_count?: number | null
	match?: number | null
	poster_path?: string | null
	poster?: string | null
	backdrop_path?: string | null
	backdrop?: string | null
	runtime?: number | null
	runtime_minutes?: number | null
	tagline?: string | null
	services?: TitleCard["services"]
	[k: string]: unknown
}

const stripTmdb = (p: string | null | undefined) =>
	p ? p.replace(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+/, "") : null

export function toCard(raw: RawCard): LabCard | null {
	let mediaType = (raw.media_type ?? raw.mediaType) as string | undefined
	let tmdbId = raw.tmdb_id ?? raw.tmdbId
	if ((!mediaType || !tmdbId) && typeof raw.id === "string" && raw.id.includes(":")) {
		const [m, t] = raw.id.split(":")
		mediaType = m
		tmdbId = Number(t)
	}
	if (mediaType === "tv") mediaType = "show"
	if ((mediaType !== "movie" && mediaType !== "show") || !tmdbId) return null
	const title = raw.title ?? raw.name
	if (!title) return null
	return {
		key: (mediaType === "movie" ? 1e12 : 2e12) + tmdbId,
		tmdb_id: tmdbId,
		media_type: mediaType,
		title,
		poster_path: stripTmdb(raw.poster_path ?? raw.poster),
		backdrop_path: stripTmdb(raw.backdrop_path ?? raw.backdrop),
		release_year: raw.release_year ?? raw.year ?? null,
		runtime: raw.runtime ?? raw.runtime_minutes ?? null,
		tagline: raw.tagline ?? null,
		goodwatch_overall_score_normalized_percent:
			raw.goodwatch_overall_score_normalized_percent ?? raw.score ?? raw.goodwatch_score ?? null,
		goodwatch_overall_score_voting_count: raw.goodwatch_overall_score_voting_count ?? null,
		match: raw.match ?? null,
		reasons: [],
		services: raw.services ?? null,
		seen: false,
		wantToSee: false,
		notInterested: false,
		rating: null,
	} as LabCard
}

const cards = (list: unknown): LabCard[] =>
	Array.isArray(list) ? list.map((c) => toCard(c as RawCard)).filter((c): c is LabCard => !!c && !!c.poster_path) : []

export type LabMood = { key: string; label: string; titles: LabCard[] }
export type LabPrompt = { q: string; reading: unknown; titles: LabCard[] }

export type LabGuest = {
	moods: LabMood[]
	prompts: LabPrompt[]
	popular: LabCard[]
	topRated: LabCard[]
	/** The famous titles a visitor taps (the intro quiz's pool), and what each one leads to. */
	quizPool: LabCard[]
	similar: Record<string, LabCard[]>
	/** Teaser rows for the browse section (round 2), from Discover browse captures. */
	browse: LabBrowse
}

export type LabBrowse = {
	genres: { movie: { name: string; titles: LabCard[] }[]; show: { name: string; titles: LabCard[] }[] }
	services: { id: number; name: string; logo_path: string | null; titles: LabCard[] }[]
	best: { movie: LabCard[]; show: LabCard[] }
	newOn: LabCard[]
}

export type LabShowSection = { name: string; titles: (LabCard & { next?: unknown })[] }

export type LabMember = {
	name: string
	tonight: LabCard[]
	tonightRaw: unknown
	shows: LabShowSection[]
	wishlistMovies: LabCard[]
	forYou: LabCard[]
	forYouShows: LabCard[]
}

export type LabData = {
	scenes: ScenePair[]
	guest: LabGuest
	member: LabMember | null
	talked: TalkedRow | null
	fixtures: string
}

// The Discover mood chips' words (the site's MOODS), so chips read like the real filter.
const MOOD_LABELS: Record<string, string> = {
	funny: "Funny",
	feelgood: "Feel-good",
	romance: "Romance",
	action: "Action",
	scary: "Scary",
	crime: "Crime",
	mind: "Mind-bending",
	heavy: "Heavy",
	worlds: "Other worlds",
	history: "History",
	growing: "Growing up",
}

const fixturesDir = () => process.env.START_LAB_FIXTURES || path.join(os.homedir(), ".cache/start-lab/fixtures")

function readJson(file: string): unknown {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"))
	} catch {
		return null
	}
}

function readScenes(): ScenePair[] {
	const dir = path.join(process.cwd(), "public/prototype-start-lab/scenes")
	let files: string[] = []
	try {
		files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("index"))
	} catch {
		return []
	}
	const metas = new Map<string, SceneMeta>()
	for (const f of files) {
		const meta = readJson(path.join(dir, f)) as SceneMeta | null
		if (meta?.id && "tv" in meta && Array.isArray(meta.slots)) metas.set(meta.id, meta)
	}
	const order = ["nook-stage", "nook-stage-tv", "nook-illustrated", "sofa-shelves", "media-wall-angle", "shelf-closeup", "coffee-table", "projector-loft", "retro-den", "iso-cutaway", "pixel-iso", "miniature", "papercraft", "flat-vector"]
	const ids = [...metas.keys()].filter((id) => !id.endsWith("-portrait"))
	ids.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
	return ids.map((id) => ({
		id,
		landscape: metas.get(id) as SceneMeta,
		portrait: metas.get(`${id}-portrait`) ?? null,
	}))
}

function readBrowse(raw: unknown): LabBrowse {
	const b = (raw ?? {}) as Record<string, any>
	const rows = (list: unknown) =>
		Array.isArray(list) ? list.map((r: { name: string; titles: unknown }) => ({ name: r.name, titles: cards(r.titles) })) : []
	return {
		genres: { movie: rows(b.genres?.movie), show: rows(b.genres?.show) },
		services: Array.isArray(b.services)
			? b.services.map((s: { id: number; name: string; logo_path?: string; titles: unknown }) => ({
					id: s.id,
					name: s.name,
					logo_path: s.logo_path ?? null,
					titles: cards(s.titles),
				}))
			: [],
		best: { movie: cards(b.best?.movie), show: cards(b.best?.show) },
		newOn: cards(b.newOn),
	}
}

function readGuest(dir: string): LabGuest {
	const g = (readJson(path.join(dir, "guest.json")) ?? {}) as Record<string, unknown>
	const moods = Array.isArray(g.moods) ? (g.moods as { key: string; titles: unknown }[]) : []
	const prompts = Array.isArray(g.prompts) ? (g.prompts as { q: string; reading?: unknown; titles: unknown }[]) : []
	const similar: Record<string, LabCard[]> = {}
	for (const [k, v] of Object.entries((g.similar ?? {}) as Record<string, unknown>)) similar[k] = cards(v)
	return {
		moods: moods.map((m) => ({ key: m.key, label: MOOD_LABELS[m.key] ?? m.key, titles: cards(m.titles) })),
		prompts: prompts.map((p) => ({ q: p.q, reading: p.reading ?? null, titles: cards(p.titles) })),
		popular: cards(g.popular),
		topRated: cards(g.topRated),
		quizPool: cards(g.quizPool),
		similar,
		browse: readBrowse(g.browse),
	}
}

function showCards(list: unknown): LabShowSection["titles"] {
	const out: LabShowSection["titles"] = []
	for (const c of Array.isArray(list) ? (list as RawCard[]) : []) {
		const card = toCard(c)
		if (card?.poster_path) out.push({ ...card, next: c.next ?? c.next_episode ?? c.episode ?? undefined })
	}
	return out
}

function readMember(dir: string): LabMember | null {
	const m = readJson(path.join(dir, "member.json")) as Record<string, unknown> | null
	if (!m) return null
	const tonight = m.tonight as Record<string, unknown> | undefined
	const rawShowsTop = m.shows as unknown
	// get_my_shows: { sections: [{ group, label, titles }] }
	const rawShows =
		rawShowsTop && typeof rawShowsTop === "object" && Array.isArray((rawShowsTop as { sections?: unknown }).sections)
			? (rawShowsTop as { sections: unknown[] }).sections
			: rawShowsTop
	let shows: LabShowSection[] = []
	if (Array.isArray(rawShows)) {
		shows = rawShows.map((s: Record<string, unknown>) => ({
			name: String(s.label ?? s.name ?? s.section ?? s.title ?? "Shows"),
			titles: showCards(s.titles ?? s.items),
		}))
	} else if (rawShows && typeof rawShows === "object") {
		const sections = ((rawShows as Record<string, unknown>).sections ?? rawShows) as Record<string, unknown>
		shows = Object.entries(sections)
			.filter(([, v]) => Array.isArray(v))
			.map(([name, v]) => ({
				name,
				titles: showCards(v),
			}))
	}
	// get_tonight, normalized: { card, ... } or a list of cards.
	const norm = tonight?.normalized as Record<string, unknown> | unknown[] | undefined
	const tonightCards = cards(
		Array.isArray(norm) ? norm : norm && typeof norm === "object" && "card" in norm ? [norm.card] : (tonight?.cards ?? []),
	)
	return {
		name: "Sam",
		tonight: tonightCards,
		tonightRaw: tonight?.raw ?? tonight ?? null,
		shows,
		wishlistMovies: cards(
			(Array.isArray(m.wishlistMovies) ? (m.wishlistMovies as RawCard[]) : []).filter((c) => c.status !== "seen"),
		),
		forYou: cards(m.forYou),
		forYouShows: cards(m.forYouShows),
	}
}

export function loadStartLab(): LabData {
	const dir = fixturesDir()
	const talked = (readJson(path.join(dir, "talked.json")) as { row?: TalkedRow } | null)?.row ?? null
	return { scenes: readScenes(), guest: readGuest(dir), member: readMember(dir), talked, fixtures: dir }
}

/** The captured /api/intro answer, for the prototype's /api/intro (api.intro.ts). */
export function startLabIntro(): unknown {
	return readJson(path.join(fixturesDir(), "intro.json"))
}
