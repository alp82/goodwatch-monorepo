// Tonight, the title screen and the rating as they are drawn: the items in the markup are the machine's, in its
// order, in both editions; each key says what is; and the Expand key's corner stays free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Editions = { desktop: string; phone: string }
type Tonight = Editions & { items: string[]; phoneItems: string[] }
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
		watch: string
		print: string
	}[]
	keySizes: { desktop: number; first: number }
	toast: { desktop: string; phone: string; menuOpen: string }
	title: {
		items: string[]
		phoneItems: string[]
		watchItems: string[]
		printItems: string[]
		short: string
	} & Record<
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
	rate: Editions & { items: string[]; phoneItems: string[]; waiting: string }
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
/** The desktop bar of a screen without the navigation: the white G (since 2026-10-22), Back, Search, Menu. */
const BAR = ["nav:home", "bar:back", "bar:search", "bar:menu"]
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
/** The phone's header on every screen (2026-10-22): the white G and Menu. */
/** The phone's header on every screen but home (2026-10-22): Back, the white G and Menu. */
const HEADER = ["bar:back", "nav:home", "bar:menu"]
/** What a key says for a screen reader, where its words are short: the phone's "Watch". */
const ariaOf = (html: string, id: string) =>
	new RegExp(`data-tv-item="${id}"[^>]*aria-label="([^"]*)"`).exec(html)?.[1]
/** The rating strip: its four levels, then its ten exact scores. */
const LINE = [
	...["level:3", "level:5", "level:7", "level:9"],
	...Array.from({ length: 10 }, (_, at) => `score:${at + 1}`),
]
/** The same items, in any order: what a phone screen draws of the machine's, where the reading order is its own test. */
const sameSet = (a: readonly string[], b: readonly string[], what?: string) =>
	assert.deepEqual([...a].sort(), [...b].sort(), what)

test("Tonight's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.tonight)) {
		assert.deepEqual(ids(screen.desktop), screen.items)
		// The phone's one pick at a time (variant A, the default, 2026-10-22): every item but the stack's picks,
		// which the arrows step through instead.
		sameSet(
			ids(screen.phone),
			screen.phoneItems.filter((id) => !id.startsWith("pick:")),
		)
	}
	assert.deepEqual(rendered.tonight.guest.phoneItems, [
		"prev-pick",
		"next-pick",
		"watch",
		"trailer",
		"details",
		"another",
		"pick:0",
		"pick:1",
		"pick:2",
		"pick:3",
		"expand",
		...HEADER,
	])
	assert.deepEqual(drawn(rendered.tonight.one.phoneItems), [
		"watch",
		"trailer",
		"details",
		"pick:0",
		...HEADER,
	])
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

// Tab walks the markup and the wheel the machine's list: the two must agree. Variant A draws its arrows (beside the
// pick's name) before Watch, where the machine lists them after Not now.
test("the phone's Watch next draws its keys in the machine's reading order", () => {
	const phone = ids(rendered.tonight.guest.phone)
	assert.deepEqual(
		phone,
		rendered.tonight.guest.phoneItems.filter((id) => phone.includes(id)),
	)
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
	assert.ok(text(guest.phone).includes("|1 of 4|"))
	assert.ok(text(second.phone).includes("|Title 2|86|2 of 4|"))
	assert.ok(text(wrapped.phone).includes("|Title 2|86|2 of 4|"))
	for (const edition of EDITIONS) {
		// The compact phone TV says "Watch" (2026-10-22); its name for a screen reader says where it leads.
		const words = edition === "phone" ? "Watch" : "Where to watch"
		assert.deepEqual(focused(guest[edition]), ["watch"])
		assert.equal(label(guest[edition], "watch"), words)
		assert.ok(
			text(guest[edition]).includes(`|${words}|Trailer|Details|`),
			edition,
		)
		assert.equal(label(guest[edition], "details"), "Details")
		assert.equal(label(guest[edition], "another"), "Not now")
	}
	assert.match(guest.desktop, />Best rated right now</)
	// Each pick of the desktop's stack is named for a screen reader; the phone's arrows say where they go.
	for (const [i, name] of [
		"Title 1",
		"Title 2",
		"Title 3",
		"Title 4",
	].entries())
		assert.match(
			guest.desktop,
			new RegExp(`data-tv-item="pick:${i}" aria-label="${name}"`),
		)
	assert.match(guest.phone, /data-tv-item="prev-pick" aria-label="[^"]+"/)
	assert.match(guest.phone, /data-tv-item="next-pick" aria-label="[^"]+"/)
})

