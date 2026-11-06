// Discover's awards filter: titles with a reported award result, from the shared `award_title_display` view
// (docs/tvdb-pipelines.md, "Award quality and display contract"). Pure, shared by the server and the browser.
//
// URL: `awards=won` (any reported win), `awards=won:oscars,emmys` (a win at one of these), `awards=nominated:globes`
// (nominated or won). Coverage is partial, so the filter only keeps titles with a reported result; it never claims a
// title has none, and nothing here counts awards.

export type AwardOutcome = "won" | "nominated"

export interface AwardFilter {
	outcome: AwardOutcome
	/** Award bodies by id, in AWARD_BODIES order; empty means any. */
	bodies: string[]
}

export interface AwardBody {
	id: string
	/** The name in award_title_display.award_name. */
	award: string
	/** The picker's name. */
	name: string
	/** The word before "winners" / "nominees". */
	adjective: string
	/** Search words, as regular expression sources over lowercase text. */
	words: string[]
}

export const AWARD_BODIES: readonly AwardBody[] = [
	{
		id: "oscars",
		award: "Academy Awards",
		name: "Oscars",
		adjective: "Oscar",
		words: ["oscars?", "academy awards?"],
	},
	{
		id: "emmys",
		award: "Primetime Emmy Awards",
		name: "Emmys",
		adjective: "Emmy",
		words: ["(?<!daytime )emm(?:y|ys|ies)", "primetime emm(?:y|ys|ies)"],
	},
	{
		id: "globes",
		award: "Golden Globe Awards",
		name: "Golden Globes",
		adjective: "Golden Globe",
		words: ["golden globes?"],
	},
	{
		id: "bafta",
		award: "BAFTA Awards",
		name: "BAFTA",
		adjective: "BAFTA",
		words: ["baftas?"],
	},
	{
		id: "cesars",
		award: "César Awards",
		name: "Césars",
		adjective: "César",
		words: ["c[ée]sars?(?: awards?)?"],
	},
	{
		id: "critics",
		award: "Critics' Choice Awards",
		name: "Critics' Choice",
		adjective: "Critics' Choice",
		words: ["critics'? choice"],
	},
	{
		id: "sag",
		award: "Screen Actors Guild Awards",
		name: "SAG Awards",
		adjective: "SAG",
		words: ["sag", "screen actors guild"],
	},
	{
		id: "wga",
		award: "Writers Guild of America Awards",
		name: "Writers Guild",
		adjective: "Writers Guild",
		words: ["wga", "writers guild"],
	},
	{
		id: "dga",
		award: "Directors Guild of America Awards",
		name: "Directors Guild",
		adjective: "Directors Guild",
		words: ["dga", "directors guild"],
	},
	{
		id: "pga",
		award: "Producers Guild of America Awards",
		name: "Producers Guild",
		adjective: "Producers Guild",
		words: ["pga", "producers guild"],
	},
	{
		id: "baeksang",
		award: "Baeksang Arts Awards",
		name: "Baeksang",
		adjective: "Baeksang",
		words: ["baeksang"],
	},
	{
		id: "mtv",
		award: "MTV Movie & TV Awards",
		name: "MTV Awards",
		adjective: "MTV Award",
		words: ["mtv(?: movie)? awards?"],
	},
	{
		id: "daytime",
		award: "Daytime Emmy Awards",
		name: "Daytime Emmys",
		adjective: "Daytime Emmy",
		words: ["daytime emm(?:y|ys|ies)"],
	},
	{
		id: "nta",
		award: "National Television Awards",
		name: "National TV Awards",
		adjective: "National TV Award",
		words: ["national television awards?", "ntas?"],
	},
	{
		id: "canadian",
		award: "Canadian Screen Awards",
		name: "Canadian Screen",
		adjective: "Canadian Screen Award",
		words: ["canadian screen awards?"],
	},
	{
		id: "gemini",
		award: "Gemini Awards",
		name: "Gemini",
		adjective: "Gemini Award",
		words: ["gemini awards?"],
	},
	{
		id: "genie",
		award: "Genie Awards",
		name: "Genie",
		adjective: "Genie Award",
		words: ["genie awards?"],
	},
]

const BODY_ORDER = AWARD_BODIES.map((body) => body.id)
const BODY_BY_ID = new Map(AWARD_BODIES.map((body) => [body.id, body]))
const inBodyOrder = (ids: string[]) =>
	[...ids].sort((a, b) => BODY_ORDER.indexOf(a) - BODY_ORDER.indexOf(b))

/** The filter from `awards=`, or undefined. Unknown bodies are dropped; the rest are kept once, in AWARD_BODIES order. */
export function parseAwardParam(
	value: string | null | undefined,
): AwardFilter | undefined {
	if (!value) return undefined
	const [outcome, list = ""] = value.split(":")
	if (outcome !== "won" && outcome !== "nominated") return undefined
	const bodies = inBodyOrder([
		...new Set(list.split(",").filter((id) => BODY_BY_ID.has(id))),
	])
	return { outcome, bodies }
}

/** The `awards=` value, or null when the filter is off. */
export function awardParam(filter: AwardFilter | undefined): string | null {
	if (!filter) return null
	const bodies = inBodyOrder(filter.bodies)
	return bodies.length
		? `${filter.outcome}:${bodies.join(",")}`
		: filter.outcome
}

