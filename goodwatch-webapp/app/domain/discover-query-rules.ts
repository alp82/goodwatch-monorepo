// Current Discover's additional filter vocabulary. Runs before generic numbers,
// dates and formats, so an IMDb score or season count cannot become a GW score.
import { getCountryName } from "../server/resources/country-names"
import { PROVIDER_ALIASES } from "../server/discord/provider-aliases"
import {
	BUDGET_PRESETS,
	POPULARITY_RANK_PRESETS,
	VOTES_PRESETS,
} from "./title-scales"

export type Scan = (
	pattern: RegExp,
	make: (m: RegExpMatchArray) => [string, string, string?][] | null,
	ownsNegation?: boolean,
) => void
export type QueryProvider = { id: number; name: string }
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const choices = (words: string[]) =>
	words
		.sort((a, b) => b.length - a.length)
		.map(escape)
		.join("|")
const numbers: Record<string, number> = {
	zero: 0,
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	twelve: 12,
	twenty: 20,
}
const n = (s: string) => numbers[s.toLowerCase()] ?? Number(s.replace(/,/g, ""))
const NUM = `(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|${Object.keys(numbers).join("|")})`
const CMP =
	"(?:at least|at most|no more than|no less than|less than|more than|up to|under|below|over|above|minimum(?: of)?|maximum(?: of)?|exactly)"
const cmpRange = (value: number, cmp = "", plus = "", step = 1): string => {
	if (plus || /at least|no less|minimum/.test(cmp)) return `${value}-`
	if (/at most|no more|up to|maximum/.test(cmp)) return `-${value}`
	if (/under|below|less than/.test(cmp))
		return `-${Number((value - step).toFixed(6))}`
	if (/over|above|more than/.test(cmp))
		return `${Number((value + step).toFixed(6))}-`
	return `${value}-${value}`
}
const countryAliases: Record<string, string> = {
	usa: "US",
	us: "US",
	uk: "GB",
	uae: "AE",
	"united states of america": "US",
	"south korea": "KR",
	"north korea": "KP",
	"czech republic": "CZ",
	czechia: "CZ",
	"the netherlands": "NL",
	"new zealand": "NZ",
}
for (let a = 65; a <= 90; a++)
	for (let b = 65; b <= 90; b++) {
		const code = String.fromCharCode(a, b),
			name = getCountryName(code).trim()
		if (name !== code) countryAliases[name.toLowerCase()] = code
	}
