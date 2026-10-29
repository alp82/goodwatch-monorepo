import { reasonsLine, type SearchReason } from "./search-reading.ts"
import { withArticle } from "../../utils/country-article.ts"
import type { Score } from "../scores.server.ts"
import {
	getVibeColorValue,
	goodwatchScoreDisplay,
	hasGoodwatchScore,
	scoreLabels,
	scoreWord,
} from "../../utils/ratings.ts"
import { titlePath } from "../../utils/helpers.ts"
import { providerIdentity } from "./provider-aliases.ts"
import {
	formatCustomId,
	formatListRef,
	listCustomId,
	isTitleId,
	type ListRef,
} from "./custom-id.ts"
import { scoreEmojiName } from "./score-emoji.ts"
import { PROVIDER_EMOJI_BY_ID } from "./provider-emojis.ts"
export const IS_COMPONENTS_V2 = 1 << 15
export const EPHEMERAL = 64
/** GoodWatch amber, the accent of member and list containers. */
export const AMBER = 0xfbbf24
/** Discord's secondary button grey, for cards that state a rule rather than an error. */
export const QUIET_GREY = 0x4e5058
export interface Component {
	type: number
	components?: Component[]
	accessory?: Component
	[key: string]: unknown
}
export interface MemberMarks {
	score?: number | null
	want_to_see?: boolean
	status?: string | null
	watch_count?: number
}
export interface GuestTitle {
	reasons?: SearchReason[]
	trailer_url?: string | null
	match?: number | null
	match_label?: string | null
	id: string
	name: string
	year: number | null
	synopsis?: string | null
	genres?: string[]
	runtime_minutes?: number | null
	poster_url?: string | null
	backdrop_url?: string | null
	goodwatch_score?: number | null
	availability?: {
		state?: string
		country?: string
		offers: {
			service_id?: number
			name?: string
			url?: string
			stream_link: string
			offer_type?: string
		}[]
	}
}
/**
 * Application emoji IDs by name: `GoodWatchScore1` to `GoodWatchScore10` and the service logos of provider-emojis.ts.
 * Missing names render as plain text.
 */
export type EmojiIds = Readonly<Record<string, string>>
export function componentCount(components: Component[]): number {
	return components.reduce(
		(n, c) =>
			n +
			1 +
			componentCount(c.components ?? []) +
			(c.accessory ? componentCount([c.accessory]) : 0),
		0,
	)
}
/** The characters of every text display, which Discord limits to 4000 per message. */
export function textLength(components: Component[]): number {
	return components.reduce(
		(n, c) =>
			n +
			(c.type === 10 ? String(c.content ?? "").length : 0) +
			textLength(c.components ?? []),
		0,
	)
}
export function message(components: Component[], ephemeral = true) {
	const clean = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(clean)
		if (!value || typeof value !== "object") return value
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				["content", "label", "description", "placeholder"].includes(key) &&
				typeof item === "string"
					? discordText(item)
					: clean(item),
			]),
		)
	}
	components = clean(components) as Component[]
	if (componentCount(components) > 40)
		throw new Error("Discord component limit exceeded")
	if (textLength(components) > 4000)
		throw new Error("Discord text limit exceeded")
	validateComponents(components)
	return {
		flags: IS_COMPONENTS_V2 | (ephemeral ? EPHEMERAL : 0),
		components,
		allowed_mentions: { parse: [] },
	}
}
/** Human-facing names and tool messages never expose internal identifiers or field separators. */
export function displayText(value: string) {
	return value
		.replace(/\b(?:movie|show):\d+\b/g, "this title")
		.replace(/\bperson:\d+\b/g, "this person")
		.replace(
			/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
			"this change",
		)
		.replace(/\b\d{15,20}\b/g, "this change")
		.replace(/\\?_/g, " ")
}
export const textCard = (text: string) =>
	message([{ type: 10, content: text.slice(0, 4000) }])
/** An error card, with a Try again button when the interaction could be kept for a retry. */
export const errorCard = (text: string, retryId?: string | null) =>
	retryId
		? message([
				{ type: 10, content: text.slice(0, 4000) },
				{
					type: 1,
					components: [
						{ type: 2, style: 2, label: "Try again", custom_id: retryId },
					],
				},
			])
		: textCard(text)
export const ERROR_TEXT = "Something went wrong. Please try again."
export const TIMEOUT_TEXT = "The search took too long. Please try again."
/** Human-facing copy: displayText outside link destinations, Discord emoji syntax, and member handles (@film_fan),
 * which stay as they are. Discord doesn't italicize underscores inside a word, so handles need no escaping. */
export const discordText = (value: string) =>
	value
		.split(
			/(https?:\/\/[^\s)>]+|<a?:[A-Za-z0-9_]+:\d+>|(?<![\w@.])@[a-z][a-z0-9_]{2,29}(?![\w:@-]|\.\w))/g,
		)
		.map((part, i) => (i % 2 ? part : displayText(part)))
		.join("")
