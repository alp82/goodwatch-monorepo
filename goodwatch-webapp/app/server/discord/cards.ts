import type { Score } from "../scores.server.ts"
import {
	getVibeColorValue,
	goodwatchScoreDisplay,
	hasGoodwatchScore,
	scoreLabels,
} from "../../utils/ratings.ts"
import { titlePath } from "../../utils/helpers.ts"
import { formatCustomId, listCustomId, isTitleId } from "./custom-id.ts"
import { scoreEmojiName } from "./score-emoji.ts"
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
		offers: { name?: string; stream_link: string; offer_type?: string }[]
	}
}
/** Application emoji IDs by name (`gw_score_1` to `gw_score_10`). Missing names render as plain text. */
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
function textLength(components: Component[]): number {
	return components.reduce(
		(n, c) =>
			n +
			(c.type === 10 ? String(c.content ?? "").length : 0) +
			textLength(c.components ?? []),
		0,
	)
}
export function message(components: Component[], ephemeral = true) {
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
		.replace(
			/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
			"this change",
		)
		.replace(/\b\d{15,20}\b/g, "this change")
		.replace(/_/g, " ")
}
export const textCard = (text: string) =>
	message([{ type: 10, content: displayText(text).slice(0, 4000) }])
const escape = (text: string) =>
	displayText(text)
		.replace(/[\\*_~`|>#[\]]/g, "\\$&")
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
	return /^(United |Netherlands$|Philippines$|Bahamas$|Gambia$|Maldives$|Czech Republic$|Dominican Republic$|Central African Republic$|.* Islands$)/.test(
		name,
	)
		? `the ${name}`
		: name
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

/** The site's score word for a displayed score: the title page rule, rounded to the nearest band. */
export const scoreWord = (score: number) =>
	scoreLabels[Math.min(10, Math.max(1, Math.round(score / 10)))]

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
	if (hero)
		return [
			hero,
			text(`${eyebrow}# ${name}\n${titleFacts(title, emojis)}`),
			text(shortOverview(title.synopsis, 150)),
		]
	const facts = text(`${eyebrow}## ${name}\n${titleFacts(title, emojis)}`)
	const overview = text(shortOverview(title.synopsis, 160))
	return title.poster_url
		? [
				{
					type: 9,
					components: [facts, overview],
					accessory: {
						type: 11,
						media: { url: title.poster_url },
						description: `${displayText(title.name)} poster`.slice(0, 1024),
					},
				},
			]
		: [facts, overview]
}

/**
 * Where to watch: provider names, or each offer's link after Where to watch. `heading` replaces the small line, for
 * example the member's "On your services in France".
 */
export function whereToWatch(
	title: GuestTitle,
	country: string,
	options: { offers?: boolean; allServices?: boolean; heading?: string } = {},
) {
	const offers = title.availability?.offers ?? []
	const names = [
		...new Set(offers.map((o) => escape(o.name ?? "Provider"))),
	].slice(0, 10)
	const body = offers.length
		? options.offers
			? offers
					.slice(0, 20)
					.map(
						(o) =>
							`${o.stream_link}${
								o.offer_type ? ` (${escape(o.offer_type)})` : ""
							}`,
					)
					.join("\n")
			: names.map((n) => `**${n}**`).join("  ·  ")
		: title.availability?.state === "no_match"
			? "No current offers found."
			: "Availability unknown."
	const heading =
		options.heading ??
		`Where to watch ${
			options.allServices ? "on every service " : ""
		}in ${countryName(country)}`
	return `-# ${heading}\n${body}`.slice(0, 3000)
}

export function titleButtons(title: GuestTitle, share = false): Component {
	const [kind, id] = title.id.split(":")
	const buttons: Component[] = [
		{
			type: 2,
			style: 2,
			label: "Where to watch",
			custom_id: formatCustomId("watch", title.id),
		},
		{
			type: 2,
			style: 2,
			label: "Similar",
			custom_id: formatCustomId("similar", title.id),
		},
		linkButton(
			"Open on GoodWatch",
			`https://goodwatch.app${titlePath(kind, Number(id), title.name)}`,
		),
	]
	if (!share)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: formatCustomId("share", title.id),
		})
	return { type: 1, components: buttons }
}

