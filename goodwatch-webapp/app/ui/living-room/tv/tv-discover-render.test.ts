// Mini Discover as it is drawn: the items in the markup are the machine's, in its order, in both editions; the
// open tab is marked; a tile shows its option's picture or its colour; the list names the focused title; and on
// every phone of the room's table the keys are touch targets with the Expand key's corner free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Editions = { desktop: string; phone: string }
type Drawn = Editions & { items: string[]; phoneItems: string[] }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-discover-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_DISCOVER_RENDER__")
		.at(-1) ?? "",
) as {
	choice: Record<
		| "moods"
		| "themes"
		| "styles"
		| "plain"
		| "partly"
		| "onTab"
		| "onBar"
		| "secondFocused",
		Drawn
	>
	list: Record<
		| "mood"
		| "theme"
		| "style"
		| "second"
		| "long"
		| "onChange"
		| "two"
		| "waiting"
		| "unreported"
		| "none",
		Drawn
	>
	phones: {
		phone: string
		scale: number
		h: number
		tab: number
		foot: number
		bar: number
		choice: string
		list: string
	}[]
	first: { choice: string; list: string }
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
/** The tabs marked as open. */
const open = (html: string) =>
	[
		...html.matchAll(/data-tv-item="(tab:[a-z]+)"[^>]*aria-pressed="true"/g),
	].map((match) => match[1])
const count = (html: string, part: string) => html.split(part).length - 1

/** A screen's own items and its bar's, without the Expand key: for the lists written out here. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
/** An item's own tag. */
const tag = (html: string, id: string) =>
	new RegExp(`<button[^>]*data-tv-item="${id}"[^>]*>`).exec(html)?.[0] ?? ""
/** Discover's navigation along the top, in the bar's place. */
const BAR = [
	"nav:home",
	"nav:tonight",
	"nav:discover",
	"nav:search",
	"nav:quiz",
	"bar:menu",
]
const TABS = ["tab:moods", "tab:themes", "tab:styles"]
/** The phone's header: the white G and Menu. */
/** The phone's header on every screen but home (2026-10-22): Back, the white G and Menu. */
const PHONE_BAR = ["bar:back", "nav:home", "bar:menu"]
/** What the phone draws of a list's items: its first page of five titles, the arrow to the next page, the rest. */
const phonePage = (items: readonly string[]) => {
	const titles = items.filter((id) => id.startsWith("title:"))
	return [
		...titles.slice(0, 5),
		...(titles.length > 5 ? [`jump:${titles[5]}`] : []),
		...items.filter(
			(id) =>
				!id.startsWith("title:") &&
				id !== "browse:prev" &&
				id !== "browse:next",
		),
	]
}
const EDITIONS = ["desktop", "phone"] as const

test("the choice screen's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.choice)) {
		assert.deepEqual(ids(screen.desktop), screen.items)
		assert.deepEqual(ids(screen.phone), screen.phoneItems)
		// The phone's Expand key ends the row of tabs (2026-10-22): right after them, before the options.
		assert.deepEqual(screen.phoneItems.slice(-3), PHONE_BAR)
		assert.deepEqual(screen.phoneItems.slice(0, 5), [
			"browse:all",
			...TABS,
			"expand",
		])
	}
	assert.deepEqual(rendered.choice.themes.items, [
		"browse:all",
		...TABS,
		"theme:crime",
		"theme:mystery",
		"theme:family",
		"theme:growing",
		"theme:future",
		"theme:fantasy",
		"expand",
		...BAR,
	])
})

test("three tabs with their names, and the open one marked, with or without the focus", () => {
	const { moods, themes, styles, onTab, onBar } = rendered.choice
	for (const edition of EDITIONS) {
		for (const name of ["Moods", "Themes", "Styles"])
			assert.equal(count(themes[edition], `>${name}</button>`), 1, name)
		assert.deepEqual(open(moods[edition]), ["tab:moods"])
		assert.deepEqual(open(themes[edition]), ["tab:themes"])
		assert.deepEqual(open(styles[edition]), ["tab:styles"])
		// The pointer over Styles while Moods is open: Styles has the focus, Moods stays open, with its options.
		assert.deepEqual(focused(onTab[edition]), ["tab:styles"])
		assert.deepEqual(open(onTab[edition]), ["tab:moods"])
		assert.ok(ids(onTab[edition]).includes("mood:funny"))
		assert.ok(!ids(onTab[edition]).includes("style:slow"))
		assert.deepEqual(focused(onBar[edition]), ["bar:menu"])
		assert.deepEqual(open(onBar[edition]), ["tab:styles"])
		// The open tab has its own look, and the others the quiet one: on the phone quiet words with an underline
		// (kit.tsx, `Tab`, 2026-10-22), on the desktop the TV's tabs.
		const [quiet, marked] =
			edition === "phone"
				? [/tvc-utab /, /tvc-utab-on/]
				: [/tvc-tab /, /tvc-tab-open/]
		assert.match(tag(themes[edition], "tab:themes"), marked)
		assert.ok(!marked.test(tag(themes[edition], "tab:moods")))
		assert.match(tag(themes[edition], "tab:moods"), quiet)
	}
})

