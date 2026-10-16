// Home's guide for a member with Sides of you (#673) as it is drawn: its items are the machine's, in its order,
// with only the picks of the side that is on; a side is its loved posters and no words while the gate is closed;
// and the phone keeps the row of tiles.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import {
	FEW_ON_SERVICES,
	LOVED_LABEL,
	NO_PICKS,
	SIDES_HEADING,
} from "./home-sides-copy.ts"

type Drawn = { html: string; items: string[]; focus: string }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-home-sides-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_HOME_SIDES__")
		.at(-1) ?? "",
) as Record<
	"onApp" | "onSide" | "onPick" | "onEmpty" | "phone" | "named",
	Drawn
>

const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
const APPS = [
	"app:tonight",
	"app:discover",
	"app:explorer",
	"app:taste",
	"app:shows",
]
const ENTRIES = [...APPS, "home-side:a", "home-side:b", "home-side:c"]
const BAR = ["bar:search", "bar:menu"]
test("with an app on, the guide draws the apps, the sides' entries and the bar, and no picks", () => {
	const { html, items } = rendered.onApp
	assert.deepEqual(ids(html), [...ENTRIES, ...BAR])
	assert.ok(items.includes("title:movie-11"))
	assert.deepEqual(focused(html), ["app:tonight"])
})

test("with a side on, the guide draws that side's picks and Watch next key, in the machine's order", () => {
	const side = rendered.onSide
	assert.deepEqual(ids(side.html), [
		...APPS,
		"home-side:a",
		"home-side:b",
		"home-side:c",
		"title:movie-21",
		"title:movie-22",
		"watch-next:b",
		...BAR,
	])
	assert.deepEqual(focused(side.html), ["home-side:b"])
	// The picks follow the machine's reading order.
	const picks = side.items.filter(
		(item) => ids(side.html).includes(item) && !ENTRIES.includes(item),
	)
	assert.deepEqual(picks, [
		"title:movie-21",
		"title:movie-22",
		"watch-next:b",
		...BAR,
	])
	assert.ok(side.html.includes(FEW_ON_SERVICES))
})

test("a focused pick keeps its side on and names the pick", () => {
	const { html } = rendered.onPick
	assert.deepEqual(focused(html), ["title:movie-12"])
	assert.ok(html.includes('data-tv-item="title:movie-11"'))
	assert.ok(!html.includes('data-tv-item="title:movie-21"'))
	assert.ok(html.includes(">Pick 12<"))
	assert.ok(!html.includes(FEW_ON_SERVICES))
})

test("a side without picks says so and keeps its Watch next key", () => {
	const { html } = rendered.onEmpty
	assert.ok(html.includes(NO_PICKS))
	assert.deepEqual(focused(html), ["watch-next:c"])
})

test("with the words gate closed, a side is its loved posters: no name, no moods, no share", () => {
	const { html } = rendered.onSide
	assert.ok(html.includes("/loved-b-1.jpg"))
	assert.ok(html.includes(LOVED_LABEL))
	assert.ok(html.includes(SIDES_HEADING))
	assert.ok(!/of what you love|titles you love|Heavy/.test(html))
	// A screen reader hears which side it is and the loved titles it is shown by.
	assert.match(
		html,
		/aria-label="Your taste, 2 of 3, with Loved b 1, Loved b 2 and Loved b 3"/,
	)
	// Today's H1 is there once, for a screen reader.
	assert.equal(
		html.split("Let&#x27;s find something good for tonight.").length - 1,
		1,
	)
})

test("with the words gate open, the side's name and its moods show", () => {
	const { html } = rendered.named
	assert.ok(html.includes("Dark, tense crime"))
	assert.ok(html.includes("Watch next: Heavy"))
})

test("the phone keeps the row of tiles, with the services", () => {
	const { html, items } = rendered.phone
	assert.deepEqual(ids(html), items)
	assert.ok(items.includes("service:8"))
	assert.ok(!items.some((item) => item.startsWith("home-side:")))
})