const escape = (text: string) =>
	discordText(text)
		.replace(/[\\*~`|>#[\]]/g, "\\$&")
		.replace(/@/g, "＠")

// ---------- shared pieces (title, /watch, /together and write cards reuse these) ----------

/** A Components V2 container. `accent` is a 0xRRGGBB number; leave it out for no accent bar. */
export const container = (
	components: (Component | null | false | undefined)[],
	accent?: number,
): Component => ({
	type: 17,
	...(accent === undefined ? {} : { accent_color: accent }),
	components: components.filter(Boolean) as Component[],
})
export const separator = (divider = true): Component => ({
	type: 14,
	divider,
	spacing: 1,
})
const text = (content: string): Component => ({ type: 10, content })
const linkButton = (label: string, url: string): Component => ({
	type: 2,
	style: 5,
	label,
	url,
})

/**
 * The country's English name for use after "in" ("Germany", "the United Kingdom"), or the code when the runtime doesn't
 * know it.
 */
export function countryName(code: string) {
	let name = code
	try {
		name =
			new Intl.DisplayNames(["en"], { type: "region" }).of(
				code.toUpperCase(),
			) ?? code
	} catch {
		/* Keep the code. */
	}
	return withArticle(name)
}

/** The vibe color of a GoodWatch score as an accent number, like the site's score ring. */
export function scoreAccent(
	score: number | null | undefined,
	scale: "catalog" | "member" = "catalog",
) {
	if (scale === "member" && score != null)
		return Number.parseInt(getVibeColorValue(score as Score).slice(1), 16)
	if (!hasGoodwatchScore(score)) return undefined
	const colors = [
		0x7f1d1d, 0x991b1b, 0xb91c1c, 0xc2410c, 0xd97706, 0xca8a04, 0xa3a323,
		0x65a32d, 0x16934a, 0x15803d, 0x166534,
	]
	return colors[Math.min(10, Math.floor(goodwatchScoreDisplay(score) / 10))]
}

/** The score's app emoji, or "" when the emoji isn't uploaded yet. */
export function scoreEmoji(score: number, emojis: EmojiIds = {}) {
	const name = scoreEmojiName(score)
	return emojis[name] ? `<:${name}:${emojis[name]}>` : ""
}

/** "<emoji> **85 · Excellent**", or "Not rated yet". Never breaks when emojis are missing. */
export function scoreLine(
	score: number | null | undefined,
	emojis: EmojiIds = {},
	scale: "catalog" | "member" = "catalog",
) {
	if (!hasGoodwatchScore(score)) return "Not rated yet"
	const shown = goodwatchScoreDisplay(score)
	const percent = scale === "member" ? shown * 10 : shown
	const emoji = scoreEmoji(percent, emojis)
	return `${emoji ? `${emoji} ` : ""}**${shown} · ${scoreWord(percent)}**`
}

/** A count with its noun: "1 participant", "3 participants", "1 person", "2 people". */
export const plural = (count: number, one: string, many = `${one}s`) =>
	`${count.toLocaleString("en-US")} ${count === 1 ? one : many}`

/** Runtime as "2h 37m". */
export const runtime = (minutes: number) =>
	minutes >= 60
		? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
		: `${minutes}m`

const isMovie = (title: Pick<GuestTitle, "id">) => title.id.startsWith("movie:")

/** Score, year, runtime (movies) or "TV show", and up to three genres, separated by wide dots. */
export function titleFacts(title: GuestTitle, emojis: EmojiIds = {}) {
	return [
		scoreLine(title.goodwatch_score, emojis),
		title.year ? String(title.year) : null,
		isMovie(title)
			? title.runtime_minutes
				? runtime(title.runtime_minutes)
				: null
			: "TV show",
		(title.genres ?? []).slice(0, 3).map(escape).join(", ") || null,
	]
		.filter(Boolean)
		.join("  ·  ")
}

/** The overview cut at a word boundary. */
export function shortOverview(value: string | null | undefined, max = 180) {
	const clean = escape((value ?? "").replace(/\s+/g, " ").trim())
	if (!clean) return "Overview unavailable."
	if (clean.length <= max) return clean
	const cut = clean.slice(0, max)
	const space = cut.lastIndexOf(" ")
	return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(
		/[,.;:\\]+$/,
		"",
	)}…`
}

/** The wide backdrop at the top of 1C-style cards, or null without a backdrop. */
export function backdropHero(
	title: Pick<GuestTitle, "name" | "backdrop_url">,
): Component | null {
	return title.backdrop_url
		? {
				type: 12,
				items: [
					{
						media: { url: title.backdrop_url },
						description: `${displayText(title.name)} backdrop`.slice(0, 1024),
					},
				],
			}
		: null
}

/**
 * The cinematic title block: backdrop, large title, score line and facts, overview. Without a backdrop it falls back to
 * the poster thumbnail beside the facts. Returns components for a container, not a container.
 */
export function titleHero(
	title: GuestTitle,
	emojis: EmojiIds = {},
	options: { eyebrow?: string } = {},
): Component[] {
	const name = escape(title.name).slice(0, 250)
	const eyebrow = options.eyebrow ? `-# ${options.eyebrow}\n` : ""
	const hero = backdropHero(title)
	// With a backdrop the title is large and the poster sits beside it; without one the poster carries the card.
	const facts = text(
		`${eyebrow}${hero ? "#" : "##"} ${name}\n${titleFacts(title, emojis)}`,
	)
	const overview = text(shortOverview(title.synopsis, hero ? 150 : 160))
	return [
		hero,
		title.poster_url
			? {
					type: 9,
					components: [facts, overview],
					accessory: {
						type: 11,
						media: { url: title.poster_url },
						description: `${displayText(title.name)} poster`.slice(0, 1024),
					},
				}
			: null,
		...(title.poster_url ? [] : [facts, overview]),
	].filter((c): c is Component => !!c)
}

type Offer = NonNullable<GuestTitle["availability"]>["offers"][number]

export const subscriptionOffer = (offer: Offer) =>
	["flatrate", "free", "ads"].includes(offer.offer_type ?? "")

export const CARD_COUNTRIES = [
	"US",
	"GB",
	"DE",
	"CA",
	"AU",
	"FR",
	"ES",
	"IT",
	"NL",
	"BR",
	"MX",
	"IN",
	"JP",
	"SE",
	"NO",
	"DK",
	"FI",
	"AT",
	"CH",
	"IE",
] as const

export function countryMenu(
	titleId: string,
	country: string,
	back?: ListRef,
): Component {
	const codes = [...new Set([country.toUpperCase(), ...CARD_COUNTRIES])].slice(
		0,
		25,
	)
	return {
		type: 1,
		components: [
			{
				type: 3,
				custom_id: formatCustomId("country", titleId, back),
				placeholder: countryName(country).replace(/^the /, ""),
				min_values: 1,
				max_values: 1,
				options: codes.map((code, i) => ({
					label: countryName(code).replace(/^the /, ""),
					value: code,
					emoji: {
						name: [...code]
							.map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
							.join(""),
					},
					default: i === 0,
				})),
			},
		],
	}
}

/** A service as the card shows it: the site's brand name, its logo emoji name, and its offers. */
export interface WatchProvider {
	/** The service's own ID, which its channels and tiers fold into. */
	id?: number
	brand: string
	emoji: string | null
	offers: Offer[]
}

/**
 * Group only known channel and tier IDs. Keep the incoming per-country popularity order from linkedAvailability.
 */
export function watchProviders(offers: Offer[]): WatchProvider[] {
	const brands = new Map<string, WatchProvider>()
	offers.forEach((offer) => {
		const name = offer.name?.trim()
		// Placeholders from offers without a known service ("Provider", "Service 123") say nothing.
		if (!name || /^(provider|service \d+)$/i.test(name)) return
		const identity = providerIdentity(offer.service_id, name)
		const brand = identity.name
		if (!brand) return
		const id = identity.id
		const emoji = id === undefined ? null : (PROVIDER_EMOJI_BY_ID[id] ?? null)
		const key = id === undefined ? `name:${brand}` : `id:${id}`
		const entry = brands.get(key)
		if (!entry) brands.set(key, { id, brand, emoji, offers: [offer] })
		else {
			entry.offers.push(offer)
			entry.emoji ??= emoji
		}
	})
	return [...brands.values()]
}

/** The service's logo as inline emoji, or its name in bold while the logo isn't uploaded. */
export function providerMark(provider: WatchProvider, emojis: EmojiIds = {}) {
	return provider.emoji && emojis[provider.emoji]
		? `<:${provider.emoji}:${emojis[provider.emoji]}>`
		: `**${escape(provider.brand)}**`
}

/** At most this many services in the logo row; the heading counts the rest. */
const LOGO_LIMIT = 14

/**
 * Where to watch as a heading and a body: a row of service logos, with names where a logo is missing. Never links, so
 * no streaming URL reaches markdown. `heading` replaces the small line, for example the member's "On your services in
 * France".
 */
export function whereToWatchParts(
	title: GuestTitle,
	country: string,
	options: {
		allServices?: boolean
		heading?: string
		emojis?: EmojiIds
		/** Keep whole service marks within a compact card's text budget. */
		providerTextLimit?: number
	} = {},
) {
	const emojis = options.emojis ?? {}
	const providers = watchProviders(title.availability?.offers ?? [])
	const more = providers.length - LOGO_LIMIT
	const body = providers.length
		? providers
				.slice(0, LOGO_LIMIT)
				.map((p) => providerMark(p, emojis))
				.filter(
					(_, i, marks) =>
						options.providerTextLimit === undefined ||
						marks.slice(0, i + 1).join(" ").length <= options.providerTextLimit,
				)
				.join(" ")
		: noOffers(title)
	return {
		heading: `-# ${watchHeading(country, options)}${
			more > 0 ? `  ·  ${more} more` : ""
		}`,
		body: body.slice(0, 2800),
	}
}

const noOffers = (title: GuestTitle) =>
	title.availability?.state === "no_match"
		? "No current offers found."
		: "Availability unknown."

const watchHeading = (
	country: string,
	options: { allServices?: boolean; heading?: string },
) =>
	options.heading ??
	`Where to watch ${
		options.allServices ? "on every service " : ""
	}in ${countryName(country)}`

/**
 * Services for compact rows, as text: each logo with its name ("<logo> Netflix, <logo> MUBI and 2 more"), the name
 * alone while a logo isn't uploaded. Never links.
 */
export function serviceNames(
	title: GuestTitle,
	emojis: EmojiIds = {},
	limit = 4,
) {
	const providers = watchProviders(title.availability?.offers ?? [])
	if (!providers.length) return noOffers(title)
	const names = providers
		.slice(0, limit)
		.map(
			(p) =>
				`${
					p.emoji && emojis[p.emoji] ? `<:${p.emoji}:${emojis[p.emoji]}> ` : ""
				}${escape(p.brand).slice(0, 40)}`,
		)
	const more = providers.length - limit
	return `${names.join(", ")}${more > 0 ? ` and ${more} more` : ""}`
}

/**
 * Services for rows where the place is said once above: each logo (the name while a logo isn't uploaded), then
 * "+2 more". Never links.
 */
export function serviceLogos(
	title: GuestTitle,
	emojis: EmojiIds = {},
	limit = 3,
) {
	const providers = watchProviders(title.availability?.offers ?? [])
	if (!providers.length) return noOffers(title)
	const more = providers.length - limit
	return `${providers
		.slice(0, limit)
		.map((p) =>
			p.emoji && emojis[p.emoji]
				? `<:${p.emoji}:${emojis[p.emoji]}>`
				: `**${escape(p.brand).slice(0, 40)}**`,
		)
		.join(" ")}${more > 0 ? `  +${more} more` : ""}`
}

/** The small "Where to watch on every service in the United States" line. */
export const whereToWatchLine = (country: string, allServices = false) =>
	`-# ${watchHeading(country, { allServices })}`

/** Where to watch as one text: the small heading line, then the logos. */
export function whereToWatch(
	title: GuestTitle,
	country: string,
	options: Parameters<typeof whereToWatchParts>[2] = {},
) {
	const { heading, body } = whereToWatchParts(title, country, options)
	return `${heading}\n${body}`.slice(0, 3000)
}

export const GOODWATCH_ORIGIN = "https://goodwatch.app"

/** The title page's URL. A long name's slug is cut; the page redirects any slug to its own. */
export function titlePageUrl(
	title: Pick<GuestTitle, "id" | "name">,
	hash = "",
) {
	const [kind, id] = title.id.split(":")
	return `${GOODWATCH_ORIGIN}${titlePath(kind, Number(id), title.name.slice(0, 120))}${hash}`
}
/** Discord's limit for a link button's URL. */
export const BUTTON_URL_LIMIT = 512
/** Two rows of five service buttons. */
export const STREAM_BUTTON_LIMIT = 10

const httpUrl = (url: string | undefined) => {
	if (!url) return null
	try {
		return ["http:", "https:"].includes(new URL(url).protocol) ? url : null
	} catch {
		return null
	}
}

/**
 * The URL a service button opens: the offer's own link, or for links over Discord's 512 characters (long JustWatch
 * click URLs), the GoodWatch redirect that looks the same link up again. Null when neither works.
 */
export function streamButtonUrl(
	offer: Offer,
	titleId: string,
	country: string,
) {
	const url = httpUrl(offer.url)
	if (!url) return null
	if (url.length <= BUTTON_URL_LIMIT) return url
	if (!offer.service_id || !isTitleId(titleId)) return null
	const [media, tmdbId] = titleId.split(":")
	return `${GOODWATCH_ORIGIN}/go/stream/${media}/${tmdbId}/${
		offer.service_id
	}?country=${encodeURIComponent(country.toUpperCase())}`
}

/**
 * Where to watch as link buttons: each service with its logo emoji and name, in the site's order, up to two rows of
 * five. With more services, the last button opens the title page's where-to-watch section instead.
 */
export function streamLinks(
	title: GuestTitle,
	country: string,
	options: {
		emojis?: EmojiIds
		back?: ListRef
	} = {},
): Component[] {
	const emojis = options.emojis ?? {}
	const providers = watchProviders(
		(title.availability?.offers ?? []).filter(subscriptionOffer),
	)
	const buttons = providers.flatMap((p): Component[] => {
		// The service's own offer first, then its channels and tiers.
		const url = [
			...p.offers.filter((o) => o.service_id === p.id),
			...p.offers.filter((o) => o.service_id !== p.id),
		]
			.map((o) => streamButtonUrl(o, title.id, country))
			.find(Boolean)
		if (!url) return []
		const emoji = p.emoji && emojis[p.emoji] ? emojis[p.emoji] : null
		return [
			{
				type: 2,
				style: 5,
				label: discordText(p.brand).slice(0, 80),
				url,
				...(emoji ? { emoji: { id: emoji, name: p.emoji } } : {}),
			},
		]
	})
	const shown =
		buttons.length > STREAM_BUTTON_LIMIT
			? [
					...buttons.slice(0, STREAM_BUTTON_LIMIT - 1),
					linkButton("More on GoodWatch", titlePageUrl(title, "#streaming")),
				]
			: buttons
	return [
		...(!shown.length
			? [
					text(
						providers.length
							? "Open the title on GoodWatch for links."
							: `Not on a subscription service in ${countryName(country)}`,
					),
				]
			: []),
		...[0, 5]
			.map((at) => shown.slice(at, at + 5))
			.filter((row) => row.length)
			.map((row) => ({ type: 1, components: row })),
		countryMenu(title.id, country, options.back),
	]
}

/** `back` is the custom ID of the list the title was opened from; it puts Back first. */
export function titleButtons(
	title: GuestTitle,
	share = false,
	back?: string,
	country?: string,
	ref?: ListRef,
): Component {
	const buttons: Component[] = [
		...(back && !share
			? [{ type: 2, style: 2, label: "Back", custom_id: back }]
			: []),
		{
			type: 2,
			style: 2,
			label: "Similar",
			custom_id: formatCustomId("similar", title.id),
		},
		linkButton("Open on GoodWatch", titlePageUrl(title)),
	]
	if (!share)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: formatCustomId("share", title.id, ref, country),
		})
	return { type: 1, components: buttons }
}

