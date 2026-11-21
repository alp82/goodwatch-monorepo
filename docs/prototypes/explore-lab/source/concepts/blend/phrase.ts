// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). A blend said the way a person would say it, as
// segments: plain words and ingredient tokens. The same order as the kit's `blendName` (kit/words.ts), so the headline
// reads like the page's name; here every ingredient stays a separate piece the headline can make interactive.
// Pure: loader and browser.
import type { Kind } from "../../kit/address"
import type { PlaceRef } from "../../kit/types"
import { demonym } from "../../kit/words"

export type Seg =
	| { t: "text"; text: string }
	| { t: "part"; part: PlaceRef; text: string }
	| { t: "best"; text: string }
	| { t: "year"; year: number; text: string }

const GENRE_PLURAL: Record<string, string> = {
	comedy: "comedies",
	drama: "dramas",
	thriller: "thrillers",
	western: "westerns",
	documentary: "documentaries",
	mystery: "mysteries",
	romance: "romances",
}
const GENRE_ADJ: Record<string, string> = {
	animation: "animated",
	"science-fiction": "sci-fi",
	"sci-fi-fantasy": "sci-fi & fantasy",
	"action-adventure": "action & adventure",
	"war-politics": "war & politics",
	"tv-movie": "TV",
}
/** Moods that read better behind the noun: the lead-in word and the token's own words. */
const MOOD_AFTER: Record<string, [string, string]> = {
	"crime-mystery": ["with", "a mystery to crack"],
	"other-worlds": ["set in", "other worlds"],
	history: ["about", "real history"],
	"coming-of-age": ["about", "growing up"],
}
const STYLE_ADJ: Record<string, string> = {
	spectacle: "big-spectacle",
	music: "music-driven",
}

const text = (s: string): Seg => ({ t: "text", text: s })
const tok = (part: PlaceRef, s: string): Seg => ({ t: "part", part, text: s })

/** "a", "a and b", "a, b and c" as segments. */
function listed(items: Seg[]): Seg[] {
	const out: Seg[] = []
	items.forEach((item, i) => {
		if (i > 0) {
			if (i === items.length - 1) out.push(text("and"))
			else {
				const prev = out[out.length - 1]
				prev.text = `${prev.text},`
			}
		}
		out.push({ ...item })
	})
	return out
}

/**
 * The blend as a phrase: "Cozy comedies from the 1990s on Netflix", "Dark and funny animated Korean thrillers",
 * "Best cozy movies of 2026". The first word is capitalized; proper names keep their capitals.
 */
export function phrase(
	kind: Kind,
	parts: PlaceRef[],
	opts: { best?: boolean; year?: number } = {},
): Seg[] {
	const noun = kind === "all" ? "movies and shows" : kind === "show" ? "shows" : "movies"
	const by = (f: PlaceRef["family"]) => parts.filter((p) => p.family === f)
	const feel: Seg[] = []
	const made: Seg[] = []
	const from: Seg[] = []
	const after: Seg[] = []
	for (const m of by("mood")) {
		const behind = MOOD_AFTER[m.slug]
		if (behind) after.push(text(behind[0]), tok(m, behind[1]))
		else feel.push(tok(m, m.label.toLowerCase()))
	}
	for (const t of by("trait")) feel.push(tok(t, (t.adj ?? t.label).toLowerCase()))
	for (const s of by("style")) made.push(tok(s, STYLE_ADJ[s.slug] ?? s.label.toLowerCase()))
	for (const c of by("country")) {
		const d = demonym(c.code)
		if (d) from.push(tok(c, d))
		else after.push(text("from"), tok(c, c.label.replace(/ SAR China$/, "")))
	}
	const genres = by("genre")
	const head: Seg[] = []
	if (genres.length === 1 && GENRE_PLURAL[genres[0].slug] && kind !== "show")
		head.push(tok(genres[0], GENRE_PLURAL[genres[0].slug]))
	else if (genres.length)
		head.push(
			...listed(genres.map((g) => tok(g, GENRE_ADJ[g.slug] ?? g.label.toLowerCase()))),
			text(noun),
		)
	else head.push(text(noun))
	for (const t of by("theme")) after.push(text("about"), tok(t, t.label.toLowerCase()))
	// Round 7: tropes blend too. "with a final girl": the small words stay text, the trope's own words are the token.
	for (const t of by("trope")) {
		const say = t.say ?? `with ${t.label}`
		const lead = /^(with(?: an?| the)?|where|about)\s+/i.exec(say)?.[0] ?? ""
		if (lead) after.push(text(lead.trim()))
		after.push(tok(t, say.slice(lead.length)))
	}
	const decades = by("decade")
	decades.forEach((d, i) => {
		after.push(text(i === 0 ? "from the" : "and the"), tok(d, d.label))
	})
	by("service").forEach((s, i) => {
		after.push(text(i === 0 ? "on" : "and"), tok(s, s.label))
	})
	if (opts.year)
		after.push(text("of"), {
			t: "year",
			year: opts.year,
			text: String(opts.year),
		})
	const segs: Seg[] = []
	if (opts.best) segs.push({ t: "best", text: "best" })
	segs.push(...listed(feel), ...made, ...from, ...head, ...after)
	if (opts.best && !decades.length && !opts.year) segs.push(text("of all time"))
	if (segs[0]) segs[0] = { ...segs[0], text: cap(segs[0].text) }
	return segs
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const phraseText = (segs: Seg[]) => segs.map((s) => s.text).join(" ")

/** The phrase with its first letter in lowercase unless it is a proper name ("All cozy comedies", "All Korean ..."). */
export function inSentence(segs: Seg[]): string {
	const s = phraseText(segs)
	const first = segs[0]
	const proper =
		first?.t === "part" &&
		(first.part.family === "country" ||
			first.part.family === "service" ||
			first.part.family === "decade")
	return proper ? s : s.charAt(0).toLowerCase() + s.slice(1)
}

/** One part said as what the others are not: "that aren't comedies", "from anywhere but Japan". */
export function without(kind: Kind, p: PlaceRef): string {
	if (p.family === "mood") {
		const behind = MOOD_AFTER[p.slug]
		return behind ? `not ${behind[0]} ${behind[1]}` : `that aren't ${p.label.toLowerCase()}`
	}
	if (p.family === "genre") {
		const plural = kind !== "show" ? GENRE_PLURAL[p.slug] : undefined
		return `that aren't ${plural ?? GENRE_ADJ[p.slug] ?? p.label.toLowerCase()}`
	}
	if (p.family === "theme") return `that aren't about ${p.label.toLowerCase()}`
	if (p.family === "style") return `that aren't ${STYLE_ADJ[p.slug] ?? p.label.toLowerCase()}`
	if (p.family === "decade") return `from any other decade`
	if (p.family === "country") return `from anywhere but ${p.label.replace(/ SAR China$/, "")}`
	if (p.family === "service") return `that aren't on ${p.label}`
	return `that aren't ${(p.adj ?? p.label).toLowerCase()}`
}

/** A part as a short bare label for a pair or a menu: "Cozy", "Comedy", "1990s", "Japan". */
export const bare = (p: PlaceRef) => p.label

/** The family's word for a token's caption. */
export const FAMILY_WORD: Record<PlaceRef["family"], string> = {
	mood: "Mood",
	genre: "Genre",
	theme: "Subject",
	style: "Style",
	decade: "Decade",
	country: "Country",
	service: "Streaming",
	trait: "Trait",
	trope: "Trope",
}
