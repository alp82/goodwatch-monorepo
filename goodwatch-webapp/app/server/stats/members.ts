// The members chapter of /stats, from member rows (raw.ts) to aggregates. Privacy rules (owner, November 15, 2026):
//
// - A member counts only in the numbers built from the profile parts they show to everyone. Scores need `scores`,
//   Seen marks `seen`, the Wishlist `wishlist`, watch time `hours`, a show's episode watches `shows`, imports
//   `activity`. A part set to members only or to the member alone is hidden: the page is public. Member countries
//   aren't a profile part; a member who hides every part is left out there too.
// - A title-level number needs at least 10 distinct members (MIN_TITLE_MEMBERS), an average at least 25
//   (MIN_AVERAGE_MEMBERS), a country and an import source at least 10 (MIN_COUNTRY_MEMBERS, MIN_SOURCE_MEMBERS).
//   Nothing names or singles out a member.
// - Rows of ids that aren't account ids (fixtures such as `owner`) are test data and never count.
//
// The weekday and hour charts count scores members gave by hand: scores an import wrote are left out, and so are
// bulk writes (60 or more scores from one member within one minute, as an AI app's batch writes them).
import {
	PROFILE_PARTS,
	type ProfilePart,
	parseVisibility,
} from "../../domain/profile.ts"
import type {
	MediaType,
	MemberStats,
	MemberTitle,
	ScoredTitle,
} from "../../domain/stats/snapshot.ts"
import type { MemberTitleRow, RawMembers } from "./raw.ts"

export const MIN_TITLE_MEMBERS = 10
export const MIN_AVERAGE_MEMBERS = 25
export const MIN_COUNTRY_MEMBERS = 10
export const MIN_SOURCE_MEMBERS = 10
/** The import sources with fewer members than MIN_SOURCE_MEMBERS, together, when they have enough members together. */
export const OTHER_SOURCE = "other"
/** Scores from one member within one minute that mark a bulk write. */
export const BULK_SCORES_PER_MINUTE = 60

const ACCOUNT_ID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_MS = 86_400_000

/** Whether a member's rows count for a profile part ("any": they show at least one part). */
export type Counts = (userId: string, part: ProfilePart | "any") => boolean

export function memberCounts(visibility: RawMembers["visibility"]): Counts {
	const hidden = new Map<string, Set<ProfilePart>>()
	for (const { userId, value } of visibility) {
		let parsed: unknown
		try {
			parsed = JSON.parse(value)
		} catch {
			parsed = null
		}
		const parts = parseVisibility(parsed)
		hidden.set(
			userId,
			new Set(PROFILE_PARTS.filter((part) => parts[part] !== "everyone")),
		)
	}
	return (userId, part) => {
		if (!ACCOUNT_ID.test(userId)) return false
		const off = hidden.get(userId)
		if (!off) return true
		return part === "any" ? off.size < PROFILE_PARTS.length : !off.has(part)
	}
}

const titleKey = (type: MediaType, tmdbId: number) => `${type}-${tmdbId}`

/** Scores an import wrote, or that came in bulk: left out of the weekday and hour charts. */
export function bulkScoreKeys(
	scores: RawMembers["scores"],
	imported: RawMembers["importedScores"],
): Set<string> {
	const out = new Set(
		imported.map((x) => `${x.userId}|${titleKey(x.type, x.tmdbId)}`),
	)
	const perMinute = new Map<string, string[]>()
	for (const s of scores) {
		if (s.createdAt === null) continue
		const minute = `${s.userId}|${Math.floor(s.createdAt / 60_000)}`
		const keys = perMinute.get(minute) ?? []
		keys.push(`${s.userId}|${titleKey(s.type, s.tmdbId)}`)
		perMinute.set(minute, keys)
	}
	for (const keys of perMinute.values())
		if (keys.length >= BULK_SCORES_PER_MINUTE) for (const k of keys) out.add(k)
	return out
}

type Agg = {
	type: MediaType
	tmdbId: number
	members: Set<string>
	sum: number
	squares: number
	n: number
	year: number | null
}

/** Per title: who scored it, and the sums for its average and spread. */
function scoreAggregates(scores: RawMembers["scores"]) {
	const byTitle = new Map<string, Agg>()
	for (const s of scores) {
		const key = titleKey(s.type, s.tmdbId)
		const agg = byTitle.get(key) ?? {
			type: s.type,
			tmdbId: s.tmdbId,
			members: new Set<string>(),
			sum: 0,
			squares: 0,
			n: 0,
			year: s.year,
		}
		agg.members.add(s.userId)
		agg.sum += s.score
		agg.squares += s.score * s.score
		agg.n++
		byTitle.set(key, agg)
	}
	return [...byTitle.values()]
}