/** "Award winners", "Oscar winners", "Oscar or Emmy nominees", "Oscar, Emmy +2 winners". */
export function awardLabel(filter: AwardFilter): string {
	const noun = filter.outcome === "won" ? "winners" : "nominees"
	const names = inBodyOrder(filter.bodies).map(
		(id) => BODY_BY_ID.get(id)?.adjective ?? id,
	)
	if (!names.length) return `Award ${noun}`
	if (names.length === 1) return `${names[0]} ${noun}`
	if (names.length === 2) return `${names[0]} or ${names[1]} ${noun}`
	return `${names[0]}, ${names[1]} +${names.length - 2} ${noun}`
}

/** One award body switched on or off; the first pick turns the filter on as "won". */
export function toggleAwardBody(
	filter: AwardFilter | undefined,
	id: string,
): AwardFilter {
	const now = filter ?? { outcome: "won", bodies: [] }
	const bodies = now.bodies.includes(id)
		? now.bodies.filter((b) => b !== id)
		: inBodyOrder([...now.bodies, id])
	return { ...now, bodies }
}

/** Award body chips all show up to this many options; above it, the rest wait behind "+N more". */
export const AWARD_CHIPS_ALL_SHOWN_UP_TO = 30

/** The chip list's limit for this many options: all of them, unless there are more than AWARD_CHIPS_ALL_SHOWN_UP_TO. */
export const awardChipLimit = (options: number, limit: number): number =>
	options > AWARD_CHIPS_ALL_SHOWN_UP_TO ? limit : options

/**
 * The view read behind the filter: the titles with a reported result, one row per title. Every view row is a win or a
 * nomination, so "nominated" needs no outcome condition. Award names stay bound.
 */
export function awardTitlesQuery(
	filter: AwardFilter,
	limit: number,
): { sql: string; params: string[] } {
	const names = inBodyOrder(filter.bodies).flatMap((id) => {
		const award = BODY_BY_ID.get(id)?.award
		return award ? [award] : []
	})
	const where = [
		...(filter.outcome === "won" ? ["has_win"] : []),
		...(names.length
			? [`award_name IN (${names.map(() => "?").join(", ")})`]
			: []),
	]
	return {
		sql: `SELECT media_type, media_tmdb_id FROM doc.award_title_display${
			where.length ? ` WHERE ${where.join(" AND ")}` : ""
		} GROUP BY media_type, media_tmdb_id LIMIT ${limit}`,
		params: names,
	}
}

// Award words in a search: a body name or "award(s)", with an outcome word ("winning", "winners", "won", "nominated",
// "nominees"), in any order. An outcome word alone ("winning") isn't enough, and neither is a body's name alone: "oscar
// isaac", "emmy rossum", "pga tour" and the film "Oscar" are searches. "award(s)" alone or inside the body's name
// ("academy awards", "emmy award") is enough.
const OUTCOME_WON = "(?:won(?: an?| the)?|wins?|winners?|winning|-winning)"
const OUTCOME_NOMINATED =
	"(?:nominated(?: for(?: an?| the)?)?|nominees?|nominations?|-nominated)"
const AWARD_WORD = "(?:award-winning|awards?)"

export interface AwardReading {
	filter: AwardFilter
	/** The words left once the award words are taken out. */
	rest: string
}

// Longer body names first, so "daytime emmy" isn't read as the Emmys.
const BODIES_LONGEST_FIRST = [...AWARD_BODIES].sort(
	(a, b) =>
		Math.max(...b.words.map((w) => w.length)) -
		Math.max(...a.words.map((w) => w.length)),
)

/** The awards filter the words name ("oscar winners", "emmy winning comedies", "golden globe nominated"), or null. */
export function readAwardWords(text: string): AwardReading | null {
	const lower = text.toLowerCase()
	const bodies: string[] = []
	const spans: [number, number][] = []
	/** The matched words, in order, that don't overlap an earlier match. */
	const take = (source: string): string[] => {
		const re = new RegExp(`(?<![\\p{L}\\d])(?:${source})(?![\\p{L}\\d])`, "giu")
		const found: string[] = []
		for (const m of lower.matchAll(re)) {
			const start = m.index ?? 0
			const end = start + m[0].length
			if (spans.some(([a, b]) => start < b && end > a)) continue
			spans.push([start, end])
			found.push(m[0])
		}
		return found
	}
	let named = false
	for (const body of BODIES_LONGEST_FIRST) {
		const hits = take(body.words.join("|"))
		if (!hits.length) continue
		bodies.push(body.id)
		if (hits.some((hit) => hit.includes("award"))) named = true
	}
	const awardWord = take(AWARD_WORD).length > 0
	if (!bodies.length && !awardWord) return null
	const nominated = take(OUTCOME_NOMINATED).length > 0
	const won = take(OUTCOME_WON).length > 0
	if (!awardWord && !named && !nominated && !won) return null
	const outcome: AwardOutcome = nominated && !won ? "nominated" : "won"
	spans.sort((a, b) => a[0] - b[0])
	let rest = ""
	let last = 0
	for (const [a, b] of spans) {
		rest += `${text.slice(last, a)} `
		last = b
	}
	rest += text.slice(last)
	rest = rest.replace(/[-–]/g, " ").replace(/\s+/g, " ").trim()
	// Joining words left at either end ("bafta and cesar nominees", "movies that won an oscar").
	for (let i = 0; i < 3; i++)
		rest = rest
			.replace(/\s*\b(?:an?|the|for|of|at|that|which|and|or)$/i, "")
			.replace(/^(?:an?|the|for|of|at|that|which|and|or)\b\s*/i, "")
			.trim()
	return { filter: { outcome, bodies: inBodyOrder(bodies) }, rest }
}
