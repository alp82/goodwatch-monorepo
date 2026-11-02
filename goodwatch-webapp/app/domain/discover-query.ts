import { addDiscoverRules, type QueryProvider } from "./discover-query-rules"
// Shared natural-language Discover filter rules. Entity lookups run only on the server.
import {
	defaultFilterState,
	filterStateFromParams,
	filterStateToParams,
} from "./filter-state"
import { MOODS } from "./moods"
import { THEMES, STYLES } from "./themes-styles"
import { FINGERPRINT_META } from "../ui/fingerprint/fingerprintMeta"
import { VALID_FINGERPRINT_KEYS } from "../server/utils/fingerprint"

export type Proposal = {
	parameter: string
	value: string
	phrase: string
	reason: string
	source: string
	status?: string
	entityParameter?: string
	consumedName?: string
	bare?: boolean
	entityStart?: number
	entityEnd?: number
}
export type Entity = {
	parameter: string
	name: string
	start: number
	end: number
	implicit?: boolean
	quoted?: boolean
	bare?: boolean
}
export const concepts = [
	...MOODS.map((m) => ({
		parameter: "moods",
		value: m.key,
		label: m.name,
		description: m.description,
	})),
	...THEMES.map((t) => ({
		parameter: "themes",
		value: t.id,
		label: t.name,
		description: `Subject matter: ${t.name}.`,
	})),
	...STYLES.map((s) => ({
		parameter: "styles",
		value: s.id,
		label: s.name,
		description: `Presentation or storytelling: ${s.name}.`,
	})),
]
const groups: Record<string, string> = {
	minYear: "years",
	maxYear: "years",
	released: "years",
	minRuntime: "runtime",
	maxRuntime: "runtime",
	services: "services",
	seen: "seenState",
	unseen: "seenState",
	score: "scores",
	maxScore: "scores",
}
const group = (key: string) => groups[key] ?? key
const lists = new Set([
	"genres",
	"moods",
	"themes",
	"styles",
	"productionCountries",
	"people",
	"similar",
	"loved",
	"disliked",
	"all",
])
const defaults = { onMyServices: false, notSeenYet: false }
const resolvesEntity = (p: Proposal, parameter: string, name: string) =>
	p.source === "entity lookup" &&
	(p.entityParameter ?? p.parameter) === parameter &&
	p.phrase === name
const providerIds: Record<string, string> = {
	netflix: "8",
	"disney+": "337",
	"disney plus": "337",
	disney: "337",
	"amazon prime": "9",
	"amazon prime video": "9",
	"prime video": "9",
	prime: "9",
	"apple tv+": "350",
	"apple tv plus": "350",
	hulu: "15",
	"hbo max": "1899",
	max: "1899",
}
const providerAliasPattern = Object.keys(providerIds)
	.sort((a, b) => b.length - a.length)
	.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
	.join("|")
const startsProvider = new RegExp(
	`^(?:${providerAliasPattern})(?=$|[\\s,;:.!?])`,
	"i",
)

