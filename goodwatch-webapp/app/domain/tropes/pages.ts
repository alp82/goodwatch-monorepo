// What the tropes index and a trope page carry, and the pure rules both use: how a twist reads in plain words, how
// often a trope is twisted, which tropes fit the spotlight, and the order of a trope's examples. Safe in the browser.
// docs/implementation/explore-rethink/spec.md
import type { Kind } from "~/domain/browse/address"
import type { Person, ShowTitle, Suggestion, TraitWord } from "~/domain/browse/types"
import type { Play, TropeGroupId } from "~/domain/tropes/catalog"
import { hideBucket } from "~/ui/discover-bar/hide-count"

/** One title's write-up of the trope: the first point, spoilers marked as character ranges. */
export interface Example {
	title: ShowTitle
	/** The name the write-up files it under, when it isn't the trope's own. */
	as: string | null
	play: Play
	text: string
	spoilers: [number, number][]
}

export interface TropeRow {
	id: string
	slug: string
	label: string
	line: string
	group: TropeGroupId
	color: string
	/** Well-known titles of the kind that carry it. */
	n: number
	/** Its best-known titles, for the poster fan. */
	posters: ShowTitle[]
	/** One short write-up without spoilers, as a teaser: "In Jaws: ...". */
	teaser: Example | null
}

/**
 * The spotlight never changes height, so it only takes tropes whose name, line and teaser fit its fixed frame whole,
 * at every width.
 */
export const fitsSpotlight = (r: Pick<TropeRow, "label" | "line" | "teaser" | "posters">) =>
	Boolean(r.teaser && r.teaser.text.length <= 165 && r.label.length <= 24 && r.line.length <= 64) &&
	r.posters.length >= 3

export interface GroupBlock {
	id: TropeGroupId
	name: string
	line: string
	color: string
	tropes: TropeRow[]
}

export interface TropesIndexData {
	kind: Kind
	groups: GroupBlock[]
	/** The trope the page opens on, picked by the day. */
	feature: TropeRow | null
}

/** Another trope, as a link. */
export interface TropeLink {
	slug: string
	label: string
	line: string
	color: string
}

/** How often stories twist the trope, in words (see `twistWords`). */
export type TwistBand = "rare" | "sometimes" | "often" | "half"

export interface TropePageData {
	trope: Omit<TropeRow, "teaser"> & { opening: string | null; say: string }
	group: { id: TropeGroupId; name: string; color: string }
	/** How often it's twisted, among every write-up of it (not only the well-known titles). */
	twist: TwistBand
	/** Write-ups of well-known titles: the most watched first, then every twisted one found. */
	examples: Example[]
	contrast: TropeLink | null
	/** Tropes it meets far more often than chance, strongest first. */
	travels: TropeLink[]
	/** Tropes it meets far less often than chance. */
	rarely: TropeLink[]
	feels: TraitWord[]
	/** The other tropes of its group, for walking sideways. */
	siblings: { slug: string; label: string }[]
	/** Each decade with its best-known titles that carry it; `share` against its busiest decade. */
	timeline: { label: string; slug: string; n: number; share: number; titles: ShowTitle[] }[]
	/** Places it blends well with (moods, genres, countries), each a full page with posters. */
	ways: Suggestion[]
	/** Who makes or stars in the most well-known titles with it. */
	people: Person[]
}

/** The plain words for how stories twist a trope; "straight" is the default and gets none. */
export const TWIST: Record<Exclude<Play, "straight">, string> = {
	subverted: "Set up, then undone",
	inverted: "Roles reversed",
	averted: "Doesn't happen here",
	lampshaded: "A character points it out",
	exaggerated: "Taken to the extreme",
	downplayed: "A milder version",
	"played-with": "A variation on it",
}

export const twistOf = (p: Play): string | null => (p === "straight" ? null : TWIST[p])

export const twistWords: Record<TwistBand, string> = {
	rare: "Almost always played straight",
	sometimes: "Usually played straight",
	often: "Often given a twist",
	half: "Twisted as often as not",
}

/**
 * How often a trope is twisted: the share of every write-up of it (all titles in the table, not only the well-known
 * ones) whose first words say it is subverted, inverted, averted, lampshaded, exaggerated, downplayed or played with.
 */
export function twistBand(share: number): TwistBand {
	return share < 0.08 ? "rare" : share < 0.2 ? "sometimes" : share < 0.4 ? "often" : "half"
}

/** A count as people read it: Discover's buckets, "400+" when rounded down. Exact counts like 421 never show. */
export const many = (n: number) => {
	const b = hideBucket(n)
	return b.lossy ? `${b.text}+` : b.text
}

