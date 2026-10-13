// The mini Explorer as it is drawn: the items in the markup are the machine's, in its order, in both editions; the
// islands are flat and carry their names; an island's keys are touch targets on every phone; and the Expand key's
// corner stays free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import { MAP_PLACES } from "./tv-explorer.ts"
import { SIX } from "./tv-explorer.fixture.ts"

type Drawn = { items: string[]; html: string }
type Editions = { desktop: Drawn; phone: Drawn }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-explorer-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_EXPLORER_RENDER__")
		.at(-1) ?? "",
) as Record<
	| "map"
	| "mapOnFunny"
	| "mapOnBar"
	| "island"
	| "islandOnSecond"
	| "member"
	| "empty"
	| "missing"
	| "waiting"
	| "failed",
	Editions
> & {
	first: string
	firstIsland: string
	reported: string
	phones: {
		phone: string
		scale: number
		key: number
		map: string
		island: string
	}[]
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
/** An item's opening tag. */
const tag = (html: string, id: string) =>
	new RegExp(`<button type="button" data-tv-item="${id}"[^>]*>`).exec(
		html,
	)?.[0] ?? ""
const count = (html: string, part: string) => html.split(part).length - 1
const BAR = ["bar:back", "bar:search", "bar:menu"]
/** The Expand key is the machine's item; its place is kept, and slice 11 draws the key. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")

test("every screen's items in the markup are exactly the machine's, in reading order, in both editions", () => {
	for (const [name, screen] of Object.entries({
		map: rendered.map,
		island: rendered.island,
		member: rendered.member,
		empty: rendered.empty,
		missing: rendered.missing,
		waiting: rendered.waiting,
		failed: rendered.failed,
	}))
		for (const edition of ["desktop", "phone"] as const) {
			const { items, html } = screen[edition]
			assert.deepEqual(ids(html), drawn(items), `${name} ${edition}`)
			assert.equal(count(html, "<button"), drawn(items).length)
			assert.equal(focused(html).length, 1, `${name} ${edition}: one focus`)
			assert.match(html, /data-tv-expand-place/)
			assert.match(html, />Explorer</)
			assert.equal(count(html, "<h1"), 0)
		}
	assert.deepEqual(rendered.map.desktop.items, [
		...SIX.map((id) => `island:${id}`),
		"expand",
		...BAR,
	])
	assert.deepEqual(rendered.island.desktop.items, [
		"title:movie-701",
		"title:movie-702",
		"title:movie-703",
		"title:movie-704",
		"hop:thrilling",
		"hop:dark",
		"expand",
		...BAR,
	])
})

test("the map: flat islands in their own colours with their names inside, each at its place", () => {
	const { html } = rendered.map.desktop
	assert.match(html, />Six islands</)
	assert.deepEqual(focused(html), ["island:dark"])
	SIX.forEach((id, n) => {
		const place = MAP_PLACES[n]
		const island = tag(html, `island:${id}`)
		assert.match(island, /class="tvc-item [^"]*tvc-tile[^"]*absolute/)
		const px = (n: number) => (n ? `${n}px` : "0")
		assert.ok(
			island.includes(
				`left:${px(place.left)};top:${px(place.top)};width:${place.width}px;height:${place.height}px`,
			),
			`${id} sits at place ${n}`,
		)
		assert.ok(island.includes(`border-radius:${place.shape}`))
		// A flat colour, and no picture: the name is the island.
		assert.match(island, /background:#[0-9a-f]{6}/)
	})
	assert.equal(count(html, "<img"), 1, "the one picture is the backdrop")
	for (const name of ["Dark", "Sad", "Cozy", "Scary", "Thrilling", "Funny"])
		assert.match(html, new RegExp(`text-\\[38px\\]">${name}</span>`))
	// The name's ink stands out on the colour: white on Dark's violet, near black on Funny's yellow.
	assert.match(tag(html, "island:dark"), /background:#6a5aa8;color:#fff/)
	assert.match(tag(html, "island:funny"), /background:#e2cf55;color:#0b0c10/)
	// The focused island has the tile's white edge; the others a ring of their own colour.
	assert.doesNotMatch(tag(html, "island:dark"), /outline/)
	assert.match(tag(html, "island:funny"), /outline:7px solid #e2cf5538/)
})

test("the map shows what sets the focused island apart, and its bridges", () => {
	const { html } = rendered.map.desktop
	assert.match(html, />A bleak outlook and suspense</)
	assert.match(html, />1,943 titles</)
	assert.match(html, /backdrop-801\.jpg/)
	// Dark and Scary, Sad and Thrilling, Cozy and Funny: three dotted lines between the places' centres.
	assert.equal(count(html, "<line"), 3)
	const centre = (n: number) =>
		`${MAP_PLACES[n].left + MAP_PLACES[n].width / 2}" y1="${MAP_PLACES[n].top + MAP_PLACES[n].height / 2}"`
	assert.ok(html.includes(`x1="${centre(0)}`))
	assert.match(html, /stroke-dasharray="2 14"/)

	const funny = rendered.mapOnFunny.desktop.html
	assert.deepEqual(focused(funny), ["island:funny"])
	assert.match(funny, />Comic situations and slapstick</)
	assert.match(funny, />2,616 titles</)
	// With the focus on the bar the map keeps showing its first island.
	assert.deepEqual(focused(rendered.mapOnBar.desktop.html), ["bar:menu"])
	assert.match(rendered.mapOnBar.desktop.html, />A bleak outlook and suspense</)
})

test("the phone's map is three by two, with the focused island's line beside the Expand key's corner", () => {
	const { html } = rendered.map.phone
	assert.match(html, /class="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 /)
	assert.equal(count(html, "<line"), 0)
	for (const id of SIX) {
		const island = tag(html, `island:${id}`)
		assert.doesNotMatch(island, /absolute/)
		assert.match(island, /max-h-\[108px\]/)
	}
	assert.match(html, /text-\[25px\]">Thrilling<\/span>/)
	// The last row ends before the corner, 158 canvas px wide.
	assert.match(
		html,
		/style="height:62px;padding-right:158px"><div class="tvc-fade line-clamp-2 [^"]*">A bleak outlook and suspense · 1,943 titles</,
	)
})

test("an island: the focused title's name and facts over four posters, and Sail to its two nearest", () => {
	const { html } = rendered.island.desktop
	assert.match(html, />Sad · Deeply moving stories and melancholy</)
	assert.deepEqual(focused(html), ["title:movie-701"])
	assert.match(html, /style="font-size:62px">Title 701</)
	assert.match(html, />1990 · Movie · 80 score</)
	assert.match(html, /w1280\/backdrop-701\.jpg/)
	// Four posters, each named for a screen reader, in a row that pages.
	assert.equal(count(html, "/w342/poster-70"), 4)
	assert.match(
		tag(html, "title:movie-702"),
		/aria-label="Title 702" class="tvc-item [^"]*tvc-tile[^"]*" style="width:172px;height:258px"/,
	)
	assert.match(html, /data-tv-row=""/)
	assert.match(html, />Sail to</)
	assert.match(tag(html, "hop:thrilling"), /aria-label="Sail to Thrilling"/)
	assert.match(html, /style="background:#e8793d"><\/span>Thrilling</)
	assert.match(html, /style="background:#6a5aa8"><\/span>Dark</)
	// The band under the content is the Expand key's.
	assert.match(html, /pb-\[120px\]/)

	const second = rendered.islandOnSecond.desktop.html
	assert.deepEqual(focused(second), ["title:movie-702"])
	assert.match(second, />Title 702</)
	assert.match(second, /w1280\/backdrop-702\.jpg/)
})

test("an island for a member: a long name stays on two lines, with the match and their service", () => {
	const { html, items } = rendered.member.desktop
	assert.deepEqual(drawn(items), [
		"title:movie-121",
		"title:show-122",
		"hop:thrilling",
		"hop:dark",
		...BAR,
	])
	assert.match(
		html,
		/class="line-clamp-2 [^"]*" style="font-size:38px">The Lord of the Rings: The Return of the King</,
	)
	assert.match(html, />2003 · Movie · 93 score · 91% match · On Netflix</)
	// On the phone the name and the facts are one line each.
	assert.match(
		rendered.member.phone.html,
		/class="truncate text-\[30px\][^"]*">The Lord of the Rings: The Return of the King</,
	)
})

test("an island without titles says so and still sails on; one the map lacks has its bar alone", () => {
	for (const edition of ["desktop", "phone"] as const) {
		const empty = rendered.empty[edition]
		assert.deepEqual(drawn(empty.items), ["hop:thrilling", "hop:dark", ...BAR])
		assert.match(empty.html, />Nothing on this island right now\.</)
		assert.deepEqual(focused(empty.html), ["hop:thrilling"])
		const missing = rendered.missing[edition]
		assert.deepEqual(drawn(missing.items), BAR)
		assert.match(missing.html, /This island isn&#x27;t on the map\./)
		assert.deepEqual(drawn(rendered.waiting[edition].items), BAR)
		assert.match(rendered.waiting[edition].html, />The map is on its way\.</)
		assert.match(rendered.failed[edition].html, /Try again in a moment\./)
	}
})

test("the server, and the page until the map has reported, draw the bar alone", () => {
	for (const html of [
		rendered.first,
		rendered.firstIsland,
		rendered.reported,
	]) {
		assert.deepEqual(ids(html), BAR)
		assert.doesNotMatch(html, /island|Sail to|not built/)
		assert.equal(count(html, "<img"), 0)
	}
})

test("on every phone of the room's table the keys are touch targets, and the corner stays free", () => {
	assert.deepEqual(
		rendered.phones.map((p) => p.phone),
		["360x740", "375x667", "390x700", "390x844", "430x932", "844x390"],
	)
	// The narrowest phone's keys are the largest on the canvas.
	assert.deepEqual(
		rendered.phones.map((p) => p.key),
		[67, 64, 61, 61, 55, 54],
	)
	for (const p of rendered.phones) {
		for (const id of ["hop:thrilling", "hop:dark"]) {
			const height = Number(/height:(\d+)px/.exec(tag(p.island, id))?.[1])
			assert.equal(height, p.key, `${p.phone} ${id}`)
			assert.ok(
				height * p.scale >= 44,
				`${p.phone} ${id}: ${height} at ${p.scale}`,
			)
		}
		for (const html of [p.map, p.island])
			for (const id of BAR) {
				const side = Number(/width:(\d+)px/.exec(tag(html, id))?.[1])
				assert.ok(side * p.scale >= 44, `${p.phone} ${id}`)
			}
		// The last row of both screens is as tall as a key and ends before the corner.
		assert.ok(p.map.includes(`style="height:${p.key}px;padding-right:158px"`))
		assert.ok(
			p.island.includes(`style="height:${p.key}px;padding-right:158px"`),
		)
		// What a key says is cut short before it spills.
		assert.equal(count(p.island, '<span class="truncate">'), 2)
	}
})
