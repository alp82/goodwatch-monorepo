// The profile header's data (routes/u.$handle.tsx, Settings and list pages for a member with a handle): the shell as
// the viewer sees it, the viewer type and the taste print when they may see the taste, the facts for the header
// (ui/profile/header/facts.ts), and for a signed-in visitor on someone else's profile, the match with them. The
// owner's shell stays the owner's while they view their profile as a visitor: the header cuts that view itself, facts
// included.
//
// Cost: the header runs on every profile, Settings and list page, so the facts come from caches and one grouped
// watch-log read for this year (one member's rows, runtimes from their caches). The Stats tab's numbers are read from
// its summary cache and never computed here; a cold cache leaves those facts out (the header fills in others) until
// the Stats tab has built them. The facts and the match are kept in process memory for KEEP_MS.
import type { ProfileShell } from "~/domain/profile"
import { seesPart } from "~/domain/profile"
import type { TasteStats } from "~/domain/profile-taste"
import { type MatchTier, matchTier } from "~/domain/profile-taste"
import { movieRuntimes } from "~/server/movie-runtimes.server"
import { getMemberMatch } from "~/server/taste/member-match.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { type HeaderFact, watchTime } from "~/ui/profile/header/facts"
import type { WhorlAttribute } from "~/ui/profile/taste/Whorl"
import { query } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"
import { episodeMinutes, getProfileLibrary } from "./library.server"
import { loadProfileShell } from "./page.server"
import { getProfilePortrait } from "./portrait.server"
import { readCachedTasteStats } from "./taste-stats-cache.server"

const KEEP_MS = 2 * 60_000
const MAX_KEPT = 200
const DEFAULT_EPISODE_MINUTES = 40

/** The signed-in visitor's match with the profile's owner, for the header. */
export interface HeaderMatch {
	percent: number
	tier: MatchTier
	/** The visitor's own print, for rings that draw both. */
	yours: WhorlAttribute[] | null
}

export interface ProfileHeaderData {
	shell: ProfileShell
	/** The viewer type, when the viewer may see the taste and it is ready. */
	identity: string | null
	/** The taste print's attributes, under the same rule as `identity`. */
	print: WhorlAttribute[] | null
	/** The loaded facts the viewer may see; the header adds the ones the shell holds. */
	facts: HeaderFact[]
	/** For a member on someone else's profile, when both have enough scores. */
	match: HeaderMatch | null
}

const printOf = (
	view: Awaited<ReturnType<typeof getProfilePortrait<"fingerprint">>> | null,
): WhorlAttribute[] | null =>
	view?.status === "ready"
		? view.attributes.map((a) => ({
				key: a.key,
				label: a.label,
				family: a.family,
				edge: a.edge,
			}))
		: null

export async function loadProfileHeader(
	request: Request,
	handle: string,
): Promise<
	| { header: ProfileHeaderData; ownerId: string; viewerId: string | null }
	| Response
> {
	const loaded = await loadProfileShell(request, handle, { asVisitor: false })
	if (loaded instanceof Response) return loaded
	const { shell, ownerId, viewerId } = loaded
	// The viewer type, the print, the facts and the match are extras: the header shows without them when they fail.
	const [fingerprint, facts, match] = await Promise.all([
		seesPart(shell, "taste")
			? getProfilePortrait(ownerId, "fingerprint", {
					scores: seesPart(shell, "scores"),
					summary: true,
					request,
				}).catch((error) => {
					console.error("[profile] header: viewer type failed", error)
					return null
				})
			: null,
		keep(`facts:${ownerId}`, () => readFacts(ownerId)).catch((error) => {
			console.error("[profile] header: facts failed", error)
			return [] as HeaderFact[]
		}),
		shell.viewer === "member" && viewerId
			? keep(`match:${viewerId}:${ownerId}`, () =>
					readMatch(viewerId, ownerId),
				).catch((error) => {
					console.error("[profile] header: match failed", error)
					return null
				})
			: null,
	])
	const ready = fingerprint?.status === "ready" ? fingerprint : null
	return {
		header: {
			shell,
			identity: ready?.identity?.name ?? null,
			print: printOf(ready),
			facts: facts.filter((f) =>
				f.parts.every((part) => seesPart(shell, part)),
			),
			match,
		},
		ownerId,
		viewerId,
	}
}

// biome-ignore lint/suspicious/noExplicitAny: one map keeps both kinds of value
const kept = new Map<string, { at: number; value: Promise<any> }>()

/** One value per key for KEEP_MS; a failed read is dropped so the next view tries again. */
function keep<T>(key: string, read: () => Promise<T>): Promise<T> {
	const hit = kept.get(key)
	if (hit && Date.now() - hit.at < KEEP_MS) return hit.value as Promise<T>
	const value = read()
	kept.delete(key)
	kept.set(key, { at: Date.now(), value })
	value.catch(() => kept.delete(key))
	for (const old of kept.keys()) {
		if (kept.size <= MAX_KEPT) break
		kept.delete(old)
	}
	return value
}

async function readMatch(
	viewerId: string,
	ownerId: string,
): Promise<HeaderMatch | null> {
	const [match, yours] = await Promise.all([
		getMemberMatch(viewerId, ownerId),
		getProfilePortrait(viewerId, "fingerprint", { summary: true }).catch(
			() => null,
		),
	])
	if ("thin" in match) return null
	return {
		percent: match.percent,
		tier: matchTier(match.percent),
		yours: printOf(yours),
	}
}

