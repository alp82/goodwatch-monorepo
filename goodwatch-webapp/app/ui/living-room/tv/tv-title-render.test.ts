// Tonight, the title screen and the rating as they are drawn: the items in the markup are the machine's, in its
// order, in both editions; each key says what is; and the Expand key's corner stays free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Editions = { desktop: string; phone: string }
type Tonight = Editions & { items: string[] }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-title-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_TITLE_RENDER__")
		.at(-1) ?? "",
) as {
	tonight: Record<
		| "guest"
		| "second"
		| "wrapped"
		| "wished"
		| "one"
		| "member"
		| "memberSecond"
		| "waiting"
		| "none",
		Tonight
	>
	phones: {
		phone: string
		scale: number
		key: number
		title: string
		tonight: string
		rate: string
		toast: string
	}[]
	keySizes: { desktop: number; first: number }
	toast: { desktop: string; phone: string; menuOpen: string }
	title: { items: string[]; short: string } & Record<
		| "known"
		| "another"
		| "nowhere"
		| "nowhereFocusedElsewhere"
		| "unknown"
		| "marked"
		| "seen"
		| "show"
		| "waiting"
		| "missing"
		| "fromList",
		Editions
	>
	rate: Editions & { items: string[]; waiting: string }
	first: Record<"tonight" | "title" | "rate", string>
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
/** What an item says. */
const label = (html: string, id: string) =>
	new RegExp(`data-tv-item="${id}"[^>]*>(?:<span[^>]*>)?([^<]*)<`).exec(
		html,
	)?.[1]
/** The height and, where it is set, the width each item is drawn with, in canvas pixels. */
const sizes = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"[^>]*style="([^"]*)"/g)].map(
		([, id, style]) => ({
			id,
			height: Number(/height:([\d.]+)px/.exec(style)?.[1]),
			width: Number(/width:([\d.]+)px/.exec(style)?.[1] ?? Number.NaN),
		}),
	)
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
const count = (html: string, part: string) => html.split(part).length - 1
/** A screen's own items and its bar's, without the Expand key: for the lists written out here. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
const BAR = ["bar:back", "bar:search", "bar:menu"]
/** Watch next has the TV's navigation along the top, in the bar's place. */
const NAV = [
	"nav:home",
	"nav:tonight",
	"nav:discover",
	"nav:search",
	"nav:quiz",
	"bar:menu",
]
/** What a screen says, its tags and React's text markers left out, a "|" between its pieces. */
const text = (html: string) =>
	html
		.replace(/<!-- -->/g, "")
		.replace(/<svg[\s\S]*?<\/svg>/g, "")
		.replace(/<[^>]+>/g, "|")
		.replace(/\|+/g, "|")
/** The side of a bar's key on a phone's canvas shown at `scale`. */
const keySize54 = (scale: number) => Math.max(54, Math.ceil(44 / scale))
const EDITIONS = ["desktop", "phone"] as const

test("Tonight's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.tonight))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), screen.items)
	// Watch, Trailer, Details, Not now, then the stack of picks.
	assert.deepEqual(rendered.tonight.guest.items, [
		"watch",
		"trailer",
		"details",
		"another",
		"pick:0",
		"pick:1",
		"pick:2",
		"pick:3",
		"expand",
		...NAV,
	])
	// One pick has nothing to step to; no pick has nothing to open.
	assert.deepEqual(drawn(rendered.tonight.one.items), [
		"watch",
		"trailer",
		"details",
		"pick:0",
		...NAV,
	])
	assert.deepEqual(drawn(rendered.tonight.none.items), NAV)
})

test("Tonight shows one pick at a time, says which, and wraps", () => {
	const { guest, second, wrapped } = rendered.tonight
	assert.match(text(guest.desktop), /\|Title 1\|/)
	assert.ok(text(guest.desktop).includes("|Watch next|1 of 4|"))
	assert.ok(text(second.desktop).includes("|Watch next|2 of 4|"))
	assert.match(text(second.desktop), /^\|Best rated right now\|Title 2\|/)
	// `pick=5` of four is the second.
	assert.ok(text(wrapped.desktop).includes("|Watch next|2 of 4|"))
	assert.match(text(wrapped.desktop), /^\|Best rated right now\|Title 2\|/)
	assert.ok(text(guest.phone).includes("|1 / 4|"))
	for (const edition of EDITIONS) {
		assert.deepEqual(focused(guest[edition]), ["watch"])
		assert.equal(label(guest[edition], "watch"), "Where to watch")
		assert.equal(label(guest[edition], "trailer"), "Trailer")
		assert.equal(label(guest[edition], "details"), "Details")
		assert.equal(label(guest[edition], "another"), "Not now")
		assert.match(guest[edition], />Best rated right now</)
		// Each pick of the stack is named for a screen reader.
		for (const [i, name] of ["Title 1", "Title 2", "Title 3", "Title 4"].entries())
			assert.match(guest[edition], new RegExp(`data-tv-item="pick:${i}" aria-label="${name}"`))
	}
})

