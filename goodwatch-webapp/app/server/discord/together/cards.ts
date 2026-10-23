import {
	message,
	container,
	titleFacts,
	displayText,
	type EmojiIds,
	type Component,
	type GuestTitle,
} from "../cards.ts"
import { togetherCustomId } from "../custom-id.ts"
import { commands } from "../commands.ts"
import { nextTitle } from "./rules.ts"
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
function watch(title: GuestTitle, place: DeckPlace) {
	const names = [
		...new Set(
			(title.availability?.offers ?? [])
				.filter(
					(o) =>
						!o.offer_type || ["flatrate", "free", "ads"].includes(o.offer_type),
				)
				.map((o) => safe(o.name ?? "Provider").slice(0, 30)),
		),
	].slice(0, 3)
	return `Where to watch · ${place.country}${
		place.services.length ? "" : " (all services)"
	}: ${
		names.join(", ") ||
		(title.availability?.state === "no_match"
			? "No current offers found."
			: "Availability unknown.")
	}`
}
export function publicCard(
	session: Session,
	titles: GuestTitle[] = [],
	emojis: EmojiIds = {},
) {
	const { meta, summary } = session
	const moodOption = commands
		.find((c) => c.name === "together")
		?.options.find((o) => o.name === "mood")
	const mood =
		moodOption && "choices" in moodOption
			? moodOption.choices.find((c) => c.value === meta.mood)?.name
			: undefined
	const byId = new Map(titles.map((t) => [t.id, t]))
	const matches = summary.matches.slice(0, 5)
	const possible = summary.possibleMatches.slice(0, 5)
	const titleRow = (id: string, label: string) => {
		const t = byId.get(id) ?? { id, name: "Title unavailable", year: null }
		return poster(
			t,
			`### ${safe(t.name)}\n${titleFacts(t, emojis)}\n**${label}**\n${watch(t, meta.place)}`,
		)
	}
	return message(
		[
			container(
				[
					text(
						`## Let's watch together\nStarted by <@${meta.starterId}> · ${
							meta.type === "any"
								? "Movies and shows"
								: meta.type === "movie"
									? "Movies"
									: "Shows"
						}${mood ? ` · ${safe(mood)}` : ""}`,
					),
					text(
						`${summary.participantCount} participants · ${summary.stillVoting} still voting`,
					),
					...matches.map((id) => titleRow(id, "Match")),
					...(summary.matches.length > 5
						? [text(`and ${summary.matches.length - 5} more matches`)]
						: []),
					...possible.map((p) =>
						titleRow(p.titleId, `Possible match · waiting for ${p.waitingFor}`),
					),
					...(summary.possibleMatches.length > 5
						? [
								text(
									`and ${
										summary.possibleMatches.length - 5
									} more possible matches`,
								),
							]
						: []),
					...(!matches.length && !possible.length
						? [
								text(
									"Join and vote privately. Matches appear here as you vote.",
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
					]),
				],
				0xf59e0b,
			),
		],
		false,
	)
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
