import { episodeCode } from "../../domain/episode-label.ts"
import {
	type GuestTitle,
	type MemberMarks,
	type EmojiIds,
	type Component,
	container,
	titleHero,
	whereToWatch,
	titleButtons,
	memberBlock,
	memberButtons,
	message,
	scoreAccent,
	titleSelect,
	displayText,
	AMBER,
} from "./cards.ts"

/** 3C: wide backdrop, with a small invitation to link beneath a guest's pick. */
export function watchCard(
	title: GuestTitle,
	country: string,
	options: {
		another: string
		origin: string
		allServices?: boolean
		member?: MemberMarks
		emojis?: EmojiIds
		episode?: { code: string; name: string | null } | null
	},
) {
	const buttons = titleButtons(title).components!.filter(
		(b) =>
			b.label !== "Similar" &&
			(options.member === undefined || b.label !== "Share to channel"),
	)
	buttons.unshift({
		type: 2,
		style: 1,
		label: "Another",
		custom_id: options.another,
	})
	return message([
		container(
			[
				...titleHero(title, options.emojis, { eyebrow: "Your next pick" }),
				options.episode
					? {
							type: 10,
							content: displayText(
								`${options.episode.code}${options.episode.name ? ` · ${options.episode.name}` : ""}`,
							)
								.replace(/@/g, "＠")
								.slice(0, 300),
						}
					: null,
				{
					type: 10,
					content: whereToWatch(title, country, {
						allServices: options.allServices,
					}),
				},
				{ type: 1, components: buttons },
				options.member === undefined
					? {
							type: 1,
							components: [
								{
									type: 2,
									style: 5,
									label: "Link GoodWatch for picks that fit your taste",
									url: new URL("/discord/link", options.origin).href,
								},
							],
						}
					: null,
			],
			title.backdrop_url ? undefined : scoreAccent(title.goodwatch_score),
		),
		...(options.member !== undefined
			? [
					memberBlock(
						title,
						options.member,
						memberButtons(title, options.member),
					),
				]
			: []),
	])
}
export interface NextEpisode {
	displaySeason?: number
	displayNumber?: number
	season: number
	number: number
	name: string | null
}
export function nextCard(
	rows: { title: GuestTitle; episode: NextEpisode }[],
	country: string,
	allServices: boolean,
) {
	// Each entry costs at most four components. Eight entries leave space for the heading and menu.
	const shown = rows.slice(0, 8)
	const clean = (value: string, max: number) =>
		displayText(value)
			.replace(/@/g, "＠")
			.replace(/[\\*_~`|>#[\]]/g, "\\$&")
			.slice(0, max)
	return message([
		container(
			[
				{ type: 10, content: "## Watch next" },
				...shown.map(({ title, episode }): Component => {
					const text: Component = {
						type: 10,
						content: `### ${clean(title.name, 100)}\n${episodeCode(episode)}${
							episode.name ? ` · ${clean(episode.name, 100)}` : ""
						}\n${whereToWatch(title, country, {
							allServices,
							providerTextLimit: 120,
						})}`,
					}
					const image = title.poster_url ?? title.backdrop_url
					return image
						? {
								type: 9,
								components: [text],
								accessory: {
									type: 11,
									media: { url: image },
									description: displayText(title.name).slice(0, 100),
								},
							}
						: text
				}),
				...titleSelect(shown.map((r) => r.title)),
				!shown.length
					? {
							type: 10,
							content:
								"No next episodes right now. Add shows on GoodWatch to start watching.",
						}
					: null,
			],
			AMBER,
		),
	])
}