// A write-up that opens by naming its own twist ("Subverted.", "Averted when ...", "Subverted with Jess.") repeats the
// twist tag shown beside it. The twist words go and what follows stays a clean start:
// - after punctuation the rest begins the text ("Subverted. In the end ..." -> "In the end ...");
// - before "when", "after", "despite" and the like, the connective begins it ("When Sherry tries ...");
// - after "with", "by" or "but" the rest begins it ("River; she declares ..."), and a short "with an actual gun."
//   goes along with the twist words.
// Anything else ("Played with as nicely as possible ...", "Subverted in the remake.") keeps its opening, since cutting
// it would leave a fragment.
const TWIST_WORD =
	"(?:(?:partially|mostly|somewhat|largely|briefly|ultimately|eventually|heavily|initially) )?(?:double[- ])?(?:subverted|inverted|averted|lampshaded|exaggerated|downplayed|played with|zig-?zagged|deconstructed|discussed|defied|justified)"
const HEAD = new RegExp(
	`^${TWIST_WORD}(?:,? (?:then|and|but)(?: then)?(?: later| ultimately| eventually| partially)? (?:${TWIST_WORD}|played straight))?(?: (?:\\w+ly|twice|again|too|as well|big time|hard))?`,
	"i",
)
const AFTER_MARK = /^\s*(?:[.!;:,]|\s[-–])\s+/
const BEFORE_CLAUSE =
	/^\s+(?=(?:when|whenever|after|during|before|until|once|since|because|although|though|despite|while|throughout)\b)/i
const VIA = /^\s*(with|by|but)\s+/i
const SHORT_THING = /^(?:a|an|the) [^.!?]{1,40}[.!?]\s+/i

/** The write-up without a leading twist word when the tag already says it; spoiler marks move with the text. */
export function clean<E extends Pick<Example, "play" | "text" | "spoilers">>(e: E): E {
	if (e.play === "straight") return e
	const head = HEAD.exec(e.text)
	if (!head) return e
	let cut = head[0].length
	const after = e.text.slice(cut)
	const mark = AFTER_MARK.exec(after) ?? BEFORE_CLAUSE.exec(after)
	if (mark) cut += mark[0].length
	else if (!VIA.test(after)) return e
	const via = VIA.exec(e.text.slice(cut))
	if (via) {
		cut += via[0].length
		const thing = via[1].toLowerCase() === "but" ? null : SHORT_THING.exec(e.text.slice(cut))
		if (thing && e.text.length - cut - thing[0].length >= 24) cut += thing[0].length
	}
	const text = e.text.slice(cut)
	// Too little left, a chain that goes on ("then ...", "and ..."), or no real start: keep the write-up as it is.
	if (
		text.length < 24 ||
		/^(?:then|and|but|or|as)\b/i.test(text) ||
		!/^["'“(]?[\p{L}\p{N}]/u.test(text)
	)
		return e
	return {
		...e,
		text: text[0].toUpperCase() + text.slice(1),
		spoilers: e.spoilers
			.map(([a, b]) => [Math.max(0, a - cut), b - cut] as [number, number])
			.filter(([, b]) => b > 0),
	}
}

/** How many characters of the write-up you can read before showing the spoiler. */
export const visible = (e: Pick<Example, "text" | "spoilers">) =>
	e.text.length - e.spoilers.reduce((n, [a, b]) => n + (b - a), 0)

// Write-ups about a later book, comic, cut scene or the creators' word are about something else than the film.
const ASIDE =
	/\b(expanded universe|legends|\bEU\b|retroactive|novel(?:ization|isation)?|comic|tie-in|word of god|deleted scene|video game|spin-?off)\b/i

/**
 * The examples in the order a reader wants them: well-known titles whose write-up is about the title itself first.
 * A write-up about a tie-in book or comic, a very short one, a mostly hidden one and a sprawling one count for less;
 * twists count a little more (they're the interesting ones).
 */
export function strongest(raw: Example[]): Example[] {
	const examples = raw.map(clean)
	const score = (e: Example, i: number) => {
		const votes = e.title.card.goodwatch_overall_score_voting_count ?? 0
		let s = Math.log10(votes + 10) + (examples.length - i) / (examples.length * 4)
		if (ASIDE.test(e.text)) s *= 0.35
		if (e.text.length < 50) s *= 0.6
		if (visible(e) < 45) s *= 0.4
		if (e.text.length > 520) s *= 0.8
		if (e.play !== "straight") s *= 1.08
		return s
	}
	return examples
		.map((e, i) => ({ e, s: score(e, i) }))
		.sort((a, b) => b.s - a.s)
		.map((x) => x.e)
}

/** The write-up as plain and spoiler runs, in order. */
export function segments(
	e: Pick<Example, "text" | "spoilers">,
): { text: string; spoiler: boolean; at: number }[] {
	const out: { text: string; spoiler: boolean; at: number }[] = []
	let at = 0
	for (const [from, end] of e.spoilers) {
		if (from > at) out.push({ text: e.text.slice(at, from), spoiler: false, at })
		out.push({ text: e.text.slice(from, end), spoiler: true, at: from })
		at = end
	}
	if (at < e.text.length) out.push({ text: e.text.slice(at), spoiler: false, at })
	return out
}
