// PROTOTYPE (Discover lab, round 22): numbers and values in the header search. The text is read as a value only when
// it parses as one (a year, a decade, a span of years, a length, hours to finish, money, an age or a rating, a score
// or seasons), and each reading becomes a "want": what it would set, in plain words, with how likely it is meant.
// hits.tsx turns wants into results that set the same state the tab uses. Pure, no React.
import { LEN_MAX } from "../sections/length/parts"
import { YEAR_MIN, decadeRange, yearMax } from "../sections/released/parts"

export type Want =
	| { kind: "years"; range: [number, number]; label: string; score: number }
	/** An age for the rating ladder: the nearest step (ties go to the lower one). */
	| { kind: "age"; age: number; score: number }
	/** A rating's name ("pg13", "tvma", "fsk16"), compared with the ladder's own labels first. */
	| { kind: "rating"; code: string; age: number | null; score: number }
	| { kind: "seasons"; n: number; mode: "min" | "max" | "one"; score: number }
	| { kind: "length"; who: "movie" | "show"; range: [number, number]; label: string; score: number }
	| { kind: "finish"; hours: number; mode: "min" | "max"; score: number }
	| { kind: "money"; what: "budget" | "revenue"; dollars: number; mode: "min" | "max"; score: number }
	/** A minimum score on 0 to 100; `scale` says how it was typed (80, 80%, 8.0). */
	| { kind: "score"; v: number; scale: "plain" | "pct" | "ten"; score: number }

/** Common rating names and the ages they stand for (US ages as the US ladder has them). */
const RATING_AGES: Record<string, number> = {
	g: 0,
	pg: 8,
	pg13: 14,
	r: 17,
	nc17: 18,
	tvy: 0,
	tvy7: 7,
	tvg: 0,
	tvpg: 8,
	tv14: 14,
	tvma: 17,
	u: 0,
	"12a": 12,
	"15": 15,
}
/** Rating systems written as a prefix and an age: "fsk 16", "usk 12", "ab 12", "pegi 16". */
const AGE_PREFIX = /^(?:fsk|usk|ab|age|ages|pegi|bbfc|kijkwijzer|rated|for)\s*(\d{1,2})\s*\+?$/

const LESS = "under|less than|below|shorter than|cheaper than|max|at most|up to|<"
const MORE = "over|more than|above|longer than|at least|min|>"
const ABOUT = "about|around|~"
const cmpOf = (w: string | undefined): "lt" | "gt" | "about" | null => {
	if (!w) return null
	if (new RegExp(`^(?:${LESS})$`).test(w)) return "lt"
	if (new RegExp(`^(?:${MORE})$`).test(w)) return "gt"
	if (new RegExp(`^(?:${ABOUT})$`).test(w)) return "about"
	return null
}
const CMP = `(${LESS}|${MORE}|${ABOUT})?\\s*`

const okYear = (y: number) => y >= YEAR_MIN && y <= yearMax()

/** "1990s" style label for a decade start. */
const decadeLabel = (start: number) => `The ${start}s`