test("Tonight's picture is the pick's backdrop: w1280 on the desktop, w780 on the phone", () => {
	const { guest } = rendered.tonight
	assert.equal(count(guest.desktop, "/t/p/w1280/backdrop-1.jpg"), 1)
	assert.equal(count(guest.phone, "/t/p/w780/backdrop-1.jpg"), 1)
	assert.equal(count(guest.phone, "w1280"), 0)
	// The stack: a backdrop per pick on the desktop, a poster per pick on the phone.
	assert.equal(count(guest.desktop, "/t/p/w300/backdrop-"), 4)
	// The phone shows one pick at a time: no stack.
	assert.equal(count(guest.phone, "/t/p/w154/poster-"), 0)
})

test("a pick's facts: the GoodWatch score, its year, kind and length, and where it streams", () => {
	const { guest, member } = rendered.tonight
	const desktop = text(guest.desktop)
	assert.ok(
		desktop.includes(
			"|Title 1|2019 · Movie · 2 h 10 min|86|Excellent|GoodWatch score|Netflix|",
		),
	)
	// A Next episode's length is its own, not the show's usual one (130 min episodes in the fixture).
	assert.ok(text(member.desktop).includes("|2019 · Show · 50 min|"))
	assert.ok(!text(member.desktop).includes("130 min episodes"))
	// The phone has the ring without its words, where it is in the picks, and no room for where it streams.
	const phone = text(guest.phone)
	assert.ok(phone.includes("|Title 1|86|1 of 4|2019 · Movie · 2 h 10 min|"))
	assert.ok(text(member.phone).includes("|2019 · Show · 50 min|"))
	assert.ok(!phone.includes("GoodWatch score"))
})

test("a member's Tonight names the next episode, then their Wishlist; a guest's own pick leads", () => {
	const { member, memberSecond, wished } = rendered.tonight
	// The phone's one pick at a time names the pick but not what kind it is (2026-10-22).
	assert.match(member.desktop, />Next episode: S2 E4</)
	assert.match(memberSecond.desktop, />From your Wishlist</)
	assert.match(wished.desktop, />From your Wishlist</)
	for (const edition of EDITIONS) assert.match(wished[edition], />Title 9</)
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
	const { items, phoneItems, watchItems, printItems, short, ...states } =
		rendered.title
	// The phone's overview (2026-10-22): the hub, its keys to the two sections and Expand at its top, then its four
	// keys, then the header with Back.
	assert.deepEqual(phoneItems, [
		"section:watch",
		"fingerprint",
		"expand",
		"watch",
		"trailer",
		"want-to-see",
		"seen",
		...HEADER,
	])
	// It draws every item; the reading order is the test after this one.
	const overview = phoneItems
	for (const state of Object.values(states)) {
		assert.deepEqual(ids(state.desktop), items)
		sameSet(ids(state.phone), overview)
	}
	sameSet(ids(short), overview)
	// Where to watch and the fingerprint: their own items and the header, with its Back to the overview.
	for (const sectionItems of [watchItems, printItems]) {
		assert.ok(!sectionItems.some((id) => id.startsWith("section:")))
		assert.deepEqual(sectionItems.slice(-3), HEADER)
	}
	for (const p of rendered.phones) {
		sameSet(ids(p.watch), watchItems, p.phone)
		sameSet(ids(p.print), printItems, p.phone)
	}
	for (const edition of EDITIONS)
		assert.deepEqual(focused(rendered.title.known[edition]), ["watch"])
})

