// Answers for the detail page's questions section. They cover facts that the
// rest of the page doesn't state in words (where to stream legally, reception,
// age rating, length, source, box office, languages, tropes) and leave how a
// title feels to the fingerprint.

import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { list } from "~/ui/fingerprint/fingerprintText"
import { seededRandomFromString } from "~/utils/random"

const regionName = (code: string) => {
	try {
		return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code
	} catch {
		return code
	}
}

// JustWatch lists add-on channels as separate services; keep the main brands.
const isChannel = (name: string) => /channel/i.test(name)
const cleanName = (name: string) => name.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "").replace(/\s+(Essential|Premium)$/i, "").replace(/\s+Plus$/i, "+").replace(/\s+Plus\b/i, "+")

function streamingAnswer(media: MovieResult | ShowResult, country: string) {
	const T = media.details.title
	const where = country ? `in ${regionName(country) === "United States" ? "the United States" : regionName(country)}` : "in your country"
	const names = new Map(media.streaming_services.map((s) => [s.tmdb_id, s.name]))
	const order = new Map(media.streaming_services.map((s) => [s.tmdb_id, s.order_default]))
	const byType = (types: string[]) => [
		...new Set(
			media.streaming_availabilities
				.filter((a) => types.includes(a.streaming_type))
				.sort((a, b) => (order.get(a.streaming_service_id) ?? 999) - (order.get(b.streaming_service_id) ?? 999))
				.map((a) => names.get(a.streaming_service_id))
				.filter((n): n is string => !!n && !isChannel(n))
				.map(cleanName),
		),
	]
	const subs = byType(["flatrate", "flatrate_and_buy"]).slice(0, 4)
	const free = byType(["free", "ads"]).slice(0, 3)
	const buy = byType(["rent", "buy"]).slice(0, 4)
	if (!subs.length && !free.length && !buy.length)
		return `GoodWatch doesn't know of a legal streaming option for ${T} ${where} right now. Pick another country in the Where to Watch section to check elsewhere.`
	const parts: string[] = []
	if (subs.length) parts.push(`${T} is included with a subscription to ${list(subs)} ${where}.`)
	if (free.length) parts.push(`You can watch it free with ads on ${list(free)}.`)
	if (buy.length) parts.push(`${subs.length || free.length ? "You can also" : "You can"} rent or buy it from ${list(buy)}.`)
	parts.push("All links in Where to Watch go to these licensed services.")
	return parts.join(" ")
}

function receptionAnswer(media: MovieResult | ShowResult) {
	const d = media.details
	const gw = d.goodwatch_overall_score_normalized_percent
	if (gw == null) return null
	const score = Math.round(gw)
	const others = [
		d.imdb_user_score_original != null ? `IMDb ${d.imdb_user_score_original}` : "",
		d.rotten_tomatoes_tomato_score_original != null ? `Rotten Tomatoes ${d.rotten_tomatoes_tomato_score_original}%` : "",
		d.metacritic_meta_score_original != null ? `Metacritic ${d.metacritic_meta_score_original}` : "",
	].filter(Boolean)
	const verdict =
		score >= 80 ? "Yes. It's widely acclaimed" : score >= 65 ? "Mostly. It's well received" : score >= 50 ? "Opinions are mixed" : "Reviews are weak"
	return `${verdict}, with a GoodWatch score of ${score}/100${others.length ? ` (${list(others)})` : ""}. The GoodWatch score combines critic and audience ratings.`
}

export function ageInfo(media: MovieResult | ShowResult, country: string) {
	const certs = media.details.age_certifications ?? []
	const find = (cc: string) => certs.find((c) => c.startsWith(`${cc}_`))?.split("_")[1]
	const cc = find(country) ? country : "US"
	const cert = find(cc)
	const advisories = ((media.details as unknown as { content_advisories?: string[] }).content_advisories ?? []).map((a) => a.toLowerCase())
	return { cc, cert, advisories }
}

