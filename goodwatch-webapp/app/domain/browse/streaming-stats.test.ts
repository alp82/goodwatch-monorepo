import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { BRANDS } = await import("~/domain/new-on-services")
const {
	brandKey,
	brandName,
	countPerGroup,
	foldTiers,
	groupsOf,
	kindHas,
	serviceGroupOf,
	sortServices,
} = await import("./streaming-stats.ts")

const netflix = BRANDS.find((b) => b.slug === "netflix")
assert.ok(netflix, "the brand list has Netflix")
const tier = netflix.ids[1] ?? netflix.ids[0]
const OTHER = 999_901

test("a brand's tiers are one group, any other service its own", () => {
	assert.equal(serviceGroupOf(netflix.ids[0]), "brand:netflix")
	assert.equal(serviceGroupOf(tier), "brand:netflix")
	assert.equal(serviceGroupOf(OTHER), `id:${OTHER}`)
})

test("kinds pick their media types", () => {
	assert.equal(kindHas("movie", "movie"), true)
	assert.equal(kindHas("movie", "tv"), false)
	assert.equal(kindHas("show", "tv"), true)
	assert.equal(kindHas("all", "tv"), true)
})

test("a group counts its largest member, a member adds up its kinds under all", () => {
	const rows = [
		{ streaming_service_id: netflix.ids[0], media_type: "movie", n: 100 },
		{ streaming_service_id: netflix.ids[0], media_type: "tv", n: 50 },
		{ streaming_service_id: tier, media_type: "movie", n: 80 },
		{ streaming_service_id: OTHER, media_type: "movie", n: 7 },
	]
	assert.equal(countPerGroup(rows, "movie").get("brand:netflix"), 100)
	assert.equal(countPerGroup(rows, "show").get("brand:netflix"), 50)
	assert.equal(countPerGroup(rows, "all").get("brand:netflix"), 150)
	assert.equal(countPerGroup(rows, "movie").get(`id:${OTHER}`), 7)
})

test("cost is the offer type that carries most titles", () => {
	const groups = groupsOf(
		[
			{ streaming_service_id: OTHER, media_type: "movie", streaming_type: "flatrate", n: 3 },
			{ streaming_service_id: OTHER, media_type: "movie", streaming_type: "ads", n: 300 },
			{
				streaming_service_id: netflix.ids[0],
				media_type: "movie",
				streaming_type: "flatrate",
				n: 10,
			},
		],
		"movie",
	)
	assert.equal(groups.get(`id:${OTHER}`)?.model, "ads")
	assert.equal(groups.get("brand:netflix")?.model, "plan")
	assert.deepEqual(groups.get(`id:${OTHER}`)?.ids, [OTHER])
})

const service = (
	name: string,
	n: Partial<{ titles: number; arrived: number; left: number; popular: number; great: number }>,
) => ({
	name,
	titles: 0,
	arrived: 0,
	left: 0,
	popular: 0,
	great: 0,
	...n,
})

test("a tier named after a bigger service folds into it", () => {
	const hosts = foldTiers([
		service("HBO Max Amazon Channel", { popular: 300, arrived: 9 }),
		service("HBO Max", { popular: 200, arrived: 4, titles: 2000 }),
		service("Hulu", { popular: 100 }),
	])
	assert.deepEqual(hosts.map((h) => h.name).sort(), ["HBO Max", "Hulu"])
	const hbo = hosts.find((h) => h.name === "HBO Max")
	assert.equal(hbo?.popular, 300)
	assert.equal(hbo?.arrived, 9)
	assert.equal(hbo?.titles, 2000)
})