/** `back` is the list the title was opened from: each press keeps it, so its result can offer Back. */
export function memberButtons(
	title: GuestTitle,
	marks: MemberMarks,
	back?: ListRef,
): Component[] {
	const seen =
		marks.status === "seen" ||
		(title.id.startsWith("movie:") &&
			((marks.watch_count ?? 0) > 0 || marks.score != null))
	return (
		[
			["want", "Want to see", marks.want_to_see],
			["seen", "Seen", seen],
			["rate", "Rate", marks.score != null],
		] as const
	).map(([action, label, active]) => ({
		type: 2,
		style: active ? 3 : 2,
		label,
		custom_id: formatCustomId(action, title.id, back),
	}))
}

/** The member's state in words: taste match heading and Want to See, seen, watching, and rating. */
export function memberLines(
	title: Pick<GuestTitle, "id" | "match" | "match_label">,
	marks: MemberMarks,
) {
	const seen =
		marks.status === "seen" ||
		(isMovie(title) && ((marks.watch_count ?? 0) > 0 || marks.score != null))
	const progress =
		marks.status && !["seen", "not_started"].includes(marks.status)
			? escape(marks.status.replace(/_/g, " "))
			: null
	const state = [
		marks.want_to_see ? "In your Wishlist" : null,
		seen
			? "Seen"
			: progress
				? progress[0].toUpperCase() + progress.slice(1)
				: "Not seen yet",
		marks.score != null && marks.score >= 1 && marks.score <= 10
			? `You rated it **${marks.score} · ${
					scoreLabels[Math.round(marks.score)]
				}**`
			: null,
	]
		.filter(Boolean)
		.join("  ·  ")
	const match =
		typeof title.match === "number"
			? escape(title.match_label ?? `${title.match}% taste match`)
			: null
	return `${match ? `### ${match}\n` : ""}-# ${state}`
}

