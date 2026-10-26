// The link-preview cards of the /new pages: which addresses have one, and what each shows. Data comes from fakes of
// the pages' reads; flags are the site's own files.
import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const { canonicalNewPath, newServicesContent } = await import(
	"./new-services-content.server.ts"
)

const deps = {
	now: () => Date.parse("2026-10-26T00:00:00Z"),
	meta: async () => ({
		updatedAt: null,
		logos: { netflix: "/netflix.png", hulu: "/hulu.png" } as Record<
			string,
			string | null
		>,
	}),
	countries: async () => [
		{ code: "DE", name: "Germany" },
		{ code: "US", name: "United States" },
	],
	country: async ({ country }: { country: string }) =>
		country === "DE"
			? { brands: { netflix: [{}, {}] }, all: [{}, {}, {}] }
			: { brands: {}, all: [] },
} as unknown as Parameters<typeof newServicesContent>[1]

test("every /new address has its own card path; others have none", () => {
	const paths: [string, string | null][] = [
		["/new", "/new"],
		["/new/DE", "/new/de"],
		["/new/de/netflix", "/new/de/netflix"],
		["/new/netflix", "/new/netflix"],
		["/new/de/nope", null],
		["/new/nope", null],
		["/new/de/netflix/extra", null],
	]
	for (const [path, expected] of paths)
		assert.equal(canonicalNewPath(path.split("/").filter(Boolean)), expected, path)
})

test("a service in a country: its logo, the country's flag, and how many titles arrived", async () => {
	const card = await newServicesContent("/new/de/netflix", deps)
	assert.ok(card)
	assert.equal(card.layout, "service")
	assert.equal(card.tag, "Germany")
	assert.equal(card.headline, "New on Netflix")
	assert.equal(card.tally, "2 new movies and shows")
	assert.equal(card.brand?.logo, "https://image.tmdb.org/t/p/w500/netflix.png")
	assert.match(card.flag ?? "", /^data:image\/svg\+xml;base64,/)
})

test("a country: its flag and the services with arrivals; an unknown country has no card", async () => {
	const card = await newServicesContent("/new/de", deps)
	assert.equal(card?.layout, "country")
	assert.equal(card?.headline, "New on streaming")
	assert.equal(card?.tally, "3 new movies and shows")
	assert.deepEqual(card?.logos.map((l) => l.name), ["Netflix"])
	assert.equal(await newServicesContent("/new/zz", deps), null)
})

test("a country without arrivals shows no count", async () => {
	const card = await newServicesContent("/new/us/netflix", deps)
	assert.equal(card?.tally, null)
})

test("/new: a wall of services with three ticked, and no country", async () => {
	const card = await newServicesContent("/new", deps)
	assert.equal(card?.layout, "member")
	assert.equal(card?.headline, "New on your services")
	assert.equal(card?.tag, null)
	assert.equal(card?.tally, null)
	assert.equal(card?.logos.length, 12)
	assert.deepEqual(
		card?.logos.filter((l) => l.picked).map((l) => l.name),
		["Netflix", "Hulu", "Paramount+"],
	)
})

test("the share link: the service's logo and four flags for the reader's own country", async () => {
	const card = await newServicesContent("/new/netflix", deps)
	assert.equal(card?.layout, "share")
	assert.equal(card?.tag, "In your country")
	assert.equal(card?.flags.length, 4)
	assert.equal(card?.tally, null)
})
