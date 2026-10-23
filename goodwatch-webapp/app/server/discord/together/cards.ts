import {
	message,
	container,
	titleFacts,
	displayText,
	plural,
	serviceNames,
	serviceLogos,
	textLength,
	componentCount,
	streamLinks,
	whereToWatchLine,
	type EmojiIds,
	type Component,
	type GuestTitle,
} from "../cards.ts"
import { togetherCustomId } from "../custom-id.ts"
import { themeChoices } from "../filter-options.ts"
import { commands } from "../commands.ts"
import { nextTitle, isExhausted, topThree, summarySignature } from "./rules.ts"
import { ogImageUrl } from "../../../utils/og-image-url.ts"
import { titlePath } from "../../../utils/helpers.ts"
import type { Session, DeckPlace } from "./store.server.ts"
const safe = (s: string) =>
	displayText(s)
		.replace(/[\\*_~`|>#[\]]/g, "\\$&")
		.replace(/@/g, "＠")
		.slice(0, 120)
const text = (content: string): Component => ({ type: 10, content })
const row = (components: Component[]): Component => ({ type: 1, components })
function poster(title: GuestTitle, content: string): Component {
	return title.poster_url
		? {
				type: 9,
				components: [text(content)],
				accessory: {
					type: 11,
					media: { url: title.poster_url },
					description: safe(title.name),
				},
			}
		: text(content)
}
/** Where to watch as text for the voting card and the decision: the place line, then each service's logo and name. */
function watch(title: GuestTitle, place: DeckPlace, emojis: EmojiIds) {
	return `${whereToWatchLine(place.country, !place.services.length)}\n${serviceNames(
		title,
		emojis,
		3,
	)}`
}
/** The decision uses the title card's subscription buttons and country menu. */
function decisionLinks(title: GuestTitle, place: DeckPlace, emojis: EmojiIds) {
	const links = streamLinks(title, place.country, {
		allServices: !place.services.length,
		emojis,
	})
	return links
}
/** Text budget below Discord's 4000 characters, with room for the cleanup message() applies. */
const PUBLIC_TEXT_BUDGET = 3900
export function publicCard(
	session: Session,
	titles: GuestTitle[] = [],
	emojis: EmojiIds = {},
) {
	const { meta, summary } = session
	if (meta.status !== "open") return closedCard(session, emojis)
	const removable = Object.keys(session.votes)
	let matchCount = Math.min(summary.matches.length, 5)
	let possibleCount = Math.min(
		summary.possibleMatches.length,
		removable.length && matchCount ? 4 : 5,
	)
	// Long names and many logos can pass Discord's limits: drop possible matches first, then matches, from the end.
	let components = publicComponents(
		session,
		titles,
		emojis,
		matchCount,
		possibleCount,
	)
	while (
		(textLength(components) > PUBLIC_TEXT_BUDGET ||
			componentCount(components) > 40) &&
		matchCount + possibleCount > 0
	) {
		if (possibleCount) possibleCount--
		else matchCount--
		components = publicComponents(
			session,
			titles,
			emojis,
			matchCount,
			possibleCount,
		)
	}
	return message(components, false)
}
function publicComponents(
	session: Session,
	titles: GuestTitle[],
	emojis: EmojiIds,
	matchCount: number,
	possibleCount: number,
): Component[] {
	const { meta, summary } = session
	const moodOption = commands
		.find((c) => c.name === "together")
		?.options.find((o) => o.name === "mood")
	const mood =
		moodOption && "choices" in moodOption
			? moodOption.choices.find((c) => c.value === meta.mood)?.name
			: undefined
	const theme = themeChoices.find((choice) => choice.value === meta.theme)?.name
	const byId = new Map(titles.map((t) => [t.id, t]))
	const matches = summary.matches.slice(0, matchCount)
	const removable = Object.keys(session.votes)
	const possible = summary.possibleMatches.slice(0, possibleCount)
	const titleRow = (id: string, label: string) => {
		const t = byId.get(id) ?? { id, name: "Title unavailable", year: null }
		return poster(
			t,
			`### ${safe(t.name)}\n${titleFacts(t, emojis)}\n**${label}**\n${serviceLogos(
				t,
				emojis,
				3,
			)}`,
		)
	}
	const exhausted = isExhausted(session, meta.deckDone)
	const anyRows = matches.length || possible.length || exhausted
	return [
		container(
			[
				text(
					`## Let's watch together\nStarted by ${safe(
						meta.starterName ?? "the starter",
					)} · ${
						meta.type === "any"
							? "Movies and shows"
							: meta.type === "movie"
								? "Movies"
								: "Shows"
					}${mood ? ` · ${safe(mood)}` : ""}${theme ? ` · ${safe(theme)}` : ""}`,
				),
				text(
					`${plural(summary.participantCount, "participant")} · ${
						summary.stillVoting
					} still voting${
						anyRows
							? `\n${whereToWatchLine(meta.place.country, !meta.place.services.length)}`
							: ""
					}`,
				),
				...matches.map((id) =>
					titleRow(
						id,
						`Match · picked by ${
							Object.values(session.picks ?? {}).filter((pick) => pick === id)
								.length
						} of ${summary.participantCount}`,
					),
				),
				...(summary.matches.length > matches.length
					? [
							text(
								`and ${plural(summary.matches.length - matches.length, "more match", "more matches")}`,
							),
						]
					: []),
				...possible.map((p) =>
					titleRow(
						p.titleId,
						`Possible match · waiting for ${plural(p.waitingFor, "person", "people")}`,
					),
				),
				...(summary.possibleMatches.length > possible.length
					? [
							text(
								`and ${plural(
									summary.possibleMatches.length - possible.length,
									"more possible match",
									"more possible matches",
								)}`,
							),
						]
					: []),
				...(!summary.matches.length && !summary.possibleMatches.length
					? [text("Join and vote privately. Matches appear here as you vote.")]
					: []),
				...(exhausted
					? [
							text(
								"Deck exhausted. The starter can choose from the three titles with the most Yep votes.",
							),
							...topThree(session).map((t) =>
								titleRow(
									t.titleId,
									`${t.yep} of ${summary.participantCount} voted Yep`,
								),
							),
							select(
								session,
								"choose",
								"Starter: choose a title",
								topThree(session).map((t) => ({
									label: safe(
										byId.get(t.titleId)?.name ?? "Title unavailable",
									).slice(0, 80),
									value: t.titleId,
								})),
							),
						]
					: []),
				...(summary.matches.length
					? [
							select(
								session,
								"pick",
								"Pick a match",
								summary.matches.slice(0, 25).map((id) => ({
									label: safe(byId.get(id)?.name ?? "Title unavailable").slice(
										0,
										80,
									),
									value: id,
								})),
							),
						]
					: []),
				...(removable.length
					? [
							select(
								session,
								"remove",
								"Starter: remove a participant",
								removable.slice(0, 12).map((id, i) => ({
									label: safe(
										session.names?.[id] ?? `Participant ${i + 1}`,
									).slice(0, 80),
									value: id,
								})),
							),
						]
					: []),
				row([
					{
						type: 2,
						style: 1,
						label: "Join",
						custom_id: togetherCustomId("join", meta.id),
					},
					{
						type: 2,
						style: 2,
						label: "End",
						custom_id: togetherCustomId("end", meta.id),
					},
				]),
			],
			0xf59e0b,
		),
	]
}
export function votingCard(
	session: Session,
	user: string,
	title?: GuestTitle,
	emojis: EmojiIds = {},
) {
	const id = nextTitle(session, user)
	const last = session.votes[user]?.at(-1)?.titleId
	const button = (
		label: string,
		action: "yep" | "nope" | "undo" | "leave",
		style: number,
		titleId?: string,
		disabled = false,
	): Component => ({
		type: 2,
		label,
		style,
		custom_id: togetherCustomId(action, session.meta.id, titleId),
		disabled,
	})
	const voting = id && title
	return message([
		container(
			[
				text(
					`-# Together · title ${
						id ? session.deck.indexOf(id) + 1 : session.deck.length
					} of ${session.deck.length}`,
				),
				voting
					? poster(
							title,
							`## ${safe(title.name)}\n${titleFacts(title, emojis)}\n${watch(
								title,
								session.meta.place,
								emojis,
							)}`,
						)
					: text("You've voted on every title for now."),
				row([
					...(voting
						? [button("Yep", "yep", 3, id), button("Nope", "nope", 4, id)]
						: []),
					button("Undo", "undo", 2, last, !last),
					button("Leave", "leave", 2),
				]),
				...(voting &&
				title.trailer_url &&
				/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(
					title.trailer_url,
				)
					? [
							row([
								{ type: 2, style: 5, label: "Trailer", url: title.trailer_url },
							]),
						]
					: []),
			],
			0xf59e0b,
		),
	])
}
export function installCard(appId: string) {
	// VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES
	const permissions = (1 << 10) | (1 << 11) | (1 << 14) | (1 << 15)
	const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
		appId,
	)}&scope=bot+applications.commands&permissions=${permissions}`
	return message([
		text("Add GoodWatch to this server to start a /together session."),
		row([{ type: 2, style: 5, label: "Add GoodWatch to this server", url }]),
	])
}