/**
 * The amber container under a personal card that holds only the member's part, so Share never carries it. `buttons`
 * is the seam for Want to see, Seen, and Rate: up to five buttons on one row. `availability` is the member's own
 * where-to-watch text, shown when the member's place differs from the card's.
 */
export function memberBlock(
	title: Pick<GuestTitle, "id" | "match" | "match_label">,
	marks: MemberMarks,
	buttons: Component[] = [],
	availability?: string,
): Component {
	return container(
		[
			text(memberLines(title, marks)),
			availability ? text(availability) : null,
			buttons.length ? { type: 1, components: buttons.slice(0, 5) } : null,
		],
		AMBER,
	)
}

// ---------- cards ----------

/**
 * Guest title card with a private member block when linked. Availability uses the displayed country, defaulting
 * to the member's saved country for personal cards. Share keeps that country and omits all member data.
 */
export function titleCard(
	title: GuestTitle,
	country: string,
	options: {
		share?: boolean
		member?: MemberMarks
		memberTitle?: GuestTitle
		memberButtons?: Component[]
		emojis?: EmojiIds
		/** The list the title was opened from, for the Back button. */
		back?: ListRef
	} = {},
) {
	const share = !!options.share
	const guest = container(
		[
			...titleHero(title, options.emojis),
			reasonsLine(title.reasons) ? text(reasonsLine(title.reasons)) : null,
			separator(),
			...streamLinks(title, country, {
				emojis: options.emojis,
				back: options.back,
			}),
			titleButtons(
				title,
				share,
				options.back
					? listCustomId("back", formatListRef(options.back))
					: undefined,
				country,
				options.back,
			),
		],
		scoreAccent(title.goodwatch_score),
	)
	const mine = options.memberTitle ?? title
	return message(
		options.member && !share
			? [
					guest,
					memberBlock(
						mine,
						options.member,
						options.memberButtons ??
							memberButtons(mine, options.member, options.back),
					),
				]
			: [guest],
		!share,
	)
}

