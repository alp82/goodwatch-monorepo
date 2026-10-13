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
	new RegExp(`data-tv-item="${id}"[^>]*>([^<]*)<`).exec(html)?.[1]
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
const count = (html: string, part: string) => html.split(part).length - 1
/** The machine's items that a slice has drawn: all but the Expand key, which is slice 11's. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
const BAR = ["bar:back", "bar:search", "bar:menu"]
const EDITIONS = ["desktop", "phone"] as const

test("Tonight's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.tonight))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), drawn(screen.items))
	assert.deepEqual(rendered.tonight.guest.items, [
		"details",
		"another",
		"expand",
		...BAR,
	])
	// One pick has nothing to step to; no pick has nothing to open.
	assert.deepEqual(drawn(rendered.tonight.one.items), ["details", ...BAR])
	assert.deepEqual(drawn(rendered.tonight.none.items), BAR)
})

test("Tonight shows one pick at a time, says which, and wraps", () => {
	const { guest, second, wrapped } = rendered.tonight
	assert.match(guest.desktop, />Pick 1 of 3</)
	assert.match(guest.desktop, />Title 1</)
	assert.match(second.desktop, />Pick 2 of 3</)
	assert.match(second.desktop, />Title 2</)
	// `pick=4` of three is the second.
	assert.match(wrapped.desktop, />Pick 2 of 3</)
	assert.match(wrapped.desktop, />Title 2</)
	for (const edition of EDITIONS) {
		assert.deepEqual(focused(guest[edition]), ["details"])
		assert.equal(label(guest[edition], "details"), "Details")
		assert.equal(label(guest[edition], "another"), "Another one")
		assert.match(guest[edition], />Tonight</)
		assert.match(guest[edition], />Best rated right now</)
	}
})

test("Tonight's picture is the pick's backdrop: w1280 on the desktop, w780 on the phone", () => {
	const { guest } = rendered.tonight
	assert.equal(count(guest.desktop, "/t/p/w1280/backdrop-1.jpg"), 1)
	assert.equal(count(guest.phone, "/t/p/w780/backdrop-1.jpg"), 1)
	assert.equal(count(guest.desktop, "<img"), 1)
	assert.equal(count(guest.phone, "w1280"), 0)
})

test("a pick's facts: the score, the match once there is one, where it streams, and its line on the desktop", () => {
	const { guest, member } = rendered.tonight
	assert.match(guest.desktop, /<b>86<\/b> <span[^>]*>score<\/span>/)
	assert.ok(!guest.desktop.includes("match"))
	assert.match(guest.desktop, />On Netflix</)
	assert.match(guest.desktop, />Line 1\.</)
	// The phone has no room for the kicker and the line.
	assert.ok(!guest.phone.includes("Line 1."))
	assert.ok(!guest.phone.includes("Pick 1 of 3"))
	assert.match(guest.phone, />On Netflix</)
	assert.match(member.desktop, /<b>92%<\/b> <span[^>]*>match<\/span>/)
})

test("a member's Tonight names the next episode, then their Wishlist; a guest's own pick leads", () => {
	const { member, memberSecond, wished } = rendered.tonight
	for (const edition of EDITIONS) {
		assert.match(member[edition], />Next episode: S2 E4</)
		assert.match(memberSecond[edition], />From your Wishlist</)
		assert.match(wished[edition], />From your Wishlist</)
		assert.match(wished[edition], />Title 9</)
	}
	// The episode's name stands where the show's line would.
	assert.match(member.desktop, />Cicada</)
	assert.ok(!member.desktop.includes("Line 10."))
	assert.match(member.desktop, />Pick 1 of 2</)
})

test("Tonight without picks says whether they are on their way, and keeps its bar", () => {
	assert.match(rendered.tonight.waiting.desktop, /on their way/)
	assert.match(rendered.tonight.none.desktop, /No picks right now/)
	for (const screen of [rendered.tonight.waiting, rendered.tonight.none])
		assert.equal(count(screen.desktop, "<img"), 0)
})

test("the title screen's items in the markup are the machine's, in reading order, in every state", () => {
	assert.deepEqual(rendered.title.items, [
		"watch",
		"want-to-see",
		"seen",
		"expand",
		...BAR,
	])
	const { items, short, ...states } = rendered.title
	for (const state of Object.values(states))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(state[edition]), drawn(items))
	assert.deepEqual(ids(short), drawn(items))
	for (const edition of EDITIONS)
		assert.deepEqual(focused(rendered.title.known[edition]), ["watch"])
})

test("every key of the title screen is a real button, as tall as the prototype's; a short phone's are lower", () => {
	const { known, short } = rendered.title
	assert.equal(count(known.desktop, "<button"), 6)
	assert.equal(count(known.desktop, '<button type="button" data-tv-item='), 6)
	assert.equal(count(known.desktop, "h-[74px]"), 3)
	// The phone: three keys in a column, 52 canvas px each; on a canvas under 400 px tall they are 46.
	assert.equal(count(known.phone, "h-[52px]"), 3)
	assert.equal(count(short, "h-[46px]"), 3)
	assert.equal(count(short, "h-[52px]"), 0)
})

test("the title screen names the title, its facts and its line", () => {
	const { known, show } = rendered.title
	assert.match(known.desktop, />Movie</)
	assert.match(known.desktop, />2019 · Movie · 2h 10m</)
	assert.match(known.desktop, />The Matrix</)
	assert.match(known.desktop, />Free your mind\.</)
	assert.match(known.desktop, /<b>86<\/b>/)
	assert.match(known.desktop, />On Netflix</)
	assert.equal(count(known.desktop, "/t/p/w1280/backdrop-603.jpg"), 1)
	assert.equal(count(known.phone, "/t/p/w780/backdrop-603.jpg"), 1)
	assert.match(show.desktop, />Show</)
	assert.match(show.desktop, />2019 · Show · 55 min episodes</)
	assert.match(show.desktop, /<b>91%<\/b>/)
	// The phone leaves the kicker and the line out.
	assert.ok(!known.phone.includes("2h 10m"))
	assert.ok(!known.phone.includes("Free your mind."))
})

test("the Watch key says Watch on the person's service, On another's, and Not streaming as a quiet key", () => {
	const { known, another, nowhere, nowhereFocusedElsewhere, unknown } =
		rendered.title
	for (const edition of EDITIONS) {
		assert.equal(label(known[edition], "watch"), "Watch on Netflix")
		assert.equal(label(another[edition], "watch"), "On Netflix")
		assert.equal(label(nowhere[edition], "watch"), "Not streaming")
		assert.equal(label(unknown[edition], "watch"), "Where to watch")
	}
	// The quiet key is dimmed only while it does not have the focus: focused, its words are black on white.
	assert.match(
		nowhereFocusedElsewhere.desktop,
		/data-tv-item="watch" class="[^"]*\[&amp;:not\(\.tvc-on\)\]:text-white\/55/,
	)
	assert.ok(!known.desktop.includes("text-white/55"))
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
	assert.equal(count(fromList.desktop, "<img"), 0)
	assert.equal(label(fromList.desktop, "watch"), "Where to watch")
	// The key alone says movie or show.
	assert.match(waiting.desktop, />Movie</)
	assert.equal(count(waiting.desktop, "<img"), 0)
	assert.match(missing.desktop, />GoodWatch doesn&#x27;t have this title\.</)
})

test("the Expand key's corner is reserved and empty on Tonight and on the title screen", () => {
	for (const html of [
		rendered.tonight.guest.desktop,
		rendered.tonight.guest.phone,
		rendered.title.known.desktop,
		rendered.title.known.phone,
	]) {
		assert.match(html, /<div data-tv-expand-place="true" class="[^"]*"><\/div>/)
		assert.ok(!ids(html).includes("expand"))
	}
	// On the phone the keys stand in a column on the left, clear of the corner.
	assert.match(rendered.title.known.phone, /w-\[292px\] flex-col/)
})

test("the rating asks how the title was, with the machine's answers in its order", () => {
	const { items, desktop, phone, waiting } = rendered.rate
	assert.deepEqual(items, ["level:9", "level:7", "level:5", "level:3", ...BAR])
	for (const html of [desktop, phone]) {
		assert.deepEqual(ids(html), items)
		assert.deepEqual(focused(html), ["level:9"])
		assert.match(html, />Seen it</)
		assert.match(html, />How was The Matrix\?</)
		assert.equal(label(html, "level:9"), "Excellent")
		assert.equal(label(html, "level:7"), "Good")
		assert.equal(label(html, "level:5"), "Mediocre")
		assert.equal(label(html, "level:3"), "Bad")
		assert.ok(!html.includes("data-tv-expand-place"))
	}
	assert.match(waiting, />How was it\?</)
	assert.deepEqual(ids(waiting), items)
})

test("a screen in a chunk of its own is not in the server's HTML: its bar alone is, and no h1", () => {
	for (const html of Object.values(rendered.first)) {
		assert.deepEqual(ids(html), BAR)
		assert.ok(!html.includes("<template"))
		assert.equal(count(html, "<h1"), 0)
	}
})
