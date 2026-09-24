import {
	type CoreScores,
	DISTINCT_FINGERPRINT_KEYS,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"
// Cast and crew pages (/person/:personKey): a person's credits, the fingerprint of their
// work compared with the catalog, recurring genres and tags, frequent collaborators, and
// the filtered and grouped title grid. Every query is keyed by id so a cold page stays
// around one second; profiles and the catalog baseline are cached in Redis.
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

type MediaType = "movie" | "show"

export interface PersonCredit {
	key: string
	tmdb_id: number
	media_type: MediaType
	title: string
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	popularity: number
	score: number | null
	votes: number
	genres: string[]
	essence_tags: string[]
	fingerprint: Partial<CoreScores> | null
	roles: string[] // "Acting", "Directing", "Writing", ... or "Appearances"
	characters: string[]
	jobs: string[]
	billing: number | null // lowest order_default across acting credits
	weight: number // how strongly this title speaks for the person
}

export interface Trait {
	key: string
	value: number
	baseline: number
	lift: number
}

export interface Collaborator {
	tmdb_id: number
	name: string
	profile_path: string | null
	shared: number
	as: string
	group: "Cast" | "Directors and writers" | "Crew"
	titles: string[]
}

export interface PersonProfile {
	tmdb_id: number
	name: string
	profile_path: string | null
	known_for_department: string
	credits: PersonCredit[]
	signature: {
		basedOn: number
		above: Trait[]
		below: Trait[]
		pillars: { name: string; value: number; baseline: number }[]
	}
	genres: { name: string; count: number }[]
	tags: { name: string; count: number }[]
	collaborators: Collaborator[]
	stats: {
		titles: number
		movies: number
		shows: number
		leading: number
		directed: number
		firstYear: number | null
		lastYear: number | null
		perYear: { year: number; count: number }[]
		avgScore: number | null
		best: {
			title: string
			score: number
			poster_path: string | null
			media_type: MediaType
			tmdb_id: number
			release_year: number | null
		} | null
	}
}

const SELF = /^(self|himself|herself|themselves|host|guest)\b/i
const MIN_VOTES = 200

// Mirrors the pillar groups in discover.server.ts.
const PILLARS: Record<string, (keyof CoreScores)[]> = {
	Energy: [
		"adrenaline",
		"tension",
		"scare",
		"fast_pace",
		"spectacle",
		"violence",
	],
	Heart: [
		"romance",
		"wholesome",
		"pathos",
		"melancholy",
		"hopefulness",
		"catharsis",
		"nostalgia",
		"coming_of_age",
		"family_dynamics",
		"wonder",
	],
	Humor: [
		"situational_comedy",
		"wit_wordplay",
		"physical_comedy",
		"cringe_humor",
		"absurdist_humor",
		"satire_parody",
		"dark_humor",
	],
	World: [
		"world_immersion",
		"dialogue_centrality",
		"rewatchability",
		"ambiguity",
		"novelty",
	],
	Craft: [
		"direction",
		"acting",
		"narrative_structure",
		"dialogue_quality",
		"character_depth",
		"intrigue",
		"complexity",
		"non_linear_narrative",
		"meta_narrative",
	],
	Style: [
		"cinematography",
		"editing",
		"music_composition",
		"visual_stylization",
		"music_centrality",
		"sound_centrality",
	],
}

// --- Catalog baseline (what an average well-known movie looks like) ---

// Averaging the catalog takes about two seconds, so it's cached for a week.
function fingerprintBaseline(): Promise<Record<string, number>> {
	return cached<Record<string, never>, Record<string, number>>({
		name: "person-fingerprint-baseline",
		target: async () => {
			const cols = VALID_FINGERPRINT_KEYS.map(
				(k) => `avg(fingerprint_scores['${k}']) AS "${k}"`,
			).join(", ")
			const [row] = await query<Record<string, number>>(
				`SELECT ${cols} FROM movie WHERE goodwatch_overall_score_voting_count >= 1000 AND fingerprint_scores IS NOT NULL`,
			)
			return row
		},
		params: {},
		ttlMinutes: 60 * 24 * 7,
	})
}

// --- Credits: credit rows first, then titles by primary key (a join is 3x slower) ---

const TITLE_COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, popularity,
	goodwatch_overall_score_normalized_percent AS score, goodwatch_overall_score_voting_count AS votes,
	genres, essence_tags, fingerprint_scores AS fingerprint`

type TitleRow = Pick<
	PersonCredit,
	| "tmdb_id"
	| "title"
	| "release_year"
	| "poster_path"
	| "backdrop_path"
	| "popularity"
	| "score"
	| "votes"
	| "genres"
	| "essence_tags"
	| "fingerprint"
>
type CreditRow = {
	media_tmdb_id: number
	media_type: MediaType
	character?: string
	order_default?: number
	job?: string
	department?: string
}

const inList = (ids: number[]) => ids.map(() => "?").join(",")

async function titles(type: MediaType, ids: number[]): Promise<TitleRow[]> {
	if (!ids.length) return []
	return query<TitleRow>(
		`SELECT ${TITLE_COLS} FROM ${type} WHERE tmdb_id IN (${inList(ids)}) AND title IS NOT NULL`,
		ids,
	)
}

async function credits(id: number): Promise<PersonCredit[]> {
	const [acting, crew] = await Promise.all([
		query<CreditRow>(
			"SELECT media_tmdb_id, media_type, character, order_default FROM person_appeared_in WHERE person_tmdb_id = ? LIMIT 2000",
			[id],
		),
		query<CreditRow>(
			"SELECT media_tmdb_id, media_type, job, department FROM person_worked_on WHERE person_tmdb_id = ? LIMIT 2000",
			[id],
		),
	])
	const all = [...acting, ...crew]
	const ids = (t: MediaType) => [
		...new Set(
			all.filter((c) => c.media_type === t).map((c) => c.media_tmdb_id),
		),
	]
	const [movies, shows] = await Promise.all([
		titles("movie", ids("movie")),
		titles("show", ids("show")),
	])
	const title = new Map<string, TitleRow>([
		...movies.map((m) => [`movie:${m.tmdb_id}`, m] as const),
		...shows.map((s) => [`show:${s.tmdb_id}`, s] as const),
	])

	const byKey = new Map<string, PersonCredit>()
	for (const r of all) {
		const key = `${r.media_type}:${r.media_tmdb_id}`
		const t = title.get(key)
		if (!t) continue
		const c = byKey.get(key) ?? {
			...t,
			key,
			media_type: r.media_type,
			popularity: t.popularity ?? 0,
			votes: t.votes ?? 0,
			genres: t.genres ?? [],
			essence_tags: t.essence_tags ?? [],
			roles: [],
			characters: [],
			jobs: [],
			billing: null,
			weight: 0,
		}
		if (r.department !== undefined) {
			const dept = r.department === "Crew" ? "Other crew" : r.department
			if (dept && !c.roles.includes(dept)) c.roles.push(dept)
			if (r.job && !c.jobs.includes(r.job)) c.jobs.push(r.job)
		} else {
			const role =
				r.character && SELF.test(r.character) ? "Appearances" : "Acting"
			if (!c.roles.includes(role)) c.roles.push(role)
			if (r.character && !c.characters.includes(r.character))
				c.characters.push(r.character)
			if (role === "Acting" && r.order_default != null)
				c.billing = Math.min(c.billing ?? 999, r.order_default)
		}
		byKey.set(key, c)
	}
	for (const c of byKey.values()) c.weight = creditWeight(c)
	return [...byKey.values()]
}

const KEY_JOBS =
	/^(Director|Screenplay|Writer|Creator|Original Music Composer|Director of Photography|Novel|Story|Showrunner)$/
function creditWeight(c: PersonCredit): number {
	let w = 0
	if (c.roles.includes("Acting"))
		w = Math.max(
			w,
			c.billing == null
				? 0.3
				: c.billing <= 2
					? 1
					: c.billing <= 6
						? 0.6
						: 0.25,
		)
	if (c.jobs.some((j) => KEY_JOBS.test(j))) w = Math.max(w, 1)
	else if (c.jobs.length) w = Math.max(w, 0.4)
	return w
}

// --- Aggregates ---

function signature(
	credits: PersonCredit[],
	baseline: Record<string, number>,
): PersonProfile["signature"] {
	const basis = credits.filter(
		(c) => c.fingerprint && c.weight > 0 && c.votes >= MIN_VOTES,
	)
	if (basis.length < 3)
		return { basedOn: basis.length, above: [], below: [], pillars: [] }
	const total = basis.reduce((s, c) => s + c.weight, 0)
	const mean = (k: keyof CoreScores) =>
		basis.reduce(
			(s, c) => s + (Number(c.fingerprint?.[k]) || 0) * c.weight,
			0,
		) / total
	// Craft keys (direction, acting, ...) say "their films are good", not what they feel like.
	const traits = DISTINCT_FINGERPRINT_KEYS.map((k) => {
		const value = mean(k)
		return {
			key: k,
			value,
			baseline: baseline[k] ?? 0,
			lift: value - (baseline[k] ?? 0),
		}
	})
	const avg = (
		keys: (keyof CoreScores)[],
		f: (k: keyof CoreScores) => number,
	) => keys.reduce((s, k) => s + f(k), 0) / keys.length
	return {
		basedOn: basis.length,
		above: traits
			.filter((t) => t.lift > 0.3 && t.value >= 3)
			.sort((a, b) => b.lift - a.lift)
			.slice(0, 8),
		below: traits
			.filter((t) => t.lift < -0.5)
			.sort((a, b) => a.lift - b.lift)
			.slice(0, 4),
		pillars: Object.entries(PILLARS).map(([name, keys]) => ({
			name,
			value: avg(keys, mean),
			baseline: avg(keys, (k) => baseline[k] ?? 0),
		})),
	}
}

function counted(
	credits: PersonCredit[],
	pick: (c: PersonCredit) => string[],
	min: number,
	limit: number,
) {
	const m = new Map<string, number>()
	for (const c of credits)
		for (const v of new Set(pick(c))) m.set(v, (m.get(v) ?? 0) + 1)
	return [...m.entries()]
		.filter(([, n]) => n >= min)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([name, count]) => ({ name, count }))
}

const JOB_LABEL: Record<string, string> = {
	"Original Music Composer": "Composer",
	"Director of Photography": "Cinematographer",
	Screenplay: "Writer",
}

async function collaborators(
	id: number,
	credits: PersonCredit[],
): Promise<Collaborator[]> {
	const core = credits.filter(
		(c) => c.weight >= 0.6 && !c.roles.every((r) => r === "Appearances"),
	)
	const clauses: string[] = []
	const params: number[] = []
	for (const t of ["movie", "show"] as const) {
		const list = core.filter((c) => c.media_type === t).map((c) => c.tmdb_id)
		if (!list.length) continue
		clauses.push(`(media_type = '${t}' AND media_tmdb_id IN (${inList(list)}))`)
		params.push(...list)
	}
	if (!clauses.length) return []
	const where = clauses.join(" OR ")
	const [cast, crew] = await Promise.all([
		query<{ pid: number; media_type: string; mid: number }>(
			`SELECT person_tmdb_id AS pid, media_type, media_tmdb_id AS mid FROM person_appeared_in
			WHERE (${where}) AND order_default <= 8 AND person_tmdb_id != ? LIMIT 5000`,
			[...params, id],
		),
		query<{ pid: number; media_type: string; mid: number; job: string }>(
			`SELECT person_tmdb_id AS pid, media_type, media_tmdb_id AS mid, job FROM person_worked_on
			WHERE (${where}) AND job IN ('Director', 'Screenplay', 'Writer', 'Creator', 'Original Music Composer', 'Director of Photography', 'Editor')
			AND person_tmdb_id != ? LIMIT 5000`,
			[...params, id],
		),
	])

	const titleOf = new Map(core.map((c) => [`${c.media_type}:${c.tmdb_id}`, c]))
	const agg = new Map<
		number,
		{ keys: Set<string>; as: string; group: Collaborator["group"] }
	>()
	const add = (
		pid: number,
		key: string,
		as: string,
		group: Collaborator["group"],
	) => {
		const a = agg.get(pid) ?? { keys: new Set(), as, group }
		a.keys.add(key)
		agg.set(pid, a)
	}
	for (const r of cast) add(r.pid, `${r.media_type}:${r.mid}`, "Actor", "Cast")
	for (const r of crew) {
		const as = JOB_LABEL[r.job] ?? r.job
		add(
			r.pid,
			`${r.media_type}:${r.mid}`,
			as,
			/Director|Writer|Creator/.test(as) ? "Directors and writers" : "Crew",
		)
	}
	const top = [...agg.entries()]
		.filter(([, a]) => a.keys.size >= 2)
		.sort((a, b) => b[1].keys.size - a[1].keys.size)
		.slice(0, 18)
	if (!top.length) return []
	const people = await query<{
		tmdb_id: number
		name: string
		profile_path: string | null
	}>(
		`SELECT tmdb_id, name, profile_path FROM person WHERE tmdb_id IN (${inList(top.map(([pid]) => pid))})`,
		top.map(([pid]) => pid),
	)
	const byId = new Map(people.map((p) => [p.tmdb_id, p]))
	return top
		.flatMap(([pid, a]) => {
			const person = byId.get(pid)
			return person ? [{ ...person, a }] : []
		})
		.map(({ a, ...person }) => ({
			...person,
			shared: a.keys.size,
			as: a.as,
			group: a.group,
			titles: [...a.keys]
				.flatMap((k) => titleOf.get(k) ?? [])
				.sort((x, y) => y.popularity - x.popularity)
				.map((c) => c.title),
		}))
}

// --- Entry point ---

/** The name alone, for redirects that need the canonical slug without loading a profile. */
export async function getPersonName(personId: number): Promise<string | null> {
	const [person] = await query<{ name: string }>(
		"SELECT name FROM person WHERE tmdb_id = ?",
		[personId],
	)
	return person?.name ?? null
}

export async function getPersonProfile(
	personId: number,
): Promise<PersonProfile | null> {
	// The cache stores objects only, so a missing person is wrapped too.
	const { profile } = await cached<
		{ personId: number },
		{ profile: PersonProfile | null }
	>({
		name: "person-profile",
		target: async ({ personId }) => ({
			profile: await loadPersonProfile(personId),
		}),
		params: { personId },
		ttlMinutes: 60 * 24,
	})
	return profile
}

async function loadPersonProfile(id: number): Promise<PersonProfile | null> {
	const [[person], list, baseline] = await Promise.all([
		query<{
			tmdb_id: number
			name: string
			profile_path: string | null
			known_for_department: string
		}>(
			"SELECT tmdb_id, name, profile_path, known_for_department FROM person WHERE tmdb_id = ?",
			[id],
		),
		credits(id),
		fingerprintBaseline(),
	])
	if (!person) return null
	const collabs = await collaborators(id, list)

	const main = list.filter((c) => c.weight >= 0.6)
	const years = main.map((c) => c.release_year).filter((y): y is number => !!y)
	const scored = main.filter((c) => c.score != null && c.votes >= MIN_VOTES)
	const best = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
	const perYear = new Map<number, number>()
	for (const y of years) perYear.set(y, (perYear.get(y) ?? 0) + 1)
	return {
		...person,
		credits: list,
		signature: signature(list, baseline),
		genres: counted(main, (c) => c.genres, 2, 8),
		tags: counted(main, (c) => c.essence_tags, 2, 12),
		collaborators: collabs,
		stats: {
			titles: list.length,
			movies: list.filter((c) => c.media_type === "movie").length,
			shows: list.filter((c) => c.media_type === "show").length,
			leading: list.filter((c) => c.billing != null && c.billing <= 2).length,
			directed: list.filter((c) => c.jobs.includes("Director")).length,
			firstYear: years.length ? Math.min(...years) : null,
			lastYear: years.length ? Math.max(...years) : null,
			perYear: [...perYear.entries()]
				.sort((a, b) => a[0] - b[0])
				.map(([year, count]) => ({ year, count })),
			avgScore: scored.length
				? scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length
				: null,
			best: best
				? {
						title: best.title,
						score: best.score ?? 0,
						poster_path: best.poster_path,
						media_type: best.media_type,
						tmdb_id: best.tmdb_id,
						release_year: best.release_year,
					}
				: null,
		},
	}
}

// --- Filters and grouping for the title grid (discover-style, applied on the server) ---

export interface GridFilters {
	type: "all" | MediaType
	role: string
	genre: string
	decade: string
	trait: string
	minScore: number
	group: "decade" | "score"
	order: "desc" | "asc"
	expand: string // a group key whose titles are all shown
}

export function parseGridFilters(p: URLSearchParams): GridFilters {
	const type = p.get("type")
	return {
		type: type === "movie" || type === "show" ? type : "all",
		role: p.get("role") ?? "",
		genre: p.get("genre") ?? "",
		decade: p.get("decade") ?? "",
		trait: p.get("trait") ?? "",
		minScore: Number(p.get("minScore")) || 0,
		group: p.get("group") === "score" ? "score" : "decade",
		order: p.get("order") === "asc" ? "asc" : "desc",
		expand: p.get("expand") ?? "",
	}
}

export const decadeOf = (c: { release_year: number | null }) =>
	c.release_year ? String(Math.floor(c.release_year / 10) * 10) : "upcoming"

const SCORE_BANDS = [
	{ key: "90", min: 90, label: "90 to 100" },
	{ key: "80", min: 80, label: "80 to 89" },
	{ key: "70", min: 70, label: "70 to 79" },
	{ key: "60", min: 60, label: "60 to 69" },
	{ key: "30", min: 30, label: "30 to 59" },
	{ key: "0", min: 0, label: "0 to 29" },
]
const bandOf = (c: PersonCredit) =>
	c.score == null || c.votes < MIN_VOTES
		? "unrated"
		: (SCORE_BANDS.find((b) => (c.score ?? 0) >= b.min)?.key ?? "0")

// Leading roles in widely rated titles first; a guest spot in a huge show should not lead.
const prominence = (c: PersonCredit) =>
	c.weight ** 2 * Math.log1p(c.popularity) * Math.log1p(c.votes)

export function applyGridFilters(credits: PersonCredit[], f: GridFilters) {
	const matches = (c: PersonCredit, skip?: keyof GridFilters) =>
		(skip === "type" || f.type === "all" || c.media_type === f.type) &&
		(skip === "role" ||
			(f.role
				? c.roles.includes(f.role)
				: !c.roles.every((r) => r === "Appearances"))) &&
		(skip === "genre" || !f.genre || c.genres.includes(f.genre)) &&
		(skip === "decade" || !f.decade || decadeOf(c) === f.decade) &&
		(skip === "trait" ||
			!f.trait ||
			(Number(c.fingerprint?.[f.trait as keyof CoreScores]) || 0) >= 7) &&
		(skip === "minScore" || !f.minScore || (c.score ?? 0) >= f.minScore)

	const facet = (
		skip: keyof GridFilters,
		pick: (c: PersonCredit) => string[],
	) =>
		counted(
			credits.filter((c) => matches(c, skip)),
			pick,
			1,
			30,
		)

	return {
		items: credits
			.filter((c) => matches(c))
			.sort((a, b) => prominence(b) - prominence(a)),
		facets: {
			type: facet("type", (c) => [c.media_type]),
			role: facet("role", (c) => c.roles),
			genre: facet("genre", (c) => c.genres).slice(0, 14),
			decade: facet("decade", (c) => [decadeOf(c)]).sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		},
	}
}

export interface TitleGroup<T> {
	key: string
	label: string
	total: number
	avgScore: number | null
	items: T[]
	more: { kind: "decade" | "expand"; value: string } | null
}

/**
 * Groups filtered titles by decade or score band. Descending decades put upcoming
 * titles first, as the newest; unrated titles always come last. A capped group keeps its
 * most prominent titles, so minor credits don't crowd out known work; the shown titles
 * then follow the group order (by year or by score, in the chosen direction).
 * Each group is capped unless expanded or filtered.
 */
export function groupTitles(
	items: PersonCredit[],
	f: GridFilters,
	cap: number,
): TitleGroup<PersonCredit>[] {
	const keyOf = f.group === "score" ? bandOf : decadeOf
	const value = (c: PersonCredit) =>
		f.group === "score"
			? c.votes >= MIN_VOTES
				? (c.score ?? 0)
				: 0
			: (c.release_year ?? 0)
	const inOrder = (list: PersonCredit[]) =>
		[...list].sort((a, b) =>
			f.order === "asc" ? value(a) - value(b) : value(b) - value(a),
		)
	const groups = new Map<string, PersonCredit[]>() // items arrive in prominence order
	for (const c of items)
		groups.set(keyOf(c), [...(groups.get(keyOf(c)) ?? []), c])
	const rank = (k: string) =>
		f.group === "score"
			? k === "unrated"
				? f.order === "desc"
					? -1
					: 999
				: Number(k)
			: k === "upcoming"
				? 9999
				: Number(k)
	const label = (k: string) =>
		f.group === "score"
			? k === "unrated"
				? "Not rated yet"
				: (SCORE_BANDS.find((b) => b.key === k)?.label ?? k)
			: k === "upcoming"
				? "Upcoming"
				: `${k}s`
	return [...groups.entries()]
		.sort((a, b) =>
			f.order === "asc" ? rank(a[0]) - rank(b[0]) : rank(b[0]) - rank(a[0]),
		)
		.map(([key, list]) => {
			const scored = list.filter((c) => c.score != null && c.votes >= MIN_VOTES)
			const showAll = f.expand === key || (f.group === "decade" && !!f.decade)
			return {
				key,
				label: label(key),
				total: list.length,
				avgScore: scored.length
					? scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length
					: null,
				items: inOrder(showAll ? list : list.slice(0, cap)),
				more:
					showAll || list.length <= cap
						? null
						: f.group === "decade"
							? { kind: "decade", value: key }
							: { kind: "expand", value: key },
			}
		})
}
