import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { relatedMap } = await import("./map.ts")
const { TRAIT_KEYS } = await import("./traits.ts")
type RawTitle = [string, string, string, string, number, string]

const levels = (given: Record<string, number>) =>
	TRAIT_KEYS.map((key) => "0123456789a"[given[key] ?? 5]).join("")
const title = (
	key: string,
	name: string,
	near: number,
	given: Record<string, number> = {},
): RawTitle => [key, name, "2001", `${key}.jpg`, near, levels(given)]

const center = title("m1", "The Middle", 1000, {
	spectacle: 10,
	tension: 8,
	situational_comedy: 1,
})
const around = Array.from({ length: 30 }, (_, i) =>
	// One word each: names that differ only in a number count as one franchise.
	title(`m${i + 2}`, `Neighbor${i + 2}th`, 990 - i * 3),
)
const pack = { c: center, n: around, fl: { "": 0 } }
const draw = (n = around) =>
	relatedMap(null).section({
		root: "m1",
		title: "The Middle",
		pack: { ...pack, n },
		links: [{ href: "/movie/2-neighbor-a", text: "Neighbor A (2001)" }],
	})

/** The posters of a picture: key, and place in px from the middle. */
const posters = (html: string) =>
	[
		...html.matchAll(
			/<button type="button" class="pl-p rm-p[^"]*" style="--x:(-?[\d.]+)px;--y:(-?[\d.]+)px;--s:[\d.]+" data-pl-step="([ms]\d+)"/g,
		),
	].map((found) => ({ k: found[3], x: Number(found[1]), y: Number(found[2]) }))
const distance = (poster: { x: number; y: number }) =>
	Math.hypot(poster.x, poster.y)

test("the server's picture is drawn for a phone: the title in the middle and eight around it", () => {
	const html = draw()
	assert.match(html, /<h2 class="pl-h">Titles like The Middle<\/h2>/)
	assert.match(html, /data-pl-stage="" data-pl-at="m1" data-y="2001" data-p="m1.jpg"/)
	assert.match(html, /data-r-geo="346\|348"/)
	assert.equal((html.match(/data-pl-center=""/g) ?? []).length, 1)
	const drawn = posters(html)
	assert.deepEqual(
		drawn.map((poster) => poster.k).sort(),
		["m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"],
		"the eight most alike titles",
	)
})

test("nearer is more alike: a title's ring is its rank of similarity", () => {
	const drawn = posters(draw())
	const byKey = Object.fromEntries(drawn.map((poster) => [poster.k, poster]))
	// The first ring of a phone's map has six places, the second the two at the sides.
	const first = ["m2", "m3", "m4", "m5", "m6", "m7"].map((k) => distance(byKey[k]))
	const second = ["m8", "m9"].map((k) => distance(byKey[k]))
	assert.ok(Math.max(...first) < Math.min(...second))
	// Around a ring the places are taken clockwise from the top: the most alike title sits straight above.
	assert.equal(byKey.m2.x, 0)
	assert.ok(byKey.m2.y < 0)
	assert.ok(byKey.m3.x > 0 && byKey.m3.y < 0, "the next one to its right")
})

test("no two posters share a place, and every place has its opposite", () => {
	const drawn = posters(draw())
	const places = new Set(drawn.map((poster) => `${poster.x},${poster.y}`))
	assert.equal(places.size, drawn.length)
	for (const poster of drawn)
		assert.ok(places.has(`${-poster.x},${-poster.y}`), `opposite of ${poster.k}`)
})

test("a franchise shows one title: the most alike one", () => {
	const n = [
		title("m50", "Toy Story 2", 995),
		title("m51", "Toy Story", 994),
		title("m52", "Toy Story 3", 993),
		...around,
	]
	const drawn = posters(draw(n)).map((poster) => poster.k)
	assert.ok(drawn.includes("m50"))
	assert.ok(!drawn.includes("m51") && !drawn.includes("m52"))
	assert.equal(drawn.length, 8)
})

test("what the picture has no room for goes along as data, for a wider screen", () => {
	const html = draw()
	const rest = JSON.parse(
		(/data-pl-rest="([^"]*)"/.exec(html)?.[1] ?? "").replace(/&quot;/g, '"'),
	) as string[][]
	assert.equal(rest.length, around.length - 8)
	assert.deepEqual(rest[0], ["m10", "Neighbor10th", "2001", "m10.jpg"])
})

test("the chips are the middle title's own: full ones to drop, low ones to add, none on", () => {
	const html = draw()
	const chips = [...html.matchAll(/data-pl-act="tk" data-arg="([^"]+)"[^>]*aria-pressed="(\w+)"/g)]
	assert.deepEqual(
		chips.map((chip) => chip[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">")),
		["spectacle<4", "tension<4", "situational_comedy>6"],
	)
	assert.ok(chips.every((chip) => chip[2] === "false"))
	assert.match(html, /aria-label="Spectacle: 10 of 10 here. Tap: titles with 4 or less."/)
})

test("the trail starts at the page's title, with back off and no count of steps", () => {
	const html = draw()
	assert.match(html, /<button type="button" class="fn-bk" disabled aria-label="Back">/)
	assert.match(html, /aria-current="step" title="The Middle"/)
	assert.doesNotMatch(html, /Step \d/)
	assert.match(html, /<span class="fn-this">This page<\/span>/)
})

test("the plain links are real links, out of the tab order", () => {
	assert.match(
		draw(),
		/<p class="pl-more"><span>Open a page:<\/span><a data-pl-nav="" tabindex="-1" href="\/movie\/2-neighbor-a">Neighbor A \(2001\)<\/a><\/p>$/,
	)
})

test("a title's name can't break out of the markup", () => {
	const html = relatedMap(null).section({
		root: "m1",
		title: 'A "<b>" & more',
		pack: { ...pack, n: [title("m2", '<img onerror="x">', 990)] },
		links: [],
	})
	assert.doesNotMatch(html, /<img onerror/)
	assert.match(html, /Titles like A &quot;&lt;b&gt;&quot; &amp; more/)
})