function select(
	session: Session,
	action: "pick" | "remove" | "choose",
	placeholder: string,
	options: { label: string; value: string }[],
) {
	return row([
		{
			type: 3,
			custom_id: togetherCustomId(action, session.meta.id),
			placeholder,
			min_values: 1,
			max_values: 1,
			options,
		},
	])
}
function closedCard(session: Session, emojis: EmojiIds) {
	const { meta } = session
	if (meta.status !== "decided")
		return message(
			[
				container(
					[
						text(
							meta.status === "ended"
								? "## Ended by the starter"
								: "## This session expired",
						),
						text("Start a new one with /together."),
					],
					0x4e5058,
				),
			],
			false,
		)
	const title = meta.decisionTitle ?? {
		id: meta.decidedTitleId!,
		name: "Title unavailable",
		year: null,
	}
	const [kind, id] = title.id.split(":")
	const url = `https://goodwatch.app${titlePath(kind, Number(id), title.name)}`
	return message(
		[
			container(
				[
					text(
						`## Decided: ${safe(title.name)}\n${
							meta.decisionBy === "starter"
								? "Chosen by the starter."
								: `Everyone picked it. **${
										session.summary.participantCount
									} of ${plural(
										session.summary.participantCount,
										"participant",
									)}**.`
						}`,
					),
					{
						type: 12,
						items: [
							{
								media: { url: ogImageUrl(url) },
								description: safe(title.name),
							},
						],
					},
					text(titleFacts(title, emojis)),
					...(meta.availabilityFailed
						? [
								text(
									"Availability couldn't be checked. Check Where to watch on GoodWatch before starting.",
								),
							]
						: decisionLinks(title, meta.place, emojis)),
					row([{ type: 2, style: 5, label: "Open on GoodWatch", url }]),
				],
				0xf59e0b,
			),
		],
		false,
	)
}
/** Includes every visible state, including name changes, so the throttle never drops a pick or closure. */
export function publicSignature(session: Session) {
	if (session.meta.status !== "open")
		return JSON.stringify([
			session.meta.status,
			session.summary.participantCount,
			session.meta.decidedTitleId,
			session.meta.decisionBy,
			ordered(session.meta.decisionTitle),
			session.meta.availabilityFailed,
		])
	return JSON.stringify([
		summarySignature(session.summary),
		session.meta.status,
		session.meta.decidedTitleId,
		ordered(session.meta.decisionTitle),
		session.meta.availabilityFailed,
		session.meta.deckDone,
		Object.entries(session.picks ?? {}).sort(),
		Object.entries(session.names ?? {}).sort(),
		isExhausted(session, session.meta.deckDone) ? topThree(session) : [],
	])
}

function ordered(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(ordered)
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, entry]) => [key, ordered(entry)]),
		)
	return value
}
