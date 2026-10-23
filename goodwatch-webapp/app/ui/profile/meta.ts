// The profile pages' meta: title "@handle · GoodWatch" (a tab adds its name), a description from the bio, the canonical
// address, the link-preview card (/og/u/<handle>…), noindex unless the profile has enough public scores, and ProfilePage
// structured data on an indexable Overview.
import type { MetaDescriptor } from "@remix-run/node"
import type { ProfileShell } from "~/domain/profile"
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

export function profileMeta(shell: ProfileShell | undefined, tab: ProfileTab, line?: string): MetaDescriptor[] {
	if (!shell)
		return [{ title: "Profile not found · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
	const handle = shell.handle
	const url = `https://goodwatch.app${profileTabPath(handle, tab)}`
	const name = TAB_NAMES[tab]
	const title = name ? `${name} · @${handle} · GoodWatch` : `@${handle} · GoodWatch`
	const description =
		line ||
		shell.bio ||
		`@${handle} on GoodWatch: ${shell.counts.rated.toLocaleString("en-US")} scores, favorites, taste and lists.`
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
							...(shell.avatar.url ? { image: new URL(shell.avatar.url, "https://goodwatch.app").href } : {}),
							...(shell.bio ? { description: shell.bio } : {}),
							...(shell.links.length ? { sameAs: shell.links.map(linkUrl) } : {}),
						},
					},
				]
			: []
	return buildMeta({
		pageMeta: { title, description, url, image: "", alt: `@${handle}'s profile on GoodWatch` },
		robots: indexable ? "index, follow" : "noindex, nofollow",
		structuredData: profilePage,
	}) as MetaDescriptor[]
}