/** Sample standard deviation, as Crate's `stddev` (n - 1). */
const deviation = (a: Agg) => {
	if (a.n < 2) return 0
	const mean = a.sum / a.n
	return Math.sqrt(Math.max(0, (a.squares - a.n * mean * mean) / (a.n - 1)))
}

/** The rows a member list starts from, before titles are attached: everything counted, nothing cut yet. */
export interface MemberAggregates {
	scoreRows: RawMembers["scores"]
	scored: Agg[]
	seen: { type: MediaType; tmdbId: number; members: number }[]
	binged: { tmdbId: number; episodeWatches: number; members: number }[]
	wishlisted: { type: MediaType; tmdbId: number; members: number }[]
}

const tally = <K extends string>(
	rows: { userId: string; key: K }[],
): Map<K, Set<string>> => {
	const out = new Map<K, Set<string>>()
	for (const { userId, key } of rows) {
		const set = out.get(key) ?? new Set<string>()
		set.add(userId)
		out.set(key, set)
	}
	return out
}

const splitKey = (key: string) => {
	const at = key.indexOf("-")
	return {
		type: key.slice(0, at) as MediaType,
		tmdbId: Number(key.slice(at + 1)),
	}
}

export function memberAggregates(
	raw: RawMembers,
	counts: Counts,
): MemberAggregates {
	const scoreRows = raw.scores.filter((s) => counts(s.userId, "scores"))
	const seen = [
		...tally(
			raw.seen
				.filter((s) => counts(s.userId, "seen"))
				.map((s) => ({ userId: s.userId, key: titleKey(s.type, s.tmdbId) })),
		),
	].map(([key, members]) => ({ ...splitKey(key), members: members.size }))
	const showRows = raw.showWatches.filter((s) => counts(s.userId, "shows"))
	const byShow = new Map<number, { watches: number; members: Set<string> }>()
	for (const s of showRows) {
		const show = byShow.get(s.tmdbId) ?? { watches: 0, members: new Set() }
		show.watches += s.watches
		show.members.add(s.userId)
		byShow.set(s.tmdbId, show)
	}
	const wishlisted = [
		...tally(
			raw.wishlist
				.filter((w) => counts(w.userId, "wishlist"))
				.map((w) => ({ userId: w.userId, key: titleKey(w.type, w.tmdbId) })),
		),
	].map(([key, members]) => ({ ...splitKey(key), members: members.size }))
	return {
		scoreRows,
		scored: scoreAggregates(scoreRows),
		seen,
		binged: [...byShow].map(([tmdbId, s]) => ({
			tmdbId,
			episodeWatches: s.watches,
			members: s.members.size,
		})),
		wishlisted,
	}
}

const LIST = {
	mostSeen: 7,
	mostBinged: 6,
	highestRated: 6,
	ranges: 5,
	versusImdb: 5,
	shared: 5,
	wishlist: 8,
}

const byMembers = <T extends { members: number }>(rows: T[]) =>
	[...rows].sort((a, b) => b.members - a.members)

/** The titles a member list could show, so the refresh can read their names and posters in one go. */
export function memberTitleKeys(agg: MemberAggregates): {
	type: MediaType
	tmdbId: number
}[] {
	const keys = new Map<string, { type: MediaType; tmdbId: number }>()
	const add = (type: MediaType, tmdbId: number) =>
		keys.set(titleKey(type, tmdbId), { type, tmdbId })
	for (const t of agg.scored)
		if (t.members.size >= MIN_TITLE_MEMBERS) add(t.type, t.tmdbId)
	for (const t of byMembers(agg.seen).slice(0, LIST.mostSeen * 2))
		if (t.members >= MIN_TITLE_MEMBERS) add(t.type, t.tmdbId)
	for (const t of agg.binged)
		if (t.members >= MIN_TITLE_MEMBERS) add("show", t.tmdbId)
	for (const t of byMembers(agg.wishlisted).slice(0, LIST.wishlist * 2))
		if (t.members >= MIN_TITLE_MEMBERS) add(t.type, t.tmdbId)
	return [...keys.values()]
}

const round = (n: number, digits = 3) => Number(n.toFixed(digits))

const UTC_WEEKDAY = (ms: number) => ((new Date(ms).getUTCDay() + 6) % 7) + 1