function ageAnswer(media: MovieResult | ShowResult, country: string) {
	const { cc, cert, advisories } = ageInfo(media, country)
	if (!cert && !advisories.length) return null
	const parts: string[] = []
	if (cert) parts.push(`It's rated ${cert} in ${cc === "US" ? "the United States" : regionName(cc)}.`)
	if (advisories.length) parts.push(`Content advisories: ${list(advisories)}.`)
	return parts.join(" ")
}

function lengthAnswer(media: MovieResult | ShowResult) {
	const d = media.details as unknown as Record<string, unknown>
	if (media.mediaType === "movie") {
		const rt = d.runtime as number | null
		if (!rt) return null
		return `${media.details.title} runs ${Math.floor(rt / 60)} h ${rt % 60} min.`
	}
	const seasons = d.number_of_seasons as number
	const eps = d.number_of_episodes as number
	const ep = (d.episode_run_time as number[])?.[0]
	if (!seasons) return null
	const running = d.in_production ? " and is still in production" : ""
	return `It has ${seasons} season${seasons === 1 ? "" : "s"} with ${eps} episodes${ep ? ` of about ${ep} minutes each` : ""}${running}.`
}

function sourceAnswer(media: MovieResult | ShowResult) {
	const kw = media.details.keywords ?? []
	const bio = media.fingerprint?.scores.biographical ?? 0
	if (kw.includes("based on true story") || bio >= 7) return "Yes. It's based on real events or a real person's life."
	if (kw.includes("based on novel or book")) return "No. It's adapted from a novel."
	if (kw.includes("based on comic")) return "No. It's adapted from a comic."
	if (kw.includes("based on video game")) return "No. It's adapted from a video game."
	return null
}

export interface TitleQuestion {
	id: QuestionId
	q: string
	a: string
}

export type QuestionId = "stream" | "worth" | "rated" | "length" | "source" | "agree" | "boxoffice" | "tropes" | "language" | "countries" | "aired"

const langName = (code: string) => {
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code
	} catch {
		return code
	}
}

// Critics vs audiences on the same 0-100 scale.
export function agreement(media: MovieResult | ShowResult) {
	const d = media.details
	const avg = (xs: (number | null | undefined)[]) => {
		const v = xs.filter((x): x is number => typeof x === "number" && x > 0)
		return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
	}
	const critics = avg([d.rotten_tomatoes_tomato_score_original, d.metacritic_meta_score_original])
	const audience = avg([
		d.rotten_tomatoes_audience_score_original,
		d.metacritic_user_score_original ? d.metacritic_user_score_original * 10 : null,
		d.imdb_user_score_original ? d.imdb_user_score_original * 10 : null,
	])
	return { critics, audience }
}

function agreeAnswer(media: MovieResult | ShowResult) {
	const { critics, audience } = agreement(media)
	if (critics == null || audience == null) return null
	const gap = critics - audience
	const T = media.details.title
	if (Math.abs(gap) <= 7) return `Yes. Critics average ${critics} and audiences ${audience} out of 100, so both groups see ${T} much the same way.`
	return gap > 0
		? `Not quite. Critics rate ${T} higher (${critics}) than audiences (${audience}). It may be more rewarding than it is crowd-pleasing.`
		: `Not quite. Audiences rate ${T} higher (${audience}) than critics (${critics}). It's more of a crowd-pleaser than a critics' pick.`
}

