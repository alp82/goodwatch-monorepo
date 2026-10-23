import { scoreLabels } from "../../utils/ratings.ts"
import {
	type GuestTitle,
	message,
	AMBER,
	displayText,
	container,
	titleHero,
	scoreLine,
	scoreAccent,
	titlePageUrl,
	type EmojiIds,
} from "./cards.ts"
import { scoreEmojiName } from "./score-emoji.ts"
import {
	formatCustomId,
	formatListRef,
	listCustomId,
	undoCustomId,
	type ListRef,
} from "./custom-id.ts"

const escape = (text: string) =>
	displayText(text)
		.replace(/[\\*_~`|>#[\]]/g, "\\$&")
		.replace(/@/g, "＠")
const nameOf = (title: GuestTitle) => escape(title.name.slice(0, 250))
export function linkPrompt(origin: string) {
	return message([
		{
			type: 17,
			accent_color: AMBER,
			components: [
				{
					type: 10,
					content:
						"## Link GoodWatch\n- Your taste match on every title\n- Picks from your own services\n- Rate, log, and add to your Wishlist without leaving Discord",
				},
				{
					type: 1,
					components: [
						{
							type: 2,
							style: 5,
							label: "Link GoodWatch",
							url: new URL("/discord/link", origin).href,
						},
					],
				},
				{
					type: 10,
					content: "-# Takes about a minute. Unlink any time with /unlink.",
				},
			],
		},
	])
}
/**
 * The score menu that replaces the title card when Rate is pressed: 10 at the top, one compact row per score with
 * its color emoji. A menu message, not a modal, so Discord shows no form warning. `back` is the list the title was
 * opened from; Cancel returns to the title card with it.
 */
export function ratePicker(
	title: GuestTitle,
	current?: number | null,
	back?: ListRef,
	emojis: EmojiIds = {},
) {
	return message([
		container(
			[
				{
					type: 10,
					content: `### Rate ${nameOf(title)}${
						title.year ? ` (${title.year})` : ""
					}`,
				},
				{
					type: 1,
					components: [
						{
							type: 3,
							custom_id: formatCustomId("rate-submit", title.id, back),
							placeholder:
								current != null ? `Your score: ${current}` : "Choose a score",
							min_values: 1,
							max_values: 1,
							options: Array.from({ length: 10 }, (_, i) => {
								const score = 10 - i
								const name = scoreEmojiName(score * 10)
								return {
									label: `${score} · ${scoreLabels[score]}`,
									value: String(score),
									...(emojis[name] ? { emoji: { id: emojis[name], name } } : {}),
									...(current === score ? { default: true } : {}),
								}
							}),
						},
					],
				},
				{
					type: 1,
					components: [
						{
							type: 2,
							style: 2,
							label: "Cancel",
							custom_id: formatCustomId("watch", title.id, back),
						},
					],
				},
			],
			current != null ? scoreAccent(current, "member") : AMBER,
		),
	])
}
export function writeConfirmation(
	title: GuestTitle,
	batchId: string,
	action: "rate" | "seen" | "want",
	score?: number,
	wanted = true,
	back?: ListRef,
) {
	const confirmation =
		action === "rate"
			? `Rated ${scoreLine(score, {}, "member")}`
			: action === "seen"
				? "Logged a watch today"
				: wanted
					? "Added to your Wishlist"
					: "Removed from your Wishlist"
	return message([
		container(
			[
				...titleHero(title, {}, { eyebrow: confirmation }),
				{
					type: 1,
					components: [
						...(back ? [backButton(back)] : []),
						{
							type: 2,
							style: 2,
							label: "Undo",
							custom_id: undoCustomId(batchId, title.id, back),
						},
						{
							type: 2,
							style: 5,
							label: "Open on GoodWatch",
							url: titlePageUrl(title),
						},
					],
				},
			],
			action === "rate" ? scoreAccent(score, "member") : AMBER,
		),
	])
}

/** Back to the list the title was opened from. */
export const backButton = (back: ListRef) => ({
	type: 2,
	style: 2,
	label: "Back",
	custom_id: listCustomId("back", formatListRef(back)),
})

/** A short answer to a member press that replaced the title card, with Back when it came from a list. */
export function memberNote(content: string, back?: ListRef) {
	return message([
		{ type: 10, content: content.slice(0, 4000) },
		...(back ? [{ type: 1, components: [backButton(back)] }] : []),
	])
}