export function memberStats(
	raw: RawMembers,
	counts: Counts,
	agg: MemberAggregates,
	titles: MemberTitleRow[],
	now: number,
): MemberStats {
	const byKey = new Map(titles.map((t) => [titleKey(t.type, t.tmdbId), t]))
	const named = <T extends { type: MediaType; tmdbId: number }>(rows: T[]) =>
		rows.flatMap((row) => {
			const t = byKey.get(titleKey(row.type, row.tmdbId))
			if (!t) return []
			const { imdb: _, ...title } = t
			return [{ ...row, ...title }]
		})

	// Time and watches.
	const hours = (userId: string) => counts(userId, "hours")
	const sum = (rows: { minutes: number }[]) =>
		rows.reduce((a, r) => a + r.minutes, 0)
	const watchRows = raw.watches.filter((w) => hours(w.userId))
	const watchesOf = (type: MediaType) =>
		watchRows.filter((w) => w.type === type).reduce((a, w) => a + w.watches, 0)

	// Scores.
	const scores = agg.scoreRows
	const spread = Array.from({ length: 10 }, () => 0)
	for (const s of scores)
		if (s.score >= 1 && s.score <= 10) spread[Math.round(s.score) - 1]++
	const total = scores.reduce((a, s) => a + s.score, 0)
	const tens = scores.filter((s) => s.score === 10)
	const byType = (["movie", "show"] as const).flatMap((type) => {
		const rows = scores.filter((s) => s.type === type)
		return rows.length
			? [
					{
						type,
						average: round(rows.reduce((a, s) => a + s.score, 0) / rows.length),
					},
				]
			: []
	})

	// Titles members score.
	const scored = agg.scored.map((a) => ({
		type: a.type,
		tmdbId: a.tmdbId,
		members: a.members.size,
		average: a.n ? a.sum / a.n : 0,
		spread: deviation(a),
		year: a.year,
	}))
	const averaged = scored.filter((t) => t.members >= MIN_AVERAGE_MEMBERS)
	const shared = scored.filter(
		(t) => t.members >= MIN_TITLE_MEMBERS && t.year !== null,
	)
	const scoredTitle = (
		rows: typeof scored,
	): (ScoredTitle & { spread: number })[] =>
		named(rows).map(
			({ type, tmdbId, title, year, poster, members, average, spread }) => ({
				type,
				tmdbId,
				title,
				year,
				poster,
				members,
				average: round(average),
				spread: round(spread),
			}),
		)
	const withImdb = scoredTitle(averaged).flatMap((t) => {
		const imdb = byKey.get(titleKey(t.type, t.tmdbId))?.imdb
		return imdb ? [{ ...t, imdb }] : []
	})
	const versus = (direction: 1 | -1) =>
		[...withImdb]
			.sort((a, b) => direction * (b.average - b.imdb - (a.average - a.imdb)))
			.slice(0, LIST.versusImdb)
			.map(({ spread: _, ...t }) => t)
	const withoutSpread = (rows: (ScoredTitle & { spread: number })[]) =>
		rows.map(({ spread: _, ...t }) => t)

	// Genres and decades, from the scores themselves.
	const genres = new Map<
		string,
		{ scores: number; sum: number; members: Set<string> }
	>()
	const decades = new Map<number, number>()
	for (const s of scores) {
		for (const genre of s.genres) {
			const g = genres.get(genre) ?? { scores: 0, sum: 0, members: new Set() }
			g.scores++
			g.sum += s.score
			g.members.add(s.userId)
			genres.set(genre, g)
		}
		if (s.year !== null && s.year >= 1920) {
			const decade = Math.floor(s.year / 10) * 10
			decades.set(decade, (decades.get(decade) ?? 0) + 1)
		}
	}

	// When members score: by hand only.
	const bulk = bulkScoreKeys(scores, raw.importedScores)
	const weekdays = new Map<number, number>()
	const hoursOfDay = new Map<number, number>()
	for (const s of scores) {
		if (s.createdAt === null) continue
		if (bulk.has(`${s.userId}|${titleKey(s.type, s.tmdbId)}`)) continue
		const day = UTC_WEEKDAY(s.createdAt)
		const hour = new Date(s.createdAt).getUTCHours()
		weekdays.set(day, (weekdays.get(day) ?? 0) + 1)
		hoursOfDay.set(hour, (hoursOfDay.get(hour) ?? 0) + 1)
	}

	// Wishlists.
	const wish = raw.wishlist.filter((w) => counts(w.userId, "wishlist"))

	// Imports and countries.
	const imports = importsBySource(
		raw.imports.filter((i) => counts(i.userId, "activity") && i.added > 0),
	)
	const countries = new Map<string, Set<string>>()
	for (const c of raw.countries) {
		if (!counts(c.userId, "any") || !/^[A-Z]{2}$/.test(c.code)) continue
		const set = countries.get(c.code) ?? new Set<string>()
		set.add(c.userId)
		countries.set(c.code, set)
	}

	const watchers = new Set(
		[...raw.movieMinutes, ...raw.episodeMinutes, ...watchRows]
			.map((r) => r.userId)
			.filter(hours),
	)

	return {
		loggedMovieMinutes: sum(raw.movieMinutes.filter((r) => hours(r.userId))),
		loggedEpisodeMinutes: sum(
			raw.episodeMinutes.filter((r) => hours(r.userId)),
		),
		watchers: watchers.size,
		movieWatches: watchesOf("movie"),
		episodeWatches: watchesOf("show"),
		seenTitles: agg.seen.length,
		scores: {
			count: scores.length,
			average: scores.length ? round(total / scores.length) : 0,
			spread,
			perfectTens: tens.length,
			perfectTenMembers: new Set(tens.map((s) => s.userId)).size,
			byType,
		},
		mostSeen: memberTitles(
			named(byMembers(agg.seen).filter((t) => t.members >= MIN_TITLE_MEMBERS)),
		).slice(0, LIST.mostSeen),
		mostBinged: named(
			agg.binged
				.filter((t) => t.members >= MIN_TITLE_MEMBERS)
				.sort((a, b) => b.episodeWatches - a.episodeWatches)
				.map((t) => ({ type: "show" as const, ...t })),
		)
			.slice(0, LIST.mostBinged)
			.map(({ episodeWatches, ...t }) => ({
				...memberTitles([t])[0],
				episodeWatches,
			})),
		highestRated: withoutSpread(
			scoredTitle([...averaged].sort((a, b) => b.average - a.average)),
		).slice(0, LIST.highestRated),
		agreed: scoredTitle(
			[...averaged].sort((a, b) => a.spread - b.spread),
		).slice(0, LIST.ranges),
		split: scoredTitle([...averaged].sort((a, b) => b.spread - a.spread)).slice(
			0,
			LIST.ranges,
		),
		belowImdb: versus(-1),
		aboveImdb: versus(1),
		genres: [...genres]
			.filter(([, g]) => g.members.size >= MIN_AVERAGE_MEMBERS)
			.map(([genre, g]) => ({
				genre,
				scores: g.scores,
				members: g.members.size,
				average: round(g.sum / g.scores),
			}))
			.sort((a, b) => b.average - a.average),
		decades: [...decades]
			.map(([decade, n]) => ({ decade, scores: n }))
			.sort((a, b) => a.decade - b.decade),
		oldestShared: memberTitles(
			named([...shared].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))),
		).slice(0, LIST.shared),
		newestShared: memberTitles(
			named([...shared].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))),
		).slice(0, LIST.shared),
		weekdays: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
			day,
			scores: weekdays.get(day) ?? 0,
		})),
		hours: Array.from({ length: 24 }, (_, hour) => ({
			hour,
			scores: hoursOfDay.get(hour) ?? 0,
		})),
		wishlist: {
			movies: wish.filter((w) => w.type === "movie").length,
			shows: wish.filter((w) => w.type === "show").length,
			addedLast30Days: wish.filter(
				(w) => w.createdAt !== null && w.createdAt > now - 30 * DAY_MS,
			).length,
			movieMinutes: wish.reduce(
				(a, w) =>
					a +
					(w.type === "movie" && w.runtime && w.runtime <= 400 ? w.runtime : 0),
				0,
			),
			most: memberTitles(
				named(
					byMembers(agg.wishlisted).filter(
						(t) => t.members >= MIN_TITLE_MEMBERS,
					),
				),
			).slice(0, LIST.wishlist),
		},
		imports,
		countries: [...countries]
			.filter(([, members]) => members.size >= MIN_COUNTRY_MEMBERS)
			.map(([code, members]) => ({ code, members: members.size }))
			.sort((a, b) => b.members - a.members),
	}
}

