import jobDepartments from "./title-people-job-departments.json" with {
	type: "json",
}

export interface CastRaw {
	id: number
	name: string | null
	profile_path: string | null
	popularity: number | null
	character: string | null
	order_default: number | null
	episode_count_character: number | null
	episode_count_total: number | null
}
export interface CrewRaw {
	id: number
	name: string | null
	profile_path: string | null
	popularity: number | null
	job: string
	department: string | null
	episode_count_job: number | null
	episode_count_total: number | null
}

export interface PeopleRow {
	id: number
	name: string
	profilePath: string | null
	/** Cast: the characters, most episodes first. Crew: the jobs. */
	roles: string[]
	/** Episodes (shows); null for movies. */
	episodes: number | null
	/** Cast: main | recurring | guest (shows), top | more (movies). Crew: the department. */
	group: string
	/** Crew: holds a job that leads its department (Director, Writer, Director of Photography, ...). */
	key?: boolean
}
export interface PeopleGroup {
	key: string
	label: string
	/** Matches for the current q in this group. */
	count: number
}
export interface PeoplePage {
	kind: "cast" | "crew"
	/** Everyone, ignoring q and group. */
	total: number
	/** Matches for q and group. */
	matched: number
	groups: PeopleGroup[]
	rows: PeopleRow[]
	offset: number
	nextOffset: number | null
	/** Shows: the number of episodes the tiers are measured against. */
	showEpisodes: number | null
	/** With sort=name: matches per family-name initial (A-Z, "#" for the rest), for q and group, ignoring letter. */
	letters?: Record<string, number>
}

const DEPARTMENTS = [
	"Directing",
	"Writing",
	"Production",
	"Camera",
	"Editing",
	"Sound",
	"Art",
	"Costume & Make-Up",
	"Visual Effects",
	"Lighting",
	"Crew",
]
/** Jobs that lead their department, in this order; they sort first and carry key: true. */
const KEY_JOBS = [
	"Creator",
	"Director",
	"Writer",
	"Screenplay",
	"Novel",
	"Story",
	"Showrunner",
	"Executive Producer",
	"Producer",
	"Director of Photography",
	"Editor",
	"Original Music Composer",
	"Music",
	"Production Design",
	"Costume Design",
	"Casting",
	"Visual Effects Supervisor",
	"Sound Designer",
	"Supervising Sound Editor",
	"Stunt Coordinator",
]
const keyRank = (roles: string[]) =>
	Math.min(
		...roles.map((r) => (KEY_JOBS.includes(r) ? KEY_JOBS.indexOf(r) : 99)),
	)

const TIERS: Record<string, string> = {
	main: "Main cast",
	recurring: "Recurring",
	guest: "Guest stars",
	top: "Top billed",
	more: "More cast",
}

const fold = (s: string) =>
	s
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()

const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"])
const PARTICLES = new Set([
	"van",
	"von",
	"de",
	"del",
	"della",
	"der",
	"di",
	"da",
	"du",
	"la",
	"le",
	"st.",
	"mac",
	"o'",
])
/** "Steven W. Bailey" -> "bailey steven w.", "Vincent van Gogh" -> "van gogh vincent", "Martin Luther King Jr." -> "king ...". */
function familyKey(name: string) {
	const w = fold(name).split(/\s+/).filter(Boolean)
	while (w.length > 1 && SUFFIXES.has(w[w.length - 1])) w.pop()
	let i = w.length - 1
	while (i > 1 && PARTICLES.has(w[i - 1])) i--
	return [...w.slice(i), ...w.slice(0, i)].join(" ")
}
/** The family key without a leading particle: "von sydow max" files and sorts under S, as "sydow max". */
const sortKey = (name: string) =>
	familyKey(name).replace(
		/^(van|von|de|del|della|der|di|da|du|la|le|st\.)\s+/,
		"",
	)
function initialOf(key: string) {
	const c = key.charAt(0).toUpperCase()
	return c >= "A" && c <= "Z" ? c : "#"
}