function memberButtons(title: GuestTitle, marks: MemberMarks): Component[] {
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
		custom_id: formatCustomId(action, title.id),
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

/** The member's own place for the 2C member block: their country, and whether they chose services. */
export interface MemberPlace {
	country: string
	ownServices: boolean
}

/**
 * 1C guest title card, and 2C for members: the same guest container on top (what Share posts, from the guest read and
 * place) and the member block below it. `memberTitle` is the member's own read of the title: its taste match, and its
 * availability for `memberPlace` when that place is given. Share copies never get member data even when it is passed.
 */
export function titleCard(
	title: GuestTitle,
	country: string,
	options: {
		share?: boolean
		offers?: boolean
		member?: MemberMarks
		memberTitle?: GuestTitle
		memberPlace?: MemberPlace
		memberButtons?: Component[]
		emojis?: EmojiIds
		allServices?: boolean
	} = {},
) {
	const share = !!options.share
	const guest = container(
		[
			...titleHero(title, options.emojis),
			separator(),
			text(
				whereToWatch(title, country, {
					offers: options.offers,
					allServices: options.allServices,
				}),
			),
			titleButtons(title, share),
		],
		title.backdrop_url ? undefined : scoreAccent(title.goodwatch_score),
	)
	const mine = options.memberTitle ?? title
	const place = options.memberPlace
	return message(
		options.member && !share
			? [
					guest,
					memberBlock(
						mine,
						options.member,
						options.memberButtons ?? memberButtons(mine, options.member),
						place
							? whereToWatch(mine, place.country, {
									offers: options.offers,
									heading: `${
										place.ownServices ? "On your services" : "On every service"
									} in ${countryName(place.country)}`,
								})
							: undefined,
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
export function titleSelect(
	titles: GuestTitle[],
	share = false,
	emojis: EmojiIds = {},
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
							custom_id: listCustomId("open", share ? "public" : "private"),
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
function rankedLine(t: GuestTitle, rank: number, emojis: EmojiIds) {
	const score = hasGoodwatchScore(t.goodwatch_score)
		? goodwatchScoreDisplay(t.goodwatch_score)
		: null
	const emoji = score === null ? "" : scoreEmoji(score, emojis)
	return [
		`**${rank}**  ${emoji ? `${emoji}  ` : ""}**${escape(t.name).slice(
			0,
			180,
		)}**`,
		score === null ? null : String(score),
		t.year ? String(t.year) : null,
		isMovie(t) && t.runtime_minutes ? runtime(t.runtime_minutes) : null,
	]
		.filter(Boolean)
		.join("  ·  ")
}

/**
 * 4D list card for /discover, /similar, and /hot: up to ten posters as one media gallery, the ranked list below, then
 * the title menu and paging. Lists without posters skip the gallery.
 */
export function titleListCard(
	heading: string,
	titles: GuestTitle[],
	options: {
		share?: boolean
		shareId?: string
		page?: number
		stateKey?: string
		next?: boolean
		url?: string
		/** Small line under the heading, for example "Popular · every service in Germany". */
		subtitle?: string
		/** Total results, for "page 1 of 22". */
		total?: number
		emojis?: EmojiIds
	} = {},
) {
	const emojis = options.emojis ?? {}
	const shown = titles.slice(0, 10)
	const page = options.page
	const pages =
		typeof options.total === "number" && options.total > 0
			? Math.ceil(options.total / 10)
			: null
	const subtitle = [
		options.subtitle,
		page === undefined
			? null
			: `page ${page + 1}${
					pages ? ` of ${pages.toLocaleString("en-US")}` : ""
				}`,
	]
		.filter(Boolean)
		.join(" · ")
		.replace(/^./, (c) => c.toUpperCase())
	const posters = shown.filter((t) => t.poster_url)
	const buttons: Component[] = []
	if (options.stateKey) {
		for (const [label, target, disabled] of [
			["Previous", Math.max(0, (page ?? 0) - 1), (page ?? 0) === 0],
			["Next", (page ?? 0) + 1, !options.next],
		] as const)
			buttons.push({
				type: 2,
				style: 2,
				label,
				disabled,
				custom_id: listCustomId("discover", `${options.stateKey}:${target}`),
			})
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
					text(
						`### ${escape(heading).slice(0, 200)}${
							subtitle ? `\n-# ${subtitle.slice(0, 300)}` : ""
						}`,
					),
					posters.length
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
						: null,
					text(
						shown.length
							? shown.map((t, i) => rankedLine(t, i + 1, emojis)).join("\n")
							: "No titles found.",
					),
					...titleSelect(shown, options.share, emojis),
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
export function personCard(
	person: GuestPerson,
	share = false,
	options: { note?: string } = {},
) {
	const titles = (person.known_for ?? []).slice(0, 10)
	const heading: Component = {
		type: 10,
		content: `## ${escape(person.name).slice(0, 200)}\n${escape(
			person.known_for_department ?? "",
		)}`,
	}
	const buttons: Component[] = [
		{ type: 2, style: 5, label: "Open on GoodWatch", url: person.url },
	]
	if (!share)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: listCustomId("person-share", String(person.person_id)),
		})
	return message(
		[
			person.profile_url
				? {
						type: 9,
						components: [heading],
						accessory: {
							type: 11,
							media: { url: person.profile_url },
							description: person.name.slice(0, 100),
						},
					}
				: heading,
			...(options.note ? [text(`-# ${options.note}`)] : []),
			{
				type: 10,
				content: `**Known for**\n${
					titles.length
						? titles
								.map(
									(t) =>
										`${escape(t.name).slice(0, 180)}${
											t.year ? ` (${t.year})` : ""
										}`,
								)
								.join("\n")
						: "No known-for titles available."
				}`,
			},
			...titleSelect(titles, share),
			{ type: 1, components: buttons },
		],
		!share,
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
