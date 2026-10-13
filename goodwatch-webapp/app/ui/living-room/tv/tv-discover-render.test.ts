// Mini Discover as it is drawn: the items in the markup are the machine's, in its order, in both editions; the
// open tab is marked; a tile shows its option's picture or its colour; the list names the focused title; and on
// every phone of the room's table the keys are touch targets with the Expand key's corner free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Editions = { desktop: string; phone: string }
type Drawn = Editions & { items: string[] }
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
/** The machine's items that a slice has drawn: all but the Expand key, which is slice 11's. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
/** An item's own tag. */
const tag = (html: string, id: string) =>
	new RegExp(`<button[^>]*data-tv-item="${id}"[^>]*>`).exec(html)?.[0] ?? ""
const BAR = ["bar:back", "bar:search", "bar:menu"]
const TABS = ["tab:moods", "tab:themes", "tab:styles"]
const EDITIONS = ["desktop", "phone"] as const

test("the choice screen's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.choice))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), drawn(screen.items))
	assert.deepEqual(rendered.choice.themes.items, [
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
		// The open tab has its own look, and the others the quiet one.
		assert.match(
			tag(themes[edition], "tab:themes"),
			/tvc-tab tvc-tab-open|tvc-tab [^"]*tvc-tab-open/,
		)
		assert.ok(!/tvc-tab-open/.test(tag(themes[edition], "tab:moods")))
		assert.match(tag(themes[edition], "tab:moods"), /tvc-tab /)
	}
})

test("each tab shows its six options by the app's names; the desktop says a line under each", () => {
	const names = {
		moods: ["Funny", "Feel-good", "Romance", "Action", "Scary", "Mind-bending"],
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
	// The phone has room for one line: the focused option's, in the last row.
	assert.equal(
		count(themes.phone, "Heists, cons and the people who chase them."),
		1,
	)
	assert.ok(!themes.phone.includes("Magic, spirits and other rules."))
	assert.match(
		rendered.choice.secondFocused.phone,
		/>Tomorrow&#x27;s worlds and machines\.</,
	)
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
	for (const screen of Object.values(rendered.list))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), drawn(screen.items))
	assert.deepEqual(rendered.list.theme.items, [
		"title:movie-161",
		"title:movie-388",
		"title:show-1399",
		"title:movie-120",
		"change",
		"expand",
		...BAR,
	])
	assert.deepEqual(drawn(rendered.list.two.items), [
		"title:movie-161",
		"title:movie-388",
		"change",
		...BAR,
	])
	assert.deepEqual(drawn(rendered.list.none.items), ["change", ...BAR])
})

test("the list says whose titles these are, and names the focused one with its facts", () => {
	const { mood, theme, style, second } = rendered.list
	for (const edition of EDITIONS) {
		assert.match(mood[edition], />Funny</)
		assert.match(theme[edition], />Crime</)
		assert.match(style[edition], />Slow burn</)
		for (const screen of [mood, theme, style]) {
			assert.match(screen[edition], />Discover</)
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
		assert.match(theme[edition], />Change</)
		assert.match(waiting[edition], />Titles are on their way\.</)
		assert.match(unreported[edition], />Titles are on their way\.</)
		assert.match(none[edition], />Nothing fits\.</)
		for (const screen of [waiting, unreported, none]) {
			assert.deepEqual(focused(screen[edition]), ["change"])
			assert.equal(count(screen[edition], "<img"), 0)
		}
	}
})

test("the Expand key's corner is reserved and empty on both screens, in both editions", () => {
	for (const html of [
		rendered.choice.themes.desktop,
		rendered.choice.themes.phone,
		rendered.list.theme.desktop,
		rendered.list.theme.phone,
	]) {
		assert.match(html, /<div data-tv-expand-place="true" class="[^"]*"><\/div>/)
		assert.ok(!ids(html).includes("expand"))
	}
	// On the desktop the band under the content is kept free for it.
	assert.match(rendered.choice.themes.desktop, /pb-\[120px\]/)
	assert.match(rendered.list.theme.desktop, /pb-\[120px\]/)
	// On the phone the last row ends before the corner.
	assert.match(rendered.choice.themes.phone, /pr-\[158px\]/)
	assert.match(rendered.list.theme.phone, /pr-\[158px\]/)
})

test("on every phone of the room's table the tabs, the bar's keys and the last row are touch targets", () => {
	for (const phone of rendered.phones) {
		const at = `${phone.phone} at ${phone.scale.toFixed(3)}`
		for (const size of [phone.tab, phone.foot, phone.bar])
			assert.ok(size * phone.scale >= 44, `${at}: ${size}`)
		// The tabs' row and the last row are drawn at those heights.
		assert.ok(
			phone.choice.includes(`style="height:${phone.tab}px"><button`),
			`${at}: the tabs`,
		)
		assert.ok(
			count(phone.choice, `pr-[158px]" style="height:${phone.foot}px"`) === 1,
			`${at}: the choice's last row`,
		)
		assert.ok(
			count(phone.list, `pr-[158px]" style="height:${phone.foot}px"`) === 1,
			`${at}: the list's last row`,
		)
		// What is left for the two rows of tiles: each at least a touch target tall. The Frame's content starts 78
		// px down and ends 20 px above the canvas's bottom edge; the grid has 5 px over it, 8 between its rows and
		// 5 under it.
		const tiles = (phone.h - 78 - 20 - phone.tab - phone.foot - 18) / 2
		assert.ok(tiles * phone.scale >= 44, `${at}: a tile is ${tiles} tall`)
	}
})

test("before its code is there the server draws Discover's bar alone, and nothing of a list", () => {
	for (const html of [rendered.first.choice, rendered.first.list]) {
		assert.deepEqual(ids(html), BAR)
		assert.ok(!html.includes("Ocean"))
		assert.ok(!html.includes("art-theme"))
	}
})