export interface PeopleParams {
	type: "movie" | "show"
	id: number
	kind: "cast" | "crew"
	q: string
	group: string
	offset: number
	limit: number
	byName: boolean
	letter: string
}

export function parsePeopleParams(p: URLSearchParams): PeopleParams {
	const type = p.get("type")
	const kind = p.get("kind")
	const integer = (key: string, fallback?: number) => {
		const value = p.get(key)
		if ((value === null || value === "") && fallback !== undefined)
			return fallback
		if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
			throw new Response(`Invalid ${key}`, { status: 400 })
		return Number(value)
	}
	if (type !== "movie" && type !== "show")
		throw new Response("Invalid type", { status: 400 })
	if (kind !== "cast" && kind !== "crew")
		throw new Response("Invalid kind", { status: 400 })
	const id = integer("id")
	const offset = integer("offset", 0)
	const limit = integer("limit", 60)
	if (id < 1 || limit < 1 || limit > 200)
		throw new Response("Invalid id or limit", { status: 400 })
	return {
		type,
		id,
		kind,
		q: p.get("q") ?? "",
		group: p.get("group") ?? "",
		offset,
		limit,
		byName: p.get("sort") === "name",
		letter: (p.get("letter") ?? "").toUpperCase().slice(0, 1),
	}
}

export interface PeopleData {
	all: PeopleRow[]
	order: string[]
	showEpisodes: number | null
}

export function buildCast(
	type: PeopleParams["type"],
	raw: CastRaw[],
	showEpisodes: number | null,
): PeopleData {
	const all = castRows(type, raw, showEpisodes)
	return {
		all,
		order: type === "show" ? ["main", "recurring", "guest"] : ["top", "more"],
		showEpisodes,
	}
}

function castRows(
	type: PeopleParams["type"],
	raw: CastRaw[],
	showEpisodes: number | null,
): PeopleRow[] {
	const byId = new Map<
		number,
		{
			row: CastRaw
			chars: { name: string; eps: number }[]
			eps: number
			order: number
		}
	>()
	for (const r of raw) {
		const e = byId.get(r.id)
		const eps = r.episode_count_character ?? 0
		if (e) {
			if (r.character) e.chars.push({ name: r.character, eps })
			e.eps = Math.max(
				e.eps,
				r.episode_count_total ?? 0,
				e.chars.reduce((s, c) => s + c.eps, 0),
			)
			e.order = Math.min(e.order, r.order_default ?? 1e9)
		} else
			byId.set(r.id, {
				row: r,
				chars: r.character ? [{ name: r.character, eps }] : [],
				eps: Math.max(r.episode_count_total ?? 0, eps),
				order: r.order_default ?? 1e9,
			})
	}
	const people = [...byId.values()].sort(
		(a, b) =>
			(type === "show" ? b.eps - a.eps : 0) ||
			a.order - b.order ||
			a.row.id - b.row.id,
	)
	const N = showEpisodes ?? 0
	const mainAt = Math.min(0.4 * N, 60)
	const recurringAt = Math.max(2, Math.min(0.05 * N, 10))
	return people.map((p, i) => ({
		id: p.row.id,
		name: p.row.name ?? "Unknown",
		profilePath: p.row.profile_path,
		roles: p.chars.sort((a, b) => b.eps - a.eps).map((c) => c.name),
		episodes: type === "show" ? p.eps : null,
		group:
			type === "show"
				? p.eps >= mainAt
					? "main"
					: p.eps >= recurringAt
						? "recurring"
						: "guest"
				: i < 12
					? "top"
					: "more",
	}))
}

export function buildCrew(
	type: PeopleParams["type"],
	raw: CrewRaw[],
	showEpisodes: number | null,
): PeopleData {
	return { all: crewRows(type, raw), order: DEPARTMENTS, showEpisodes }
}

