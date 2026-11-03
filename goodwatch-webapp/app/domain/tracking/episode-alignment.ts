// Which IMDb episode is which TMDB episode, for a whole show at once. Pure.
//
// The two sites list a show's regular episodes in the same broadcast order, but they cut the run into seasons
// differently (Naruto is one IMDb season against four TMDB ones; Detective Conan one TMDB season against fifty-four on
// IMDb) and often title episodes in different languages. So both runs are read in order, across seasons, and paired
// by evidence, strongest first. Each kind of evidence may only add pairs that fit between the pairs already made, in
// the same order on both sides, so weaker evidence never overrides stronger and nothing is paired out of order:
//
// 1. the IMDb id TMDB stores for the episode;
// 2. a title that appears exactly once in each run;
// 3. a title that appears exactly once in the same-numbered season of each;
// 4. a whole season both sites number alike: as many episodes, the same numbers (the IMDb import's rule 3);
// 5. the same season and number with nearly the same title ("Road Rules All Stars: Five Easy Pieces");
// 6. the same season and number where a title is a placeholder ("Episode 99"), in a season both sites end alike;
//    3 to 6 and 8 only where season N is the same stretch on both sites: no earlier season ran clearly longer on IMDb
//    (a re-cut run), or it starts at the same place in both runs;
// 7. what is left between two pairs, by position, only when both sides list as many episodes there;
// 8. a title unique in the same-numbered season of each though out of order (the season is listed in another order):
//    it names the episode but anchors nothing.
//
// IMDb's episode 0 of a season is a numbered special (a Christmas episode), as TMDB's season 0 is: neither is in a run.

export interface AlignImdbEpisode {
	imdb_episode_id: string
	season_number: number | null
	episode_number: number | null
	name: string | null
}

export interface AlignTmdbEpisode {
	tmdb_id: number
	imdb_id: string | null
	season_number: number
	episode_number: number
	name: string | null
}

export type AlignEvidence =
	| "id"
	| "title"
	| "season-title"
	| "season"
	| "near-title"
	| "placeholder"
	| "gap"
	| "reordered"

export interface EpisodeAlignment {
	/** IMDb episode id → TMDB episode id, for every paired regular episode. */
	pairs: Map<string, number>
	/** The evidence each pair rests on. */
	how: Map<string, AlignEvidence>
	/** Each run's regular episodes in order, as the alignment read them. */
	imdb: AlignImdbEpisode[]
	tmdb: AlignTmdbEpisode[]
}

const fold = (name: string | null) =>
	(name ?? "")
		.normalize("NFKD")
		.replace(/[\p{Mn}\p{Lm}]/gu, "")
		.toLowerCase()
		.trim()

/** A title as both sites may write it: no accents or modifier letters, punctuation, case or leading article. */
export const titleKey = (name: string | null): string | null => {
	const key = fold(name)
		.replace(/^(the|a|an)\s+/u, "")
		.replace(/[^\p{L}\p{N}]/gu, "")
	// No title, or a placeholder such as "Episode 3" or IMDb's "Episode #1.3".
	return key && !/^(episode\d*|\d+)$/u.test(key) ? key : null
}

/** Gaps up to this many episodes are checked pairwise for near titles; wider ones by title key only. */
const NEAR_GAP = 200
const PART = /^\s*[([]\s*(part\s*)?\d+\s*[)\]]$/iu
const NOTE = /\s*[([][^)\]]*[)\]]$/u
/**
 * Nearly the same title: one contains the other, the longer adding no digits, or they differ only by a trailing
 * note on one side ("The Freelancer (No. 145)"). A part note ("(1)", "(Part 2)") is never dropped.
 */
export function nearTitle(a: string | null, b: string | null): boolean {
	const x0 = titleKey(a)
	const y0 = titleKey(b)
	if (!x0 || !y0) return false
	if (x0 === y0) return true
	const noteA = a?.trim().match(NOTE)?.[0] ?? null
	const noteB = b?.trim().match(NOTE)?.[0] ?? null
	if ((noteA === null) !== (noteB === null) && !PART.test(noteA ?? noteB ?? "")) {
		const x = titleKey((a ?? "").trim().replace(NOTE, ""))
		const y = titleKey((b ?? "").trim().replace(NOTE, ""))
		if (x && y && x === y) return true
	}
	const [short, long] = x0.length <= y0.length ? [x0, y0] : [y0, x0]
	return short.length >= 5 && long.includes(short) && !/\d/u.test(long.replace(short, ""))
}

const byPosition = <T extends { season_number: number | null; episode_number: number | null }>(a: T, b: T) =>
	(a.season_number ?? 0) - (b.season_number ?? 0) || (a.episode_number ?? 0) - (b.episode_number ?? 0)