/** The facts from the Stats cache and this year's watches, for every viewer; the loader cuts them to what this one may see. */
async function readFacts(ownerId: string): Promise<HeaderFact[]> {
	const [stats, year] = await Promise.all([
		readCachedTasteStats(ownerId),
		yearFacts(ownerId),
	])
	return [...statsFacts(stats?.value ?? null), ...year]
}

/** "Spielberg" for a phone's small tile. */
const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name

/** Countries, languages, decades, the top genre and the favorite people, from the Stats tab's numbers. */
function statsFacts(stats: TasteStats | null): HeaderFact[] {
	if (!stats) return []
	const out: HeaderFact[] = []
	const { totalCountries, totalLanguages } = stats.world
	if (totalCountries >= 2)
		out.push({
			key: "countries",
			value: `${totalCountries} countries`,
			label: "explored",
			short: { value: `${totalCountries}`, label: "countries" },
			parts: ["taste"],
		})
	if (totalLanguages >= 2)
		out.push({
			key: "languages",
			value: `${totalLanguages} languages`,
			label: "heard",
			short: { value: `${totalLanguages}`, label: "languages" },
			parts: ["taste"],
		})
	const decades = stats.eras.decades.filter((d) => d.count > 0)
	if (decades.length >= 2)
		out.push({
			key: "decades",
			value: `${decades.length} decades`,
			label: "spanned",
			short: { value: `${decades.length}`, label: "decades" },
			parts: ["taste"],
		})
	const genre = stats.genres[0]
	if (genre && genre.count >= 5)
		out.push({
			key: "genre",
			value: genre.name,
			label: "top genre",
			labelFirst: true,
			parts: ["taste"],
		})
	const director = stats.people.directors[0]
	if (director && director.count >= 3)
		out.push({
			key: "director",
			value: director.name,
			label: "favorite director",
			short: { value: surname(director.name), label: "director" },
			labelFirst: true,
			parts: ["taste"],
		})
	const actor = stats.people.actors[0]
	if (actor && actor.count >= 3)
		out.push({
			key: "actor",
			value: actor.name,
			label: "favorite actor",
			short: { value: surname(actor.name), label: "actor" },
			labelFirst: true,
			parts: ["taste"],
		})
	return out
}

/**
 * This calendar year's watches: titles seen, the time they took, and the top genre among the scored ones. One grouped
 * read of the member's dated watches; runtimes come from their caches.
 */
async function yearFacts(ownerId: string): Promise<HeaderFact[]> {
	const start = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
	const rows = await query<{
		media_type: "movie" | "show"
		tmdb_id: number
		watches: number
		episodes: number
	}>(
		`SELECT media_type, tmdb_id, count(*) AS watches,
		        count(*) FILTER (WHERE season_number > 0) AS episodes
		 FROM user_watch_log
		 WHERE user_id = ? AND watched_at >= ? AND watched_at_precision <> 'unknown'
		 GROUP BY media_type, tmdb_id
		 LIMIT 20000`,
		[ownerId, start.toISOString()],
	)
	const movies = rows.filter((r) => r.media_type === "movie")
	const shows = rows.filter((r) => r.media_type === "show" && r.episodes > 0)
	if (!movies.length && !shows.length) return []
	const [runtimes, perEpisode, library] = await Promise.all([
		movieRuntimes(movies.map((r) => titleKey("movie", Number(r.tmdb_id)))),
		episodeMinutes(shows.map((r) => Number(r.tmdb_id))),
		getProfileLibrary(ownerId).catch(() => null),
	])
	let minutes = 0
	for (const r of movies)
		minutes +=
			(runtimes.get(titleKey("movie", Number(r.tmdb_id))) ?? 0) *
			Number(r.watches)
	for (const r of shows)
		minutes +=
			Number(r.episodes) *
			(perEpisode.get(Number(r.tmdb_id)) ?? DEFAULT_EPISODE_MINUTES)

	const out: HeaderFact[] = []
	// Movies and shows together: one number reads at a glance in a tile.
	const titles = movies.length + shows.length
	out.push({
		key: "yearSeen",
		value: `${titles} ${titles === 1 ? "title" : "titles"}`,
		label: "seen this year",
		short: { label: "this year" },
		parts: ["seen"],
	})
	const hours = Math.round(minutes / 60)
	if (hours > 0)
		out.push({
			key: "yearTime",
			value: watchTime(hours),
			label: "watched this year",
			short: { label: "this year" },
			parts: ["hours"],
		})
	// The top genre among this year's scored titles.
	const tally = new Map<string, number>()
	for (const r of rows) {
		const key = `${r.media_type}-${r.tmdb_id}` as MediaKey
		const card = library?.scored.get(key)
		if (!card || parseMediaKey(key).mediaType !== r.media_type) continue
		for (const genre of card.genres)
			tally.set(genre, (tally.get(genre) ?? 0) + 1)
	}
	const [top] = [...tally.entries()].sort(
		(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
	)
	if (top && top[1] >= 3)
		out.push({
			key: "yearGenre",
			value: top[0],
			label: "top genre this year",
			short: { label: "top genre" },
			labelFirst: true,
			parts: ["seen", "taste"],
		})
	return out
}