function crewRows(type: PeopleParams["type"], raw: CrewRaw[]): PeopleRow[] {
	const depOf: Record<string, string> = jobDepartments
	const byId = new Map<
		number,
		{ row: CrewRaw; jobs: { job: string; eps: number; dep: string }[] }
	>()
	for (const r of raw) {
		const department = r.department ?? depOf[r.job] ?? "Crew"
		const dep = DEPARTMENTS.includes(department) ? department : "Crew"
		const job = { job: r.job, eps: r.episode_count_job ?? 0, dep }
		const e = byId.get(r.id)
		if (e) e.jobs.push(job)
		else byId.set(r.id, { row: r, jobs: [job] })
	}
	const all = [...byId.values()].map(({ row, jobs }) => {
		// Use the department of the job with the most episodes.
		jobs.sort(
			(a, b) =>
				b.eps - a.eps ||
				DEPARTMENTS.indexOf(a.dep) - DEPARTMENTS.indexOf(b.dep),
		)
		return {
			id: row.id,
			name: row.name ?? "Unknown",
			profilePath: row.profile_path,
			roles: [...new Set(jobs.map((j) => j.job))],
			episodes:
				type === "show"
					? Math.max(row.episode_count_total ?? 0, ...jobs.map((j) => j.eps))
					: null,
			group: jobs[0].dep,
			key: keyRank(jobs.map((j) => j.job)) < 99,
			_pop: row.popularity ?? 0,
		}
	})
	all.sort(
		(a, b) =>
			DEPARTMENTS.indexOf(a.group) - DEPARTMENTS.indexOf(b.group) ||
			keyRank(a.roles) - keyRank(b.roles) ||
			(b.episodes ?? 0) - (a.episodes ?? 0) ||
			b._pop - a._pop,
	)
	return all.map(({ _pop, ...row }) => row)
}

// Serving-only metadata: never added to cached rows or serialized responses.
const nameIndexes = new WeakMap<
	PeopleRow[],
	{ id: number; initial: string; key: string; name: string }[]
>()
function nameIndex(all: PeopleRow[]) {
	let index = nameIndexes.get(all)
	if (!index) {
		index = all
			.map(({ id, name }) => {
				const key = sortKey(name)
				return { id, name, key, initial: initialOf(key) }
			})
			.sort(
				(a, b) => a.key.localeCompare(b.key) || a.name.localeCompare(b.name),
			)
		nameIndexes.set(all, index)
	}
	return index
}

export function peoplePage(
	data: PeopleData,
	params: PeopleParams,
	// Corrections change characters or remove people; the cached name order still applies.
	nameSource = data.all,
): PeoplePage {
	const q = fold(params.q.trim())
	const { kind, group, offset, limit, byName, letter } = params
	const { all, order, showEpisodes } = data
	const hits = q
		? all.filter(
				(r) =>
					fold(r.name).includes(q) || r.roles.some((x) => fold(x).includes(q)),
			)
		: all
	const groups = order
		.map((key) => ({
			key,
			label: TIERS[key] ?? key,
			count: hits.filter((r) => r.group === key).length,
		}))
		.filter(
			(g) =>
				kind === "cast" || g.count > 0 || all.some((r) => r.group === g.key),
		)
	let matched = group ? hits.filter((r) => r.group === group) : hits
	let letters: Record<string, number> | undefined
	if (byName) {
		const byId = new Map(matched.map((r) => [r.id, r]))
		matched = []
		letters = {}
		for (const { id, initial } of nameIndex(nameSource)) {
			const row = byId.get(id)
			if (!row) continue
			letters[initial] = (letters[initial] ?? 0) + 1
			if (!letter || initial === letter) matched.push(row)
		}
	}
	const rows = matched.slice(offset, offset + limit)
	const page: PeoplePage = {
		kind,
		total: all.length,
		matched: matched.length,
		groups,
		rows,
		offset,
		nextOffset: offset + limit < matched.length ? offset + limit : null,
		showEpisodes,
		letters,
	}
	return page
}