test("tiers and resold channels fold into their brand, also without a prefix match", () => {
	const hosts = foldTiers([
		{ ...service("Paramount+ Amazon Channel", { popular: 50 }), serviceIds: [582] },
		{ ...service("Paramount Plus Essential", { popular: 400, titles: 900 }), serviceIds: [2303] },
		{ ...service("Paramount Plus Premium", { popular: 380, titles: 950 }), serviceIds: [2616] },
		{ ...service("Paramount+ Roku Premium Channel", { arrived: 30 }), serviceIds: [633] },
		{ ...service("Paramount+ with Showtime", { great: 12 }), serviceIds: [1770] },
	])
	assert.equal(hosts.length, 1)
	assert.equal(hosts[0].name, "Paramount Plus")
	assert.equal(hosts[0].popular, 400)
	assert.equal(hosts[0].titles, 950)
	assert.equal(hosts[0].arrived, 30)
	assert.equal(hosts[0].great, 12)
	assert.deepEqual(hosts[0].serviceIds, [582, 633, 1770, 2303, 2616])
})

test("brand names drop channel and tier suffixes in their own spelling", () => {
	assert.equal(brandName("Starz Roku Premium Channel"), "Starz")
	assert.equal(brandName("Netflix Standard with Ads"), "Netflix")
	assert.equal(brandName("Amazon Prime Video Free with Ads"), "Amazon Prime Video")
	assert.equal(brandName("Peacock Premium Plus"), "Peacock")
	assert.equal(brandName("ViX Premium Amazon Channel"), "ViX")
	assert.equal(brandName("HBO Max  Amazon Channel"), "HBO Max")
	assert.equal(brandKey("AcornTV Amazon Channel"), brandKey("Acorn TV"))
	assert.equal(brandKey("MGM Plus Roku Premium Channel"), brandKey("MGM+ Amazon Channel"))
	assert.equal(brandKey("Discovery +"), brandKey("Discovery+"))
})

test("over the real US, DE and GB service lists, brands fold and different services stay apart", async () => {
	const { readFile } = await import("node:fs/promises")
	const names = JSON.parse(
		await readFile(new URL("./streaming-service-names.fixture.json", import.meta.url), "utf8"),
	) as Record<string, string[]>
	const brands = (list: string[]) => new Set(list.map(brandKey))
	assert.equal(brands(names.US).size, 227)
	assert.equal(brands(names.DE).size, 148)
	assert.equal(brands(names.GB).size, 99)
	const together = (a: string, b: string) => assert.equal(brandKey(a), brandKey(b), `${a} / ${b}`)
	const apart = (a: string, b: string) => assert.notEqual(brandKey(a), brandKey(b), `${a} / ${b}`)
	together("Paramount Plus Essential", "Paramount+ Amazon Channel")
	together("Paramount Plus Basic with Ads", "Paramount Plus")
	together("Starz Apple TV channel", "Starz")
	together("Joyn Plus", "Joyn")
	together("Magenta TV+", "MagentaTV")
	together("ITVX Premium", "ITVX")
	together("Now TV Cinema", "Now TV")
	together("Arrow Video Amazon Channel", "ARROW")
	apart("YouTube TV", "YouTube Free")
	apart("AMC", "AMC+")
	apart("History", "History Vault")
	apart("Channel 4", "The Roku Channel")
	apart("Hallmark TV Amazon Channel", "Hallmark+ Amazon Channel")
	apart("Amazon MX Player", "Amazon Prime Video")
	apart("ARD Mediathek", "ARD Plus")
	for (const list of Object.values(names))
		for (const n of list) assert.ok(brandKey(n).length > 0, n)
})

test("sorts order by their number, then popularity, size and name", () => {
	const list = [
		service("B", { popular: 5, titles: 10, great: 1 }),
		service("A", { popular: 9, titles: 5, great: 1 }),
		service("C", { popular: 1, titles: 50, great: 3, arrived: 2 }),
	]
	assert.deepEqual(
		sortServices(list, "popular").map((s) => s.name),
		["A", "B", "C"],
	)
	assert.deepEqual(
		sortServices(list, "titles").map((s) => s.name),
		["C", "B", "A"],
	)
	assert.deepEqual(
		sortServices(list, "great").map((s) => s.name),
		["C", "A", "B"],
	)
	assert.deepEqual(
		sortServices(list, "name").map((s) => s.name),
		["A", "B", "C"],
	)
})
