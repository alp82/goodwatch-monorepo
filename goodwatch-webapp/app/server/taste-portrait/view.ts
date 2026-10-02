// What the Taste page's three tabs render: one view model per tab, as getTastePortrait and /api/taste/portrait return
// it. Types and fixed words only, so browser code can import them.
import type { TitleKey } from "~/utils/title-key"

export const PORTRAIT_TABS = ["sides", "everyone", "fingerprint"] as const
export type PortraitTab = (typeof PORTRAIT_TABS)[number]

/** Guests with fewer guest ratings than this see the sample taste. */
export const GUEST_MIN_RATINGS = 5

export const isPortraitTab = (value: unknown): value is PortraitTab =>
	PORTRAIT_TABS.includes(value as PortraitTab)

/** A title a tab shows. Titles are listed once per view in `titles` and referred to by key. */
export interface PortraitTitle {
	key: TitleKey
	mediaType: "movie" | "show"
	anime: boolean
	tmdbId: number
	title: string
	year: number | null
	/** TMDB paths, e.g. "/abc.jpg"; null when the title has none. */
	poster: string | null
	backdrop: string | null
	/** GoodWatch score, 0 to 100. */
	score: number | null
	/** The person's own rating, 1 to 10, for a title they rated. */
	mine: number | null
	/** Taste match, 50 to 99, for a title they haven't seen; null without taste. */
	match: number | null
	/** Whether one of the person's services carries it; null for a title they've seen, without services, or while
	 * availability loads. */
	onMyServices: boolean | null
	/** For a title they haven't seen: the attributes that most drive its match, strongest first (the card's reasons). */
	reasons: string[]
	/** For a title they haven't seen: the subscription services that carry it where they watch, theirs first; null for
	 * a title they've seen or while availability loads. */
	services: PortraitService[] | null
}

export interface PortraitService {
	id: number
	name: string
	/** TMDB logo path. */
	logo_path: string
}

/** Who the portrait describes, and what the page should say about it. */
export interface PortraitSubject {
	/** "member" and "guest" are the viewer's own ratings; "sample" is the fixed sample taste shown to guests with fewer
	 * than 5 guest ratings, labeled "Sample taste" on every tab. */
	kind: "member" | "guest" | "sample"
	/** Ratings the portrait read (titles with a title analysis). */
	rated: number
	/** The person's usual rating, 1 decimal; null without ratings. */
	usual: number | null
}

interface ViewBase {
	tab: PortraitTab
	subject: PortraitSubject
	/** "empty": too few ratings for this tab; show its empty state ("Rate a few more titles you love").
	 * "unavailable": the title snapshot hasn't loaded yet (right after the server starts); try again shortly. */
	status: "ready" | "empty" | "unavailable"
	titles: Record<string, PortraitTitle>
}

// ---------- Sides of you ----------

export interface SideEdge {
	id: string
	kind: "country" | "language" | "attribute" | "decade"
	/** "South Korea", "The 1940s", "Slow burns". */
	name: string
	/** The copy's two halves: "You've barely been to" + "South Korea", "You rarely go back to" + "the 1940s". */
	lead: string
	place: string
	/** The person's average rating there, 1 decimal ("When you go, you rate it 8.1. Usually you give 6.9."). */
	average: number
	/** How many titles they rated there. */
	count: number
	/** What they rated there, best first. */
	rated: TitleKey[]
	/** Unseen titles from there, best first, match at least 56. */
	suggestions: TitleKey[]
	/** The backdrop to show: the first suggestion with one, else a rated title with one. */
	image: TitleKey | null
}

export interface Side {
	id: string
	/** "Slow-burning crime stories": an adjective from its second attribute, a noun from its first. */
	name: string
	/** The four attributes that set it apart, strongest first (fingerprint keys). */
	attributes: { key: string; label: string }[]
	/** Share of the loved titles, 0 to 1. */
	share: number
	/** The person's average rating of its titles, 1 decimal. */
	average: number
	/** "You're here": its titles rated 7 or more (all of them when fewer than 2), best first, up to four. */
	here: TitleKey[]
	/** The first loved title with a backdrop. */
	image: TitleKey | null
	/** "Just past it", closest first. */
	edges: SideEdge[]
	/** "More of this": unseen titles, best first, match at least 65. Holds the first 12 everywhere and the first 12 on
	 * the person's services; show the ones with onMyServices, or the first 12 for Everywhere. */
	moreOfThis: TitleKey[]
}