test("each tab shows its six options by the app's names; the desktop says a line under each", () => {
	const names = {
		moods: ["Funny", "Cozy", "Romantic", "Thrilling", "Scary", "Trippy"],
		themes: ["Crime", "Mystery", "Family", "Growing up", "Future", "Fantasy"],
		styles: [
			"Animated",
			"Spectacle",
			"Slow burn",
			"Fast-paced",
			"Talky",
			"Nonlinear",
		],
	}
	for (const tab of ["moods", "themes", "styles"] as const)
		for (const edition of EDITIONS)
			for (const name of names[tab])
				assert.equal(count(rendered.choice[tab][edition], `>${name}</span>`), 1)
	const { themes } = rendered.choice
	assert.match(themes.desktop, />Heists, cons and the people who chase them\.</)
	assert.match(themes.desktop, />Magic, spirits and other rules\.</)
	// The phone (nothing scrolls): the names alone, the six options and the Expand key fill the picture.
	assert.ok(
		!themes.phone.includes("Heists, cons and the people who chase them."),
	)
	assert.ok(!themes.phone.includes("Magic, spirits and other rules."))
})

test("a tile is its option's picture under its colour; the focused option's is behind the screen", () => {
	const { themes, secondFocused } = rendered.choice
	for (const edition of EDITIONS) {
		// Six tiles, each with one w780 file of its own.
		for (const key of [
			"crime",
			"mystery",
			"family",
			"growing",
			"future",
			"fantasy",
		])
			assert.equal(
				count(themes[edition], `/t/p/w780/art-theme-${key}.jpg`),
				edition === "phone" && key === "crime" ? 2 : 1,
				key,
			)
		// A theme's colour is its own: Crime's.
		assert.match(themes[edition], /color-mix\(in srgb, #c2413a 26%, #05060a\)/)
	}
	// Behind everything: the focused option's, at the picture's size.
	assert.equal(count(themes.desktop, "/t/p/w1280/art-theme-crime.jpg"), 1)
	assert.equal(count(themes.desktop, "w1280"), 1)
	assert.equal(count(themes.phone, "w1280"), 0)
	assert.equal(
		count(secondFocused.desktop, "/t/p/w1280/art-theme-future.jpg"),
		1,
	)
})

test("until the pool is there, and for an option without a title, the tile is the option's colour alone", () => {
	const { plain, partly } = rendered.choice
	for (const edition of EDITIONS) {
		assert.equal(count(plain[edition], "<img"), 0)
		// Crime, Mystery, Family, Growing up, Future, Fantasy, by the app's colours.
		for (const color of [
			"#c2413a",
			"#5b7fa8",
			"#8ccf4d",
			"#7cc4e8",
			"#3fc1b0",
			"#d4508a",
		])
			assert.match(
				plain[edition],
				new RegExp(
					`linear-gradient\\(160deg, color-mix\\(in srgb, ${color} 58%`,
				),
				color,
			)
		// One picture, five colours.
		assert.equal(count(partly[edition], "linear-gradient(160deg"), 5)
		assert.equal(count(partly[edition], "/art-theme-crime.jpg"), 2)
	}
})

test("the list's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.list)) {
		assert.deepEqual(ids(screen.desktop), screen.items)
		assert.deepEqual(ids(screen.phone), phonePage(screen.phoneItems))
	}
	assert.deepEqual(rendered.list.theme.items, [
		"title:movie-161",
		"title:movie-388",
		"title:show-1399",
		"title:movie-120",
		"browse:filters",
		"change",
		"expand",
		...BAR,
	])
	assert.deepEqual(drawn(rendered.list.two.items), [
		"title:movie-161",
		"title:movie-388",
		"browse:filters",
		"change",
		...BAR,
	])
	assert.deepEqual(drawn(rendered.list.none.items), [
		"browse:filters",
		"change",
		...BAR,
	])
})