/**
 * Titles imported per source. A source shows with at least MIN_SOURCE_MEMBERS members, so no bar is one member's
 * import; the smaller ones show together as OTHER_SOURCE when that has enough members, and not at all otherwise.
 */
export function importsBySource(
	rows: readonly { userId: string; source: string; added: number }[],
): { source: string; titles: number }[] {
	const bySource = new Map<string, { titles: number; members: Set<string> }>()
	for (const r of rows) {
		const s = bySource.get(r.source) ?? { titles: 0, members: new Set() }
		s.titles += r.added
		s.members.add(r.userId)
		bySource.set(r.source, s)
	}
	const shown: { source: string; titles: number }[] = []
	const other = { titles: 0, members: new Set<string>() }
	for (const [source, s] of bySource) {
		if (s.members.size >= MIN_SOURCE_MEMBERS && source !== OTHER_SOURCE)
			shown.push({ source, titles: s.titles })
		else {
			other.titles += s.titles
			for (const m of s.members) other.members.add(m)
		}
	}
	if (other.members.size >= MIN_SOURCE_MEMBERS)
		shown.push({ source: OTHER_SOURCE, titles: other.titles })
	return shown.sort((a, b) => b.titles - a.titles)
}

/** Only what a poster strip draws: the title and its member count. */
const memberTitles = (rows: MemberTitle[]): MemberTitle[] =>
	rows.map(({ type, tmdbId, title, year, poster, members }) => ({
		type,
		tmdbId,
		title,
		year,
		poster,
		members,
	}))
