// /profile: the member's own profile card, as a signed-out visitor sees the profile. The image is the profile's
// link-preview card (/og/u/<handle>[/<tab>].jpg, /og/u/<handle>/taste/<view>.jpg), which draws only parts visible to
// everyone; the bot also refuses a part that isn't public instead of posting a card that silently falls back to the
// main one.
// Spec: docs/implementation/discord-bot/README.md
import {
	PROFILE_PARTS,
	canSee,
	type ProfilePart,
	type ProfileVisibility,
} from "../../domain/profile.ts"
import { ogImageUrl } from "../../utils/og-image-url.ts"
import {
	AMBER,
	QUIET_GREY,
	container,
	message,
	type Component,
} from "./cards.ts"
import { listCustomId } from "./custom-id.ts"

/** A profile card tab or Taste tab section, as in PROFILE_CARD_TABS and PROFILE_CARD_VIEWS
 * (app/ui/og-image/profile-card-model.ts). */
type CardPath =
	| "seen"
	| "scores"
	| "wishlist"
	| "shows"
	| "lists"
	| "taste"
	| "taste/everyone"
	| "taste/sides"

/**
 * Each /profile choice: its name in Discord, the card it shows (null is the main fingerprint card), where it links on
 * the profile, and the parts that must be visible to everyone, in the order the refusal names them. The value is kept
 * in Share to channel buttons, so "crowd" stays the id of Different from everyone.
 */
export const PROFILE_CARDS = {
	profile: { name: "Profile", image: null, link: "", parts: [] },
	taste: { name: "Taste", image: "taste", link: "/taste", parts: ["taste"] },
	crowd: {
		name: "Different from everyone",
		image: "taste/everyone",
		link: "/taste#everyone",
		parts: ["taste", "scores"],
	},
	sides: {
		name: "Sides",
		image: "taste/sides",
		link: "/taste#sides",
		parts: ["taste"],
	},
	scores: {
		name: "Top scores",
		image: "scores",
		link: "/scores",
		parts: ["scores"],
	},
	seen: { name: "Seen", image: "seen", link: "/seen", parts: ["seen"] },
	wishlist: {
		name: "Wishlist",
		image: "wishlist",
		link: "/wishlist",
		parts: ["wishlist"],
	},
	shows: { name: "Shows", image: "shows", link: "/shows", parts: ["shows"] },
	lists: { name: "Lists", image: "lists", link: "/lists", parts: ["lists"] },
} as const satisfies Record<
	string,
	{
		name: string
		image: CardPath | null
		link: string
		parts: readonly ProfilePart[]
	}
>
export type ProfileCardChoice = keyof typeof PROFILE_CARDS
export const isProfileCardChoice = (
	value: string,
): value is ProfileCardChoice =>
	Object.prototype.hasOwnProperty.call(PROFILE_CARDS, value)

/** The `card` option's choices, in menu order. */
export const profileCardChoices = () =>
	Object.entries(PROFILE_CARDS).map(([value, card]) => ({
		name: card.name,
		value,
	}))

/** The part names of Edit profile's Who sees what. */
const PART_NAMES: Record<ProfilePart, string> = {
	scores: "Scores",
	seen: "Seen",
	wishlist: "Wishlist",
	shows: "Shows",
	lists: "Lists",
	taste: "Taste",
	hours: "Time watched",
	activity: "Recent activity",
}

export const EDIT_PROFILE_PATH = "/settings/profile"
export const WHO_SEES_WHAT_PATH = "/settings/profile#who-sees-what"

const ORIGIN = "https://goodwatch.app"
const linkButton = (label: string, url: string): Component => ({
	type: 2,
	style: 5,
	label,
	url,
})

/** The profile page or tab the card links to. */
export function profileCardPage(handle: string, choice: ProfileCardChoice) {
	return `${ORIGIN}/u/${handle}${PROFILE_CARDS[choice].link}`
}

/**
 * The card image. The query changes every minute: Discord's media proxy keeps an image by its address, so a fixed
 * address would keep showing an old card after the member's taste or settings change. The card route ignores the
 * query, so the server's own card cache (og-card:v6) still serves it.
 */
