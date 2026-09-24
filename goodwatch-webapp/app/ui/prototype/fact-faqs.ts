// PROTOTYPE - throwaway. Questions for the bottom of the detail page. They
// cover facts (where to stream legally, reception, age rating, length, source)
// and leave everything about how a title feels to the fingerprint card.

import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { list, type Faq } from "~/ui/prototype/fingerprint-text"

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

export type FaqId = "stream" | "worth" | "rated" | "length" | "source"

export function factFaqs(media: MovieResult | ShowResult, country: string): (Faq & { id: FaqId })[] {
	const T = media.details.title
	const rows: [FaqId, string, string | null][] = [
		["stream", `Where can I stream ${T} legally?`, streamingAnswer(media, country)],
		["worth", `Is ${T} worth watching?`, receptionAnswer(media)],
		["rated", `What is ${T} rated?`, ageAnswer(media, country)],
		["length", media.mediaType === "movie" ? `How long is ${T}?` : `How many seasons does ${T} have?`, lengthAnswer(media)],
		["source", `Is ${T} based on a true story?`, sourceAnswer(media)],
	]
	return rows.filter((r): r is [FaqId, string, string] => !!r[2]).map(([id, q, a]) => ({ id, q, a }))
}