// Tab walks the markup and the wheel the machine's list: the two must agree. The phone's sections draw their
// section keys at the top, where the machine lists them after the section's own items.
test("the phone's title sections draw their keys in the machine's reading order", () => {
	const order = (html: string, items: readonly string[]) => {
		const drawnIds = ids(html)
		assert.deepEqual(
			drawnIds,
			items.filter((id) => drawnIds.includes(id)),
		)
	}
	order(rendered.title.known.phone, rendered.title.phoneItems)
	order(rendered.phones[0].print, rendered.title.printItems)
})

test("every key of the title screen is a real button, 54 canvas px tall on the desktop", () => {
	const { known } = rendered.title
	// The four keys, the fingerprint, Expand, and the bar: the white G, Back, Search and Menu.
	assert.equal(count(known.desktop, "<button"), 10)
	assert.equal(count(known.desktop, '<button type="button" data-tv-item='), 10)
	// The four keys take their height from the rule; the Expand key and the bar's keys are drawn as designed.
	assert.deepEqual(sizes(known.desktop), [
		{ id: "watch", height: 54, width: Number.NaN },
		{ id: "trailer", height: 54, width: Number.NaN },
		{ id: "want-to-see", height: 54, width: Number.NaN },
		{ id: "seen", height: 54, width: Number.NaN },
	])
	assert.equal(count(known.desktop, "h-[64px]"), 5)
	// The Fingerprint is a card as tall as its readings.
	assert.match(
		known.desktop,
		/data-tv-item="fingerprint" aria-label="Fingerprint: all readings"/,
	)
	assert.equal(rendered.keySizes.desktop, 74)
})

test("on every phone of the room's table every key is 44 px or more on the phone's screen", () => {
	assert.deepEqual(
		rendered.phones.map((p) => p.phone),
		["360x740", "375x667", "390x700", "390x844", "430x932", "844x390"],
	)
	for (const p of rendered.phones) {
		for (const [screen, items] of [
			[
				"title",
				rendered.title.phoneItems.filter((id) => id !== "section:overview"),
			],
			["watch", rendered.title.watchItems],
			["print", rendered.title.printItems],
			[
				"tonight",
				rendered.tonight.guest.phoneItems.filter(
					(id) => !id.startsWith("pick:"),
				),
			],
			["rate", rendered.rate.phoneItems],
		] as const) {
			const drawn = sizes(p[screen])
			// Every item of the screen has its size from the rule, the Expand key and the header's keys included.
			sameSet(
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
		[64, 61, 59, 59, 53, 52],
	)
	// Before the window is measured nobody knows the scale, and nothing is painted.
	assert.equal(rendered.keySizes.first, 52)
})

test("on the phone nothing scrolls: the title's four keys share one row, and the Expand key is drawn once", () => {
	for (const p of rendered.phones) {
		for (const html of [p.title, p.watch, p.print, p.tonight]) {
			assert.ok(!html.includes("data-tv-row"), p.phone)
			assert.ok(!html.includes("data-tv-scroll"), p.phone)
			assert.ok(!/overflow-(x|y)?-?auto/.test(html), p.phone)
		}
		// The title's keys share one row: the four of them, nothing between them.
		const keys = ids(p.title)
		const at = keys.indexOf("watch")
		assert.deepEqual(keys.slice(at, at + 4), [
			"watch",
			"trailer",
			"want-to-see",
			"seen",
		])
		const row =
			/<div class="[^"]*">((?:<button[^>]*data-tv-item="(?:watch|trailer|want-to-see|seen)"[\s\S]*?<\/button>){4})<\/div>/.exec(
				p.title,
			)
		assert.ok(row, `${p.phone}: one row of the four keys`)
		for (const html of [p.title, p.tonight])
			assert.equal(count(html, 'data-tv-item="expand"'), 1, p.phone)
	}
})

