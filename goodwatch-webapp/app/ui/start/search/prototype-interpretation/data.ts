// THROWAWAY: vocabulary and examples for the interpretation UI review.
export type Token = {
	field: string
	value: string
	kind: "filter" | "fingerprint" | "text"
	note?: string
	assumed?: boolean
	avoid?: boolean
}
export type Example = {
	name: string
	query: string
	filters: Record<string, string>
	fingerprint?: string[]
	residual?: string
	note?: string
}
export const examples: Example[] = [
	{
		name: "Seasons + decade",
		query: "7+ seasons from the 90s",
		filters: { seasons: "7-", minYear: "1990", maxYear: "1999" },
	},
	{
		name: "Money + fingerprint",
		query: "low budget scary dark",
		filters: { budget: "-4.999", moods: "scary,dark" },
		fingerprint: ["Scare", "Bleakness", "Tension"],
	},
	{
		name: "Low budget",
		query: "low budget flop",
		filters: { budget: "-4.999", returns: "flop" },
		note: "The engine maps low budget to the existing under-$5M preset. Show the bound; explain the cutoff on demand.",
	},
	{
		name: "Scary + dark",
		query: "scary dark",
		filters: { moods: "scary,dark" },
		fingerprint: ["Scare", "Bleakness", "Tension"],
	},
	{
		name: "Sources",
		query: "IMDb 8+ Letterboxd 4+",
		filters: { sources: "imdb:80,letterboxd:80" },
	},
	{
		name: "Kids",
		query: "for my kids on Netflix",
		filters: { age: "12", services: "8" },
		note: "No ages were given. Age ≤ 12 is an assumption, not an explicit instruction.",
	},
	{
		name: "Person + service",
		query: "80+ Brad Pitt on Prime Video",
		filters: { score: "80", people: "287", services: "9" },
	},
	{
		name: "Similar + mood",
		query: "like Matrix but funnier",
		filters: { similar: "1000000000603", moods: "funny" },
		fingerprint: ["Humour"],
	},
	{
		name: "Bare 100",
		query: "100",
		filters: {},
		residual: "100",
		note: "Keep 100 as a title/text query. Do not silently apply a minimum score of 100.",
	},
	{
		name: "Controversial",
		query: "controversial",
		filters: { gap: "audience" },
		note: "The existing filter is directional: audiences ≥ 15 points above critics. The word controversial does not specify that direction.",
	},
	{
		name: "Episodes + status",
		query: "finished series episodes under 30 minutes",
		filters: { showStatus: "ended", episodeRuntime: "-29" },
	},
]
const serviceNames: Record<string, string> = {
	8: "Netflix",
	9: "Prime Video",
	337: "Disney+",
	350: "Apple TV+",
	15: "Hulu",
	1899: "HBO Max",
	11: "MUBI",
	73: "Tubi",
	531: "Paramount+",
	386: "Peacock",
	283: "Crunchyroll",
	99: "Shudder",
	524: "Discovery+",
	all: "Everywhere",
	mine: "My services",
	any: "Any service",
}
const sourceNames: Record<string, string> = {
	imdb: "IMDb",
	letterboxd: "Letterboxd",
	rtCritics: "RT critics",
	rtAudience: "RT audience",
	metacritic: "Metacritic",
	metacriticUsers: "Metacritic users",
}
const countries: Record<string, string> = {
	US: "United States",
	GB: "United Kingdom",
	DE: "Germany",
	FR: "France",
	JP: "Japan",
	AU: "Australia",
	NL: "Netherlands",
	KR: "South Korea",
}
const name = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
function range(s: string, suffix = "", money = false) {
	const [lo, hi] = s.split("-")
	const show = (v: string) =>
		money
			? Number(v) >= 1000
				? `$${Number(v) / 1000}B`
				: `$${v}M`
			: `${v}${suffix}`
	if (lo && hi)
		return Number(lo) === Number(hi)
			? show(lo)
			: suffix && !money
				? `${lo}–${hi}${suffix}`
				: `${show(lo)}–${show(hi)}`
	if (hi) {
		if (money && /\.999$/.test(hi))
			return `< ${show(String(Math.ceil(Number(hi))))}`
		return `≤ ${show(hi)}`
	}
	return lo ? `≥ ${show(lo)}` : "Any"
}
export function tokens(
	filters: Record<string, string>,
	query: string,
): Token[] {
	const out: Token[] = []
	const add = (field: string, value: string, note?: string, assumed = false) =>
		out.push({ field, value, note, assumed, kind: "filter" })
	const year =
		filters.years ?? `${filters.minYear ?? ""}-${filters.maxYear ?? ""}`
	if (year !== "-")
		add(
			"Released",
			range(year),
			"An applied release-year range; not the period in which the story is set.",
		)
	const runtime =
		filters.runtime ?? `${filters.minRuntime ?? ""}-${filters.maxRuntime ?? ""}`
	if (runtime !== "-") add("Runtime", range(runtime, " min"))
	const listFields: Record<string, string> = {
		moods: "Mood",
		themes: "Theme",
		styles: "Style",
		genres: "Genre",
		productionCountries: "Origin",
	}
	for (const [key, value] of Object.entries(filters)) {
		if (
			[
				"years",
				"minYear",
				"maxYear",
				"runtime",
				"minRuntime",
				"maxRuntime",
				"q",
				"page",
			].includes(key)
		)
			continue
		if (key in listFields) {
			const join = filters.all?.split(",").includes(key) ? " + " : " / "
			add(
				listFields[key],
				value
					.split(",")
					.map((v) => countries[v] ?? name(v))
					.join(join),
				join === " + "
					? "Every listed tag is required."
					: "Any listed tag can match.",
			)
			continue
		}
		if (key === "sources") {
			for (const part of value.split(",")) {
				const [src, v] = part.split(":")
				const n =
					Number(v) /
					(src === "letterboxd"
						? 20
						: ["imdb", "metacriticUsers"].includes(src)
							? 10
							: 1)
				add(sourceNames[src] ?? src, `≥ ${n}${src.startsWith("rt") ? "%" : ""}`)
			}
			continue
		}
		if (key === "type")
			add(
				"Format",
				{ movie: "Movies", show: "Shows", all: "Movies + shows" }[value] ??
					value,
			)
		else if (key === "anime")
			add(
				"Anime",
				{ only: "Only", none: "Excluded", any: "Included" }[value] ?? value,
			)
		else if (key === "services")
			add(
				"Service",
				value
					.split(",")
					.map((v) => serviceNames[v] ?? v)
					.join(" / "),
			)
		else if (key === "age")
			add(
				"Age",
				`≤ ${value}`,
				/kids|family|teens/i.test(query)
					? `No exact ages were supplied; the engine assumed ${value}.`
					: "Explicit age limit, using the country's rating ladder.",
				/kids|family|teens/i.test(query) && !query.includes(value),
			)
		else if (key === "budget")
			add(
				"Budget",
				range(value, "", true),
				/low budget/i.test(query)
					? "Low budget was mapped to the existing under-$5M preset. The selected bound is visible; this note explains the cutoff."
					: "Nominal USD millions; this is an applied budget constraint.",
			)
		else if (key === "boxOffice") add("Box office", range(value, "", true))
		else if (key === "seasons") add("Seasons", range(value))
		else if (key === "episodeRuntime")
			add("Episode", value === "any" ? "Any length" : range(value, " min"))
		else if (key === "votes") add("Ratings", range(value))
		else if (key === "rank")
			add(
				"Popularity",
				value.startsWith("-") ? `Top ${value.slice(1)}` : range(value),
			)
		else if (key === "score") add("GW score", `≥ ${value}`)
		else if (key === "maxScore") add("GW score", `≤ ${value}`)
		else if (key === "match") add("Taste match", `≥ ${value}%`)
		else if (key === "showStatus")
			add(
				"Status",
				{ ended: "Ended", running: "Still running", canceled: "Canceled" }[
					value
				] ?? value,
			)
		else if (key === "returns")
			add(
				"Box office",
				name(value),
				value === "flop"
					? "Grossed less than its budget."
					: "Grossed at least three times its budget.",
			)
		else if (key === "gap")
			add(
				"Ratings",
				{
					audience: "Audience > critics",
					critics: "Critics > audience",
					agree: "Critics ≈ audience",
				}[value] ?? value,
				value === "agree"
					? "Both scores ≥ 70 and within five points."
					: "The selected side is at least 15 points higher.",
				/controversial|divisive|polariz/i.test(query),
			)
		else if (key === "seen" && value === "1") add("History", "Seen")
		else if (key === "unseen" && value === "1") add("History", "Unseen")
		else if (key === "wishlist") add("List", "Wishlist")
		else if (key === "foryou") add("For you", value === "1" ? "On" : "Off")
		else if (key === "sort")
			add(
				"Sort",
				{
					top: "Top rated",
					popular: "Popular",
					newest: "Newest",
					match: "Best match",
					relevance: "Relevance",
				}[value] ?? value,
			)
		else if (key === "streamingCountry")
			add("Watching in", countries[value] ?? value)
		else if (key === "ratingCountry")
			add("Age ratings", countries[value] ?? value)
		else if (key === "restOfWorld") add("Origin", "Rest of world")
		else if (key === "similar")
			add(
				"Similar to",
				value === "1000000000603"
					? "The Matrix"
					: value === "2000000095310"
						? "Severance"
						: "Selected title",
			)
		else if (key === "people")
			add(
				"Person",
				value === "287"
					? "Brad Pitt"
					: value === "31"
						? "Tom Hanks"
						: "Selected person",
			)
		else if (key === "loved")
			add("Loved", value === "1000000329865" ? "Arrival" : "Selected title")
		else if (key === "disliked")
			add(
				"Avoid likes of",
				value === "1000000000176" ? "Saw" : "Selected title",
			)
		else if (key === "hide")
			for (const v of value.split(",")) add("Hide", name(v))
		else if (key === "ok")
			for (const v of value.split(",")) add("Allow", name(v))
		else if (key === "released")
			add(
				"Released",
				{
					recent: "Last 3 years",
					"2010s": "2010–2019",
					"2000s": "2000–2009",
					before2000: "Before 2000",
				}[value] ?? value,
			)
	}
	return out
}
export const catalog: {
	group: string
	query: string
	filters: Record<string, string>
	residual?: string
	fingerprint?: string[]
}[] = [
	{
		group: "Format",
		query: "movies without anime",
		filters: { type: "movie", anime: "none" },
	},
	{
		group: "Released",
		query: "from the 90s",
		filters: { minYear: "1990", maxYear: "1999" },
	},
	{
		group: "Released",
		query: "released after 2020",
		filters: { minYear: "2021" },
	},
	{
		group: "Duration",
		query: "between 90 and 120 minutes",
		filters: { runtime: "90-120" },
	},
	{
		group: "Duration",
		query: "episodes under 30 minutes",
		filters: { episodeRuntime: "-29" },
	},
	{
		group: "Duration",
		query: "any episode length",
		filters: { episodeRuntime: "any" },
	},
	{ group: "Shows", query: "7+ seasons", filters: { seasons: "7-" } },
	{ group: "Shows", query: "one season", filters: { seasons: "1-1" } },
	{
		group: "Shows",
		query: "two to three seasons",
		filters: { seasons: "2-3" },
	},
	{
		group: "Shows",
		query: "finished series",
		filters: { showStatus: "ended" },
	},
	{
		group: "Shows",
		query: "still running",
		filters: { showStatus: "running" },
	},
	{
		group: "Shows",
		query: "canceled shows",
		filters: { showStatus: "canceled" },
	},
	{ group: "Money", query: "low budget", filters: { budget: "-4.999" } },
	{
		group: "Money",
		query: "budget between $5M and $20M",
		filters: { budget: "5-20" },
	},
	{
		group: "Money",
		query: "box office at least $1B",
		filters: { boxOffice: "1000-" },
	},
	{ group: "Money", query: "flop", filters: { returns: "flop" } },
	{ group: "Money", query: "commercial hit", filters: { returns: "hit" } },
	{ group: "Scores", query: "80+", filters: { score: "80" } },
	{ group: "Scores", query: "poor ratings", filters: { maxScore: "50" } },
	{
		group: "Scores",
		query: "IMDb 8+ Letterboxd 4+",
		filters: { sources: "imdb:80,letterboxd:80" },
	},
	{
		group: "Scores",
		query: "RT critics 90% RT audience 80%",
		filters: { sources: "rtCritics:90,rtAudience:80" },
	},
	{
		group: "Scores",
		query: "Metacritic 70+ users 8+",
		filters: { sources: "metacritic:70,metacriticUsers:80" },
	},
	{ group: "Scores", query: "controversial", filters: { gap: "audience" } },
	{
		group: "Scores",
		query: "critics liked it more",
		filters: { gap: "critics" },
	},
	{
		group: "Scores",
		query: "critics and audiences agree",
		filters: { gap: "agree" },
	},
	{
		group: "Popularity",
		query: "at least 10,000 ratings",
		filters: { votes: "10000-" },
	},
	{ group: "Popularity", query: "top 100", filters: { rank: "-100" } },
	{
		group: "Tags",
		query: "both scary and funny",
		filters: { moods: "scary,funny", all: "moods" },
	},
	{
		group: "Tags",
		query: "crime or mystery",
		filters: { themes: "crime,mystery" },
	},
	{
		group: "Tags",
		query: "slow and animated",
		filters: { styles: "slow,animated" },
	},
	{
		group: "Tags",
		query: "horror or comedy",
		filters: { genres: "Horror,Comedy" },
	},
	{
		group: "Streaming",
		query: "Netflix or Prime",
		filters: { services: "8,9" },
	},
	{
		group: "Streaming",
		query: "on my services",
		filters: { services: "mine" },
	},
	{
		group: "Streaming",
		query: "on any streaming service",
		filters: { services: "any" },
	},
	{ group: "Streaming", query: "everywhere", filters: { services: "all" } },
	{
		group: "Countries",
		query: "watching in Germany",
		filters: { streamingCountry: "DE" },
	},
	{
		group: "Countries",
		query: "Japanese",
		filters: { productionCountries: "JP" },
	},
	{
		group: "Countries",
		query: "rest of the world",
		filters: { restOfWorld: "1" },
	},
	{
		group: "Countries",
		query: "US age ratings",
		filters: { ratingCountry: "US" },
	},
	{ group: "Audience", query: "for my kids", filters: { age: "12" } },
	{ group: "Audience", query: "age at most 12", filters: { age: "12" } },
	{
		group: "Content",
		query: "no violence, sex, drugs, swearing or frightening content",
		filters: { hide: "violence,sex,drugs,language,disturbing" },
	},
	{ group: "Content", query: "violence is okay", filters: { ok: "violence" } },
	{ group: "Library", query: "not seen yet", filters: { unseen: "1" } },
	{ group: "Library", query: "already seen", filters: { seen: "1" } },
	{ group: "Library", query: "on my wishlist", filters: { wishlist: "1" } },
	{ group: "People", query: "Brad Pitt vibes", filters: { people: "287" } },
	{
		group: "References",
		query: "Matrix vibes",
		filters: { similar: "1000000000603" },
	},
	{
		group: "References",
		query: "loved Arrival",
		filters: { loved: "1000000329865" },
	},
	{
		group: "References",
		query: "disliked Saw",
		filters: { disliked: "1000000000176" },
	},
	{
		group: "Personalization",
		query: "taste match at least 80%",
		filters: { match: "80" },
	},
	{ group: "Personalization", query: "for you off", filters: { foryou: "0" } },
	{ group: "Sorting", query: "newest first", filters: { sort: "newest" } },
	{ group: "Sorting", query: "most relevant", filters: { sort: "relevance" } },
	{
		group: "Fingerprint",
		query: "scary dark",
		filters: {},
		fingerprint: ["Scare", "Bleakness", "Tension"],
	},
	{
		group: "Fingerprint",
		query: "nothing wholesome",
		filters: {},
		fingerprint: ["Avoid Wholesome"],
	},
	{ group: "Text", query: "100", filters: {}, residual: "100" },
	{
		group: "Text",
		query: "submarine sabotage",
		filters: {},
		residual: "submarine sabotage",
	},
]
