import { scoreLabels } from "../../utils/ratings.ts"
import { titlePath } from "../../utils/helpers.ts"
import {
	type GuestTitle,
	message,
	AMBER,
	displayText,
	container,
	titleHero,
	scoreLine,
	scoreAccent,
} from "./cards.ts"
import { formatCustomId, undoCustomId } from "./custom-id.ts"

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
export function rateModal(title: GuestTitle, current?: number | null) {
	return {
		type: 9,
		data: {
			custom_id: formatCustomId("rate-submit", title.id),
			title: `Rate ${displayText(title.name)}`.slice(0, 45),
			components: [
				{
					type: 10,
					content: `**${nameOf(title)}**${
						title.year ? ` (${title.year})` : ""
					}`,
				},
				{
					type: 18,
					label: "Your score",
					description: "1 is Unwatchable, 10 is Masterpiece.",
					component: {
						type: 3,
						custom_id: "score",
						placeholder: "Choose a score",
						required: true,
						min_values: 1,
						max_values: 1,
						options: Array.from({ length: 10 }, (_, i) => ({
							label: String(i + 1),
							value: String(i + 1),
							description: scoreLabels[i + 1],
							...(current === i + 1 ? { default: true } : {}),
						})),
					},
				},
			],
		},
	}
}
export function writeConfirmation(
	title: GuestTitle,
	batchId: string,
	action: "rate" | "seen" | "want",
	score?: number,
	wanted = true,
) {
	const confirmation =
		action === "rate"
			? `Rated ${scoreLine(score, {}, "member")}`
			: action === "seen"
				? "Logged a watch today"
				: wanted
					? "Added to your Wishlist"
					: "Removed from your Wishlist"
	const [kind, id] = title.id.split(":")
	return message([
		container(
			[
				...titleHero(title, {}, { eyebrow: confirmation }),
				{
					type: 1,
					components: [
						{
							type: 2,
							style: 2,
							label: "Undo",
							custom_id: undoCustomId(batchId, title.id),
						},
						{
							type: 2,
							style: 5,
							label: "Open on GoodWatch",
							url: `https://goodwatch.app${titlePath(kind, Number(id), title.name)}`,
						},
					],
				},
			],
			action === "rate" ? scoreAccent(score, "member") : AMBER,
		),
	])
}