test("the toast stands in the bar's row, and on the phone in the header between the G and Menu", () => {
	const { desktop, phone, menuOpen } = rendered.toast
	assert.match(
		desktop,
		/<div class="pointer-events-none absolute left-0 top-0 z-30 flex items-center h-\[108px\] pl-14" style="max-width:640px"><output class="tvc-toast">Rated 10 · Masterpiece<\/output>/,
	)
	assert.match(desktop, /^<div class="tvc [^"]*" data-tv-toast="">/)
	assert.match(phone, /^<div class="tvc [^"]*" data-tv-toast="">/)
	// On the phone (2026-10-22) it stands in the header's row (66 canvas px), between the white G at the left and
	// Menu at the right, where the screen's name is: it covers neither key.
	for (const p of rendered.phones) {
		const box =
			/<div class="pointer-events-none absolute[^"]*" style="([^"]*)"><output/.exec(
				p.toast,
			)?.[1] ?? ""
		const left = Number(/left:(\d+(?:\.\d+)?)px/.exec(box)?.[1] ?? 0)
		const width = Number(/max-width:(\d+)px/.exec(box)?.[1])
		const key = keySize54(p.scale)
		assert.match(box, /height:66px/, `${p.phone}: the header's height`)
		assert.ok(
			left >= 12 + key,
			`${p.phone}: starts at ${left}, after the G (${12 + key})`,
		)
		assert.ok(
			left + width <= 480 - 12 - key,
			`${p.phone}: ends at ${left + width}, before Menu (${480 - 12 - key})`,
		)
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
	// The phone's overview: the name in the header, the facts by the ring; the line is left out.
	assert.ok(text(known.phone).endsWith("|The Matrix|"))
	assert.ok(text(known.phone).includes("|86|2019 · Movie · 2h 10m|"))
	assert.ok(!known.phone.includes("Free your mind."))
	// Where to watch says it is looking until the title's offers are there: on the phone in its own section.
	assert.match(known.desktop, />Looking for where it streams\.</)
	for (const p of rendered.phones)
		assert.match(p.watch, />Looking for where it streams\.</)
})

test("without an offer URL the watch action honestly leads to Where to watch", () => {
	for (const state of [
		rendered.title.known,
		rendered.title.another,
		rendered.title.nowhere,
		rendered.title.unknown,
	])
		for (const edition of EDITIONS)
			if (edition === "desktop")
				assert.equal(label(state[edition], "watch"), "Where to watch")
			// The phone's key says "Watch", and where it leads to a screen reader.
			else {
				assert.equal(label(state[edition], "watch"), "Watch")
				assert.match(ariaOf(state[edition], "watch") ?? "", /^Watch: where it streams/)
			}
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
	for (const html of [
		rendered.tonight.guest.desktop,
		rendered.title.known.desktop,
	]) {
		assert.match(
			html,
			/<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*aria-label="Expand"[^>]*>.*?Expand<\/button><\/div>/,
		)
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
	}
	for (const html of [
		rendered.tonight.guest.phone,
		rendered.title.known.phone,
	]) {
		assert.ok(!html.includes("data-tv-expand-place"))
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
	}
})

// The strip itself, with its exact scores on the desktop, is tv-taste-render.test.ts's.
test("the rating asks how the title was, on the strip's levels from low to high", () => {
	const { items, phoneItems, desktop, phone, waiting } = rendered.rate
	assert.deepEqual(items, [...LINE, ...BAR])
	// The phone's band: the levels over their scores, then the header.
	assert.deepEqual(phoneItems, [
		"level:3",
		"level:5",
		"level:7",
		"level:9",
		...Array.from({ length: 10 }, (_, i) => `score:${i + 1}`),
		...HEADER,
	])
	assert.match(desktop, />Seen it</)
	for (const [html, own] of [
		[desktop, items],
		[phone, phoneItems],
	] as const) {
		assert.deepEqual(ids(html), own)
		assert.deepEqual(focused(html), ["level:9"])
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

// Regression (2026-10-21): on the phone the Expand key ("All my movies") rode past the picture's right edge at the
// end of the stack's scrolling row. Since 2026-10-22 nothing on the phone scrolls (the test "on the phone nothing
// scrolls"), and the Expand key is drawn once, in the screen's own row.
test("on every phone Watch next's Expand key is in a row of its own keys, not after the picks", () => {
	for (const p of rendered.phones) {
		const keys = ids(p.tonight)
		assert.equal(keys.filter((id) => id === "expand").length, 1, p.phone)
		assert.ok(!keys.some((id) => id.startsWith("pick:")), p.phone)
	}
})