/** Minutes in words: "90 min", "2 h", "2 h 30". */
export const minutes = (m: number) => (m < 120 && m % 60 !== 0 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60}`)

function yearWants(q: string): Want[] {
	const now = yearMax()
	// A span: "1990-1999", "1990 to 1999", "1990-99", "between 1990 and 1999".
	let m = q.match(/^(?:from |between )?(\d{4})\s*(?:-|–|to|until|till|through|thru|and)\s*(\d{2}|\d{4})s?$/)
	if (m) {
		const a = Number(m[1])
		let b = Number(m[2])
		if (m[2].length === 2) {
			b = Math.floor(a / 100) * 100 + b
			if (b < a) b += 100
		}
		const lo = Math.min(a, b)
		const hi = Math.min(Math.max(a, b), now)
		if (!okYear(lo) || lo > now) return []
		const label = lo % 10 === 0 && hi === Math.min(lo + 9, now) ? decadeLabel(lo) : `Released ${lo} to ${hi}`
		return [{ kind: "years", range: [lo, hi], label, score: 99 }]
	}
	// A decade: "1990s", "90s", "'90s" (the apostrophe is gone by now), "the 90s", "early 90s".
	m = q.match(/^(?:the )?(early |mid |late )?(\d{2})?(\d)0s$/)
	if (m) {
		const d = Number(m[3])
		const start = m[2] ? Number(m[2]) * 100 + d * 10 : d <= 2 ? 2000 + d * 10 : 1900 + d * 10
		if (!okYear(start)) return []
		const [lo, hi] = decadeRange(start)
		const part = m[1]?.trim()
		if (part === "early") return [{ kind: "years", range: [lo, Math.min(lo + 3, now)], label: `Early ${start}s`, score: 99 }]
		if (part === "mid") return [{ kind: "years", range: [lo + 3, Math.min(lo + 6, now)], label: `Mid ${start}s`, score: 99 }]
		if (part === "late") return [{ kind: "years", range: [Math.min(lo + 6, now), hi], label: `Late ${start}s`, score: 99 }]
		return [{ kind: "years", range: [lo, hi], label: decadeLabel(start), score: 99 }]
	}
	// One year, with or without a word before it.
	m = q.match(/^(from|since|after|post|before|pre|until|till|up to|to|in|released|released in|year|made in)?\s*(\d{4})$/)
	if (!m) return []
	const y = Number(m[2])
	if (!okYear(y)) return []
	const w = m[1]
	const decade = Math.floor(y / 10) * 10
	const one: Want = { kind: "years", range: [y, y], label: `Released in ${y}`, score: 98 }
	const from: Want = { kind: "years", range: [y, now], label: `From ${y}`, score: 97 }
	const upTo: Want = { kind: "years", range: [YEAR_MIN, y], label: `Up to ${y}`, score: 96 }
	const dec: Want = { kind: "years", range: decadeRange(decade), label: decadeLabel(decade), score: 95 }
	if (w === "from" || w === "since") return y < now ? [{ ...from, score: 99 }] : [one]
	if (w === "after" || w === "post") return y < now ? [{ kind: "years", range: [y + 1, now], label: `After ${y}`, score: 99 }] : []
	if (w === "before" || w === "pre") return y > YEAR_MIN ? [{ kind: "years", range: [YEAR_MIN, y - 1], label: `Before ${y}`, score: 99 }] : []
	if (w === "until" || w === "till" || w === "up to" || w === "to") return [{ ...upTo, score: 99 }]
	if (w) return [{ ...one, score: 99 }, dec]
	return [one, ...(y < now ? [from] : []), upTo, dec]
}

/** Movie and episode lengths for a span in minutes, as Length d writes them (movies from 60 min, episodes up to 60). */
function lengthWants(mins: number, cmp: "lt" | "gt" | "about" | null): Want[] {
	if (mins < 10 || mins > LEN_MAX) return []
	const out: Want[] = []
	const kinds: ("movie" | "show")[] = mins <= 50 ? ["show"] : mins < 60 ? ["show", "movie"] : mins === 60 ? ["movie", "show"] : ["movie"]
	let s = 97
	for (const who of kinds) {
		const word = who === "movie" ? "Movies" : "Episodes"
		const lt: Want = { kind: "length", who, range: [0, mins], label: `${word} under ${minutes(mins)}`, score: s }
		const gt: Want = { kind: "length", who, range: [mins, LEN_MAX], label: `${word} ${minutes(mins)} or more`, score: s - 0.5 }
		const lo = Math.max(0, mins - 10)
		const about: Want = { kind: "length", who, range: [lo, Math.min(mins + 10, LEN_MAX)], label: `${word} about ${minutes(mins)}`, score: s }
		if (cmp === "lt") out.push(lt)
		else if (cmp === "gt") out.push(mins < LEN_MAX ? gt : { ...gt, label: `${word} ${minutes(mins)} or more` })
		else if (cmp === "about") out.push(about)
		else out.push(lt, ...(mins < LEN_MAX ? [gt] : []))
		s -= 2
	}
	return out
}

function durationWants(q: string): Want[] {
	// "90 min", "2h", "2 h 30", "2h30m", "under 90 min", "100h", "over 2 hours".
	const m = q.match(
		new RegExp(`^${CMP}(\\d+(?:[.,]\\d+)?)\\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)(?:\\s*(\\d{1,2})\\s*(?:m|min|mins)?)?\\s*(\\+)?$`),
	)
	if (m) {
		const cmp = m[5] ? "gt" : cmpOf(m[1])
		const n = Number(m[2].replace(",", "."))
		const hours = m[3].startsWith("h")
		const mins = Math.round(hours ? n * 60 + Number(m[4] ?? 0) : n)
		// More than four hours is a show's time to finish; "300m" without a $ is left to the money reading.
		if (hours && mins > LEN_MAX) return finishWants(mins / 60, cmp === "lt" ? "lt" : cmp === "gt" ? "gt" : null)
		if (!hours && mins > LEN_MAX) return []
		return lengthWants(mins, cmp)
	}
	// A comparison with a bare number: "under 90", "over 120". Years go to yearWants.
	const b = q.match(new RegExp(`^(${LESS}|${MORE}|${ABOUT})\\s*(\\d{2,3})$`))
	if (b) {
		const cmp = cmpOf(b[1])
		const n = Number(b[2])
		const out = n >= 20 ? lengthWants(n, cmp) : []
		// "over 80", "at least 75": also a minimum score.
		if (cmp === "gt" && n >= 50 && n <= 99) out.unshift({ kind: "score", v: n, scale: "plain", score: 98 })
		return out
	}
	return []
}

function finishWants(hours: number, cmp: "lt" | "gt" | null): Want[] {
	const lt: Want = { kind: "finish", hours, mode: "max", score: 97 }
	const gt: Want = { kind: "finish", hours, mode: "min", score: 96.5 }
	return cmp === "lt" ? [lt] : cmp === "gt" ? [gt] : [lt, gt]
}

const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, millions: 1e6, b: 1e9, bn: 1e9, billion: 1e9, billions: 1e9 }
const MONEY_WORD = /^(budget|box office|boxoffice|revenue|gross|grossing|grossed|made)$/

function moneyWants(q: string): Want[] {
	// A money word may lead or trail: "budget 100m", "$1b box office", "100 million budget", "under $5m".
	let what: "budget" | "revenue" | null = null
	let t = q
	const lead = t.match(/^(budget|box office|boxoffice|revenue|gross|grossing|grossed|made)\s+(.*)$/)
	if (lead) {
		what = lead[1] === "budget" ? "budget" : "revenue"
		t = lead[2]
	}
	const m = t.match(
		new RegExp(`^${CMP}(\\$|usd\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(k|thousand|m|mn|mil|million|millions|b|bn|billion|billions)?\\s*(\\+)?\\s*(budget|box office|boxoffice|revenue|gross|grossing|grossed)?$`),
	)
	if (!m) return []
	const [, w, dollar, num, unit, plus, word] = m
	if (word) what = word === "budget" ? "budget" : "revenue"
	// "100m" alone is minutes (durationWants); past four hours of minutes it is millions.
	const money = Boolean(dollar) || Boolean(what) || (unit && unit !== "m") || (unit === "m" && Number(num) > LEN_MAX)
	if (!money) return []
	const dollars = Number(num.replace(",", ".")) * (unit ? MULT[unit] : 1)
	if (dollars < 1e5) return []
	const cmp = plus ? "gt" : cmpOf(w)
	const mode = cmp === "lt" ? "max" : "min"
	const kinds: ("budget" | "revenue")[] = what ? [what] : dollars > 3e8 ? ["revenue", "budget"] : ["budget", "revenue"]
	return kinds.map((k, i) => ({ kind: "money", what: k, dollars, mode, score: 97 - i }))
}

function ageWants(q: string): Want[] {
	const p = q.match(AGE_PREFIX)
	if (p) return [{ kind: "age", age: Number(p[1]), score: 99 }]
	const code = q.replace(/[^a-z0-9]/g, "")
	if (!code || /^\d+$/.test(code)) return []
	// Letters or letters with digits: compared with the ladder's labels in hits.tsx, the table as a fallback.
	if (code.length > 5) return []
	return [{ kind: "rating", code, age: RATING_AGES[code] ?? null, score: 99 }]
}

function numberWants(q: string): Want[] {
	// "8.0", "7.5+": a ten-point score (IMDb, Metacritic users).
	const dec = q.match(/^(\d)[.,](\d)\s*\+?$/)
	if (dec) return [{ kind: "score", v: Number(dec[1]) * 10 + Number(dec[2]), scale: "ten", score: 97 }]
	// "8 seasons", "3+ seasons", "over 5 seasons", "up to 3 seasons", "one season".
	const sw = q.match(new RegExp(`^(${LESS}|${MORE})?\\s*(\\d{1,2}|one)\\s*(\\+)?\\s*(?:seasons?|series)$`))
	if (sw) {
		const n = sw[2] === "one" ? 1 : Number(sw[2])
		const cmp = sw[3] ? "gt" : cmpOf(sw[1])
		if (n === 1 && cmp !== "gt") return [{ kind: "seasons", n, mode: "one", score: 99 }]
		return cmp === "lt" ? [{ kind: "seasons", n, mode: "max", score: 99 }] : [{ kind: "seasons", n, mode: "min", score: 99 }]
	}
	const m = q.match(/^(\d{1,3})\s*(\+|%)?$/)
	if (!m) return []
	const n = Number(m[1])
	const sign = m[2]
	if (sign === "%") return n >= 50 && n <= 100 ? [{ kind: "score", v: n, scale: "pct", score: 98 }] : []
	const out: Want[] = []
	// A small number: an age rating first ("12" is FSK 12 or the PG-13 step), then seasons where it fits a step.
	if (n <= 21) {
		out.push({ kind: "age", age: n, score: sign ? 98 : 96 })
		if (n >= 2) out.push({ kind: "seasons", n, mode: "min", score: 88 })
		else if (n === 1) out.push({ kind: "seasons", n, mode: "one", score: 88 })
	}
	// 50 to 100: a minimum score.
	if (n >= 50 && n <= 100) out.push({ kind: "score", v: n, scale: "plain", score: 95 })
	// Round movie lengths: 45, 60, 90, 105, 120, 150, 180, 240 and other multiples of 10 from 100.
	if (!sign && ((n % 15 === 0 && n >= 45) || (n % 10 === 0 && n >= 100)) && n <= LEN_MAX)
		out.push(...lengthWants(n, "lt").map((w) => ({ ...w, score: w.score - 15 })))
	return out
}

/** Every reading of the text as a value; empty when it isn't one. */
export function parseValues(q: string): Want[] {
	const t = q.replace(/[‘`´]/g, "").trim()
	if (!t || !(/\d/.test(t) || /^[a-z]{1,4}(?:[-\s][a-z0-9]{1,3})?$/.test(t))) return []
	const years = yearWants(t)
	if (years.length) return years
	const dur = durationWants(t)
	if (dur.length) return dur
	const money = moneyWants(t)
	if (money.length) return money
	const num = numberWants(t)
	if (num.length) return num
	return ageWants(t)
}
