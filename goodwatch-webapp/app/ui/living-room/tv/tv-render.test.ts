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
		"homeGuest" | "homeMember" | "about" | "menuGuest" | "menuMember",
		string[]
	> & { phone: Record<"homeGuest" | "homeMember" | "about", string[]> }
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
/** The TV's navigation along the top of its own screens and a member's Start. */
const NAV = [
	"nav:home",
	"nav:tonight",
	"nav:discover",
	"nav:search",
	"nav:quiz",
	"bar:menu",
]

test("home's items in the markup are exactly the machine's, in reading order, in both editions", () => {
	assert.deepEqual(ids(rendered.home.guest.desktop), rendered.items.homeGuest)
	assert.deepEqual(ids(rendered.home.member.desktop), rendered.items.homeMember)
	// The phone's items: the same screen's, with the header's G and Menu (2026-10-22).
	// A phone screen draws a page of its items at a time, with arrows to the rest (2026-10-22): the guest's row of
	// three tiles, Start's Watch next and four tiles.
	for (const [html, items] of [
		[rendered.home.guest.phone, rendered.items.phone.homeGuest],
		[rendered.home.member.phone, rendered.items.phone.homeMember],
	] as const) {
		const drawn = ids(html)
		const own = drawn.filter((id) => !id.startsWith("jump:"))
		assert.deepEqual(
			own,
			items.filter((id) => own.includes(id)),
		)
		for (const id of drawn.filter((one) => one.startsWith("jump:")))
			assert.ok(items.includes(id.slice(5)) && !own.includes(id.slice(5)), id)
		assert.deepEqual(own.slice(-2), ["nav:home", "bar:menu"])
	}
	assert.ok(ids(rendered.home.member.phone).includes("jump:start:taste"))
	assert.deepEqual(rendered.items.phone.homeGuest.slice(-2), [
		"nav:home",
		"bar:menu",
	])
	assert.deepEqual(rendered.items.homeGuest, [
		"app:tonight",
		"app:discover",
		"app:taste",
		"bar:search",
		"bar:menu",
	])
	// A member's home is Start: a tile per screen, then the navigation.
	assert.deepEqual(rendered.items.homeMember, [
		"start:tonight",
		"start:discover",
		"start:search",
		"start:quiz",
		"start:taste",
		"start:shows",
		"start:about",
		...NAV,
	])
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
		/data-tv-item="nav:home" aria-label="Home"/,
	)
})