function validateComponents(components: Component[], depth = 0) {
	for (const c of components) {
		if (typeof c.label === "string" && c.label.length > 80)
			throw new Error("Discord label limit exceeded")
		if (typeof c.custom_id === "string" && c.custom_id.length > 100)
			throw new Error("Discord custom ID limit exceeded")
		if (typeof c.url === "string" && c.url.length > BUTTON_URL_LIMIT)
			throw new Error("Discord button URL limit exceeded")
		if (c.type === 17 && depth > 0)
			throw new Error("Discord container limit exceeded")
		if (c.type === 12) {
			const items = c.items as unknown[] | undefined
			if (!items?.length || items.length > 10)
				throw new Error("Discord media gallery limit exceeded")
		}
		if (c.type === 1) {
			const children = c.components ?? []
			if (
				!children.length ||
				children.length > 5 ||
				(children.some((x) => x.type === 3) && children.length !== 1)
			)
				throw new Error("Discord action row limit exceeded")
		}
		if (c.type === 3) {
			const options = c.options as {
				label: string
				description?: string
				value: string
			}[]
			if (
				!options?.length ||
				options.length > 25 ||
				options.some(
					(o) =>
						o.label.length > 100 ||
						(o.description?.length ?? 0) > 100 ||
						o.value.length > 100,
				)
			)
				throw new Error("Discord select limit exceeded")
		}
		validateComponents(c.components ?? [], depth + 1)
		if (c.accessory) validateComponents([c.accessory], depth + 1)
	}
}
/** The "Open a title" menu. `ref` is the list it sits on, so the opened card can go Back to it. */
export function titleSelect(
	titles: GuestTitle[],
	share = false,
	emojis: EmojiIds = {},
	ref?: ListRef,
): Component[] {
	const unique = [
		...new Map(
			titles.filter((t) => isTitleId(t.id)).map((t) => [t.id, t]),
		).values(),
	].slice(0, 25)
	return unique.length
		? [
				{
					type: 1,
					components: [
						{
							type: 3,
							custom_id: listCustomId(
								"open",
								ref ? formatListRef(ref) : share ? "public" : "private",
							),
							placeholder: "Open a title",
							options: unique.map((t) => {
								const score = hasGoodwatchScore(t.goodwatch_score)
									? goodwatchScoreDisplay(t.goodwatch_score)
									: null
								const name = score === null ? null : scoreEmojiName(score)
								return {
									label: displayText(t.name).slice(0, 100) || "Untitled",
									value: t.id,
									description: [
										t.year ?? "Year unknown",
										isMovie(t) ? "Movie" : "TV show",
										score === null ? null : `${score} · ${scoreWord(score)}`,
									]
										.filter(Boolean)
										.join(" · "),
									...(name && emojis[name]
										? { emoji: { id: emojis[name], name } }
										: {}),
								}
							}),
						},
					],
				},
			]
		: []
}