/** Keys that occur exactly once, with where. */
function uniqueAt<T>(items: readonly T[], key: (item: T) => string | null): Map<string, number> {
	const at = new Map<string, number>()
	const seen = new Set<string>()
	items.forEach((item, index) => {
		const k = key(item)
		if (k === null) return
		if (seen.has(k)) at.delete(k)
		else at.set(k, index)
		seen.add(k)
	})
	return at
}

/** The largest set of pairs increasing on both sides. */
function inOrder(pairs: [number, number][]): [number, number][] {
	pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1])
	const tails: number[] = []
	const tailAt: number[] = []
	const previous: number[] = []
	pairs.forEach(([, j], index) => {
		let lo = 0
		let hi = tails.length
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (tails[mid] < j) lo = mid + 1
			else hi = mid
		}
		tails[lo] = j
		tailAt[lo] = index
		previous[index] = lo > 0 ? tailAt[lo - 1] : -1
	})
	const kept: [number, number][] = []
	for (let index = tails.length ? tailAt[tails.length - 1] : -1; index >= 0; index = previous[index])
		kept.push(pairs[index])
	return kept.reverse()
}

/** Without the episodes that share a position, or (IMDb) an id, with another: neither can be placed for sure. */
function alone<T extends { season_number: number | null; episode_number: number | null }>(
	list: T[],
	id?: (e: T) => string,
): T[] {
	const count = new Map<string, number>()
	const keys = (e: T) => [`p${e.season_number}:${e.episode_number}`, ...(id ? [`i${id(e)}`] : [])]
	for (const e of list) for (const k of keys(e)) count.set(k, (count.get(k) ?? 0) + 1)
	return list.filter((e) => keys(e).every((k) => count.get(k) === 1))
}