export interface SidesView extends ViewBase {
	tab: "sides"
	sides: Side[]
	/** The ids of the two sides least alike: "You love {first's name}, and just as much {second's name}." Null with
	 * fewer than 2 sides. */
	headline: { first: string; second: string } | null
	/** The side the picker opens first: the one with the highest average rating. */
	openFirst: string | null
	/** Whether the person has saved services, so On my services applies. */
	hasServices: boolean
	/** The person's services with their logos, for the On my services switch. */
	services: PortraitService[]
}

// ---------- You vs everyone ----------

export interface EveryoneRow {
	key: TitleKey
	mine: number
	/** GoodWatch score, 0 to 100. */
	everyone: number
	/** Points the person rates it above (positive) or below everyone, after their usual generosity. */
	delta: number
}

export interface EveryoneGap {
	/** A fingerprint key or a genre name. */
	id: string
	name: string
	/** Average gap in points; drawn only at 2 or more either way. */
	delta: number
	count: number
}

export interface EveryoneView extends ViewBase {
	tab: "everyone"
	/** "You mostly agree with everyone", "You agree about as often as you don't", or "You don't take the crowd's word
	 * for much". */
	headline: string
	/** Pearson correlation of the person's scores with the GoodWatch score. */
	agreement: number
	/** The person's mean gap (their generosity), in points. */
	offset: number
	/** Rated titles counted: with a GoodWatch score and at least 1,000 votes. */
	counted: number
	/** Up to 30 each, strongest first; show 8, then 8 more per Show more. Filter by the titles' media type. */
	higher: EveryoneRow[]
	lower: EveryoneRow[]
	/** Gap bars: the top and bottom four attributes and three genres at a gap of 2 or more, largest first. */
	attributes: EveryoneGap[]
	genres: EveryoneGap[]
}

// ---------- Fingerprint ----------

export type FamilyId = "feel" | "humor" | "world" | "story" | "craft"

export interface Family {
	id: FamilyId
	/** "Feel", "Humor", "World", "Story", "Craft". */
	name: string
	/** "How it makes you feel". */
	line: string
	/** Its attributes in fingerprint order. */
	keys: string[]
}

export type Tier = -3 | -2 | -1 | 0 | 1 | 2 | 3

export const TIER_NAMES: Record<Tier, string> = {
	3: "Defining",
	2: "You seek it",
	1: "You lean toward it",
	0: "Neither here nor there",
	[-1]: "You lean away",
	[-2]: "You avoid it",
	[-3]: "You steer clear",
}

export interface FingerprintAttribute {
	key: string
	label: string
	family: FamilyId
	/** What the attribute means, in plain words. */
	meaning: string
	/** "the surreal". */
	phrase: string
	/** "surreal trips". */
	noun: string
	/** Against everyone: positive is sought, negative avoided, in the person's own spread. */
	edge: number
	tier: Tier
	/** Share of the person's rated titles that carry it strongly (the pool's top quarter for it), 0 to 1. */
	share: number
	/** The same share over everyone's titles, 0 to 1. */
	everyoneShare: number
	/** Their average rating of those titles minus their usual, 1 decimal; null with fewer than 3. */
	lift: number | null
	/** How many of their rated titles carry it strongly. */
	count: number
	/** Up to six titles that carry it for them, strongest first. */
	carriers: TitleKey[]
	/** Up to four strong in it that they rated lowest or skipped (shown for an avoided attribute). */
	against: TitleKey[]
	/** Against their usual stance: a title rated at least max(8, usual + spread) for an avoided attribute, or at most
	 * min(5, usual - spread) for a sought one. */
	exception: TitleKey | null
}

export interface FingerprintView extends ViewBase {
	tab: "fingerprint"
	/** A viewing preference, with the two attribute keys supporting the identity. */
	identity: { name: string; persona: string; adjective: string } | null
	/** "Show you the unexpected, the surreal or absurd humor, and you're in. Grounded dramas rarely get a look." */
	line: string
	/** The attributes the line names: up to three sought, up to two avoided, strongest first. */
	seek: string[]
	avoid: string[]
	families: Family[]
	/** All 74 attributes, in fingerprint order. */
	attributes: FingerprintAttribute[]
	/** "The titles that are most you": two rows of eight. */
	mostYou: TitleKey[]
}

export type PortraitView = SidesView | EveryoneView | FingerprintView

export type PortraitViewOf<T extends PortraitTab> = Extract<
	PortraitView,
	{ tab: T }
>