/** One ranked line: rank, score emoji, name, score, year, runtime. */
function rankedLine(
	t: GuestTitle,
	rank: number,
	emojis: EmojiIds,
	nameLimit = 180,
) {
	const score = hasGoodwatchScore(t.goodwatch_score)
		? goodwatchScoreDisplay(t.goodwatch_score)
		: null
	const emoji = score === null ? "" : scoreEmoji(score, emojis)
	return (
		[
			`**${rank}**  ${emoji ? `${emoji}  ` : ""}**${escape(t.name).slice(
				0,
				nameLimit,
			)}**`,
			score === null ? null : String(score),
			t.year ? String(t.year) : null,
			isMovie(t) && t.runtime_minutes ? runtime(t.runtime_minutes) : null,
		]
			.filter(Boolean)
			.join("  ·  ") +
		(reasonsLine(t.reasons)
			? `\n-# ${escape(reasonsLine(t.reasons)).slice(0, 80)}`
			: "")
	)
}

/** Up to ten posters as one media gallery, or null when none of the titles has a poster. */
function posterGallery(titles: GuestTitle[]): Component | null {
	const posters = titles.filter((t) => t.poster_url).slice(0, 10)
	return posters.length
		? {
				type: 12,
				items: posters.map((t) => ({
					media: { url: t.poster_url },
					description: `${t.name}${t.year ? ` (${t.year})` : ""}`.slice(
						0,
						1024,
					),
				})),
			}
		: null
}

/** "Page 2 of 22" after the subtitle, capitalized. */
function pageSubtitle(subtitle?: string, page?: number, pages?: number | null) {
	return [
		subtitle,
		page === undefined
			? null
			: `page ${page + 1}${
					pages ? ` of ${pages.toLocaleString("en-US")}` : ""
				}`,
	]
		.filter(Boolean)
		.join(" · ")
		.replace(/^./, (c) => c.toUpperCase())
}

const pageButtons = (
	page: number,
	hasNext: boolean,
	id: (page: number) => string,
): Component[] =>
	(
		[
			["Previous", Math.max(0, page - 1), page === 0],
			["Next", page + 1, !hasNext],
		] as const
	).map(([label, target, disabled]) => ({
		type: 2,
		style: 2,
		label,
		disabled,
		custom_id: id(target),
	}))

export const listHeading = (heading: string) =>
	`### ${escape(heading).slice(0, 200)}`

/**
 * 4D list card for /discover, /search, /similar, and /person lists: up to ten posters as one media gallery, the ranked
 * list below, then the title menu and paging. Lists without posters skip the gallery.
 */