export function interpret(
	query: string,
	existing = "",
	now = new Date(),
	additions: Proposal[] = [],
	providers: readonly QueryProvider[] = [],
) {
	query = query.trim().slice(0, 512)
	const proposals: Proposal[] = []
	const warnings: string[] = []
	const entities: Entity[] = []
	const used = Array(query.length).fill(false) as boolean[]
	const protectedText = Array(query.length).fill(false) as boolean[]
	for (const m of query.matchAll(/"[^"]*"|“[^”]*”/g))
		for (let i = m.index!; i < m.index! + m[0].length; i++)
			protectedText[i] = true
	const consume = (start: number, length: number) => {
		for (let i = start; i < start + length; i++) used[i] = true
	}
	function isNegatedAt(start: number): boolean {
		// Negation scopes a coordinated clause, not just the immediately previous
		// word: "not very scary", "no comedy or horror", "anything except X".
		const prefix = query
			.slice(0, start)
			.replace(/"[^"]*"|“[^”]*”/g, " ")
			.replace(/\b(?:anything|everything)\s+but\b/gi, " except ")
			.replace(/\bnot\s+only\b|\bno\s+doubt\b/gi, " ")
		const clause =
			prefix.split(/[.!?;,]|\b(?:but|however|yet|instead)\b/i).at(-1) ?? ""
		const negators = [
			...clause.matchAll(
				/\b(?:don['’]?t|do\s+not|no|not|without|exclud(?:e|ing)|avoid(?:ing)?|except|nothing|neither)\b/gi,
			),
		]
		const last = negators.at(-1)
		if (!last) return false
		const tail = clause.slice(last.index! + last[0].length)
		const meaningful = (text: string) =>
			text
				.replace(
					/\b(?:a|an|the|any|very|too|really|particularly|especially|want|need|something|anything)\b/gi,
					" ",
				)
				.trim()
		// A separate positive constraint starts a new scope: "no horror on
		// Netflix". Conversely, "not on Netflix" remains a negative request.
		for (const connector of tail.matchAll(
			/\b(?:on|with|allow|for|from|since|released|under|over|after|before)\b/gi,
		))
			if (meaningful(tail.slice(0, connector.index))) return false
		if (
			/^(?:on|with|allow|for|from|since|released|under|over|after|before)\b/i.test(
				query.slice(start),
			) &&
			meaningful(tail)
		)
			return false
		return true
	}
	// Confirmed bare people are protected before reading their names as filters.
	for (const p of additions)
		if (
			p.bare &&
			p.entityStart !== undefined &&
			p.entityEnd !== undefined &&
			query.slice(p.entityStart, p.entityEnd) === p.phrase
		) {
			consume(p.entityStart, p.entityEnd - p.entityStart)
			entities.push({
				parameter: "people",
				name: p.phrase,
				start: p.entityStart,
				end: p.entityEnd,
				implicit: true,
				bare: true,
			})
		}
	function scan(
		pattern: RegExp,
		make: (m: RegExpMatchArray) => [string, string, string?][] | null,
		ownsNegation = false,
	) {
		for (const m of query.matchAll(pattern)) {
			const start = m.index!
			if (
				used.slice(start, start + m[0].length).some(Boolean) ||
				protectedText.slice(start, start + m[0].length).some(Boolean)
			)
				continue
			if (
				/\b(?:set|takes place)\s+in\s+(?:the\s+)?(?:\d{2}['’]?s|\d{4})$/i.test(
					query.slice(Math.max(0, start - 40), start + m[0].length),
				)
			)
				continue
			// Negation cannot turn into a positive filter. Unsupported exclusions remain searchable.
			if (
				isNegatedAt(start) &&
				(!ownsNegation ||
					/\b(?:not|no|without|never)\s*$/i.test(query.slice(0, start)))
			) {
				// A rejected full constraint must not fall through into a narrower
				// unrelated rule (e.g. "not age under 12" becoming score >=12).
				for (let i = start; i < start + m[0].length; i++)
					protectedText[i] = true
				continue
			}
			const values = make(m)
			if (!values) continue
			for (const [parameter, value, reason] of values)
				proposals.push({
					parameter,
					value,
					phrase: m[0],
					reason: reason ?? "Explicit wording",
					source: "rule",
				})
			consume(start, m[0].length)
		}
	}
	addDiscoverRules(
		query,
		(pattern, make, ownsNegation) =>
			scan(
				pattern,
				(m) => {
					if (
						/\b(?:like|similar\s+to|starring|directed by|loved|disliked)\s+(?:(?:the|a|an)\s+)?$/i.test(
							query.slice(0, m.index! + m[0].length - m[0].trimStart().length),
						)
					)
						return null
					return make(m)
				},
				ownsNegation,
			),
		(start, length) => {
			for (let i = start; i < start + length; i++) protectedText[i] = true
		},
		concepts,
		providers,
	)
	// Unscoped/unsupported monetary wording stays text, without mistaking
	// "80 million" for a score or "2000 million" for a release year.
	for (const m of query.matchAll(
		/(?:[$€£]|\b(?:USD|EUR|GBP)\s*)\s*\d[\d,.]*(?:\s*(?:million|billion|thousand|[kmb])\b)?|\b\d+(?:[.,]\d+)?\s*(?:million|billion|thousand|usd|eur|gbp|dollars?|euros?|pounds?)\b/gi,
	)) {
		if (
			used.slice(m.index!, m.index! + m[0].length).some(Boolean) ||
			protectedText.slice(m.index!, m.index! + m[0].length).some(Boolean)
		)
			continue
		for (let i = m.index!; i < m.index! + m[0].length; i++)
			protectedText[i] = true
		warnings.push(
			"Unscoped or non-USD money is not supported; the monetary amount remains in search text.",
		)
	}
	// References are spans, not isolated words: quotes end a name exactly;
	// ordinary prepositions remain part of titles until a real filter clause.
	const markers = [
		...query.matchAll(
			/\b(similar\s+(?:to|like)|like|with|starring|directed by|loved|disliked)\s+/gi,
		),
	].map((m) => ({
		start: m.index!,
		content: m.index! + m[0].length,
		intro: m[1],
		parameter: /like|similar/i.test(m[1])
			? "similar"
			: /loved|disliked/i.test(m[1])
				? m[1].toLowerCase()
				: "people",
	}))
	const startsFilter =
		/^(?:comedy|comedies|horror|drama|thrillers?|action|adventure|fantasy|crime|mystery|family|war|westerns?|sci[- ]fi|science fiction|funnier|funny|scary|scarier|slower|faster|more\s+(?:humorous|romantic)|less\s+\w+|good|bad|low|high|poor|excellent|scores?|ratings?|under|over|after|before|since|from\s+\d|on\s+|for\s+(?:my|kids|children|a\s+\d)|netflix|disney|hulu|\d)\b/i
	const clauseBoundary =
		/(?:\s+|[,;]\s*)(?:(?:but|however|except)\s+|(?:under|over|less than|more than|at most|at least)\s+\d|(?:from|after|before|since|released(?: in)?)\s+\d|on\s+(?:my services|netflix|disney|amazon|prime|apple|hulu|max|hbo)\b|for\s+(?:(?:my|the)\s+)?(?:kids|children|family|preschoolers|teens|a?\s*\d)\b|and\s+(?:funnier|funny|scary|scarier|slower|faster|more\s+\w+|less\s+\w+|good|bad|low|high|poor|excellent|scores?|ratings?)\b)/i
	while (markers.length) {
		markers.sort((a, b) => a.start - b.start)
		const marker = markers.shift()!
		if (
			used[marker.start] ||
			protectedText[marker.start] ||
			isNegatedAt(marker.start)
		)
			continue
		const tail = query.slice(marker.content)
		const quoted = /^(?:"([^"]+)"|“([^”]+)”)/.exec(tail)
		const boundary = quoted ? null : clauseBoundary.exec(tail)
		const usedBoundary = quoted
			? -1
			: used.slice(marker.content).findIndex(Boolean)
		const endOfName = Math.min(
			boundary?.index ?? tail.length,
			usedBoundary < 0 ? tail.length : usedBoundary,
		)
		const literal = quoted
			? quoted[0]
			: tail
					.slice(0, endOfName)
					.trimEnd()
					.replace(usedBoundary >= 0 ? /\s+(?:and|or|but)\s*$/i : /$^/, "")
		const name = quoted ? (quoted[1] ?? quoted[2]) : literal
		if (
			!name ||
			/^(my |(?:the |a )?(?:sex\b|nudity\b|violence\b|gore\b|swearing\b|drugs\b))/i.test(
				name,
			)
		)
			continue
		const resolution = additions.find((p) =>
			resolvesEntity(p, marker.parameter, name),
		)
		const end =
			marker.content +
			literal.length -
			(resolution?.consumedName
				? name.length - resolution.consumedName.length
				: 0)
		const implicit = marker.intro.toLowerCase() === "with"
		entities.push({
			parameter: marker.parameter,
			name,
			start: marker.start,
			end,
			implicit,
			quoted: Boolean(quoted),
		})
		if (!implicit || resolution) consume(marker.start, end - marker.start)
		if (/directed by|starring/i.test(marker.intro))
			warnings.push(
				"People matches cast or crew together; today's filter cannot require a credit role.",
			)
		// A confirmed prefix or quoted name may introduce another reference of the
		// same kind: with Tom Hanks and Brad Pitt; like "Toy Story" and "Shrek".
		if (quoted || resolution) {
			const connector = /^\s*(?:,\s*)?(?:and|or)\s+/i.exec(query.slice(end))
			if (connector) {
				const content = end + connector[0].length
				const nextText = query.slice(content)
				if (
					!startsFilter.test(nextText) &&
					!startsProvider.test(nextText) &&
					!/^(?:not|no|without|except)\b/i.test(nextText)
				)
					markers.push({
						start: end,
						content,
						intro: "and",
						parameter: marker.parameter,
					})
			}
		}
	}
	// A comparative request can imply a reference without saying "like":
	// "Fight Club but funnier". Only consume the candidate once lookup has
	// confirmed a real title; otherwise normal filters/search keep working.
	const comparative = query.match(
		/^\s*("[^"]+"|[^,;]+?)\s*[,;]?\s+(?:but|only|except|just|and)\s+(?:(?:a bit|much|slightly|even)\s+)?(?:funnier|scarier|slower|faster|more humorous)\b/i,
	)
	if (comparative && !entities.some((e) => e.start < comparative[1].length)) {
		const name = comparative[1].replace(/^"|"$/g, "").trim()
		const generic =
			/^(?:something|anything|movies?|shows?|series|comed(?:y|ies)|horror|drama|thrillers?|good movies|funny movies)$/i.test(
				name,
			)
		if (!generic) {
			const start = query.indexOf(comparative[1])
			const resolution = additions.find((p) =>
				resolvesEntity(p, "similar", name),
			)
			const end =
				start +
				comparative[1].length -
				(resolution?.consumedName
					? name.length - resolution.consumedName.length
					: 0)
			entities.push({
				parameter: "similar",
				name,
				start,
				end,
				implicit: true,
				quoted: comparative[1].startsWith('"'),
			})
			if (additions.some((p) => resolvesEntity(p, "similar", name)))
				consume(start, end - start)
		}
	}
	const year = now.getUTCFullYear()
	const invalidNumeric = (m: RegExpMatchArray, message: string) => {
		for (let i = m.index!; i < m.index! + m[0].length; i++)
			protectedText[i] = true
		warnings.push(message)
		return null
	}
	scan(
		/\b(?:(?:released|release(?: year)?)\s+)?(?:(?:between|from)\s+)?((?:18|19|20)\d{2})\s*(?:and|to|through|[-–—])\s*((?:18|19|20)\d{2})\b/gi,
		(m) => {
			if (
				/^[- ]*(?:minutes?|mins?|hours?|hrs?|h|m)\b/i.test(
					query.slice(m.index! + m[0].length),
				)
			)
				return null
			return +m[1] <= +m[2]
				? [
						["minYear", m[1]],
						["maxYear", m[2]],
					]
				: invalidNumeric(
						m,
						"Release range is reversed; the range stays in search text.",
					)
		},
	)
	scan(
		/\b(?:from\s+(?:the\s+)?|in\s+(?:the\s+)?)?((?:18|19|20)?\d{2})['’]?s\b/gi,
		(m) => {
			let start = +m[1]
			if (m[1].length === 2) {
				start += Math.floor(year / 100) * 100
				if (start > year) start -= 100
			}
			if (start % 10) return null
			return [
				["minYear", String(start), "Most recent decade that has begun"],
				["maxYear", String(start + 9)],
			]
		},
	)
	scan(
		/\b(?:(?:released|release(?: year)?)\s+)?(after|since|before|until|from|in)\s+((?:18|19|20)\d{2})\b/gi,
		(m) => {
			if (
				/^[- ]*(?:minutes?|mins?|hours?|hrs?|h|m)\b/i.test(
					query.slice(m.index! + m[0].length),
				)
			)
				return null
			const n = +m[2],
				op = m[1].toLowerCase()
			return op === "after"
				? [["minYear", String(n + 1)]]
				: op === "since"
					? [["minYear", String(n)]]
					: op === "before"
						? [["maxYear", String(n - 1)]]
						: op === "until"
							? [["maxYear", String(n)]]
							: [
									["minYear", String(n)],
									["maxYear", String(n)],
								]
		},
	)
	scan(
		/\b(?:(?:released|release(?: year)?)\s+)?(this year|last year|last (\d+|two|three|four|five|ten) years|recent|new releases?)\b/gi,
		(m) => {
			const count = m[2]
				? Number(m[2]) ||
					(
						{ two: 2, three: 3, four: 4, five: 5, ten: 10 } as Record<
							string,
							number
						>
					)[m[2].toLowerCase()]
				: 0
			if (
				m[2] &&
				(!Number.isSafeInteger(count) || count < 1 || year - count + 1 < 1800)
			)
				return invalidNumeric(
					m,
					"Relative release range is outside the supported years; it stays in search text.",
				)
			return m[1].toLowerCase() === "this year"
				? [
						["minYear", String(year)],
						["maxYear", String(year)],
					]
				: m[1].toLowerCase() === "last year"
					? [
							["minYear", String(year - 1)],
							["maxYear", String(year - 1)],
						]
					: count
						? [
								["minYear", String(year - count + 1)],
								["maxYear", String(year)],
							]
						: [
								[
									"released",
									"recent",
									"Existing Recent preset: current year and previous two",
								],
							]
		},
	)
	// A year does not need an introductory word: "matrix 1999" keeps "matrix" for search.
	// Entity clauses and quotes were protected before this pass.
	scan(
		/\b(?:(?:released|release(?: year)?)\s+)?((?:18|19|20)\d{2})\b/gi,
		(m) =>
			/^(?:[- ]*(?:minutes?|mins?|hours?|hrs?|h|m)\b|\s*(?:and|to|[-–—])\s*\d+(?:\.\d+)?\s*(?:minutes?|mins?|hours?|hrs?|h|m)\b)/i.test(
				query.slice(m.index! + m[0].length),
			)
				? null
				: [
						["minYear", m[1]],
						["maxYear", m[1]],
					],
	)
	const numberWords: Record<string, number> = {
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
		fifteen: 15,
		twenty: 20,
		thirty: 30,
		forty: 40,
		sixty: 60,
		ninety: 90,
	}
	const amount = `(?:\\d+(?:\\.\\d+)?|${Object.keys(numberWords).join("|")})`
	const numberOf = (text: string) =>
		numberWords[text.toLowerCase()] ?? Number(text)
	const duration = `(?:${amount}\\s*(?:hours?|hrs?|h)(?:\\s*(?:and\\s+)?${amount}\\s*(?:minutes?|mins?|m))?|${amount}[- ]*(?:minutes?|mins?|m))\\b`
	const runtimeLabel = `(?:(?:runtime|running time|duration)\\s+(?:of\\s+)?)?`
	const minutesOf = (text: string) => {
		let total = 0
		for (const part of text.matchAll(
			new RegExp(
				`(${amount})[- ]*(hours?|hrs?|h|minutes?|mins?|m)(?=\\b|\\d)`,
				"gi",
			),
		))
			total += numberOf(part[1]) * (/^h/i.test(part[2]) ? 60 : 1)
		return total
	}
	scan(
		new RegExp(
			`\\b${runtimeLabel}(?:(?:between|from)\\s+)?(${amount})\\s*(?:and|to|[-–—])\\s*(${amount})\\s*(minutes?|mins?|hours?|hrs?)\\b`,
			"gi",
		),
		(m) => {
			const multiplier = /^h/i.test(m[3]) ? 60 : 1
			const min = Math.ceil(numberOf(m[1]) * multiplier),
				max = Math.floor(numberOf(m[2]) * multiplier)
			return min >= 0 && min <= max && max <= 10000
				? [
						["minRuntime", String(min)],
						["maxRuntime", String(max)],
					]
				: invalidNumeric(
						m,
						"Runtime range is invalid; it stays in search text.",
					)
		},
	)
	scan(
		new RegExp(
			`\\b${runtimeLabel}(under|less than|at most|up to|over|more than|at least)\\s+(${duration})`,
			"gi",
		),
		(m) => {
			const n = minutesOf(m[2]),
				op = m[1].toLowerCase(),
				minimum = /over|more than|at least/.test(op)
			const bound = minimum
				? op === "at least"
					? Math.ceil(n)
					: Math.floor(n) + 1
				: /under|less than/.test(op)
					? Math.ceil(n) - 1
					: Math.floor(n)
			return bound >= 0 && bound <= 10000
				? [
						[
							minimum ? "minRuntime" : "maxRuntime",
							String(bound),
							"Inclusive minute bound; for shows this means usual episode length",
						],
					]
				: invalidNumeric(
						m,
						"Runtime bound is invalid; it stays in search text.",
					)
		},
	)
	scan(new RegExp(`\\b${runtimeLabel}(${duration})`, "gi"), (m) => {
		const minutes = Math.floor(minutesOf(m[1]))
		return minutes >= 0 && minutes <= 10000
			? [
					[
						"maxRuntime",
						String(minutes),
						"Guess: a duration without a comparator is the time available; for shows this means usual episode length",
					],
				]
			: invalidNumeric(
					m,
					"Runtime is outside the supported range; it stays in search text.",
				)
	})
	scan(/\b(short|quick watch|feature length|long movies?)\b/gi, (m) =>
		/long/i.test(m[0])
			? [["minRuntime", "120", "Guess: long means at least two hours"]]
			: /feature/i.test(m[0])
				? [
						[
							"minRuntime",
							"60",
							"Guess: feature length means at least one hour",
						],
					]
				: [["maxRuntime", "90", "Guess: short means at most 90 minutes"]],
	)
	scan(
		/\bfor\s+(?:(?:my|the)\s+)?(?:(?:kids?|children)\s+(?:aged?|ages?)|ages?)\s+(\d{1,2})(?:\s*(?:and|&|to|[-–])\s*(\d{1,2}))?\b/gi,
		(m) => {
			const age = Math.min(+m[1], m[2] ? +m[2] : +m[1])
			return age <= 18
				? [["age", String(age), "Youngest named audience age"]]
				: invalidNumeric(
						m,
						"Audience age is outside the 0–18 rating scale; it stays in search text.",
					)
		},
	)
	scan(
		/\b(?:for\s+)?(?:a\s+|my\s+)?(\d{1,2})(?:\s*(?:and|&)\s*(\d{1,2}))?[- ]year[- ]olds?\b/gi,
		(m) => {
			const age = Math.min(+m[1], m[2] ? +m[2] : +m[1])
			return age <= 18
				? [
						[
							"age",
							String(age),
							"Youngest named age; Discover uses the viewer country's ladder",
						],
					]
				: null
		},
	)
	scan(
		/\bage(?: rating| limit)?\s*(of|under|below|at most|<=|≤|<)?\s*(\d{1,2})\b/gi,
		(m) => {
			const age = +m[2] - (/under|below|^<$/.test(m[1] ?? "") ? 1 : 0)
			return age >= 0 && age <= 18
				? [
						[
							"age",
							String(age),
							"Audience age ceiling, resolved on the viewing country's rating ladder",
						],
					]
				: invalidNumeric(
						m,
						"Age ceiling is outside the 0–18 rating scale; it stays in search text.",
					)
		},
	)
	scan(
		/\b(for (?:my |the )?(?:kids|children)|kid[- ]friendly|family[- ]friendly|for the whole family|for preschoolers|for teens)\b/gi,
		(m) => [
			[
				"age",
				/preschool/i.test(m[0]) ? "6" : /teens/i.test(m[0]) ? "16" : "12",
				"Guess: kids/family 12, preschool 6, teens 16; age also sets default content restrictions",
			],
		],
	)
	const contentWords =
		"graphic violence|violence|gore|sexual content|sex|nudity|disturbing (?:content|scenes)|disturbing|swearing|bad language|strong language|drugs"
	scan(
		new RegExp(
			`\\b(no|without|avoid|exclude|nothing|do not allow|don['’]?t allow|not allow|not with|allow|with)\\s+(?:any\\s+)?(?:${contentWords})(?:\\s*(?:,\\s*(?:(?:and|or)\\s+)?|(?:and|or)\\s+)(?:any\\s+)?(?:${contentWords}))*\\b`,
			"gi",
		),
		(m) =>
			[...m[0].matchAll(new RegExp(contentWords, "gi"))].map(
				(content): [string, string, string] => {
					const kind = /violence|gore/i.test(content[0])
						? "violence"
						: /sex|nudity/i.test(content[0])
							? "sex"
							: /disturbing/i.test(content[0])
								? "disturbing"
								: /swearing|language/i.test(content[0])
									? "language"
									: "drugs"
					return [
						/^(?:allow|with)$/i.test(m[1]) ? "ok" : "hide",
						kind,
						"Existing broad content category; gore maps to violence, nudity to sex",
					]
				},
			),
		true,
	)
	scan(
		/\b(no anime|not anime|without anime|exclude anime|avoid anime)\b/gi,
		() => [["anime", "none"]],
		true,
	)
	scan(/\b(anime)\b/gi, () => [["anime", "only"]])
	scan(/\b(movies?|films?|tv shows?|shows?|series)\b/gi, (m) => [
		["type", /movie|film/i.test(m[0]) ? "movie" : "show"],
	])
	scan(
		new RegExp(
			`\\b(on\\s+)?(my services|${providerAliasPattern})(?=$|[\\s,;:.!?])`,
			"gi",
		),
		(m) => {
			const name = m[2].toLowerCase()
			// "Max" alone also names titles and people; require service context for it.
			if (name === "max" && !m[1]) return null
			return [
				[
					"services",
					name === "my services" ? "mine" : providerIds[name],
					"Streaming service; availability depends on viewing country",
				],
			]
		},
	)
	scan(/\b(everywhere|on all services)\b/gi, () => [["services", "all"]])
	scan(
		new RegExp(`\\b(?:or|and)\\s+(${providerAliasPattern})(?=$|[\\s,;])`, "gi"),
		(m) =>
			proposals.some((p) => p.parameter === "services")
				? [
						[
							"services",
							providerIds[m[1].toLowerCase()],
							"Matches any selected provider",
						],
					]
				: null,
	)
	scan(
		/\b(?:available in|streaming in)\s+(germany|united states|usa|uk|united kingdom|france|canada|australia)\b/gi,
		(m) => [
			[
				"streamingCountry",
				(
					{
						germany: "DE",
						"united states": "US",
						usa: "US",
						uk: "GB",
						"united kingdom": "GB",
						france: "FR",
						canada: "CA",
						australia: "AU",
					} as Record<string, string>
				)[m[1].toLowerCase()],
			],
		],
	)
	scan(
		/\b(korean|south korean|japanese|french|german|british|american|indian|italian|spanish)\b/gi,
		(m) => {
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
					(
						{
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
						} as Record<string, string>
					)[m[1].toLowerCase()],
					"Guess: production origin, not spoken language or dubbing",
				],
			]
		},
	)
	scan(
		/\b(?:i (?:have not|haven't) seen|not seen yet|unseen|new to me)\b/gi,
		() => [["unseen", "1"]],
	)
	scan(/\b(?:include seen|include watched)\b/gi, () => [["unseen", "0"]])
	scan(/\bscore\s+(above|over|at least)\s*(\d{1,3})\b/gi, (m) => {
		const score = +m[2] + (/above|over/i.test(m[1]) ? 1 : 0)
		return score <= 100
			? [["score", String(score), "Inclusive GoodWatch score floor"]]
			: invalidNumeric(
					m,
					"Score bound exceeds the 0–100 scale; it stays in search text.",
				)
	})
	scan(
		/\b(?:with\s+)?scores?\s+(under|below|at most|up to)\s+(\d{1,3})\b/gi,
		(m) => {
			const value = +m[2] - (/under|below/i.test(m[1]) ? 1 : 0)
			return value >= 0 && value <= 100
				? [["maxScore", String(value), "Inclusive GoodWatch score ceiling"]]
				: invalidNumeric(
						m,
						"Score bound is outside the 0–100 scale; it stays in search text.",
					)
		},
	)
	scan(
		/\b(?:with\s+)?(?:(?:bad|poor|low)\s+(?:scores?|ratings?)|poorly[- ]rated|low[- ]rated)\b/gi,
		() => [
			[
				"maxScore",
				"50",
				"Guess: bad/poor/low ratings means GoodWatch score at most 50",
			],
		],
	)
	scan(
		/\b(?:with\s+)?(?:good|high|great|excellent)\s+(?:scores?|ratings?)\b/gi,
		(m) => [
			[
				"score",
				/excellent/i.test(m[0]) ? "80" : "70",
				"Guess: good/high/great ratings 70+, excellent 80+",
			],
		],
	)
	scan(/\b(?:taste match (?:above|at least)\s*)(70|80|90)%?/gi, (m) => [
		["match", m[1]],
	])
	// Bare catalog scores are a common shorthand. More specific numeric rules
	// above have already claimed years, decades, ages, runtimes and taste match.
	scan(/\b(at least|at most|above|over|under|below)\s+(\d{1,3})\b/gi, (m) => {
		const maximum = /at most|under|below/i.test(m[1])
		const value =
			+m[2] +
			(/above|over/i.test(m[1]) ? 1 : /under|below/i.test(m[1]) ? -1 : 0)
		return value >= 0 && value <= 100
			? [
					[
						maximum ? "maxScore" : "score",
						String(value),
						"Guess: a comparison without a unit uses the 0–100 GoodWatch score scale",
					],
				]
			: invalidNumeric(
					m,
					"Score comparison is outside the 0–100 scale; add a unit if you meant something else.",
				)
	})
	scan(
		/(?<![\w.+<>=/\-])\b(?:(?:score|rated)\s+)?(100|[1-9]?\d)(?:\+|%)?(?=$|[\s,;!?])/gi,
		(m) =>
			+m[1] === 100 && !/\b(?:score|rated)\b/i.test(m[0])
				? null
				: [
						[
							"score",
							m[1],
							"Guess: a bare number from 0–99, optionally followed by + or %, means minimum GoodWatch score",
						],
					],
	)
	scan(
		/\b(highest rated|best rated|top rated|most popular|popular|newest first|latest first|best matches? for me|for me|for you)\b/gi,
		(m) => [
			[
				"sort",
				/rated/.test(m[0])
					? "top"
					: /popular/.test(m[0])
						? "popular"
						: /newest|latest/.test(m[0])
							? "newest"
							: /match/.test(m[0])
								? "match"
								: "popular",
			],
			...(/for me|for you/.test(m[0])
				? [["foryou", "1"] as [string, string]]
				: []),
		],
	)
	scan(/\b(good|great|excellent|masterpieces?)\b/gi, (m) => [
		[
			"score",
			/excellent|masterpiece/i.test(m[0]) ? "80" : "70",
			"Guess: good/great 70+, excellent/masterpiece 80+",
		],
	])
	scan(
		/\b(?:(?:a bit|much|slightly|even)\s+)?(funnier|scarier|slower|faster|more humorous)\b/gi,
		(m) => {
			const value = (
				{
					funnier: "funny",
					scarier: "scary",
					slower: "slow",
					faster: "fast",
					"more humorous": "funny",
				} as Record<string, string>
			)[m[1].toLowerCase()]
			return [
				[
					value === "slow" || value === "fast" ? "styles" : "moods",
					value,
					`Guess: use the existing ${value} filter. It cannot compare this quality against the reference title.`,
				],
			]
		},
	)
	const aliases: [string, string, string][] = [
		["genres", "Science Fiction", "sci-fi|science fiction"],
		["genres", "Comedy", "comedies|comedy"],
		["genres", "Horror", "horror"],
		["genres", "Drama", "dramas?"],
		["genres", "Romance", "romances?"],
		["genres", "Thriller", "thrillers?"],
		["genres", "Action", "action"],
		["genres", "Adventure", "adventure"],
		["genres", "Fantasy", "fantasy"],
		["genres", "Crime", "crime"],
		["genres", "Mystery", "mystery|mysteries"],
		["genres", "Family", "family"],
		["genres", "War", "war"],
		["genres", "Western", "westerns?"],
		["moods", "funny", "funny|funnier|more humorous|make me laugh|hilarious"],
		["moods", "feelgood", "feel[- ]good|uplifting|comfort(?:ing)?|cozy"],
		["moods", "scary", "scary|scarier|frightening"],
		["moods", "mind", "mind[- ]bending|make me think"],
		["moods", "heavy", "a good cry|melancholic|sad"],
		["moods", "romance", "romantic"],
		["moods", "growing", "coming[- ]of[- ]age"],
		["themes", "war", "about war"],
		["themes", "politics", "political|about politics"],
		["themes", "true", "based on a true story|true stories"],
		["themes", "history", "historical|history"],
		["themes", "sports", "about sports|sports"],
		["themes", "money", "about finance|about money"],
		["themes", "future", "futuristic|about the future"],
		["themes", "showbiz", "about showbiz"],
		["styles", "animated", "animated|animation"],
		["styles", "documentary", "documentaries|documentary"],
		["styles", "slow", "slow[- ]burn|slow[- ]paced|slower"],
		["styles", "fast", "fast[- ]paced|faster"],
		["styles", "talky", "dialogue[- ]heavy|talky"],
		["styles", "nonlinear", "nonlinear|non-linear"],
		["styles", "spectacle", "spectacular|big set pieces"],
		["styles", "stylized", "stylized|stylised"],
		["styles", "music", "musicals?|music[- ]driven"],
		["styles", "graphic", "graphic"],
	]
	// Long phrases before component words ("about war" before "war").
	for (const [parameter, value, pattern] of [...aliases].sort(
		(a, b) => b[2].length - a[2].length,
	))
		scan(new RegExp(`\\b(?:${pattern})\\b`, "gi"), (m) => [
			[
				parameter,
				value,
				/^(funnier|scarier|slower|faster|more humorous)$/i.test(m[0])
					? `Guess: use the existing ${value} filter. It cannot compare this quality against the reference title.`
					: undefined,
			],
		])
	for (const c of concepts)
		scan(
			new RegExp(
				`\\b${c.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
				"gi",
			),
			() => [[c.parameter, c.value]],
		)
	// Rule declaration order must not decide which phrase was "earlier".
	proposals.sort(
		(a, b) =>
			query.toLowerCase().indexOf(a.phrase.toLowerCase()) -
			query.toLowerCase().indexOf(b.phrase.toLowerCase()),
	)
	for (const p of additions) proposals.push({ ...p, status: undefined })
	const positioned = proposals
		.map((p) => ({
			p,
			start: query.toLowerCase().indexOf(p.phrase.toLowerCase()),
		}))
		.filter((item) => item.start >= 0)
		.sort((a, b) => a.start - b.start)
	const unsupportedOrGroups = new Set<string>()
	for (let i = 1; i < positioned.length; i++) {
		const left = positioned[i - 1],
			right = positioned[i]
		const gap = query.slice(left.start + left.p.phrase.length, right.start)
		if (
			/^\s*,?\s*or\s+(?:(?:a|an|the|something|anything)\s*)?$/i.test(gap) &&
			group(left.p.parameter) !== group(right.p.parameter)
		) {
			unsupportedOrGroups.add(group(left.p.parameter))
			unsupportedOrGroups.add(group(right.p.parameter))
		}
	}
	if (unsupportedOrGroups.size) {
		warnings.push(
			"OR between different filter groups is not supported; those clauses remain in search text. Independent filters still apply.",
		)
		for (const p of proposals)
			if (unsupportedOrGroups.has(group(p.parameter))) {
				const start =
					p.entityStart ?? query.toLowerCase().indexOf(p.phrase.toLowerCase())
				const end = p.entityEnd ?? start + p.phrase.length
				if (start >= 0) for (let i = start; i < end; i++) used[i] = false
			}
	}
	if (
		/\b(dubbed|subtitles|oscar|no horror|without horror|not horror)\b/i.test(
			query,
		)
	)
		warnings.push(
			"Some wording has no matching Discover filter today. It remains in search text.",
		)
	if (/\b(set in|takes place in)\b/i.test(query)) {
		// A story's period must not accidentally become its release period.
		warnings.push(
			"Story period is not a release-year filter; keep it in semantic search.",
		)
	}
	const raw = new URLSearchParams(
		existing.includes("?")
			? existing.split("?")[1]
			: existing.replace(/^\?/, ""),
	)
	const legacyBounds: Record<string, [number, number, boolean]> = {
		minYear: [1800, 2100, true],
		maxYear: [1800, 2100, true],
		minRuntime: [0, 10000, true],
		maxRuntime: [0, 10000, true],
		maxScore: [0, 100, false],
	}
	for (const [key, [min, max, integer]] of Object.entries(legacyBounds)) {
		const value = raw.get(key)
		if (value === null) continue
		const trimmed = value.trim(),
			number = Number(trimmed)
		if (
			!/^\d+(?:\.\d+)?$/.test(trimmed) ||
			!Number.isFinite(number) ||
			number < min ||
			number > max ||
			(integer && !Number.isInteger(number))
		) {
			raw.delete(key)
			warnings.push(
				`Ignored invalid existing ${key}; it does not lock that filter group.`,
			)
		} else raw.set(key, String(number))
	}
	const state = filterStateFromParams(raw, defaults)
	const base = filterStateToParams(state, defaults)
	// Keep accepted old bounds in the lab's public result contract. Current
	// Discover also writes canonical ranges; both spellings denote the same range.
	for (const [name, minKey, maxKey] of [
		["years", "minYear", "maxYear"],
		["runtime", "minRuntime", "maxRuntime"],
	] as const) {
		const range = state[name]
		if (!raw.has(name) && range) {
			if (raw.has(minKey) && range.min !== undefined)
				base.set(minKey, String(range.min))
			if (raw.has(maxKey) && range.max !== undefined)
				base.set(maxKey, String(range.max))
		}
	}
	// Only valid existing selections lock a group. Explicit defaults still
	// count, but malformed URL values must not suppress a useful interpretation.
	const defaultValues: Record<string, string[]> = {
		services: ["all", "any"],
		unseen: ["0", "1"],
		type: ["all"],
		anime: ["any"],
		released: ["any"],
		match: ["0"],
		sort: ["popular", "top", "newest", "relevance", "match"],
		foryou: ["0", "1"],
	}
	for (const [key, values] of Object.entries(defaultValues))
		if (values.includes(raw.get(key) ?? "__missing"))
			base.set(key, raw.get(key)!)
	if (/^\d{1,3}$/.test(raw.get("score") ?? "") && +raw.get("score")! <= 100)
		base.set("score", String(+raw.get("score")!))
	for (const key of [...lists, "services"])
		if (raw.get(key) === "") base.set(key, "")
	for (const key of [
		"services",
		"unseen",
		"type",
		"anime",
		"released",
		"score",
		"match",
		"sort",
		"foryou",
		"moods",
		"themes",
		"styles",
		"people",
		"similar",
		"loved",
		"disliked",
		"productionCountries",
		"age",
	]) {
		if (
			raw.has(key) &&
			raw.get(key) !== "" &&
			!base.has(key) &&
			!(key === "type" && raw.get(key) === "anime")
		)
			warnings.push(
				`Ignored invalid existing ${key}; it does not lock that filter group.`,
			)
	}
	const locked = new Set([...base.keys()].map(group))
	const out = new URLSearchParams(base)
	const inferred = new URLSearchParams()
	const contentExisting = new Map<string, string>()
	const explicitKeys = new Set(
		proposals
			.filter((p) => p.source !== "fingerprint read")
			.map(
				(p) =>
					`${p.parameter}${p.parameter === "hide" || p.parameter === "ok" ? `:${p.value}` : ""}`,
			),
	)
	for (const key of ["hide", "ok"])
		for (const kind of (raw.get(key) ?? "").split(",").filter(Boolean))
			contentExisting.set(kind, key)
	for (const p of proposals) {
		if (p.status) continue
		const content = p.parameter === "hide" || p.parameter === "ok"
		const sourceKey = p.parameter === "sources" ? p.value.split(":")[0] : null
		const existingSources = (base.get("sources") ?? "").split(",")
		if (
			content
				? contentExisting.has(p.value)
				: sourceKey
					? existingSources.some((v) => v.startsWith(`${sourceKey}:`))
					: locked.has(group(p.parameter))
		) {
			p.status = "existing wins"
			continue
		}
		if (unsupportedOrGroups.has(group(p.parameter))) {
			p.status = "unsupported cross-filter OR"
			continue
		}
		if (
			p.source === "fingerprint read" &&
			explicitKeys.has(`${p.parameter}${content ? `:${p.value}` : ""}`)
		) {
			p.status = "explicit wording wins"
			continue
		}
		if (
			content &&
			(out.get(p.parameter === "hide" ? "ok" : "hide") ?? "")
				.split(",")
				.includes(p.value)
		) {
			p.status = "earlier content choice wins"
			warnings.push(
				`Conflicting content choices for ${p.value}; the earlier phrase wins.`,
			)
			continue
		}
		if (sourceKey) {
			const prior = (out.get("sources") ?? "").split(",").filter(Boolean)
			if (prior.some((v) => v.startsWith(`${sourceKey}:`))) {
				p.status = "earlier source threshold wins"
				continue
			}
			out.set("sources", [...prior, p.value].join(","))
			p.status = "applied"
			continue
		}
		if (
			[
				"budget",
				"boxOffice",
				"seasons",
				"votes",
				"rank",
				"episodeRuntime",
			].includes(p.parameter) &&
			p.value !== "any"
		) {
			if (!/^\d*(?:\.\d+)?-\d*(?:\.\d+)?$/.test(p.value) || p.value === "-") {
				p.status = "invalid range"
				const start = query.toLowerCase().indexOf(p.phrase.toLowerCase())
				if (start >= 0)
					for (let i = start; i < start + p.phrase.length; i++) used[i] = false
				continue
			}
			const parseRange = (s: string) =>
				s.split("-").map((v) => (v === "" ? undefined : Number(v)))
			const next = parseRange(p.value),
				prior = parseRange(out.get(p.parameter) ?? "-")
			const lo = Math.max(next[0] ?? 0, prior[0] ?? 0),
				hi = Math.min(next[1] ?? Infinity, prior[1] ?? Infinity)
			if (
				lo > hi ||
				!Number.isFinite(lo) ||
				next.some((v) => v !== undefined && v < 0)
			) {
				p.status = "conflicting range"
				warnings.push(`Conflicting ${p.parameter} range; earlier bounds win.`)
				continue
			}
			out.set(
				p.parameter,
				`${next[0] === undefined && prior[0] === undefined ? "" : lo}-${hi === Infinity ? "" : hi}`,
			)
			inferred.set(p.parameter, out.get(p.parameter)!)
			p.status = "applied"
			continue
		}

		if (
			lists.has(p.parameter) ||
			content ||
			(p.parameter === "services" && /^\d+$/.test(p.value))
		) {
			const prior = (out.get(p.parameter) ?? "").split(",").filter(Boolean)
			const max = ["moods", "themes", "styles"].includes(p.parameter) ? 3 : 20
			if (prior.length >= max && !prior.includes(p.value)) {
				p.status = `limit ${max}; left unapplied`
				warnings.push(
					`Only ${max} ${p.parameter} can be applied; ${p.value} was left unapplied.`,
				)
				continue
			}
			if (p.parameter === "services" && prior.some((v) => !/^\d+$/.test(v))) {
				p.status = "earlier service choice wins"
				warnings.push("Conflicting service choices; the earlier phrase wins.")
				continue
			}
			out.set(p.parameter, [...new Set([...prior, p.value])].join(","))
		} else if (
			inferred.has(p.parameter) &&
			inferred.get(p.parameter) !== p.value
		) {
			p.status = "earlier phrase wins"
			warnings.push(
				`Conflicting ${p.parameter} choices; the earlier phrase wins.`,
			)
			continue
		} else out.set(p.parameter, p.value)
		inferred.set(p.parameter, out.get(p.parameter)!)
		p.status = "applied"
	}
	// Resolve entity clauses only when a real lookup supplied the matching proposal.
	for (const e of entities)
		if (
			!e.implicit &&
			!additions.some((p) => resolvesEntity(p, e.parameter, e.name))
		) {
			for (let i = e.start; i < e.end; i++) used[i] = false
			warnings.push(
				`Unresolved ${e.parameter === "people" ? "person" : "title"}: ${e.name}`,
			)
		}
	// Clean connectors at the edges of text left around extracted spans, rather
	// than treating all leftovers as one opaque search phrase. Internal words
	// and quoted titles such as "War and Peace" remain untouched.
	const segments: string[] = []
	for (let start = 0; start < query.length; ) {
		if (used[start]) {
			start++
			continue
		}
		let end = start + 1
		while (end < query.length && !used[end]) end++
		let text = query.slice(start, end).trim()
		if (used.slice(0, start).some(Boolean))
			text = text.replace(
				/^(?:(?:and|or|but|however|except|also|yet|instead)\b[\s,;:]*)+/i,
				"",
			)
		if (used.slice(end).some(Boolean))
			text = text.replace(
				/(?:[\s,;:]*\b(?:and|or|but|however|except|also|yet|instead))+$/i,
				"",
			)
		if (text) {
			const sourceStart = query.indexOf(text, start)
			if (
				sourceStart >= 0 &&
				isNegatedAt(sourceStart) &&
				!/^(?:no|not|without|except|avoid|never|nothing|neither|don['’]?t|do not)\b/i.test(
					text,
				)
			) {
				const consumedNegation = [
					...query
						.slice(0, sourceStart)
						.matchAll(
							/\b(?:no|not|without|except|avoid|never|nothing|neither|don['’]?t)\b/gi,
						),
				].some((m) => used[m.index!])
				if (consumedNegation) text = `not ${text}`
			}
			segments.push(text)
			// Try unresolved plain text as a person name, without requiring "with".
			// Only a confirmed lookup may consume it on the second interpretation.
			const textStart = query.indexOf(text, start)
			const nameText = text
				.split("")
				.map((c, i) =>
					protectedText[textStart + i] ||
					entities.some(
						(e) => e.start <= textStart + i && e.end > textStart + i,
					)
						? "0"
						: c,
				)
				.join("")
			// Unsupported numbers must not block valid names beside them. Keep
			// each name's original span so only the confirmed name is consumed.
			for (const candidate of nameText.matchAll(
				/[\p{L}\p{M}][\p{L}\p{M} .'’\-]*/gu,
			)) {
				const rawName = candidate[0].trim()
				const bareParts = [
					...rawName.matchAll(
						/(?:^|\s+(?:and|or|with)\s+)(.+?)(?=\s+(?:and|or|with)\s+|$)/gi,
					),
				]
				for (const part of bareParts) {
					const name = part[1].trim()
					const nameStart =
						textStart +
						candidate.index! +
						part.index! +
						part[0].indexOf(part[1])
					if (
						textStart >= 0 &&
						!isNegatedAt(nameStart) &&
						name.length <= 100 &&
						name.split(/\s+/).length <= 6 &&
						!/^(?:like|similar|with|for|in|about|no|without|something|anything|not)\b/i.test(
							name,
						) &&
						!entities.some(
							(e) => e.start < nameStart + name.length && e.end > nameStart,
						)
					) {
						entities.push({
							parameter: "people",
							name,
							start: nameStart,
							end: nameStart + name.length,
							implicit: true,
							bare: true,
						})
					}
				}
			}
		}
		start = end
	}
	const remaining = segments.join(" ").replace(/\s+/g, " ").trim()
	const residual = remaining
		.replace(
			/\b(?:not only|no doubt|please|find|show me|something|some|a|an|the|to watch|watch|and|or|but|from|for|on|with|me)\b/gi,
			" ",
		)
		.replace(/[ ,;:.!?]+/g, " ")
		.trim()
		? remaining
		: ""
	if (
		[...query.matchAll(/\b\d{3}\b/g)].some(
			(m) =>
				+m[0] > 100 &&
				!used.slice(m.index!, m.index! + m[0].length).some(Boolean) &&
				!protectedText.slice(m.index!, m.index! + m[0].length).some(Boolean),
		)
	)
		warnings.push(
			"Unparsed number above 100: it is outside the GoodWatch score range. Add a unit to state its meaning.",
		)
	if (
		+out.get("minYear")! > +(out.get("maxYear") ?? "9999") ||
		+out.get("minRuntime")! > +(out.get("maxRuntime") ?? "99999")
	)
		warnings.push(
			"Conflicting range: minimum exceeds maximum. Edit the query before judging results.",
		)
	if (!out.has("services")) out.set("services", "all")
	if (!out.has("unseen")) out.set("unseen", "0")
	const params = new URLSearchParams(out)
	if (residual) params.set("q", residual)
	return {
		query,
		residual,
		// Descriptive wording still needs the fingerprint read even after it
		// becomes a filter. Rejected proposals stay out: manual selections win.
		semanticQuery: [
			...new Set(
				proposals
					.filter(
						(p) =>
							p.status === "applied" &&
							["moods", "themes", "styles", "genres"].includes(p.parameter),
					)
					.map((p) => p.phrase),
			),
			residual,
		]
			.filter(Boolean)
			.join(" ")
			.slice(0, 512),
		proposals,
		entities,
		warnings: [...new Set(warnings)],
		filters: Object.fromEntries(out),
		path: `/discover?${params}`,
		fingerprint: [] as unknown[],
	}
}

// Same want/avoid reading contract as search, using the real fingerprint vocabulary.
export function readQuestions(request: string) {
	const questions: Record<string, unknown> = {}
	for (const key of VALID_FINGERPRINT_KEYS)
		for (const direction of ["want", "avoid"])
			questions[`${direction}:${key}`] = {
				type: "noul",
				instructions: `Does \`request\` ask ${direction === "want" ? "for" : "to avoid"} "${FINGERPRINT_META[key]?.label ?? key}" (${FINGERPRINT_META[key]?.description ?? key})?`,
			}
	for (const c of concepts)
		questions[`filter:${c.parameter}:${c.value}`] = {
			type: "choice",
			instructions: `Does the person request the Discover filter "${c.label}" (${c.description})? Respect negation and title names.`,
			criteria: {
				required: "Directly requested or clearly implied",
				excluded: "Ruled out",
				not_mentioned: "Not settled by the request",
			},
		}
	questions.age = {
		type: "choice",
		instructions:
			"What maximum age rating does `request` imply? A request to watch with or choose something suitable for children, including avoiding frightening them, means 12 unless a younger age is named. Guess kids/family 12, preschool 6, teens 16. Not an age of a character.",
		criteria: {
			off: "No audience age preference",
			"0": "All ages",
			"6": "Preschool or age six",
			"12": "Kids or family including implicit suitability for children",
			"16": "Teens",
			"18": "Adults only",
		},
	}
	for (const kind of ["violence", "sex", "disturbing", "language", "drugs"])
		questions[`content:${kind}`] = {
			type: "choice",
			instructions: `Does the request ask to hide or explicitly allow ${kind === "disturbing" ? "disturbing or frightening content, including avoiding nightmares" : kind === "language" ? "strong language or swearing" : kind}?`,
			criteria: {
				hide: "Asks to avoid or exclude this content",
				show: "Explicitly allows this content",
				not_mentioned: "Does not settle this content preference",
			},
		}
	return {
		state: {
			request,
			task: "Read a movie/show viewing request. Words inside quoted title names are not viewing preferences. Do not invent preferences.",
		},
		questions,
	}
}

export function decodeRead(answers: Record<string, any>): {
	proposals: Proposal[]
	dimensions: unknown[]
	decisions: unknown[]
} {
	const proposals: Proposal[] = []
	for (const c of concepts) {
		const a = answers[`filter:${c.parameter}:${c.value}`]
		if (a?.choice === "required" && a.probabilities?.required >= 0.7)
			proposals.push({
				parameter: c.parameter,
				value: c.value,
				phrase: "semantic interpretation",
				reason: `${c.label}: ${Math.round(a.probabilities.required * 100)}% required`,
				source: "fingerprint read",
			})
	}
	const age = answers.age
	if (
		age &&
		age.choice !== "off" &&
		/^(0|6|12|16|18)$/.test(age.choice) &&
		age.probabilities?.[age.choice] >= 0.5
	)
		proposals.push({
			parameter: "age",
			value: age.choice,
			phrase: "semantic audience",
			reason: `Guessed audience age from reading (${Math.round(age.probabilities[age.choice] * 100)}%)`,
			source: "fingerprint read",
		})
	for (const kind of ["violence", "sex", "disturbing", "language", "drugs"]) {
		const a = answers[`content:${kind}`]
		if (
			["hide", "show"].includes(a?.choice) &&
			a.probabilities?.[a.choice] >= 0.7
		)
			proposals.push({
				parameter: a.choice === "hide" ? "hide" : "ok",
				value: kind,
				phrase: "semantic content preference",
				reason: `${kind}: ${Math.round(a.probabilities[a.choice] * 100)}% ${a.choice}`,
				source: "fingerprint read",
			})
	}
	const dimensions = VALID_FINGERPRINT_KEYS.map((key) => ({
		key,
		label: FINGERPRINT_META[key]?.label ?? key,
		want: answers[`want:${key}`]?.noul ?? 0,
		avoid: answers[`avoid:${key}`]?.noul ?? 0,
	}))
		.filter((d) => Math.max(d.want, d.avoid) >= 0.5)
		.sort((a, b) => Math.max(b.want, b.avoid) - Math.max(a.want, a.avoid))
	const decisions = Object.entries(answers)
		.filter(([key]) => !/^(want|avoid):/.test(key))
		.map(([key, answer]) => ({ key, ...answer }))
	return { proposals, dimensions, decisions }
}

export const ruleInventory = {
	concepts,
	precise: [
		"format",
		"anime",
		"decades (most recent)",
		"release year/range",
		"relative years",
		"runtime",
		"audience age",
		"content restrictions",
		"services",
		"viewing country",
		"production country",
		"seen",
		"score",
		"taste match",
		"sort",
		"personalization",
		"people",
		"similar titles",
		"loved/disliked titles",
		"budget and box office ranges / hits and flops",
		"season counts / show status / episode runtime",
		"rating counts / popularity rank",
		"source-specific score thresholds / critics versus audiences",
		"seen-only / wishlist",
		"all-of tags / any streaming service",
		"rating country / rest-of-world production",
		"relevance sorting / personalization off",
	],
	notInScope: ["total viewing hours", "taste exploration"],
	unsupported: [
		"spoken language/dubs/subtitles",
		"awards",
		"negative genres",
		"cast versus crew role",
		"story period as release year",
	],
}