test("Tonight's picture is the pick's backdrop: w1280 on the desktop, w780 on the phone", () => {
	const { guest } = rendered.tonight
	assert.equal(count(guest.desktop, "/t/p/w1280/backdrop-1.jpg"), 1)
	assert.equal(count(guest.phone, "/t/p/w780/backdrop-1.jpg"), 1)
	assert.equal(count(guest.phone, "w1280"), 0)
	// The stack: a backdrop per pick on the desktop, a poster per pick on the phone.
	assert.equal(count(guest.desktop, "/t/p/w300/backdrop-"), 4)
	assert.equal(count(guest.phone, "/t/p/w154/poster-"), 4)
})

test("a pick's facts: the GoodWatch score, its year, kind and length, and where it streams", () => {
	const { guest, member } = rendered.tonight
	const desktop = text(guest.desktop)
	assert.ok(desktop.includes("|Title 1|2019 · Movie · 2 h 10 min|86|Excellent|GoodWatch score|Netflix|"))
	// A Next episode's length is its own, not the show's usual one (130 min episodes in the fixture).
	assert.ok(text(member.desktop).includes("|2019 · Show · 50 min|"))
	assert.ok(!text(member.desktop).includes("130 min episodes"))
	// The phone has the ring without its words, and no room for where it streams.
	const phone = text(guest.phone)
	assert.ok(phone.includes("|Title 1|86|2019 · Movie · 2 h 10 min|"))
	assert.ok(!phone.includes("GoodWatch score"))
})

test("a member's Tonight names the next episode, then their Wishlist; a guest's own pick leads", () => {
	const { member, memberSecond, wished } = rendered.tonight
	for (const edition of EDITIONS) {
		assert.match(member[edition], />Next episode: S2 E4</)
		assert.match(memberSecond[edition], />From your Wishlist</)
		assert.match(wished[edition], />From your Wishlist</)
		assert.match(wished[edition], />Title 9</)
	}
	assert.ok(text(member.desktop).includes("|Watch next|1 of 2|"))
	assert.ok(text(memberSecond.desktop).includes("|Watch next|2 of 2|"))
})

test("Tonight without picks says whether they are on their way, and keeps its bar", () => {
	assert.match(rendered.tonight.waiting.desktop, /on their way/)
	assert.match(rendered.tonight.none.desktop, /No picks right now/)
	for (const screen of [rendered.tonight.waiting, rendered.tonight.none])
		assert.equal(count(screen.desktop, "<img"), 0)
})

test("the title screen's items in the markup are the machine's, in reading order, in every state", () => {
	// The keys first, then the Fingerprint's card; Where to watch's rows come with the title's offers.
	assert.deepEqual(rendered.title.items, [
		"watch",
		"trailer",
		"want-to-see",
		"seen",
		"fingerprint",
		"expand",
		...BAR,
	])
	const { items, short, ...states } = rendered.title
	for (const state of Object.values(states))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(state[edition]), items)
	assert.deepEqual(ids(short), items)
	for (const edition of EDITIONS)
		assert.deepEqual(focused(rendered.title.known[edition]), ["watch"])
})

test("every key of the title screen is a real button, 54 canvas px tall on the desktop", () => {
	const { known } = rendered.title
	assert.equal(count(known.desktop, "<button"), 9)
	assert.equal(count(known.desktop, '<button type="button" data-tv-item='), 9)
	// The four keys take their height from the rule; the Expand key and the bar's keys are drawn as designed.
	assert.deepEqual(sizes(known.desktop), [
		{ id: "watch", height: 54, width: Number.NaN },
		{ id: "trailer", height: 54, width: Number.NaN },
		{ id: "want-to-see", height: 54, width: Number.NaN },
		{ id: "seen", height: 54, width: Number.NaN },
	])
	assert.equal(count(known.desktop, "h-[64px]"), 4)
	// The Fingerprint is a card as tall as its readings.
	assert.match(known.desktop, /data-tv-item="fingerprint" aria-label="Fingerprint: all readings"/)
	assert.equal(rendered.keySizes.desktop, 74)
})

