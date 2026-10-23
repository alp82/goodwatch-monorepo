// Profile settings: who may see which part, and what a member may save.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { DEFAULT_VISIBILITY, canSee, parseVisibility } = await import(
	"./profile.ts"
)
const {
	normalizeLinkValue,
	profileLinkUrl,
	validateProfileSettings: validate,
} = await import("./profile-settings.ts")

// Every save carries the whole visibility map; the tests below are about the other fields.
const validateProfileSettings = (
	input: Parameters<typeof validate>[0],
	ctx: Parameters<typeof validate>[1],
) => validate({ visibility: DEFAULT_VISIBILITY, ...input }, ctx)

const context = {
	scored: (key: string) => key === "movie-550",
	hasPhoto: false,
	hasProviderPhoto: false,
}

test("the owner sees everything, members see Everyone and Members, guests see Everyone", () => {
	const visibility = {
		...DEFAULT_VISIBILITY,
		wishlist: "members" as const,
		taste: "me" as const,
	}
	assert.equal(canSee(visibility, "wishlist", "owner"), true)
	assert.equal(canSee(visibility, "taste", "owner"), true)
	assert.equal(canSee(visibility, "wishlist", "member"), true)
	assert.equal(canSee(visibility, "taste", "member"), false)
	assert.equal(canSee(visibility, "wishlist", "guest"), false)
	assert.equal(canSee(visibility, "scores", "guest"), true)
})

test("stored visibility keeps known parts and audiences and defaults the rest to everyone", () => {
	assert.deepEqual(parseVisibility(null), DEFAULT_VISIBILITY)
	const parsed = parseVisibility({
		seen: "me",
		shows: "friends",
		nonsense: "me",
	})
	assert.equal(parsed.seen, "me")
	assert.equal(parsed.shows, "everyone")
	assert.equal("nonsense" in parsed, false)
})

test("links: usernames per service, a leading @ and a website's scheme are dropped", () => {
	assert.equal(normalizeLinkValue("letterboxd", " @alper "), "alper")
	assert.equal(
		normalizeLinkValue("website", "HTTPS://Example.com/films/"),
		"example.com/films",
	)
	const ok = validateProfileSettings(
		{
			links: [
				{ service: "letterboxd", value: "@alper_o" },
				{ service: "website", value: "https://example.com" },
			],
		},
		context,
	)
	assert.equal(ok.ok, true)
	if (ok.ok) {
		assert.deepEqual(ok.settings.links, [
			{ service: "letterboxd", value: "alper_o" },
			{ service: "website", value: "example.com" },
		])
		assert.equal(
			profileLinkUrl(ok.settings.links[0]),
			"https://letterboxd.com/alper_o/",
		)
	}
	for (const bad of [
		{ service: "letterboxd", value: "a/../../x" },
		{ service: "imdb", value: "12345" },
		{ service: "website", value: "javascript:alert(1)" },
		{ service: "website", value: "exa mple.com" },
		{ service: "myspace", value: "x" },
	])
		assert.equal(
			validateProfileSettings({ links: [bad] }, context).ok,
			false,
			JSON.stringify(bad),
		)
})

test("at most 6 links, each service once", () => {
	const services = [
		"letterboxd",
		"trakt",
		"tmdb",
		"simkl",
		"anilist",
		"serializd",
		"instagram",
	]
	const seven = validateProfileSettings(
		{ links: services.map((service) => ({ service, value: "alper" })) },
		context,
	)
	assert.equal(seven.ok, false)
	const twice = validateProfileSettings(
		{
			links: [
				{ service: "trakt", value: "a" },
				{ service: "trakt", value: "b" },
			],
		},
		context,
	)
	assert.equal(twice.ok, false)
})

test("bio: control characters go, at most 160 characters", () => {
	const ok = validateProfileSettings(
		{ bio: "  Sci-fi\u0007 with ideas\n\n\n\nand satire  " },
		context,
	)
	assert.equal(ok.ok && ok.settings.bio, "Sci-fi with ideas\n\nand satire")
	assert.equal(
		validateProfileSettings({ bio: "x".repeat(161) }, context).ok,
		false,
	)
})

test("a poster or cover must be a title the member scored; a photo must exist", () => {
	assert.equal(
		validateProfileSettings(
			{ avatar: { kind: "poster", title: "movie-550" } },
			context,
		).ok,
		true,
	)
	assert.equal(
		validateProfileSettings(
			{ avatar: { kind: "poster", title: "movie-551" } },
			context,
		).ok,
		false,
	)
	assert.equal(
		validateProfileSettings({ cover: "movie-550" }, context).ok,
		true,
	)
	assert.equal(
		validateProfileSettings({ cover: "show-1396" }, context).ok,
		false,
	)
	assert.equal(
		validateProfileSettings({ avatar: { kind: "photo" } }, context).ok,
		false,
	)
	assert.equal(
		validateProfileSettings(
			{ avatar: { kind: "photo" } },
			{ ...context, hasPhoto: true },
		).ok,
		true,
	)
	assert.equal(
		validateProfileSettings({ avatar: { kind: "provider" } }, context).ok,
		false,
	)
	assert.equal(
		validateProfileSettings(
			{ avatar: { kind: "initial", color: "chartreuse" } },
			context,
		).ok,
		false,
	)
	const none = validateProfileSettings({ cover: null }, context)
	assert.equal(none.ok && none.settings.cover, null)
})

test("a save must say who sees each of the eight parts", () => {
	assert.equal(validate({}, context).ok, false)
	assert.equal(validate({ visibility: { scores: "me" } }, context).ok, false)
	assert.equal(
		validate(
			{ visibility: { ...DEFAULT_VISIBILITY, taste: "nobody" } },
			context,
		).ok,
		false,
	)
	const ok = validate(
		{ visibility: { ...DEFAULT_VISIBILITY, wishlist: "members" } },
		context,
	)
	assert.equal(ok.ok && ok.settings.visibility.wishlist, "members")
})