test("home has one H1, the invitation: drawn for a guest, read out on a member's Start", () => {
	for (const html of [...Object.values(rendered.home.guest)]) {
		assert.equal(count(html, "<h1"), 1)
		assert.ok(html.includes(`>${H1}</h1>`))
	}
	for (const html of Object.values(rendered.home.member)) {
		assert.equal(count(html, "<h1"), 1)
		assert.ok(html.includes(`<h1 class="sr-only">${H1}</h1>`))
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
	// Start's big tile is Watch next, with the pick up next.
	assert.match(rendered.home.member.desktop, />Watch next<\/span>/)
	assert.match(
		rendered.home.member.desktop,
		/1 pick for you · <span class="text-amber-300">Show 10<\/span> is up next/,
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

test("a member's Start shows their next pick and a key to each screen", () => {
	const html = rendered.home.member.desktop
	assert.ok(html.includes("/w780/show-backdrop-10.jpg"))
	assert.ok(html.includes("/w185/show-poster-10.jpg"))
	for (const name of [
		"Discover",
		"Search",
		"Rate titles",
		"Your taste",
		"My shows",
		"What is GoodWatch?",
	])
		assert.ok(html.includes(`>${name}<`), name)
	assert.ok(!html.includes("first-picture"))
})

test("What is GoodWatch? and the menu draw the machine's items", () => {
	for (const edition of ["desktop", "phone"] as const) {
		assert.deepEqual(
			ids(rendered.about[edition]),
			edition === "phone" ? rendered.items.phone.about : rendered.items.about,
		)
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
		"nav:home",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	assert.deepEqual(rendered.items.menuGuest, [
		"menu:home",
		"menu:tonight",
		"menu:discover",
		"menu:search",
		"menu:quiz",
		"menu:taste",
		"menu:about",
	])
	// My shows is a member's.
	assert.deepEqual(rendered.items.menuMember, [
		...rendered.items.menuGuest.slice(0, -1),
		"menu:shows",
		"menu:about",
	])
	// The menu lists the TV's screens by their names: no Sign in, no Turn off.
	for (const name of [
		"Home",
		"Watch next",
		"Discover",
		"Search",
		"Rate titles",
		"Your taste",
		"What is GoodWatch?",
	])
		assert.ok(rendered.menu.guest.desktop.includes(`>${name}<`), name)
	assert.match(rendered.menu.member.desktop, />Start</)
	assert.match(rendered.menu.member.desktop, />My shows</)
	assert.ok(!rendered.menu.guest.desktop.includes(">Sign in<"))
	assert.ok(!rendered.menu.guest.desktop.includes(">Turn off<"))
	assert.match(rendered.about.desktop, />Got it</)
})

test("a screen in a chunk of its own is not in the server's HTML: its bar alone is", () => {
	assert.deepEqual(ids(rendered.aboutFirst), [
		"nav:home",
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
	// The search screens have the navigation in the bar's place.
	assert.deepEqual(ids(rendered.lazy.search), NAV)
	// A screen with a page has its Expand key too: a focus that came back to it is on something.
	assert.deepEqual(ids(rendered.lazy.results), ["expand", ...NAV])
	assert.deepEqual(ids(rendered.lazy.shows), [
		"expand",
		"nav:home",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	for (const html of Object.values(rendered.lazy))
		assert.ok(!html.includes("not built"))
})

test("the Expand key says what it opens, and a screen reader hears where it leads", () => {
	assert.match(
		rendered.lazy.results,
		/data-tv-item="expand"[^>]*aria-label="Search all titles: opens Discover on GoodWatch"/,
	)
	assert.match(
		rendered.lazy.shows,
		/data-tv-item="expand"[^>]*aria-label="All my shows: opens My shows on GoodWatch"/,
	)
	assert.match(rendered.lazy.results, /<\/span>Search all titles<\/button>/)
	assert.match(rendered.lazy.shows, /<\/span>All my shows<\/button>/)
	for (const html of [rendered.lazy.results, rendered.lazy.shows]) {
		// A small picture in four brackets, and the key's words.
		assert.equal(count(html, "tvc-x-arm"), 4)
		assert.ok(!html.includes("Open full"))
	}
	// The picture no longer steps back: the key stays in its corner, with nothing moving it.
	assert.match(
		rendered.lazy.results,
		/data-tv-expand-place="true"[^>]*style="right:56px;bottom:40px"/,
	)
	assert.ok(!rendered.lazy.results.includes("--tvx-"))
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
		/<output class="tvc-toast [^"]*text-\[19px\][^"]*">On your Wishlist<\/output>/,
	)
	for (const html of Object.values(rendered.toast))
		assert.match(html, /^<div class="tvc [^"]*" data-tv-toast="">/)
	assert.match(
		rendered.toast.desktop,
		/\[\[data-tv-toast\]_&amp;\]:opacity-0[^>]*>GoodWatch</,
	)
	// On the phone the header names the screen, and the name steps back for the toast (2026-10-22).
	assert.match(
		rendered.toast.phone,
		/\[\[data-tv-toast\]_&amp;\]:opacity-0[^>]*>(<span[^>]*>)?Home</,
	)
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
	// The TV's pictures under the boot screen ask with low priority, so they don't share the connection with the
	// room's pictures (the LCP). Both editions: they name the same files, and a hidden copy without it raises the
	// shown one (#236).
	for (const screen of screens)
		assert.equal(count(screen, 'fetchpriority="low"'), 6)
	// Once the window is measured (after the room has painted), they ask as usual, so later screens aren't held back.
	assert.doesNotMatch(rendered.home.guest.phone, /fetchpriority/)
	assert.doesNotMatch(rendered.home.guest.desktop, /fetchpriority/)
	// Before the window is measured both editions are drawn with the desktop's items; the phone's header has its G
	// and Menu already, which every phone screen has.
	assert.deepEqual(ids(room), [
		...rendered.items.homeGuest,
		...rendered.items.homeGuest.filter((id) => id.startsWith("app:")),
		"nav:home",
		"bar:menu",
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