test("on every phone of the room's table every key is 44 px or more on the phone's screen", () => {
	assert.deepEqual(
		rendered.phones.map((p) => p.phone),
		["360x740", "375x667", "390x700", "390x844", "430x932", "844x390"],
	)
	for (const p of rendered.phones) {
		for (const [screen, items] of [
			// The Fingerprint is a card as tall as its readings, not a key.
			["title", rendered.title.items.filter((id) => id !== "fingerprint")],
			["tonight", rendered.tonight.guest.items],
			["rate", rendered.rate.items],
		] as const) {
			const drawn = sizes(p[screen])
			// Every item of the screen has its size from the rule, the Expand key and the bar's keys included.
			assert.deepEqual(
				drawn.map((item) => item.id),
				items,
				`${p.phone} ${screen}`,
			)
			for (const item of drawn) {
				assert.ok(
					item.height * p.scale >= 44,
					`${p.phone} ${screen} ${item.id}: ${item.height} canvas px at ${p.scale}`,
				)
				// The bar's keys and the white G are round.
				if (item.id.startsWith("bar:") || item.id === "nav:home")
					assert.equal(item.width, item.height, `${p.phone} ${item.id}`)
			}
		}
	}
	// The narrowest phone's keys are the largest on the canvas; a canvas shown at its own size keeps the design's.
	assert.deepEqual(
		rendered.phones.map((p) => p.key),
		[67, 64, 61, 61, 55, 52],
	)
	// Before the window is measured nobody knows the scale, and nothing is painted.
	assert.equal(rendered.keySizes.first, 52)
})

test("on the phone the keys stand in one row that pages sideways, and the Expand key ends the details", () => {
	for (const p of rendered.phones) {
		for (const html of [p.title, p.tonight]) {
			assert.match(html, /data-tv-row="true" class="[^"]*overflow-x-auto/)
			assert.equal(count(html, "col-start-1"), 0)
		}
		// The title's keys share one row.
		const row = /<div data-tv-row="true" [^>]*>([\s\S]*?)<\/div>/.exec(p.title)?.[1] ?? ""
		assert.deepEqual(ids(row), ["watch", "trailer", "want-to-see", "seen"])
		assert.match(p.title, /<div class="flex justify-end"><button type="button" data-tv-item="expand"/)
	}
})