export function titleListCard(
	heading: string,
	titles: GuestTitle[],
	options: {
		share?: boolean
		shareId?: string
		page?: number
		stateKey?: string
		/** The paging action for `stateKey`: /discover's by default, or /search's. */
		pageAction?: "discover" | "search"
		next?: boolean
		url?: string
		/** Small line under the heading, for example "Popular · every service in Germany". */
		subtitle?: string
		/** Total results, for "page 1 of 22". */
		total?: number
		emojis?: EmojiIds
		/** This list, for the Back button of the titles opened from it. */
		ref?: ListRef
	} = {},
) {
	const emojis = options.emojis ?? {}
	const shown = titles.slice(0, 10)
	const page = options.page
	const pages =
		typeof options.total === "number" && options.total > 0
			? Math.ceil(options.total / 10)
			: null
	const subtitle = pageSubtitle(options.subtitle, page, pages)
	const headingText = `${listHeading(heading)}${
		subtitle ? `\n-# ${subtitle.slice(0, 300)}` : ""
	}`
	// Reserve the heading and separators before dividing the remaining text budget among all ten rows.
	const rowBudget = Math.floor(
		(4000 - headingText.length - Math.max(0, shown.length - 1)) /
			Math.max(1, shown.length),
	)
	const rows = shown.map((t, i) => {
		const line = rankedLine(t, i + 1, emojis)
		return rankedLine(
			t,
			i + 1,
			emojis,
			Math.max(0, 180 - Math.max(0, line.length - rowBudget)),
		).slice(0, rowBudget)
	})
	const buttons: Component[] = []
	if (options.stateKey) {
		const action = options.pageAction ?? "discover"
		buttons.push(
			...pageButtons(page ?? 0, !!options.next, (target) =>
				listCustomId(action, `${options.stateKey}:${target}`),
			),
		)
	}
	if (options.url) buttons.push(linkButton("Open on GoodWatch", options.url))
	if (!options.share && options.shareId)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: options.shareId,
		})
	return message(
		[
			container(
				[
					text(headingText),
					posterGallery(shown),
					text(shown.length ? rows.join("\n") : "No titles found."),
					...titleSelect(shown, options.share, emojis, options.ref),
					buttons.length ? { type: 1, components: buttons } : null,
				],
				AMBER,
			),
		],
		!options.share,
	)
}
export interface GuestPerson {
	person_id: number
	name: string
	url: string
	profile_url?: string | null
	known_for_department?: string | null
	known_for?: GuestTitle[]
}

/** The person's portrait beside their name and department, their known-for posters, the ranked titles, and the menu. */
export function personCard(
	person: GuestPerson,
	share = false,
	options: { note?: string; emojis?: EmojiIds } = {},
) {
	const emojis = options.emojis ?? {}
	const titles = (person.known_for ?? []).slice(0, 10)
	const heading = text(
		`## ${escape(person.name).slice(0, 200)}${
			person.known_for_department
				? `\n-# ${escape(person.known_for_department)}`
				: ""
		}`,
	)
	const note = options.note ? text(`-# ${options.note}`) : null
	const buttons: Component[] = [linkButton("Open on GoodWatch", person.url)]
	if (!share)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: listCustomId("person-share", String(person.person_id)),
		})
	return message(
		[
			container(
				[
					...(person.profile_url
						? [
								{
									type: 9,
									components: [heading, ...(note ? [note] : [])],
									accessory: {
										type: 11,
										media: { url: person.profile_url },
										description: person.name.slice(0, 100),
									},
								},
							]
						: [heading, note]),
					posterGallery(titles),
					text(
						`-# Known for\n${
							titles.length
								? titles.map((t, i) => rankedLine(t, i + 1, emojis)).join("\n")
								: "No known-for titles available."
						}`,
					),
					...titleSelect(titles, share, emojis, {
						kind: "person",
						personId: person.person_id,
					}),
					{ type: 1, components: buttons },
				],
				AMBER,
			),
		],
		!share,
	)
}

/** One post about a hot title: who said it, where, a short text, and its image when it has one. */
export interface HotPost {
	url: string
	author: string
	/** "Bluesky", "YouTube", "Mastodon", or an article's publication. */
	platform: string
	kind: "post" | "video" | "article"
	text: string
	image?: string | null
	/** ISO time it was published. */
	at?: string | null
}
export interface HotTitle extends GuestTitle {
	rank?: number
	/** Places up since the day before (down is negative), "new" for a newcomer. */
	move?: number | "new" | null
	/** A dated hint of why people read about it, such as a trailer. Context, not a claimed cause. */
	reason?: { kind: string; day: string; season?: number } | null
	posts?: HotPost[]
}

/** Hot titles per /hot page: three posts-forward blocks fit Discord's 40 components with the menu and paging. */
export const HOT_PAGE_SIZE = 3

/** A post's text as a short one-line quote, links left out. */
export function shortQuote(value: string, max = 180) {
	const clean = value
		.replace(/https?:\/\/\S+/g, "")
		.replace(/\s+/g, " ")
		.trim()
	if (clean.length <= max) return escape(clean)
	const cut = clean.slice(0, max)
	const space = cut.lastIndexOf(" ")
	return `${escape(space > max / 2 ? cut.slice(0, space) : cut).replace(
		/[,.;:\\]+$/,
		"",
	)}…`
}

const moveWords = (move: HotTitle["move"]) =>
	move === "new"
		? "new today"
		: typeof move === "number" && move !== 0
			? `${move > 0 ? "up" : "down"} ${Math.abs(move)} since yesterday`
			: null

const reasonWords = (reason: HotTitle["reason"]) => {
	if (!reason) return null
	const day = new Date(`${reason.day}T12:00:00Z`)
	const on = Number.isFinite(day.getTime())
		? ` ${day.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				timeZone: "UTC",
			})}`
		: ""
	switch (reason.kind) {
		case "trailer":
			return `trailer${on}`
		case "new_season":
			return `${reason.season ? `season ${reason.season}` : "new season"}${on}`
		case "new_release":
			return `released${on}`
		case "netflix_top10":
			return "in the Netflix top 10"
		default:
			return null
	}
}

const postButtonLabel = (post: HotPost) =>
	post.kind === "video"
		? `Watch on ${post.platform}`
		: post.kind === "article"
			? `Read on ${post.platform}`
			: `View post on ${post.platform}`