export function alignEpisodes(
	imdbRows: readonly AlignImdbEpisode[],
	tmdbRows: readonly AlignTmdbEpisode[],
): EpisodeAlignment {
	const imdb = alone(
		imdbRows.filter(
			(r) =>
				r.season_number !== null && r.season_number > 0 && r.episode_number !== null && r.episode_number > 0,
		),
		(e) => e.imdb_episode_id,
	).sort(byPosition)
	const tmdb = alone(tmdbRows.filter((e) => e.season_number > 0 && e.episode_number > 0)).sort(byPosition)
	const pairs = new Map<string, number>()
	const how = new Map<string, AlignEvidence>()
	const result = { pairs, how, imdb, tmdb }
	if (!imdb.length || !tmdb.length) return result

	// The pairs made so far, kept sorted by IMDb position (and so by TMDB position too).
	let made: [number, number][] = []
	const evidence = new Map<number, AlignEvidence>()
	const usedI = new Set<number>()
	const usedJ = new Set<number>()
	/** The TMDB range a pair at IMDb position i must fall in, between the pairs around it. */
	const window = (i: number): [number, number] => {
		let lo = 0
		let hi = made.length
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (made[mid][0] < i) lo = mid + 1
			else hi = mid
		}
		return [lo > 0 ? made[lo - 1][1] : -1, lo < made.length ? made[lo][1] : tmdb.length]
	}
	// Episodes whose own title names another place than the order allowed: no position decides them.
	const disputedI = new Set<number>()
	const disputedJ = new Set<number>()
	const POSITIONAL = new Set<AlignEvidence>(["season", "near-title", "placeholder", "gap"])
	const fits = (i: number, j: number, kind: AlignEvidence) => {
		if (usedI.has(i) || usedJ.has(j)) return false
		if (POSITIONAL.has(kind) && (disputedI.has(i) || disputedJ.has(j))) return false
		const t = tmdb[j]
		// A TMDB episode that stores another IMDb id is not this one.
		if (t.imdb_id && t.imdb_id !== imdb[i].imdb_episode_id) return false
		const [after, before] = window(i)
		return j > after && j < before
	}
	const add = (kind: AlignEvidence, candidates: [number, number][]) => {
		const kept = inOrder(candidates.filter(([i, j]) => fits(i, j, kind)))
		if (!POSITIONAL.has(kind)) {
			const keptI = new Set(kept.map(([i]) => i))
			for (const [i, j] of candidates)
				if (!keptI.has(i) && !usedI.has(i)) {
					disputedI.add(i)
					disputedJ.add(j)
				}
		}
		if (!kept.length) return
		for (const [i, j] of kept) {
			usedI.add(i)
			usedJ.add(j)
			evidence.set(i, kind)
		}
		made = [...made, ...kept].sort((a, b) => a[0] - b[0])
	}
	const matched = (a: Map<string, number>, b: Map<string, number>) =>
		[...a].flatMap(([key, i]): [number, number][] => {
			const j = b.get(key)
			return j === undefined ? [] : [[i, j]]
		})

	// 1. Stored IMDb ids.
	const imdbAt = new Map(imdb.map((e, i) => [e.imdb_episode_id, i]))
	add(
		"id",
		[...uniqueAt(tmdb, (e) => e.imdb_id)].flatMap(([id, j]): [number, number][] => {
			const i = imdbAt.get(id)
			return i === undefined ? [] : [[i, j]]
		}),
	)
	// 2. Titles unique in each run.
	add("title", matched(uniqueAt(imdb, (e) => titleKey(e.name)), uniqueAt(tmdb, (e) => titleKey(e.name))))
	const seasonsOf = (list: readonly { season_number: number | null }[]) => {
		const at = new Map<number, number[]>()
		list.forEach((e, index) => {
			const season = e.season_number as number
			const indices = at.get(season)
			if (indices) indices.push(index)
			else at.set(season, [index])
		})
		return at
	}
	const imdbSeasons = seasonsOf(imdb)
	const tmdbSeasons = seasonsOf(tmdb)
	// Season N is the same stretch on both sites until an earlier season ran clearly longer on IMDb than on TMDB: a
	// re-cut run (IMDb's season 1 runs to 20, TMDB's stops at 10 and goes on as season 2). IMDb often lists fewer
	// episodes, whole seasons fewer, or a special more, under the same numbers; none of that is a re-cut. TMDB running
	// longer (by any amount) counts only when IMDb lists more seasons, the sign that IMDb split TMDB's seasons. Sites that list as many
	// seasons cut the run the same way and are not measured.
	const lastNumber = (list: readonly { episode_number: number | null }[], indices: readonly number[]) =>
		Math.max(...indices.map((index) => list[index].episode_number as number))
	const runsPast = (a: number, b: number) => a - b > Math.max(1, Math.round(0.2 * b))
	const imdbSplits = imdbSeasons.size > tmdbSeasons.size
	const recut = imdbSeasons.size !== tmdbSeasons.size
	const comparable = new Set<number>()
	for (const season of [...imdbSeasons.keys()].filter((n) => tmdbSeasons.has(n)).sort((x, y) => x - y)) {
		comparable.add(season)
		if (!recut) continue
		const a = lastNumber(imdb, imdbSeasons.get(season) as number[])
		const b = lastNumber(tmdb, tmdbSeasons.get(season) as number[])
		if (runsPast(a, b) || (imdbSplits && b > a)) break
	}
	const startsAlike = (season: number) => {
		const is = imdbSeasons.get(season)
		const js = tmdbSeasons.get(season)
		return Boolean(is && js && (comparable.has(season) || is[0] === js[0]))
	}
	const alikeKeys = (key: (e: { season_number: number | null; name: string | null }) => string | null) => (e: {
		season_number: number | null
		name: string | null
	}) => (startsAlike(e.season_number as number) ? key(e) : null)
	// 3. Titles unique in the same-numbered season of each.
	const inSeason = (e: { season_number: number | null; name: string | null }) => {
		const k = titleKey(e.name)
		return k === null ? null : `${e.season_number}:${k}`
	}
	const imdbInSeason = uniqueAt(imdb, inSeason)
	const tmdbInSeason = uniqueAt(tmdb, inSeason)
	add("season-title", matched(uniqueAt(imdb, alikeKeys(inSeason)), uniqueAt(tmdb, alikeKeys(inSeason))))
	// 4. Whole seasons numbered alike, unless a pair already made puts one of their episodes elsewhere.
	const partner = new Map(made)
	const partnerOf = new Map(made.map(([i, j]) => [j, i]))
	const whole: [number, number][] = []
	for (const [season, is] of imdbSeasons) {
		const js = tmdbSeasons.get(season)
		if (!js || js.length !== is.length || !startsAlike(season)) continue
		if (is.some((i, k) => imdb[i].episode_number !== tmdb[js[k]].episode_number)) continue
		const contradicted = is.some((i, k) => {
			const j = partner.get(i)
			const back = partnerOf.get(js[k])
			return (j !== undefined && j !== js[k]) || (back !== undefined && back !== i)
		})
		if (!contradicted) is.forEach((i, k) => whole.push([i, js[k]]))
	}
	add("season", whole)
	// 5. The same season and number, nearly the same title.
	const tmdbAt = new Map(tmdb.map((e, j) => [`${e.season_number}:${e.episode_number}`, j]))
	add(
		"near-title",
		imdb.flatMap((e, i): [number, number][] => {
			const j = tmdbAt.get(`${e.season_number}:${e.episode_number}`)
			// A title the season lists twice on either site names neither episode.
			const once = (key: string | null, at: Map<string, number>, k: number) => key === null || at.get(`${e.season_number}:${key}`) === k
			return j !== undefined &&
				startsAlike(e.season_number as number) &&
				once(titleKey(e.name), imdbInSeason, i) &&
				once(titleKey(tmdb[j].name), tmdbInSeason, j) &&
				nearTitle(e.name, tmdb[j].name)
				? [[i, j]]
				: []
		}),
	)
	// 6. The same season and number where either title is a placeholder ("Episode 99"), in a season both sites end
	// at the same number: the episode list's rule for untitled episodes.
	const lastOf = (list: readonly { season_number: number | null; episode_number: number | null }[]) => {
		const last = new Map<number, number>()
		for (const e of list)
			last.set(e.season_number as number, Math.max(last.get(e.season_number as number) ?? 0, e.episode_number as number))
		return last
	}
	const imdbLast = lastOf(imdb)
	const tmdbLast = lastOf(tmdb)
	add(
		"placeholder",
		imdb.flatMap((e, i): [number, number][] => {
			const j = tmdbAt.get(`${e.season_number}:${e.episode_number}`)
			if (
				j === undefined ||
				!startsAlike(e.season_number as number) ||
				imdbLast.get(e.season_number as number) !== tmdbLast.get(e.season_number as number)
			)
				return []
			return titleKey(e.name) === null || titleKey(tmdb[j].name) === null ? [[i, j]] : []
		}),
	)
	// 7. Equal gaps, by position.
	const gaps: [number, number][] = []
	const imdbKey = imdb.map((e) => titleKey(e.name))
	const tmdbKey = tmdb.map((e) => titleKey(e.name))
	const bounds: [number, number][] = [[-1, -1], ...made, [imdb.length, tmdb.length]]
	for (let k = 1; k < bounds.length; k++) {
		const [i0, j0] = bounds[k - 1]
		const [i1, j1] = bounds[k]
		if (i1 - i0 !== j1 - j0) continue
		// Inside the gap, a title that names another episode of the gap says position is wrong for that one: by the
		// same title key in any gap, by a near title in gaps narrow enough to compare pairwise.
		const width = i1 - i0 - 1
		const imdbKeys = new Map<string, number[]>()
		const tmdbKeys = new Map<string, number[]>()
		for (let step = 1; step <= width; step++) {
			const a = imdbKey[i0 + step]
			const b = tmdbKey[j0 + step]
			if (a) imdbKeys.set(a, [...(imdbKeys.get(a) ?? []), step])
			if (b) tmdbKeys.set(b, [...(tmdbKeys.get(b) ?? []), step])
		}
		const elsewhere = (step: number) => {
			const a = imdbKey[i0 + step]
			const b = tmdbKey[j0 + step]
			if (a && (tmdbKeys.get(a) ?? []).some((other) => other !== step)) return true
			if (b && (imdbKeys.get(b) ?? []).some((other) => other !== step)) return true
			if (width > NEAR_GAP) return false
			for (let other = 1; other <= width; other++) {
				if (other === step) continue
				if (nearTitle(imdb[i0 + step].name, tmdb[j0 + other].name)) return true
				if (nearTitle(imdb[i0 + other].name, tmdb[j0 + step].name)) return true
			}
			return false
		}
		for (let step = 1; step <= width; step++) {
			const [i, j] = [i0 + step, j0 + step]
			// Where both sites cut seasons alike, a place never moves an episode into another season: a gap across a
			// season break with different lengths on each side would shift every episode after it.
			const a = imdb[i].season_number as number
			const b = tmdb[j].season_number
			if (a !== b && comparable.has(a) && comparable.has(b)) continue
			if (width === 1 || nearTitle(imdb[i].name, tmdb[j].name) || !elsewhere(step)) gaps.push([i, j])
		}
	}
	add("gap", gaps)

	// 8. A title unique in the same-numbered season of each, though out of order: the site lists that season in
	// another order (Kaamelott; Firefly's broadcast against its DVD order). It names the episode, but it was no
	// anchor, so nothing was paired by position around it.
	const placedI = new Set(made.map(([i]) => i))
	const placedJ = new Set(made.map(([, j]) => j))
	const reordered = matched(uniqueAt(imdb, alikeKeys(inSeason)), uniqueAt(tmdb, alikeKeys(inSeason))).filter(
		([i, j]) =>
			!placedI.has(i) && !placedJ.has(j) && (!tmdb[j].imdb_id || tmdb[j].imdb_id === imdb[i].imdb_episode_id),
	)
	for (const [i, j] of made) {
		pairs.set(imdb[i].imdb_episode_id, tmdb[j].tmdb_id)
		how.set(imdb[i].imdb_episode_id, evidence.get(i) as AlignEvidence)
	}
	for (const [i, j] of reordered) {
		pairs.set(imdb[i].imdb_episode_id, tmdb[j].tmdb_id)
		how.set(imdb[i].imdb_episode_id, "reordered")
	}
	return result
}