export function profileCardImage(
	handle: string,
	choice: ProfileCardChoice,
	now = Date.now(),
	visibility?: ProfileVisibility,
) {
	const tab = PROFILE_CARDS[choice].image
	const url = ogImageUrl(`${ORIGIN}/u/${handle}${tab ? `/${tab}` : ""}`)
	// Visibility is part of the address too: a part hidden after the preview must never reach Discord from its cache.
	const seen = visibility
		? PROFILE_PARTS.map((part) =>
				canSee(visibility, part, "guest") ? 1 : 0,
			).join("")
		: ""
	return `${url}&v=${Math.floor(now / 60_000).toString(36)}${seen && `-${parseInt(seen, 2).toString(36)}`}`
}

export interface MemberProfile {
	handle: string | null
	visibility: ProfileVisibility
}

/** The first part a choice needs that isn't visible to everyone, or null. */
export function hiddenPart(
	visibility: ProfileVisibility,
	choice: ProfileCardChoice,
): ProfilePart | null {
	const parts: readonly ProfilePart[] = PROFILE_CARDS[choice].parts
	return parts.find((part) => !canSee(visibility, part, "guest")) ?? null
}

/** The preview (with Share to channel) or the shared copy. */
export function profileCard(
	handle: string,
	choice: ProfileCardChoice,
	options: {
		share?: boolean
		now?: number
		visibility?: ProfileVisibility
	} = {},
) {
	const card = PROFILE_CARDS[choice]
	const heading = `## @${handle} on GoodWatch${
		choice === "profile" ? "" : `\n-# ${card.name}`
	}`
	const buttons: Component[] = [
		linkButton("Open on GoodWatch", profileCardPage(handle, choice)),
	]
	if (!options.share)
		buttons.push({
			type: 2,
			style: 2,
			label: "Share to channel",
			custom_id: listCustomId("profile-share", choice),
		})
	return message(
		[
			container(
				[
					{ type: 10, content: heading },
					{
						type: 12,
						items: [
							{
								media: {
									url: profileCardImage(
										handle,
										choice,
										options.now,
										options.visibility,
									),
								},
								description: `@${handle} on GoodWatch: ${card.name}`,
							},
						],
					},
					{ type: 1, components: buttons },
				],
				AMBER,
			),
		],
		!options.share,
	)
}

/** A linked member without a handle has no profile yet. */
export function noProfileCard(origin = ORIGIN) {
	return message([
		container(
			[
				{
					type: 10,
					content:
						"### You don't have a profile yet\nPick a handle on GoodWatch to get your profile, then run /profile again.",
				},
				{
					type: 1,
					components: [
						linkButton(
							"Pick a handle",
							new URL(EDIT_PROFILE_PATH, origin).href,
						),
					],
				},
			],
			QUIET_GREY,
		),
	])
}

/** The chosen part isn't visible to everyone, so its card can't be shared. */
export function hiddenPartCard(
	part: ProfilePart,
	audience: "members" | "me",
	origin = ORIGIN,
) {
	const name = PART_NAMES[part]
	return message([
		container(
			[
				{
					type: 10,
					content: `### This part of your profile isn't public\n${
						audience === "me"
							? `Only you can see your ${name}`
							: `Only GoodWatch members can see your ${name}`
					}, so its card can't be shared. To share it, set ${name} to Everyone in Who sees what.`,
				},
				{
					type: 1,
					components: [
						linkButton(
							"Edit profile",
							new URL(WHO_SEES_WHAT_PATH, origin).href,
						),
					],
				},
			],
			QUIET_GREY,
		),
	])
}

/** The answer to /profile or Share to channel once the member is known. */
export function profileReply(
	profile: MemberProfile,
	choice: ProfileCardChoice,
	options: { share?: boolean; now?: number; origin?: string } = {},
) {
	if (!profile.handle) return noProfileCard(options.origin)
	const hidden = hiddenPart(profile.visibility, choice)
	if (hidden)
		return hiddenPartCard(
			hidden,
			profile.visibility[hidden] === "members" ? "members" : "me",
			options.origin,
		)
	return profileCard(profile.handle, choice, {
		...options,
		visibility: profile.visibility,
	})
}
