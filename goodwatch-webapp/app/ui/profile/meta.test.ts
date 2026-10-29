import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_VISIBILITY, type ProfilePart, type ProfileShell } from "../../domain/profile.ts"
import type { ProfileTab } from "./paths.ts"
import "../../server/title-filter/test-alias.ts"

const { profileMeta } = await import("./meta.ts")

const shell = (): ProfileShell => ({
	handle: "seo-test",
	viewer: "guest",
	visibility: { ...DEFAULT_VISIBILITY },
	avatar: { url: null, color: "amber" },
	cover: null,
	bio: "A public profile",
	links: [],
	since: null,
	counts: { seen: 30, seenMovies: 20, rated: 30, wishlist: 5, lists: 1, hours: 10, episodes: 2, average: 7 },
	spread: [],
	indexable: true,
	dismissedImports: [],
})
const robots = (profile: ProfileShell, tab: ProfileTab) =>
	profileMeta(profile, tab).filter((tag) => "name" in tag && tag.name === "robots")
		.map((tag) => "content" in tag ? tag.content : undefined)

const parts: [ProfileTab, ProfilePart[]][] = [
	["seen", ["seen"]], ["scores", ["scores"]], ["wishlist", ["wishlist"]],
	["shows", ["shows"]], ["lists", ["lists"]], ["stats", ["taste"]],
	["tropes", ["taste", "scores"]],
]

test("restricted profile tabs stay out of search for every viewer", () => {
	for (const [tab, required] of parts)
		for (const part of required)
			for (const audience of ["members", "me"] as const)
				for (const viewer of ["guest", "member", "owner"] as const) {
					const profile = shell()
					profile.viewer = viewer
					profile.visibility[part] = audience
					assert.deepEqual(robots(profile, tab), ["noindex, nofollow"], `${tab}: ${part}/${audience}/${viewer}`)
				}
})

test("eligible public tabs and overview keep their canonical and indexing policy", () => {
	for (const tab of ["overview", ...parts.map(([tab]) => tab)] as const) {
		const profile = shell()
		assert.deepEqual(robots(profile, tab), ["index, follow"])
		assert.ok(profileMeta(profile, tab).some((tag) => "rel" in tag && tag.rel === "canonical"))
		profile.indexable = false
		assert.deepEqual(robots(profile, tab), ["noindex, nofollow"])
	}
	const profile = shell()
	profile.visibility.wishlist = "me"
	assert.deepEqual(robots(profile, "overview"), ["index, follow"])
	assert.ok(profileMeta(profile, "overview").some((tag) => "script:ld+json" in tag))
})
