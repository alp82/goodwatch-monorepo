// The TV's screens in the server's HTML: the items in the markup are the machine's, in its order; the home holds
// the page's H1 once per edition; and a guest's HTML holds nothing personal.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Editions = { desktop: string; phone: string }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_RENDER__")
		.at(-1) ?? "",
) as {
	home: { guest: Editions; member: Editions; focusOnBar: string }
	about: Editions
	aboutFirst: string
	menu: { guest: Editions; member: Editions }
	menuOpen: string
	lazy: Record<"search" | "results" | "shows", string>
	booting: string
	toast: Editions
	room: { guest: string; again: string; member: string; off: string }
	items: Record<
		| "homeGuest"
		| "homeMember"
		| "about"
		| "menuGuest"
		| "menuMember",
		string[]
	>
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
/** The ids of the items marked as focused. */
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
const count = (html: string, part: string) => html.split(part).length - 1
const H1 = "Let&#x27;s find something good to watch next."

test("home's items in the markup are exactly the machine's, in reading order, in both editions", () => {
	for (const edition of ["desktop", "phone"] as const) {
		assert.deepEqual(
			ids(rendered.home.guest[edition]),
			rendered.items.homeGuest,
		)
		assert.deepEqual(
			ids(rendered.home.member[edition]),
			rendered.items.homeMember,
		)
	}
	assert.deepEqual(rendered.items.homeGuest, [
		"app:tonight",
		"app:discover",
		"app:taste",
		"bar:search",
		"bar:menu",
	])
	assert.ok(rendered.items.homeMember.includes("app:shows"))
})

test("every item is a real button, and exactly one has the focus", () => {
	const html = rendered.home.guest.desktop
	assert.equal(count(html, "<button"), rendered.items.homeGuest.length)
	assert.equal(count(html, '<button type="button" data-tv-item='), 5)
	assert.deepEqual(focused(html), ["app:tonight"])
	assert.deepEqual(focused(rendered.home.focusOnBar), ["bar:menu"])
	// On the phone the bar's keys are icons, so they carry their names.
	assert.match(
		rendered.home.guest.phone,
		/data-tv-item="bar:menu" aria-label="Menu"/,
	)
	assert.match(
		rendered.home.guest.phone,
		/data-tv-item="bar:search" aria-label="Search"/,
	)
})

test("home has one H1: the guest invitation or the member Watch next", () => {
	for (const html of [
		...Object.values(rendered.home.guest),
	]) {
		assert.equal(count(html, "<h1"), 1)
		assert.ok(html.includes(`>${H1}</h1>`))
	}
	for (const html of Object.values(rendered.home.member)) {
		assert.equal(count(html, "<h1"), 1)
		assert.ok(html.includes(">Watch next</h1>"))
	}
	// No other screen has one.
	for (const html of [
		rendered.about.desktop,
		...Object.values(rendered.lazy),
		rendered.booting,
	])
		assert.equal(count(html, "<h1"), 0)
})

test("the home shows the focused app large, and while the focus is on the bar the first app", () => {
	assert.match(rendered.home.guest.desktop, />Watch next<\/div>/)
	assert.match(
		rendered.home.guest.desktop,
		/One pick at a time, best rated right now\./,
	)
	assert.match(rendered.home.focusOnBar, />Watch next<\/div>/)
	assert.match(
		rendered.home.member.desktop,
		/Next episode · S2 E4/,
	)
})

test("a guest's first picture is the first start title's backdrop: w1280 on the desktop, w780 on the phone", () => {
	const picture = (size: string) =>
		`https://image.tmdb.org/t/p/${size}/first-picture.jpg`
	// The whole picture and the Tonight tile take the same file.
	assert.equal(count(rendered.home.guest.desktop, picture("w1280")), 2)
	assert.equal(count(rendered.home.guest.desktop, picture("w780")), 0)
	assert.equal(count(rendered.home.guest.phone, picture("w780")), 2)
	assert.equal(count(rendered.home.guest.phone, "w1280"), 0)
	// The Discover tile: four posters of the start titles, nothing else of them.
	for (const html of Object.values(rendered.home.guest)) {
		assert.equal(count(html, "https://image.tmdb.org/t/p/w154/poster"), 4)
		assert.equal(count(html, "<img"), 6)
		// Each says its file's size (2 by 3), so a report doesn't count it as an image without width and height.
		assert.equal(
			html.match(/w154\/poster[^"]*" width="154" height="231"/g)?.length,
			4,
		)
	}
})

test("a member sees their Next pick and library actions", () => {
	const html = rendered.home.member.desktop
	assert.ok(html.includes("/w1280/show-backdrop-10.jpg"))
	assert.ok(html.includes("My shows"))
	assert.ok(html.includes("My movies"))
	assert.ok(!html.includes("first-picture"))
})

test("What is GoodWatch? and the menu draw the machine's items", () => {
	for (const edition of ["desktop", "phone"] as const) {
		assert.deepEqual(ids(rendered.about[edition]), rendered.items.about)
		// A screen reader meets a menu of menu items, each named by its word.
		const menu = rendered.menu.guest[edition]
		assert.match(menu, /role="menu" aria-label="Menu"/)
		assert.equal(
			count(menu, 'role="menuitem"'),
			rendered.items.menuGuest.length,
		)
		assert.deepEqual(
			ids(rendered.menu.guest[edition]),
			rendered.items.menuGuest,
		)
		assert.deepEqual(
			ids(rendered.menu.member[edition]),
			rendered.items.menuMember,
		)
	}
	assert.deepEqual(rendered.items.about, [
		"got-it",
		"rate",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	assert.deepEqual(rendered.items.menuGuest, [
		"menu:home",
		"menu:search",
		"menu:sign-in",
		"menu:about",
		"menu:off",
	])
	// A member has no Sign in.
	assert.ok(!rendered.items.menuMember.includes("menu:sign-in"))
	assert.match(rendered.menu.guest.desktop, />Sign in</)
	assert.match(rendered.menu.guest.desktop, />Turn off</)
	assert.match(rendered.about.desktop, />Got it</)
})

test("a screen in a chunk of its own is not in the server's HTML: its bar alone is", () => {
	assert.deepEqual(ids(rendered.aboutFirst), [
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	assert.ok(!rendered.aboutFirst.includes("<template"))
	// Under the open menu the screen takes no input; the menu's code follows after hydration.
	assert.match(rendered.menuOpen, /data-tv-layer="" inert=""/)
	assert.equal(count(rendered.menuOpen, "data-tv-layer"), 2)
	assert.deepEqual(ids(rendered.menuOpen), rendered.items.homeGuest)
})

test("every screen has its own code: before it is there the server draws the screen's bar alone", () => {
	// No Search key on the search screens: the person is there.
	assert.deepEqual(ids(rendered.lazy.search), ["bar:back", "bar:menu"])
	// A screen with a page has its Expand key too: a focus that came back to it is on something.
	assert.deepEqual(ids(rendered.lazy.results), [
		"expand",
		"bar:back",
		"bar:menu",
	])
	assert.deepEqual(ids(rendered.lazy.shows), [
		"expand",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	for (const html of Object.values(rendered.lazy))
		assert.ok(!html.includes("not built"))
})

test("the Expand key says Expand, and a screen reader hears where it leads", () => {
	assert.match(
		rendered.lazy.results,
		/data-tv-item="expand"[^>]*aria-label="Expand: Discover"/,
	)
	assert.match(
		rendered.lazy.shows,
		/data-tv-item="expand"[^>]*aria-label="Expand: My shows"/,
	)
	for (const html of [rendered.lazy.results, rendered.lazy.shows]) {
		// A small picture in four brackets, and one word.
		assert.equal(count(html, "tvc-x-arm"), 4)
		assert.match(html, /<\/span>Expand<\/button>/)
		assert.ok(!html.includes("Open full"))
	}
	// The key keeps its place while the picture steps back to 94%: it is moved against the step by as much.
	assert.match(
		rendered.lazy.results,
		/data-tv-expand-place="true"[^>]*style="right:56px;bottom:40px;--tvx-x:34\.72px;--tvx-y:18\.13px"/,
	)
})

test("while the TV boots it shows the wordmark and no item; the toast stands in the bar's row", () => {
	assert.deepEqual(ids(rendered.booting), [])
	assert.match(rendered.booting, /lr-boot/)
	assert.match(rendered.booting, /aria-label="GoodWatch"/)
	// The toast stands in the bar's row at the left, where it covers no key, and the home's wordmark steps back.
	assert.match(
		rendered.toast.desktop,
		/<div class="pointer-events-none absolute left-0 top-0 z-30 [^"]*" style="max-width:640px"><output class="tvc-toast">On your Wishlist<\/output>/,
	)
	assert.match(
		rendered.toast.phone,
		/<output class="tvc-toast [^"]*text-\[20px\][^"]*">On your Wishlist<\/output>/,
	)
	for (const html of Object.values(rendered.toast)) {
		assert.match(html, /^<div class="tvc [^"]*" data-tv-toast="">/)
		assert.match(html, /\[\[data-tv-toast\]_&amp;\]:opacity-0[^>]*>GoodWatch</)
	}
	assert.ok(!rendered.home.guest.desktop.includes("tvc-toast"))
	assert.ok(!rendered.home.guest.desktop.includes("data-tv-toast="))
})

test("before the window is measured the room holds both editions of the screen, one H1 each", () => {
	const html = rendered.room.guest
	const room = html.slice(0, html.indexOf('<section id="browse"'))
	// living-room.css places each edition's canvas for the first paint and shows the one the window's layout draws.
	assert.match(
		room,
		/<div data-tv-canvas="desktop" class="absolute left-0 top-0 origin-top-left tvr-f-cv tvr-f-cv-desktop">/,
	)
	assert.match(
		room,
		/<div data-tv-canvas="phone" class="absolute left-0 top-0 origin-top-left tvr-f-cv tvr-f-cv-phone">/,
	)
	assert.equal(count(room, "<h1"), 2)
	assert.equal(count(html, "<h1"), 2)
	// Each edition's pictures are lazy, so the edition CSS hides does not request them.
	const screens = [
		...room.matchAll(
			/<div data-tv-canvas="(desktop|phone)"[\s\S]*?(?=<div data-tv-canvas=|<div data-remote)/g,
		),
	].map((m) => m[0])
	assert.equal(screens.length, 2)
	for (const screen of screens) {
		assert.equal(count(screen, "<img"), 6)
		assert.equal(count(screen, 'loading="lazy"'), 6)
	}
	assert.deepEqual(ids(room), [
		...rendered.items.homeGuest,
		...rendered.items.homeGuest,
	])
	// The phone's top bar keys are as tall as they will be once the window is measured (living-room.css, `--tv-key`).
	assert.match(
		screens[1],
		/style="width:max\(54px, var\(--tv-key, 54px\)\);height:max\(54px, var\(--tv-key, 54px\)\)"/,
	)
	assert.doesNotMatch(screens[0], /--tv-key/)
})

test("a guest's HTML is the same on every render, and the TV that is off draws no screen", () => {
	assert.equal(rendered.room.guest, rendered.room.again)
	assert.notEqual(rendered.room.member, rendered.room.guest)
	assert.equal(count(rendered.room.off, "data-tv-item"), 0)
	assert.equal(count(rendered.room.off, "tvr-f-cv tvr-f-cv-"), 2)
})
