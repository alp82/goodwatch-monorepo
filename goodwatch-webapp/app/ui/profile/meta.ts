// The profile pages' meta: title "@handle · GoodWatch" (a tab adds its name), a description from the bio, the canonical
// address, the link-preview card (/og/u/<handle>…), noindex unless the profile has enough public scores, and ProfilePage
// structured data on an indexable Overview.
import type { MetaDescriptor } from "@remix-run/node"
import { type ProfilePart, type ProfileShell, seesPart } from "~/domain/profile"
import { buildMeta } from "~/utils/meta"
import { type ProfileTab, linkUrl, profileTabPath } from "./links"

const TAB_NAMES: Record<ProfileTab, string> = {
	overview: "",
	seen: "Seen",
	scores: "Scores",
	wishlist: "Wishlist",
	shows: "Shows",
	lists: "Lists",
	taste: "Taste",
}

export function profileMeta(
	shell: ProfileShell | undefined,
	tab: ProfileTab,
	line?: string,
): MetaDescriptor[] {
	if (!shell)
		return [
			{ title: "Profile not found · GoodWatch" },
			{ name: "robots", content: "noindex, nofollow" },
		]
	const handle = shell.handle
	const url = `https://goodwatch.app${profileTabPath(handle, tab)}`
	const name = TAB_NAMES[tab]
	const title = name
		? `${name} · @${handle} · GoodWatch`
		: `@${handle} · GoodWatch`
	const description = line || shell.bio || fallbackDescription(shell)
	const indexable = shell.indexable
	const profilePage =
		indexable && tab === "overview"
			? [
					{
						"@context": "https://schema.org",
						"@type": "ProfilePage",
						url,
						mainEntity: {
							"@type": "Person",
							name: `@${handle}`,
							alternateName: handle,
							url,
							...(shell.avatar.url
								? {
										image: new URL(shell.avatar.url, "https://goodwatch.app")
											.href,
									}
								: {}),
							...(shell.bio ? { description: shell.bio } : {}),
							...(shell.links.length
								? { sameAs: shell.links.map(linkUrl) }
								: {}),
						},
					},
				]
			: []
	return buildMeta({
		pageMeta: {
			title,
			description,
			url,
			image: "",
			alt: `@${handle}'s profile on GoodWatch`,
		},
		robots: indexable ? "index, follow" : "noindex, nofollow",
		structuredData: profilePage,
	}) as MetaDescriptor[]
}

/** "@handle on GoodWatch: 1,008 scores, taste and lists.", naming only what this visitor may see. */
function fallbackDescription(shell: ProfileShell) {
	const parts: [ProfilePart, string][] = [
		["scores", `${shell.counts.rated.toLocaleString("en-US")} scores`],
		["taste", "taste"],
		["lists", "lists"],
	]
	const shown = parts
		.filter(([part]) => seesPart(shell, part))
		.map(([, words]) => words)
	if (!shown.length) return `@${shell.handle} on GoodWatch.`
	const list =
		shown.length > 1
			? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`
			: shown[0]
	return `@${shell.handle} on GoodWatch: ${list}.`
}