test("the toast stands in the bar's row at the left and ends before the bar's keys", () => {
	const { desktop, phone, menuOpen } = rendered.toast
	assert.match(
		desktop,
		/<div class="pointer-events-none absolute left-0 top-0 z-30 flex items-center h-\[108px\] pl-14" style="max-width:640px"><output class="tvc-toast">Rated 10 · Masterpiece<\/output>/,
	)
	assert.match(phone, /h-\[78px\] pl-5" style="max-width:\d+px"><output/)
	assert.match(desktop, /^<div class="tvc [^"]*" data-tv-toast="">/)
	// On the phone it ends 12 canvas px and more before the first of the bar's three keys.
	for (const p of rendered.phones) {
		const width = Number(/max-width:(\d+)px"><output/.exec(p.toast)?.[1])
		const bar = 500 - 20 - (3 * keySize54(p.scale) + 16)
		assert.ok(width <= bar - 12, `${p.phone}: ${width} against ${bar}`)
		assert.ok(width >= 220, `${p.phone}: ${width} is room for its longest line`)
	}
	// The menu lies over everything: no toast while it is open, and no name steps back.
	assert.ok(!menuOpen.includes("tvc-toast"))
	assert.ok(!menuOpen.includes('data-tv-toast=""'))
})

test("the title screen names the title, its facts and its line", () => {
	const { known, show } = rendered.title
	assert.match(known.desktop, />Movie</)
	assert.match(known.desktop, />2019 · Movie · 2h 10m</)
	assert.match(known.desktop, />The Matrix</)
	assert.match(known.desktop, />Free your mind\.</)
	assert.ok(text(known.desktop).includes("|86|Excellent|GoodWatch score|"))
	assert.equal(count(known.desktop, "/t/p/w1280/backdrop-603.jpg"), 1)
	assert.equal(count(known.phone, "/t/p/w780/backdrop-603.jpg"), 1)
	assert.equal(count(known.desktop, "/t/p/w342/poster-603.jpg"), 1)
	assert.match(show.desktop, />Show</)
	assert.match(show.desktop, />2019 · Show · 55 min episodes</)
	// The phone has the name and the facts in the bar, and leaves the line out.
	assert.ok(text(known.phone).endsWith("|The Matrix|2019 · Movie · 2h 10m|"))
	assert.ok(!known.phone.includes("Free your mind."))
	// Where to watch says it is looking until the title's offers are there.
	for (const edition of EDITIONS)
		assert.match(known[edition], />Looking for where it streams\.</)
})

test("without an offer URL the watch action honestly leads to Where to watch", () => {
	for (const state of [rendered.title.known, rendered.title.another, rendered.title.nowhere, rendered.title.unknown])
		for (const edition of EDITIONS)
			assert.equal(label(state[edition], "watch"), "Where to watch")
})

test("Want to See and Seen it say what is", () => {
	const { known, marked, seen } = rendered.title
	for (const edition of EDITIONS) {
		assert.equal(label(known[edition], "want-to-see"), "Want to See")
		assert.equal(label(known[edition], "seen"), "Seen it")
		assert.equal(label(marked[edition], "want-to-see"), "On Wishlist ✓")
		assert.equal(label(marked[edition], "seen"), "8 · Great")
		assert.equal(label(seen[edition], "seen"), "Seen ✓")
	}
})

test("a title is drawn from what a list knew, from its key alone, and says when the catalog lacks it", () => {
	const { fromList, waiting, missing } = rendered.title
	// A list's name and poster: the name is there, the keys work, the facts follow with the card.
	assert.match(fromList.desktop, />The Matrix</)
	assert.equal(count(fromList.desktop, "/t/p/w342/p.jpg"), 1)
	assert.equal(count(fromList.desktop, "/t/p/w1280/"), 0)
	assert.equal(label(fromList.desktop, "watch"), "Where to watch")
	// The key alone says movie or show.
	assert.match(waiting.desktop, />Movie</)
	assert.equal(count(waiting.desktop, "<img"), 0)
	assert.match(missing.desktop, />GoodWatch doesn&#x27;t have this title\.</)
})

test("the Expand key stands in its corner on the desktop, and ends the phone's content", () => {
	for (const html of [rendered.tonight.guest.desktop, rendered.title.known.desktop]) {
		assert.match(html, /<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*aria-label="Expand"[^>]*>.*?Expand<\/button><\/div>/)
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
	}
	for (const html of [rendered.tonight.guest.phone, rendered.title.known.phone]) {
		assert.ok(!html.includes("data-tv-expand-place"))
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
	}
})

// The strip itself, with its exact scores on the desktop, is tv-taste-render.test.ts's.
test("the rating asks how the title was, on the strip's levels from low to high", () => {
	const { items, desktop, phone, waiting } = rendered.rate
	assert.deepEqual(items, ["level:3", "level:5", "level:7", "level:9", ...BAR])
	for (const html of [desktop, phone]) {
		assert.deepEqual(ids(html), items)
		assert.deepEqual(focused(html), ["level:9"])
		assert.match(html, />Seen it</)
		assert.match(html, />How was The Matrix\?</)
		for (const name of ["Bad, 3", "Mediocre, 5", "Good, 7", "Excellent, 9"])
			assert.equal(count(html, `aria-label="${name}"`), 1)
		assert.ok(!html.includes("data-tv-expand-place"))
	}
	assert.match(waiting, />How was it\?</)
	assert.deepEqual(ids(waiting), items)
})

test("a screen in a chunk of its own is not in the server's HTML: its bar alone is, and no h1", () => {
	// With the Expand key where the screen has a page: a focus that came back to it is on something.
	assert.deepEqual(ids(rendered.first.tonight), ["expand", ...NAV])
	assert.deepEqual(ids(rendered.first.title), ["expand", ...BAR])
	assert.deepEqual(ids(rendered.first.rate), BAR)
	for (const html of Object.values(rendered.first)) {
		assert.ok(!html.includes("<template"))
		assert.equal(count(html, "<h1"), 0)
	}
})

// Regression (2026-10-21): on the phone the Expand key ("All my movies") stood at the end of the stack's scrolling
// row and rode past the picture's right edge. It ends the row now, outside what scrolls.
test("on every phone Watch next's Expand key ends the stack's row, outside the row that scrolls", () => {
	for (const p of rendered.phones) {
		const html = p.tonight
		assert.equal(count(html, 'data-tv-item="expand"'), 1, p.phone)
		const rows = [...html.matchAll(/<div data-tv-row="[^"]*"[^>]*>/g)]
		assert.ok(rows.length >= 2, `${p.phone}: the keys' row and the stack's`)
		for (const row of rows) {
			const start = row.index ?? 0
			// The row's own markup: up to its closing tag, by counting its divs.
			let depth = 0
			let end = start
			for (const m of html.slice(start).matchAll(/<div[\s>]|<\/div>/g)) {
				depth += m[0] === "</div>" ? -1 : 1
				if (depth === 0) {
					end = start + (m.index ?? 0) + 6
					break
				}
			}
			assert.ok(
				!html.slice(start, end).includes('data-tv-item="expand"'),
				`${p.phone}: the Expand key inside a scrolling row`,
			)
		}
	}
})