const countryPattern = choices(Object.keys(countryAliases))
const demonyms: Record<string, string> = {
	korean: "KR",
	"south korean": "KR",
	japanese: "JP",
	french: "FR",
	german: "DE",
	british: "GB",
	american: "US",
	indian: "IN",
	italian: "IT",
	spanish: "ES",
	australian: "AU",
	austrian: "AT",
	belgian: "BE",
	brazilian: "BR",
	canadian: "CA",
	chinese: "CN",
	danish: "DK",
	dutch: "NL",
	finnish: "FI",
	greek: "GR",
	hungarian: "HU",
	indonesian: "ID",
	iranian: "IR",
	irish: "IE",
	israeli: "IL",
	mexican: "MX",
	"new zealand": "NZ",
	norwegian: "NO",
	polish: "PL",
	portuguese: "PT",
	romanian: "RO",
	russian: "RU",
	swedish: "SE",
	swiss: "CH",
	taiwanese: "TW",
	thai: "TH",
	turkish: "TR",
	ukrainian: "UA",
	vietnamese: "VN",
	"south african": "ZA",
	argentinian: "AR",
	argentine: "AR",
	chilean: "CL",
	colombian: "CO",
	filipino: "PH",
	pakistani: "PK",
	egyptian: "EG",
	nigerian: "NG",
}
const sourceNames: Record<string, [string, number]> = {
	imdb: ["imdb", 10],
	letterboxd: ["letterboxd", 20],
	"rotten tomatoes critics": ["rtCritics", 1],
	"rotten tomatoes critic score": ["rtCritics", 1],
	"rt critics": ["rtCritics", 1],
	tomatometer: ["rtCritics", 1],
	"rotten tomatoes": ["rtCritics", 1],
	"rotten tomatoes audience": ["rtAudience", 1],
	"rt audience": ["rtAudience", 1],
	"audience score": ["rtAudience", 1],
	popcornmeter: ["rtAudience", 1],
	"metacritic users": ["metacriticUsers", 10],
	"metacritic user score": ["metacriticUsers", 10],
	"metacritic user": ["metacriticUsers", 10],
	metacritic: ["metacritic", 1],
	metascore: ["metacritic", 1],
}
export function addDiscoverRules(
	query: string,
	scan: Scan,
	protect: (start: number, length: number) => void,
	concepts: readonly { parameter: string; value: string; label: string }[],
	providers: readonly QueryProvider[] = [],
) {
	for (const m of query.matchAll(
		/(?<![\p{L}\p{N}])-\d+(?:[.,]\d+)?\s*(?:seasons?|episodes?|ratings?|votes?|reviews?|million|billion|[kmb])\b/giu,
	)) {
		if (!/\d\s*$/.test(query.slice(0, m.index))) protect(m.index!, m[0].length)
	}
	// Total viewing time is deliberately out of scope. Do not reinterpret a
	// show's time-to-finish as its episode or movie runtime.
	for (const m of query.matchAll(
		new RegExp(
			`\\b(?:finish|complete|binge)\\s+(?:(?:it|a series|a show)\\s+)?(?:in|within|under)\\s+${NUM}\\s+hours?\\b|\\b${NUM}\\s+hours?\\s+to finish\\b`,
			"gi",
		),
	))
		protect(m.index!, m[0].length)
	// Source scales are explicit: native 0–10, 0–5, or percentages. Only minimums
	// exist in Discover. Invalid/unsupported thresholds remain text, never GW scores.
	const sourceThreshold = (
		m: RegExpMatchArray,
		name: string,
		rawValue: string,
		rawUnit = "",
		rawCompare = "",
	): [string, string][] | null => {
		let [key, scale] = sourceNames[name.toLowerCase()]
		const value = Number(rawValue.replace(",", ".")),
			unit = rawUnit.trim(),
			cmp = rawCompare.toLowerCase()
		if (unit === "%") scale = 1
		else if (unit.startsWith("/")) scale = 100 / Number(unit.slice(1).trim())
		if (
			/at most|no more|up to|maximum|under|below|less than/.test(cmp) ||
			value * scale > 100 ||
			value < 0
		) {
			protect(m.index!, m[0].length)
			return null
		}
		const normalized =
			Math.ceil(value * scale) +
			(/^(?:over|above|more than)$/.test(cmp) && Number.isInteger(value * scale)
				? 1
				: 0)
		if (normalized > 100) {
			protect(m.index!, m[0].length)
			return null
		}
		return [["sources", `${key}:${normalized}`]]
	}
	const sourcePattern = choices(Object.keys(sourceNames))
	const scoreNumber =
		"(\\d+(?:[.,]\\d+)?)(\\s*%|\\s*\\/\\s*(?:5|10|100))?\\s*(\\+)?"
	scan(
		new RegExp(
			`\\b(${sourcePattern})\\s*(?:(?:score|ratings?|rated)(?:\\s+of)?\\s*)?(${CMP})?\\s*${scoreNumber}`,
			"gi",
		),
		(m) => sourceThreshold(m, m[1], m[3], m[4], m[2]),
	)
	scan(
		new RegExp(
			`\\b(${CMP})?\\s*${scoreNumber}\\s+(?:(?:on|from|at)\\s+)?(${sourcePattern})\\b`,
			"gi",
		),
		(m) => sourceThreshold(m, m[5], m[2], m[3], m[1]),
	)

	// Monetary facts are nominal USD millions, in whole USD thousands.
	const money =
		"(?:\\$|USD\\s*)?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(billion|billions|bn|b|million|millions|mn|mil|m|thousand|k)?"
	const dollars = (value: string, unit?: string) =>
		Number(value.replace(/,/g, "")) *
		(/^b/i.test(unit ?? "")
			? 1000
			: /^(?:m|mil)/i.test(unit ?? "")
				? 1
				: /^(?:k|thousand)/i.test(unit ?? "")
					? 0.001
					: 0.000001)
	const moneyKind = (word: string) =>
		/^budget$/i.test(word) ? "budget" : "boxOffice"
	const MONEY = "budget|box[- ]?office|revenue|gross(?:ed|ing)?|made"
	scan(
		new RegExp(
			`\\b(${MONEY})\\s+(?:of\\s+)?(?:between|from)\\s+${money}\\s*(?:and|to|[-–])\\s*${money}`,
			"gi",
		),
		(m) => {
			const guessedUnits =
				!m[3] &&
				!m[5] &&
				!/\$|\bUSD\b/i.test(m[0]) &&
				Math.max(n(m[2]), n(m[4])) < 10000
			const lo = guessedUnits ? n(m[2]) : dollars(m[2], m[3] ?? m[5]),
				hi = guessedUnits ? n(m[4]) : dollars(m[4], m[5] ?? m[3])
			if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) {
				protect(m.index!, m[0].length)
				return null
			}
			return [
				[
					moneyKind(m[1]),
					`${lo}-${hi}`,
					guessedUnits
						? "Guess: unspecified monetary units mean USD millions"
						: undefined,
				],
			]
		},
	)
	scan(
		new RegExp(
			`\\b(${MONEY})\\s+(?:of\\s+)?(${CMP})?\\s*${money}\\s*(\\+)?`,
			"gi",
		),
		(m) => {
			const guessedUnits =
				!m[4] &&
				!/\$|\bUSD\b/i.test(m[0]) &&
				Number(m[3].replace(/,/g, "")) < 10000
			const value = guessedUnits
					? Number(m[3].replace(/,/g, ""))
					: dollars(m[3], m[4]),
				cmp = m[2]?.toLowerCase() ?? ""
			if (
				!Number.isFinite(value) ||
				value < 0 ||
				/^\s*(?:EUR|GBP|euros?|pounds?)\b/i.test(
					query.slice(m.index! + m[0].length),
				)
			) {
				protect(m.index!, m[0].length)
				return null
			}
			const range = cmpRange(value, cmp || "at least", m[5], 0.001)
			if (range.startsWith("--")) {
				protect(m.index!, m[0].length)
				return null
			}
			return [
				[
					moneyKind(m[1]),
					range,
					guessedUnits
						? "Guess: unspecified monetary units mean USD millions"
						: undefined,
				],
			]
		},
	)
	scan(
		new RegExp(
			`(?<![\\w.$])(${CMP})?\\s*${money}\\s*(\\+)?\\s+(${MONEY})\\b`,
			"gi",
		),
		(m) => {
			const guessedUnits = !m[3] && !/\$|\bUSD\b/i.test(m[0]) && n(m[2]) < 10000
			const value = guessedUnits ? n(m[2]) : dollars(m[2], m[3]),
				range = cmpRange(value, m[1]?.toLowerCase() || "at least", m[4], 0.001)
			if (!Number.isFinite(value) || range.startsWith("--")) {
				protect(m.index!, m[0].length)
				return null
			}
			return [
				[
					moneyKind(m[5]),
					range,
					guessedUnits
						? "Guess: unspecified monetary units mean USD millions"
						: undefined,
				],
			]
		},
	)

	for (const p of BUDGET_PRESETS) {
		const words =
			p.key === "indie"
				? "low[- ]budget|micro[- ]budget|indie[- ]budget"
				: p.key === "midBudget"
					? "mid[- ]budget|medium[- ]budget"
					: p.key === "big"
						? "big[- ]budget|high[- ]budget"
						: "blockbuster[- ]budget"
		scan(new RegExp(`\\b(?:${words})\\b`, "gi"), () => [
			[
				"budget",
				`${"min" in p.range ? p.range.min : ""}-${"max" in p.range ? p.range.max : ""}`,
				`Guess: ${p.note}, using Discover's ${p.label} preset`,
			],
		])
	}
	scan(/\b(?:box[- ]office\s+|commercial\s+)?(?:flops?|bombs?)\b/gi, () => [
		["returns", "flop"],
	])
	scan(
		/\b(?:(?:box[- ]office|commercial|financial)\s+(?:hits?|success(?:es)?)|hits?)\b/gi,
		() => [["returns", "hit"]],
	)
	scan(
		/\b(?:finished|complete|completed|ended)\s+(?:series|shows?)\b|\b(?:series|shows?)\s+(?:that\s+(?:have|has)\s+)?(?:finished|ended|completed)\b/gi,
		() => [["showStatus", "ended"]],
	)
	scan(/\b(?:still running|ongoing|still airing|currently airing)\b/gi, () => [
		["showStatus", "running"],
	])
	scan(/\b(?:cancelled|canceled)\s*(?:series|shows?)?\b/gi, () => [
		["showStatus", "canceled"],
	])
	const seasonN = `(?:${NUM})`
	scan(
		new RegExp(
			`\\b(?:(?:between|from)\\s+)?(${seasonN})\\s*(?:and|to|[-–])\\s*(${seasonN})(?:\\s+|-)seasons?\\b`,
			"gi",
		),
		(m) => {
			const lo = n(m[1]),
				hi = n(m[2])
			if (lo > hi || !Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1) {
				protect(m.index!, m[0].length)
				return null
			}
			return [["seasons", `${lo}-${hi}`]]
		},
	)
	scan(
		new RegExp(
			`\\b(${CMP})?\\s*(${seasonN})\\s*(\\+)?(?:\\s+|-)seasons?\\b`,
			"gi",
		),
		(m) => {
			const value = n(m[2])
			if (!Number.isInteger(value) || value < 1) {
				protect(m.index!, m[0].length)
				return null
			}
			return [["seasons", cmpRange(value, m[1]?.toLowerCase(), m[3])]]
		},
	)
	// Explicit episode duration is separate from general/movie runtime.
	const duration = `(${NUM})\\s*(hours?|hrs?|h|minutes?|mins?|m)(?:\\s*(?:and\\s+)?(${NUM})\\s*(?:minutes?|mins?|m))?`
	const episodeRange = (
		m: RegExpMatchArray,
		cmp: string,
		amount: string,
		unit: string,
		minutes?: string,
	): [string, string][] | null => {
		const value =
			n(amount) * (/^h/i.test(unit) ? 60 : 1) + (minutes ? n(minutes) : 0)
		if (value <= 0 || !Number.isInteger(value)) {
			protect(m.index!, m[0].length)
			return null
		}
		return [["episodeRuntime", cmpRange(value, cmp.toLowerCase())]]
	}
	scan(
		new RegExp(
			`\\b(?:episodes?|episode (?:length|runtime|duration))\\s+(?:(?:between|from)\\s+)?(${NUM})\\s*(?:and|to|[-–])\\s*(${NUM})\\s*(minutes?|mins?|m)\\b`,
			"gi",
		),
		(m) => {
			const lo = n(m[1]),
				hi = n(m[2])
			if (lo < 1 || lo > hi) {
				protect(m.index!, m[0].length)
				return null
			}
			return [["episodeRuntime", `${lo}-${hi}`]]
		},
	)

	scan(
		new RegExp(
			`\\b(?:episodes?|episode (?:runtime|length|duration))\\s+(?:of\\s+)?(${CMP})?\\s*${duration}`,
			"gi",
		),
		(m) => episodeRange(m, m[1] ?? "", m[2], m[3], m[4]),
	)
	scan(
		new RegExp(
			`\\b(${CMP})?\\s*${duration}\\s*(?:per episode|episodes?|each episode)\\b`,
			"gi",
		),
		(m) => episodeRange(m, m[1] ?? "", m[2], m[3], m[4]),
	)
	scan(
		/\b(?:any episode length|unlimited episode (?:length|runtime))\b/gi,
		() => [["episodeRuntime", "any"]],
	)
	// Votes are counts, not quality scores; k/m suffixes are counts here.
	const count = "([\\d,]+(?:\\.\\d+)?)\\s*([km])?"
	scan(
		new RegExp(
			`\\b(?:(?:between|from)\\s+)?${count}\\s*(?:and|to|[-–])\\s*${count}\\s*(?:ratings?|votes?|reviews?)\\b`,
			"gi",
		),
		(m) => {
			const value = (s: string, u: string | undefined) =>
				Number(s.replace(/,/g, "")) *
				(u?.toLowerCase() === "k" ? 1000 : u?.toLowerCase() === "m" ? 1e6 : 1)
			const lo = value(m[1], m[2] ?? m[4]),
				hi = value(m[3], m[4] ?? m[2])
			if (lo > hi || !Number.isSafeInteger(lo) || !Number.isSafeInteger(hi)) {
				protect(m.index!, m[0].length)
				return null
			}
			return [["votes", `${lo}-${hi}`]]
		},
	)
	scan(
		/\b(?:popularity\s+)?rank\s+(?:between\s+|from\s+)?([\d,]+)\s*(?:and|to|[-–])\s*([\d,]+)\b/gi,
		(m) => {
			const lo = n(m[1]),
				hi = n(m[2])
			if (lo < 1 || lo > hi) {
				protect(m.index!, m[0].length)
				return null
			}
			return [["rank", `${lo}-${hi}`]]
		},
	)

	scan(
		new RegExp(
			`\\b(${CMP})?\\s*${count}\\s*(\\+)?\\s*(?:ratings?|votes?|reviews?)\\b`,
			"gi",
		),
		(m) => {
			const value =
				Number(m[2].replace(/,/g, "")) *
				(m[3]?.toLowerCase() === "k"
					? 1000
					: m[3]?.toLowerCase() === "m"
						? 1e6
						: 1)
			if (!Number.isSafeInteger(value) || value < 0) {
				protect(m.index!, m[0].length)
				return null
			}
			return [
				["votes", cmpRange(value, m[1]?.toLowerCase() || "at least", m[4])],
			]
		},
	)
	scan(
		new RegExp(
			`\\b(?:ratings?|votes?|reviews?)\\s+(${CMP})\\s+${count}\\b`,
			"gi",
		),
		(m) => {
			const value =
				Number(m[2].replace(/,/g, "")) *
				(m[3]?.toLowerCase() === "k"
					? 1000
					: m[3]?.toLowerCase() === "m"
						? 1e6
						: 1)
			if (!Number.isSafeInteger(value) || value < 0) {
				protect(m.index!, m[0].length)
				return null
			}
			const range = cmpRange(value, m[1].toLowerCase())
			if (range.startsWith("--")) {
				protect(m.index!, m[0].length)
				return null
			}
			return [["votes", range]]
		},
	)

	scan(
		/\btop\s+(\d[\d,]*)\s*(?:most popular|by popularity|popular)?\b|\bpopularity\s+rank\s*(?:at most|up to)?\s*(\d[\d,]*)\b/gi,
		(m) => {
			const value = n(m[1] ?? m[2])
			if (!Number.isSafeInteger(value) || value < 1) {
				protect(m.index!, m[0].length)
				return null
			}
			return [["rank", `-${value}`]]
		},
	)
	scan(
		new RegExp(
			`\\b(?:popularity\\s+)?rank\\s+(${CMP})\\s+(\\d[\\d,]*)\\b`,
			"gi",
		),
		(m) => [["rank", cmpRange(n(m[2]), m[1].toLowerCase())]],
	)
	for (const p of VOTES_PRESETS)
		scan(new RegExp(`\\b${escape(p.label)}\\b`, "gi"), () => [
			[
				"votes",
				`${"min" in p.range ? p.range.min : ""}-${"max" in p.range ? p.range.max : ""}`,
				`Guess: Discover's ${p.label} preset`,
			],
		])
	for (const p of POPULARITY_RANK_PRESETS)
		scan(new RegExp(`\\b${escape(p.label)}\\b`, "gi"), () => [
			[
				"rank",
				`${"min" in p.range ? p.range.min : ""}-${"max" in p.range ? p.range.max : ""}`,
				`Guess: Discover's ${p.label} preset`,
			],
		])
	// Discover has directional disagreement, not a neutral controversial filter.
	scan(
		/\b(?:critics?\s+(?:and|&)\s+audiences?\s+agree|critics?\s+and\s+audiences?\s+(?:both\s+)?(?:love|loved|like|liked)\s+it|universally acclaimed|critical and audience acclaim)\b/gi,
		() => [["gap", "agree"]],
	)
	scan(
		/\b(?:critics?\s+(?:love|loved|like|liked|rate|rated)\s+(?:it\s+)?(?:more|higher)|critics?\s+(?:love|loved)\s+it\s*[,;]?\s*(?:but\s+)?audiences?\s+(?:hate|hated)\s+it|critics?\s*(?:>|over)\s*audiences?)\b/gi,
		() => [["gap", "critics"]],
	)
	scan(
		/\b(?:audiences?\s+(?:love|loved|like|liked|rate|rated)\s+(?:it\s+)?(?:more|higher)|audiences?\s+(?:love|loved)\s+it\s*[,;]?\s*(?:but\s+)?critics?\s+(?:hate|hated)\s+it|audiences?\s*(?:>|over)\s*critics?)\b/gi,
		() => [["gap", "audience"]],
	)
	scan(
		/\bcritics?\s+(?:hate|hated|dislike|disliked)\s+it\s*[,;]?\s*(?:but\s+)?audiences?\s+(?:love|loved|like|liked)\s+it\b/gi,
		() => [["gap", "audience"]],
	)
	scan(
		/\baudiences?\s+(?:hate|hated|dislike|disliked)\s+it\s*[,;]?\s*(?:but\s+)?critics?\s+(?:love|loved|like|liked)\s+it\b/gi,
		() => [["gap", "critics"]],
	)

	scan(/\b(?:controversial|divisive|polarizing|polarising)\b/gi, () => [
		[
			"gap",
			"audience",
			"Guess: audiences liked it more than critics; Discover has no direction-neutral disagreement option",
		],
	])
	scan(
		/\b(?:already seen|already watched|only (?:titles |movies |shows )?(?:i(?:'ve| have) )?(?:seen|watched)|rewatch(?:es)?|seen before)\b/gi,
		() => [["seen", "1"]],
	)
	scan(
		/\b(?:on |from )?(?:my |the )?(?:wishlist|watchlist|want to (?:see|watch) list)\b/gi,
		() => [["wishlist", "1"]],
	)
	scan(
		/\b(?:available (?:anywhere )?to stream|(?:on |from )?any (?:streaming )?services?|streaming in my country)\b/gi,
		() => [["services", "any"]],
	)
	scan(
		/\b(?:sort(?:ed)? by relevance|most relevant|relevance first|relevance)\b/gi,
		() => [["sort", "relevance"]],
	)
	scan(
		/\b(?:no personali[sz]ation|without personali[sz]ation|personali[sz]ation off|not personali[sz]ed|for you off)\b/gi,
		() => [["foryou", "0"]],
		true,
	)
	scan(/\btaste match (?:above|at least)\s*(60)%?/gi, (m) => [["match", m[1]]])
	// All tags must fit within one group; existing cross-group AND stays unchanged.
	const tagRows = [
		...concepts,
		...[
			["genres", "Horror", "horror"],
			["genres", "Comedy", "comedy"],
			["genres", "Thriller", "thriller"],
			["genres", "Crime", "crime"],
			["genres", "Mystery", "mystery"],
			["moods", "funny", "funny"],
			["moods", "scary", "scary"],
			["styles", "slow", "slow"],
			["styles", "fast", "fast"],
		].map(([parameter, value, label]) => ({ parameter, value, label })),
	]
	const tagPattern = choices([...new Set(tagRows.map((c) => c.label))])
	scan(
		new RegExp(
			`\\b(?:both|all of|must be)\\s+(${tagPattern})(?:\\s*,?\\s+(?:and|&)\\s+|\\s*,\\s*)(${tagPattern})(?:\\s*,?\\s+(?:and|&)\\s+(${tagPattern}))?\\b`,
			"gi",
		),
		(m) => {
			const terms = m
				.slice(1)
				.filter(Boolean)
				.map((s) => s.toLowerCase())
			const group = ["moods", "themes", "styles", "genres"].find((group) =>
				terms.every((term) =>
					tagRows.some(
						(c) => c.parameter === group && c.label.toLowerCase() === term,
					),
				),
			)
			if (!group) return null
			return [
				...terms.map(
					(term) =>
						[
							group,
							tagRows.find(
								(c) => c.parameter === group && c.label.toLowerCase() === term,
							)!.value,
						] as [string, string],
				),
				["all", group],
			]
		},
	)
	// Every known country name is available with explicit country context.
	scan(
		new RegExp(
			`\\b(?:available in|streaming in|watching in|viewing country(?: is)?|watch in)\\s+(${countryPattern})\\b`,
			"gi",
		),
		(m) => [["streamingCountry", countryAliases[m[1].toLowerCase()]]],
	)
	scan(
		new RegExp(
			`\\b(?:age ratings? (?:from|in|for)|ratings? country(?: is)?|rated for)\\s+(${countryPattern})\\b`,
			"gi",
		),
		(m) => [["ratingCountry", countryAliases[m[1].toLowerCase()]]],
	)
	scan(
		new RegExp(`\\b(${countryPattern})\\s+(?:age )?ratings?\\b`, "gi"),
		(m) => [["ratingCountry", countryAliases[m[1].toLowerCase()]]],
	)
	scan(
		new RegExp(
			`\\b(?:made in|produced in|productions? from|movies? from|shows? from)\\s+(${countryPattern})\\b`,
			"gi",
		),
		(m) => [["productionCountries", countryAliases[m[1].toLowerCase()]]],
	)
	scan(
		new RegExp(
			`\\b(${choices(Object.keys(demonyms))})\\s+(?:age )?ratings?\\b`,
			"gi",
		),
		(m) => [["ratingCountry", demonyms[m[1].toLowerCase()]]],
	)

	scan(new RegExp(`\\b(${choices(Object.keys(demonyms))})\\b`, "gi"), (m) => {
		if (
			/\b(?:in|spoken|dubbed|subtitled)\s*$/i.test(query.slice(0, m.index)) ||
			/^\s*(?:language|dubbed|audio|subtitles)\b/i.test(
				query.slice(m.index! + m[0].length),
			)
		)
			return null
		return [
			[
				"productionCountries",
				demonyms[m[1].toLowerCase()],
				"Guess: production country, not spoken language",
			],
		]
	})
	scan(
		/\b(?:rest of (?:the )?world|outside (?:the )?(?:usual production countries|main production countries))\b/gi,
		() => [["restOfWorld", "1"]],
	)
	const brands: Record<string, string> = {}
	for (const { id, name } of PROVIDER_ALIASES.values())
		brands[name.toLowerCase()] = String(id)
	Object.assign(brands, {
		"paramount plus": "531",
		paramount: "531",
		peacock: "386",
		"apple tv": "350",
		hbo: "1899",
		mubi: "11",
		crunchyroll: "283",
		shudder: "99",
		"amc plus": "526",
		"discovery plus": "524",
		"mgm plus": "34",
		starz: "43",
		acorn: "87",
	})
	const ambiguous = new Set([
		"max",
		"now",
		"home",
		"all",
		"free",
		"film",
		"films",
		"movies",
		"movie",
		"tv",
		"channel",
		"channels",
		"plus",
		"one",
		"go",
		"wow",
		"sky",
		"orange",
		"apple",
		"horror",
		"comedy",
		"drama",
		"action",
		"crime",
		"family",
		"history",
		"dark",
		"scary",
		"funny",
		"slow",
		"fast",
		"runtime",
		"running time",
		"duration",
		"budget",
		"ratings",
		"votes",
		"score",
		"seasons",
		"series",
		"shows",
		"episodes",
		"critics",
		"audience",
		"taste",
		"time",
		"returns",
		"watch",
		"watchlist",
		...concepts.map((c) => c.label.toLowerCase()),
	])
	const serviceNames: Record<string, string> = {}
	for (const p of providers) {
		for (const name of new Set([
			p.name.trim(),
			p.name.trim().replace(/^the /i, ""),
			p.name.trim().replace(/\s+TV$/i, ""),
		]))
			if (name.length >= 2)
				serviceNames[name.toLowerCase()] = String(
					PROVIDER_ALIASES.get(p.id)?.id ?? p.id,
				)
	}
	// Verified aliases override duplicate catalog spellings. Match longest names
	// across both lists, so Discovery Plus never falls back to "Discovery".
	Object.assign(serviceNames, brands, {
		"disney plus": "337",
		disney: "337",
		netflix: "8",
		prime: "9",
		"prime video": "9",
		"amazon prime": "9",
		"amazon prime video": "9",
		"discovery +": "524",
	})
	scan(
		new RegExp(
			`\\b(?:on|via|streaming on|available on)\\s+(${choices(Object.keys(serviceNames))})(?=$|[\\s,;:.!?])`,
			"gi",
		),
		(m) => [["services", serviceNames[m[1].toLowerCase()]]],
	)
	const bareNames = Object.keys(serviceNames).filter(
		(name) => !ambiguous.has(name) && (name.length >= 4 || name in brands),
	)
	scan(new RegExp(`\\b(${choices(bareNames)})(?=$|[\\s,;:.!?])`, "gi"), (m) => [
		["services", serviceNames[m[1].toLowerCase()]],
	])

	// Shield unsupported numeric units too: no accidental score from "11 IMDb",
	// "2.5 seasons", "10 hours to finish", or unsupported source ceilings.
	for (const m of query.matchAll(
		/\b\d+(?:[.,]\d+)?\s*(?:\+|%)?\s*(?:seasons?|episodes?|hours?\s+to finish|ratings?|votes?|reviews?)\b|\b(?:imdb|letterboxd|metacritic|rotten tomatoes)\b[^;!?]{0,24}?\b\d+(?:\.\d+)?(?:\+|%)?/gi,
	))
		protect(m.index!, m[0].length)
}
