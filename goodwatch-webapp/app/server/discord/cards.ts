import {
	goodwatchScoreDisplay,
	hasGoodwatchScore,
	scoreLabels,
} from "../../utils/ratings.ts"
import { titlePath } from "../../utils/helpers.ts"
import { formatCustomId, listCustomId, isTitleId } from "./custom-id.ts"
export const IS_COMPONENTS_V2 = 1 << 15
export const EPHEMERAL = 64
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
	match?: number | null
	match_label?: string | null
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
	validateComponents(components)
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
		lines[lines.length - 1] += `${
			lines[lines.length - 1] ? " " : ""
		}${word.slice(0, 140)}`
	}
	return lines.join("\n")
}
export function titleCard(
	title: GuestTitle,
	country: string,
	options: { share?: boolean; offers?: boolean; member?: MemberMarks } = {},
) {
	const [kind, id] = title.id.split(":")
	const url = `https://goodwatch.app${titlePath(kind, Number(id), title.name)}`
	const score = hasGoodwatchScore(title.goodwatch_score)
		? goodwatchScoreDisplay(title.goodwatch_score)
		: null
	let heading = `## ${escape(title.name).slice(0, 250)}${
		title.year ? ` (${title.year})` : ""
	}\nGoodWatch: ${
		score === null
			? "Not rated yet"
			: `${score}/100 · ${
					scoreLabels[Math.min(10, Math.max(1, Math.round(score / 10)))]
			  }`
	}\n${title.runtime_minutes ? `${title.runtime_minutes} min · ` : ""}${(
		title.genres ?? []
	)
		.map(escape)
		.join(", ")}`
	if (options.member && !options.share) {
		const marks = options.member
		const personal = [
			typeof title.match === "number"
				? escape(title.match_label ?? "Taste match")
				: null,
			marks.score != null ? `Rated ${marks.score}/10` : null,
			marks.status === "seen" ||
			(kind === "movie" &&
				((marks.watch_count ?? 0) > 0 || marks.score != null))
				? "Seen"
				: null,
			marks.want_to_see ? "Want to See" : null,
			marks.status && !["seen", "not_started"].includes(marks.status)
				? escape(marks.status.replace(/_/g, " "))
				: null,
		].filter(Boolean)
		if (personal.length) heading += `\n${personal.join(" · ")}`
	}
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
		{
			type: 2,
			style: 2,
			label: "Similar",
			custom_id: formatCustomId("similar", title.id),
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
				content: `**Where to watch · ${country}**\n${availability}`.slice(
					0,
					4000,
				),
			},
			{ type: 1, components: buttons },
		],
		!options.share,
	)
}

function validateComponents(components: Component[]) {
	for (const c of components) {
		if (typeof c.label === "string" && c.label.length > 80)
			throw new Error("Discord label limit exceeded")
		if (typeof c.custom_id === "string" && c.custom_id.length > 100)
			throw new Error("Discord custom ID limit exceeded")
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
		validateComponents(c.components ?? [])
		if (c.accessory) validateComponents([c.accessory])
	}
}
export function titleSelect(titles: GuestTitle[], share = false): Component[] {
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
							options: unique.map((t) => ({
								label: t.name.slice(0, 100) || "Untitled",
								value: t.id,
								description: `${t.year ?? "Year unknown"} · ${
									t.id.startsWith("movie:") ? "Movie" : "TV show"
								}`,
							})),
						},
					],
				},
		  ]
		: []
}
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
	} = {},
) {
	const shown = titles.slice(0, 10)
	const buttons: Component[] = []
	if (options.stateKey) {
		const page = options.page ?? 0
		for (const [label, target, disabled] of [
			["Previous", Math.max(0, page - 1), page === 0],
			["Next", page + 1, !options.next],
		] as const)
			buttons.push({
				type: 2,
				style: 2,
				label,
				disabled,
				custom_id: listCustomId("discover", `${options.stateKey}:${target}`),
			})
	}
	if (options.url)
		buttons.push({
			type: 2,
			style: 5,
			label: "Open on GoodWatch",
			url: options.url,
		})
	if (!options.share && options.shareId)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: options.shareId,
		})
	return message(
		[
			{
				type: 10,
				content: `## ${escape(heading).slice(0, 200)}${
					options.page === undefined ? "" : ` · Page ${options.page + 1}`
				}`,
			},
			{
				type: 10,
				content: shown.length
					? shown
							.map(
								(t, i) =>
									`${i + 1}. **${escape(t.name).slice(0, 180)}**${
										t.year ? ` (${t.year})` : ""
									}`,
							)
							.join("\n")
					: "No titles found.",
			},
			...titleSelect(shown, options.share),
			...(buttons.length ? [{ type: 1, components: buttons }] : []),
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
export function personCard(person: GuestPerson, share = false) {
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