export const money = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)} billion` : n >= 1e6 ? `$${Math.round(n / 1e6)} million` : `$${n.toLocaleString("en-US")}`)

function boxOfficeAnswer(media: MovieResult | ShowResult) {
	const { budget, revenue } = media.details
	if (media.mediaType !== "movie" || !budget || !revenue || budget < 10000 || revenue < 10000) return null
	const x = revenue / budget
	const verdict = x >= 5 ? "Yes, a big one" : x >= 2 ? "Yes" : x >= 1 ? "Roughly broke even" : "No"
	return `${verdict}. It cost about ${money(budget)} to make and earned ${money(revenue)} worldwide, ${x >= 1 ? `${x.toFixed(1)} times its budget` : `${Math.round(x * 100)}% of its budget`}.`
}

// Some titles list their signature tropes first, then the rest A to Z. Keep
// that leading run and fill up with a stable sample from the alphabetical
// rest, so the chips don't all start with "A". Seeded, so SSR and client match.
// A page payload carries only the featured tropes, already in this order.
export function featuredTropes(media: MovieResult | ShowResult, n = FEATURED_TROPES) {
	const tropes = media.details.tropes ?? []
	if (media.details.tropes_count !== undefined) return tropes.slice(0, n)
	let start = tropes.length - 1
	while (start > 0 && tropes[start - 1].localeCompare(tropes[start]) <= 0) start--
	// A real signature run is short; a long "lead" means the A-to-Z check broke early.
	if (start > 10) start = 0
	const lead = tropes.slice(0, start)
	const rest = tropes
		.slice(start)
		.map((tr) => ({ tr, k: seededRandomFromString(`${media.details.tmdb_id}:${tr}`) }))
		.sort((a, b) => a.k - b.k)
		.map((x) => x.tr)
	return [...lead, ...rest].slice(0, n)
}

/** How many trope chips the questions section shows. */
export const FEATURED_TROPES = 12

/** How many tropes TV Tropes lists for the title, also when the payload carries only the featured ones. */
export const tropeCount = (media: MovieResult | ShowResult) => media.details.tropes_count ?? media.details.tropes?.length ?? 0

function tropesAnswer(media: MovieResult | ShowResult) {
	const count = tropeCount(media)
	if (count < 3) return null
	return `TV Tropes lists ${count} storytelling tropes for ${media.details.title}, including ${featuredTropes(media, 3).join(", ")}.`
}

function languageAnswer(media: MovieResult | ShowResult) {
	const d = media.details
	if (!d.original_language_code) return null
	const others = (d.spoken_language_codes ?? []).filter((c) => c !== d.original_language_code).map(langName)
	const made = (d.production_country_codes ?? []).map(regionName)
	return `It was made in ${langName(d.original_language_code)}${others.length ? `, with some ${others.join(", ")}` : ""}.${made.length ? ` Produced in ${made.join(", ")}.` : ""}`
}

function countriesAnswer(media: MovieResult | ShowResult) {
	const n = media.details.streaming_country_codes?.length ?? 0
	if (n < 2) return null
	return `GoodWatch finds legal streaming, rental, or purchase options for ${media.details.title} in ${n} countries. Pick any of them in Where to Watch to see the local services.`
}

function airedAnswer(media: MovieResult | ShowResult) {
	if (media.mediaType !== "show") return null
	const d = media.details as unknown as { first_air_date?: string | number; last_air_date?: string | number; in_production?: boolean }
	const y = (v?: string | number) => (v ? new Date(v).getUTCFullYear() : null)
	const from = y(d.first_air_date)
	const to = y(d.last_air_date)
	if (!from) return null
	return d.in_production ? `It started in ${from} and is still in production.` : `It ran from ${from} to ${to ?? from} and has ended.`
}

export function titleQuestions(media: MovieResult | ShowResult, country: string): TitleQuestion[] {
	const T = media.details.title
	const rows: [QuestionId, string, string | null][] = [
		["stream", `Where can I stream ${T} legally?`, streamingAnswer(media, country)],
		["worth", `Is ${T} worth watching?`, receptionAnswer(media)],
		["rated", `What is ${T} rated?`, ageAnswer(media, country)],
		["length", media.mediaType === "movie" ? `How long is ${T}?` : `How many seasons does ${T} have?`, lengthAnswer(media)],
		["source", `Is ${T} based on a true story?`, sourceAnswer(media)],
		["agree", `Do critics and audiences agree on ${T}?`, agreeAnswer(media)],
		["boxoffice", `Was ${T} a box office hit?`, boxOfficeAnswer(media)],
		["aired", `When did ${T} air?`, airedAnswer(media)],
		["language", `What language is ${T} in?`, languageAnswer(media)],
		["countries", `In how many countries can I watch ${T}?`, countriesAnswer(media)],
		["tropes", `What tropes does ${T} use?`, tropesAnswer(media)],
	]
	return rows.filter((r): r is [QuestionId, string, string] => !!r[2]).map(([id, q, a]) => ({ id, q, a }))
}