test("the list says whose titles these are, and names the focused one with its facts", () => {
	const { mood, theme, style, second } = rendered.list
	assert.match(mood.desktop, />Funny · Page 1/)
	assert.match(theme.desktop, />Crime · Page 1/)
	assert.match(style.desktop, />Slow burn · Page 1/)
	// The phone's header names the choice.
	assert.match(mood.phone, /<span class="[^"]*truncate[^"]*">Funny<\/span>/)
	assert.match(
		style.phone,
		/<span class="[^"]*truncate[^"]*">Slow burn<\/span>/,
	)
	for (const edition of EDITIONS) {
		for (const screen of [mood, theme, style]) {
			if (edition === "desktop") assert.match(screen[edition], />Discover</)
			assert.deepEqual(focused(screen[edition]), ["title:movie-161"])
			assert.match(screen[edition], />Ocean&#x27;s Eleven</)
			assert.match(
				screen[edition],
				/>2001 · Movie · 1h 56m · 82 score · On Netflix</,
			)
		}
		assert.match(second[edition], />Inside Man</)
		assert.match(
			second[edition],
			/>2001 · Movie · 1h 56m · 82 score · 91% match · On Netflix</,
		)
		assert.ok(!second[edition].includes(">Ocean&#x27;s Eleven<"))
	}
})

test("the list keeps naming a title while the focus is on Change", () => {
	for (const edition of EDITIONS) {
		assert.deepEqual(focused(rendered.list.onChange[edition]), ["change"])
		assert.match(rendered.list.onChange[edition], />Ocean&#x27;s Eleven</)
	}
})

test("the list's pictures: a poster per title, and the focused title's backdrop behind them", () => {
	const { theme, second } = rendered.list
	for (const id of [161, 388, 1399, 120]) {
		assert.equal(count(theme.desktop, `/t/p/w342/poster-${id}.jpg`), 1)
		assert.equal(count(theme.phone, `/t/p/w185/poster-${id}.jpg`), 1)
	}
	assert.equal(count(theme.desktop, "/t/p/w1280/backdrop-161.jpg"), 1)
	assert.equal(count(theme.phone, "/t/p/w780/backdrop-161.jpg"), 1)
	assert.equal(count(second.desktop, "/t/p/w1280/backdrop-388.jpg"), 1)
	assert.equal(count(theme.desktop, "<img"), 5)
	// A poster says its title to a screen reader.
	assert.match(tag(theme.desktop, "title:movie-388"), /aria-label="Inside Man"/)
})

test("Change says Change, and the list without titles says why", () => {
	const { theme, waiting, unreported, none } = rendered.list
	for (const edition of EDITIONS) {
		assert.match(theme[edition], />Moods</)
		assert.match(waiting[edition], />Titles are on their way\.</)
		assert.match(unreported[edition], />Titles are on their way\.</)
		assert.match(none[edition], />Nothing fits\.</)
		for (const screen of [waiting, unreported, none]) {
			assert.deepEqual(focused(screen[edition]), ["browse:filters"])
			assert.equal(count(screen[edition], "<img"), 0)
		}
	}
})

test("the Expand key stands in its corner on the desktop and ends the last row on the phone", () => {
	for (const html of [
		rendered.choice.themes.desktop,
		rendered.list.theme.desktop,
	]) {
		assert.match(
			html,
			/<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*aria-label="Expand"[^>]*>.*?Expand<\/button><\/div>/,
		)
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
	}
	// On the desktop the band under the content is kept free for it.
	assert.match(rendered.choice.themes.desktop, /pb-\[120px\]/)
	assert.match(rendered.list.theme.desktop, /pb-\[120px\]/)
	// On the phone (nothing scrolls) the key carries its words: at the end of the row of tabs, over the options, and
	// at the end of the keys' row under the list. Nothing lies under it, and no corner is kept.
	for (const html of [
		rendered.choice.themes.phone,
		rendered.list.theme.phone,
	]) {
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
		assert.ok(!html.includes("data-tv-expand-place"))
		assert.ok(!html.includes("data-tv-scroll"))
		assert.ok(!html.includes("data-tv-row"))
	}
	assert.match(
		rendered.choice.themes.phone,
		/data-tv-item="tab:styles".*?<\/button><div class="ml-auto"><button type="button" data-tv-item="expand"/,
	)
	assert.match(
		rendered.list.theme.phone,
		/data-tv-item="change".*?<\/button><button type="button" data-tv-item="expand"/,
	)
})

test("on every phone of the room's table the tabs, the keys and the tiles are touch targets, and nothing scrolls", () => {
	for (const phone of rendered.phones) {
		const at = `${phone.phone} at ${phone.scale.toFixed(3)}`
		for (const size of [phone.foot, phone.bar])
			assert.ok(size * phone.scale >= 44, `${at}: ${size}`)
		// The tabs' row and the list's keys are a key tall.
		assert.ok(
			phone.choice.includes(`style="height:${phone.bar}px"><button`),
			`${at}: the tabs`,
		)
		assert.ok(
			phone.list.includes(`style="height:${phone.foot}px"><button`),
			`${at}: the keys`,
		)
		for (const html of [phone.choice, phone.list])
			assert.ok(!html.includes("data-tv-scroll"), at)
		// What is left for the two rows of tiles under the header (66) and over the foot (10): the tabs, 4 px
		// under them and 4 between the rows. Each a touch target, but on a phone narrower than 375 px.
		const tiles = (phone.h - 66 - 10 - phone.bar - 8) / 2
		assert.ok(
			tiles * phone.scale >= 44 || phone.phone === "360x740",
			`${at}: a tile is ${tiles} tall`,
		)
	}
})

test("before its code is there the server draws Discover's navigation and Expand key alone, and nothing of a list", () => {
	for (const html of [rendered.first.choice, rendered.first.list]) {
		assert.deepEqual(ids(html), ["expand", ...BAR])
		assert.ok(!html.includes("Ocean"))
		assert.ok(!html.includes("art-theme"))
	}
})