/** One hot title: poster beside the rank, title and score, then what people say, their images, and links to the posts. */
function hotBlock(title: HotTitle, emojis: EmojiIds): Component {
	const posts = (title.posts ?? []).slice(0, 2)
	const lead = [
		title.rank ? `No. ${title.rank} on socials` : null,
		moveWords(title.move),
		reasonWords(title.reason),
	]
		.filter(Boolean)
		.join(", ")
	const heading = text(
		`${lead ? `-# ${lead}\n` : ""}### ${escape(title.name).slice(0, 150)}${
			title.year ? ` (${title.year})` : ""
		}\n${scoreLine(title.goodwatch_score, emojis)}`,
	)
	const quotes = text(
		posts.length
			? posts
					.map((p) => {
						const at = p.at ? Date.parse(p.at) : Number.NaN
						// An article without a byline has its site's address as author; the publication says enough.
						const who = /^[\w-]+(\.[\w-]+)+$/.test(p.author)
							? escape(p.platform)
							: `${escape(p.author).slice(0, 60)} on ${escape(p.platform)}`
						return `> ${shortQuote(p.text)}\n-# ${who}${
							Number.isFinite(at) ? `  ·  <t:${Math.floor(at / 1000)}:R>` : ""
						}`
					})
					.join("\n")
			: "-# No posts picked for it yet.",
	)
	const images = posts.filter((p) => p.image)
	// Without post images the backdrop keeps the block cinematic.
	const gallery = images.length
		? images.map((p) => ({
				media: { url: p.image },
				description: `Image from ${p.author} on ${p.platform}`.slice(0, 1024),
			}))
		: title.backdrop_url
			? [
					{
						media: { url: title.backdrop_url },
						description: `${title.name} backdrop`.slice(0, 1024),
					},
				]
			: []
	const labels = posts.map(postButtonLabel)
	const same = labels.length > 1 && labels[0] === labels[1]
	return container(
		[
			title.poster_url
				? {
						type: 9,
						components: [heading, quotes],
						accessory: {
							type: 11,
							media: { url: title.poster_url },
							description: `${title.name} poster`.slice(0, 1024),
						},
					}
				: null,
			...(title.poster_url ? [] : [heading, quotes]),
			gallery.length ? { type: 12, items: gallery } : null,
			posts.length
				? {
						type: 1,
						components: posts.map((p, i) =>
							linkButton(
								(same ? `${p.author} on ${p.platform}` : labels[i]).slice(
									0,
									80,
								),
								p.url,
							),
						),
					}
				: null,
		],
		scoreAccent(title.goodwatch_score) ?? AMBER,
	)
}

/**
 * /hot: what people say about each hot title, three titles a page. Each title is its own block with its poster, rank,
 * score, up to two quoted posts with their images, and a link to each post; the menu opens a title, paging walks the
 * board.
 */
export function hotCard(
	titles: HotTitle[],
	options: {
		page?: number
		share?: boolean
		subtitle?: string
		emojis?: EmojiIds
	} = {},
) {
	const emojis = options.emojis ?? {}
	const pages = Math.max(1, Math.ceil(titles.length / HOT_PAGE_SIZE))
	const page = Math.min(Math.max(0, options.page ?? 0), pages - 1)
	const shown = titles.slice(page * HOT_PAGE_SIZE, (page + 1) * HOT_PAGE_SIZE)
	const buttons: Component[] = [
		...(pages > 1
			? pageButtons(page, page + 1 < pages, (target) =>
					listCustomId("hot", String(target)),
				)
			: []),
		linkButton("Open on GoodWatch", "https://goodwatch.app/hot-on-socials"),
		...(!options.share
			? [
					{
						type: 2,
						style: 2,
						label: "Share to channel",
						custom_id: listCustomId("hot-share", String(page)),
					},
				]
			: []),
	]
	const subtitle = pageSubtitle(
		options.subtitle ?? "What people are saying right now",
		pages > 1 ? page : undefined,
		pages,
	)
	return message(
		[
			text(`## Hot\n-# ${subtitle}`),
			...(shown.length
				? shown.map((t) => hotBlock(t, emojis))
				: [text("Nothing is hot right now. Try again later.")]),
			...titleSelect(shown, options.share, emojis, { kind: "hot", page }),
			{ type: 1, components: buttons },
		],
		!options.share,
	)
}

/** 8B link prompt: three concrete benefits and the Link GoodWatch button. `reason` names the command that needs it. */
export function linkPromptCard(url: string, reason?: string) {
	return message([
		container(
			[
				text(
					`${
						reason ? `-# ${reason}\n` : ""
					}## Link GoodWatch\n- Your taste match on every title\n- Picks from your own services\n- Rate, log, and add to your Wishlist without leaving Discord`,
				),
				{ type: 1, components: [linkButton("Link GoodWatch", url)] },
				text("-# Takes about a minute. Unlink any time with /unlink."),
			],
			AMBER,
		),
	])
}

/** 9B slow down: a quiet grey card with the limit and a countdown in each viewer's own time. */
export function slowDownCard(retryAfterSeconds: number, now = Date.now()) {
	const at = Math.ceil(now / 1000) + Math.max(1, Math.ceil(retryAfterSeconds))
	return message([
		container(
			[
				text(
					`### Slow down\nYou can send 30 commands a minute and 500 an hour. Try again <t:${at}:R>.`,
				),
			],
			QUIET_GREY,
		),
	])
}
export type LinkedIdentity = string | { name: string }
export function linkedCard(identity?: LinkedIdentity | null) {
	return message([
		{
			type: 17,
			components: [
				{
					type: 10,
					content: `## Linked to GoodWatch${
						identity
							? `\n${escape(
									typeof identity === "string" ? `@${identity}` : identity.name,
								).slice(0, 100)}`
							: ""
					}`,
				},
				{
					type: 1,
					components: [
						{ type: 2, style: 2, label: "Unlink", custom_id: "gw:unlink:ask" },
					],
				},
			],
		},
	])
}
