import {
	goodwatchScoreDisplay,
	hasGoodwatchScore,
	scoreLabels,
} from "../../utils/ratings.ts"
import { titlePath } from "../../utils/helpers.ts"
import { formatCustomId } from "./custom-id.ts"
export const IS_COMPONENTS_V2 = 1 << 15
export const EPHEMERAL = 64
export interface Component {
	type: number
	components?: Component[]
	accessory?: Component
	[key: string]: unknown
}
export interface GuestTitle {
	id: string
	name: string
	year: number | null
	synopsis?: string | null
	genres?: string[]
	runtime_minutes?: number | null
	poster_url?: string | null
	goodwatch_score?: number | null
	availability?: {
		state?: string
		country?: string
		offers: { name?: string; stream_link: string; offer_type?: string }[]
	}
}
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
export function message(components: Component[], ephemeral = true) {
	if (componentCount(components) > 40)
		throw new Error("Discord component limit exceeded")
	return {
		flags: IS_COMPONENTS_V2 | (ephemeral ? EPHEMERAL : 0),
		components,
		allowed_mentions: { parse: [] },
	}
}
export const textCard = (text: string) =>
	message([{ type: 10, content: text.slice(0, 4000) }])
const escape = (text: string) =>
	text.replace(/[\\*_~`|>#[\]]/g, "\\$&").replace(/@/g, "＠")
function overview(text: string) {
	const words = escape(text).replace(/\s+/g, " ").split(" ")
	const lines = [""]
	for (const word of words) {
		if ((lines[lines.length - 1] + word).length > 140) {
			if (lines.length === 2) {
				lines[1] += "…"
				break
			}
			lines.push("")
		}
		lines[lines.length - 1] +=
			`${lines[lines.length - 1] ? " " : ""}${word.slice(0, 140)}`
	}
	return lines.join("\n")
}
export function titleCard(
	title: GuestTitle,
	country: string,
	options: { share?: boolean; offers?: boolean } = {},
) {
	const [kind, id] = title.id.split(":")
	const url = `https://goodwatch.app${titlePath(kind, Number(id), title.name)}`
	const score = hasGoodwatchScore(title.goodwatch_score)
		? goodwatchScoreDisplay(title.goodwatch_score)
		: null
	const heading = `## ${escape(title.name).slice(0, 250)}${title.year ? ` (${title.year})` : ""}\nGoodWatch: ${score === null ? "Not rated yet" : `${score}/100 · ${scoreLabels[Math.min(10, Math.max(1, Math.round(score / 10)))]}`}\n${title.runtime_minutes ? `${title.runtime_minutes} min · ` : ""}${(title.genres ?? []).map(escape).join(", ")}`
	const offers = title.availability?.offers ?? []
	const availability = offers.length
		? options.offers
			? offers
					.slice(0, 20)
					.map(
						(o) =>
							`${o.stream_link}${o.offer_type ? ` (${o.offer_type})` : ""}`,
					)
					.join("\n")
			: offers
					.slice(0, 10)
					.map((o) => escape(o.name ?? "Provider"))
					.join(", ")
		: title.availability?.state === "no_match"
			? "No current offers found."
			: "Availability unknown."
	const buttons: Component[] = [
		{
			type: 2,
			style: 2,
			label: "Where to watch",
			custom_id: formatCustomId("watch", title.id),
		},
		{ type: 2, style: 5, label: "Open on GoodWatch", url },
	]
	if (!options.share)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: formatCustomId("share", title.id),
		})
	const titleText: Component = { type: 10, content: heading }
	return message(
		[
			title.poster_url
				? {
						type: 9,
						components: [titleText],
						accessory: {
							type: 11,
							media: { url: title.poster_url },
							description: title.name.slice(0, 100),
						},
					}
				: titleText,
			{
				type: 10,
				content: overview(title.synopsis ?? "Overview unavailable."),
			},
			{
				type: 10,
				content:
					`**Where to watch · ${country}** (all services)\n${availability}`.slice(
						0,
						4000,
					),
			},
			{ type: 1, components: buttons },
		],
		!options.share,
	)
}
