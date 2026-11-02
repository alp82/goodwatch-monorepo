import { MOODS } from "~/domain/moods"
import { THEMES, STYLES } from "~/domain/themes-styles"
const tagNames: Record<string, Record<string, string>> = {
	moods: Object.fromEntries(MOODS.map((t) => [t.key, t.name])),
	themes: Object.fromEntries(THEMES.map((t) => [t.id, t.name])),
	styles: Object.fromEntries(STYLES.map((t) => [t.id, t.name])),
}
// Concise labels for actual Discover constraints, never the original query phrases.
export type Token = {
	field: string
	value: string
	note?: string
	assumed?: boolean
	kind: "filter"
}
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
	labels: Record<string, Record<string, string>> = {},
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
					.map((v) => tagNames[key]?.[v] ?? countries[v] ?? name(v))
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
					.map(
						(v) =>
							labels.services?.[v] ?? serviceNames[v] ?? "Selected service",
					)
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
		else if (["similar", "people", "loved", "disliked"].includes(key))
			add(
				(
					{
						similar: "Similar to",
						people: "Person",
						loved: "Loved",
						disliked: "Avoid likes of",
					} as Record<string, string>
				)[key],
				value
					.split(",")
					.map(
						(id) =>
							labels[key]?.[id] ??
							(key === "people" ? "Selected person" : "Selected title"),
					)
					.join(" / "),
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
