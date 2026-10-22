// My shows, the Seen it key of a show the member is midway through, home's My shows tile, the menu and What is
// GoodWatch? as they are drawn: the items in the markup are the machine's, in its order, in both editions; every
// key is a touch target on every phone of the room's table; and the Expand key's corner stays free.
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
			"app/ui/living-room/tv/tv-shows-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_SHOWS_RENDER__")
		.at(-1) ?? "",
) as {
	items: string[]
	phoneItems: string[]
	emptyPhoneItems: string[]
	emptyItems: string[]
	titleItems: string[]
	titlePhoneItems: string[]
	aboutPhoneItems: string[]
	guestMenu: string[]
	memberMenu: string[]
	aboutItems: string[]
	shows: Record<"plain" | "signal" | "long" | "onBar" | "empty", Editions>
	title: { episode: Editions; rated: string; plain: string }
	home: Record<"plain" | "signal", Editions>
	menu: Editions
	about: Editions
	first: string
	underMenu: string
	phones: {
		phone: string
		scale: number
		h: number
		key: number
		shows: string
		title: string
		menu: string
		memberMenu: string
		menuKey: number
		about: string
	}[]
}

/**
 * What the phone draws of a list's items: its first page of five titles, the arrow to the next page (an item that
 * moves the focus to the sixth), then the rest.
 */
const phonePage = (items: readonly string[]) => {
	const titles = items.filter((id) => id.startsWith("title:"))
	return [
		...titles.slice(0, 5),
		...(titles.length > 5 ? [`jump:${titles[5]}`] : []),
		...items.filter((id) => !id.startsWith("title:")),
	]
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
/** The height each item is drawn with, in canvas pixels, where its style sets one. */
const heights = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"[^>]*style="([^"]*)"/g)].map(
		([, id, style]) => ({
			id,
			height: Number(/height:(\d+)px/.exec(style)?.[1]),
		}),
	)
const focused = (html: string) =>
	/data-tv-item="([^"]+)"[^>]*aria-current="true"|aria-current="true"[^>]*data-tv-item="([^"]+)"/
		.exec(html)
		?.slice(1)
		.find(Boolean)
const count = (html: string, part: string) => html.split(part).length - 1

/**
 * The phone's last row with the Expand key at its right end (kit.tsx, `PhoneFoot`): its height and what stands
 * before the key, or null when the screen has no such row.
 */
const phoneFoot = (html: string) => {
	const m =
		/<div class="flex shrink-0 items-center gap-2[^"]*" style="height:(\d+)px"><div class="flex min-w-0 flex-1 items-center gap-2">(.*?)<\/div><button type="button" data-tv-item="expand"/.exec(
			html,
		)
	return m ? { height: Number(m[1]), before: m[2] } : null
}

test("My shows draws the machine's items in its order, in both editions", () => {
	assert.deepEqual(rendered.items, [
		"title:show-10",
		"title:show-11",
		"title:show-12",
		"title:show-20",
		"title:show-21",
		"title:show-22",
		"expand",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	// The phone's header has Back, the G and Menu (2026-10-22: Back on every screen but home).
	assert.deepEqual(rendered.phoneItems.slice(-4), [
		"expand",
		"bar:back",
		"nav:home",
		"bar:menu",
	])
	const { desktop, phone } = rendered.shows.signal
	assert.deepEqual(ids(desktop), rendered.items)
	assert.deepEqual(ids(phone), phonePage(rendered.phoneItems))
	for (const html of [desktop, phone]) {
		assert.equal(focused(html), "title:show-10")
		// The Expand key, once: in its corner on the desktop, in the last row on the phone.
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
	}
	assert.match(
		desktop,
		/<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"/,
	)
	assert.ok(!phone.includes("data-tv-expand-place"))
})

test("the focused show is named with its line, and its backdrop is the picture", () => {
	const { desktop, phone } = rendered.shows.plain
	assert.match(desktop, />My shows</)
	assert.match(desktop, />Your next episodes</)
	assert.match(desktop, />Severance</)
	assert.match(
		desktop,
		/>Next: S2 E4 · Woe(&#x27;|')s Hollow · 50 min · 6 episodes left</,
	)
	assert.equal(count(desktop, "/t/p/w1280/backdrop-10.jpg"), 1)
	assert.equal(count(phone, "/t/p/w780/backdrop-10.jpg"), 1)
	// The focus on the fifth show: the screen names that one.
	const long = rendered.shows.long
	assert.match(long.desktop, />Only Murders in the Building</)
	assert.match(long.desktop, />To start · 4 seasons · 88% match</)
	assert.match(long.desktop, /font-size:46px/)
	assert.equal(focused(long.phone), "title:show-21")
	// The focus on the bar: the screen keeps the first show.
	assert.match(rendered.shows.onBar.desktop, />Severance</)
	assert.equal(focused(rendered.shows.onBar.desktop), "bar:back")
})

test("a poster says where a press leads; on the phone the focused show's line says it", () => {
	const { desktop, phone } = rendered.shows.plain
	const label = (text: string) =>
		new RegExp(
			`<span class="absolute inset-x-0 bottom-0 truncate[^"]*">${text}</span>`,
		)
	assert.match(desktop, label("S2 E4 · 50 min"))
	assert.match(desktop, label("S3 E2 · 44 min"))
	// Its episode list was not read.
	assert.match(desktop, label("Continue"))
	assert.equal(count(desktop, ">Start</span>"), 3)
	assert.equal(count(phone, "inset-x-0 bottom-0 truncate"), 0)
	// A screen reader hears the show and where a press leads.
	assert.match(desktop, /aria-label="Severance, S2 E4 · 50 min"/)
	assert.match(phone, /aria-label="Andor, Start"/)
	// Six posters of one size, w342 on the desktop and w185 on the phone.
	assert.equal(count(desktop, "/t/p/w342/poster-"), 6)
	// The phone shows a page of five, and an arrow to the sixth.
	assert.equal(count(phone, "/t/p/w185/poster-"), 5)
	assert.match(phone, /data-tv-item="jump:title:show-22"/)
	assert.equal(count(desktop, 'style="width:163px;height:244px"'), 6)
})

test("the New episodes signal: what is new under the screen's name, and New on its shows", () => {
	for (const html of Object.values(rendered.shows.signal)) {
		assert.match(html, />New in 2 shows</)
		assert.ok(!html.includes("Your next episodes"))
		assert.equal(count(html, ">New</span>"), 2)
		assert.match(html, /aria-label="Slow Horses, new, S3 E2 · 44 min"/)
		assert.match(html, /aria-label="Andor, new, Start"/)
	}
	// Without the signal nothing is marked.
	for (const html of Object.values(rendered.shows.plain))
		assert.equal(count(html, ">New</span>"), 0)
})

test("a member without a show to continue or to start is told how one gets here", () => {
	assert.deepEqual(rendered.emptyItems, [
		"expand",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	assert.deepEqual(rendered.emptyPhoneItems, [
		"expand",
		"bar:back",
		"nav:home",
		"bar:menu",
	])
	for (const [edition, html] of Object.entries(rendered.shows.empty)) {
		assert.deepEqual(
			ids(html),
			edition === "phone" ? rendered.emptyPhoneItems : rendered.emptyItems,
		)
		assert.match(
			html,
			/>No show to watch next\. Want to See on a show puts it here to start\./,
		)
	}
})

test("the server draws My shows as its bar and Expand key alone, and nothing of the member's shows", () => {
	assert.deepEqual(ids(rendered.first), [
		"expand",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	assert.ok(!rendered.first.includes("Severance"))
	assert.ok(!rendered.first.includes("poster-"))
})

test("Seen it on a show the member is midway through names the episode it marks", () => {
	const key = (html: string) =>
		/data-tv-item="seen"[^>]*>(?:<span[^>]*>)?([^<]*)</.exec(html)?.[1]
	assert.deepEqual(ids(rendered.title.episode.desktop), rendered.titleItems)
	// The phone's overview draws the machine's items but its own section's key (2026-10-22: sections).
	const phone = ids(rendered.title.episode.phone)
	assert.deepEqual(
		[...phone].sort(),
		rendered.titlePhoneItems.filter((id) => id !== "section:overview").sort(),
	)
	for (const html of Object.values(rendered.title.episode))
		assert.equal(key(html), "Seen S2 E4")
	// A score does not take the episode's place; without an episode the key is as on any title.
	assert.equal(key(rendered.title.rated), "Seen S2 E5")
	assert.equal(key(rendered.title.plain), "8 · Great")
})

test("home's My shows tile carries the signal's number, and says what is new while it has the focus", () => {
	for (const html of Object.values(rendered.home.signal)) {
		assert.match(html, />New in 2 shows\.</)
		assert.match(html, /aria-hidden="true"[^>]*>2<\/span>/)
		assert.match(
			html,
			/<span class="sr-only">2 shows have something new<\/span>/,
		)
		// The number is on the My shows tile and no other.
		assert.equal(count(html, "bg-sky-300"), 1)
		assert.match(
			html,
			/data-tv-item="app:shows"(?:(?!data-tv-item).)*bg-sky-300/s,
		)
	}
	for (const html of Object.values(rendered.home.plain)) {
		assert.match(html, />Your next episodes\.</)
		assert.equal(count(html, "bg-sky-300"), 0)
	}
})

test("on every phone of the room's table every key of My shows and of a show's title is a touch target", () => {
	assert.deepEqual(
		rendered.phones.map((p) => p.phone),
		["360x740", "375x667", "390x700", "390x844", "430x932", "844x390"],
	)
	for (const p of rendered.phones) {
		// My shows: every key takes its size from the rule, the posters share the height the name, the facts and
		// the keys' row leave, and the arrow, the Expand key and the header's keys are touch targets.
		assert.deepEqual(ids(p.shows), phonePage(rendered.phoneItems))
		for (const item of heights(p.shows))
			assert.ok(item.height * p.scale >= 44, `${p.phone} shows ${item.id}`)
		assert.deepEqual(
			heights(p.shows).map((item) => item.id),
			["jump:title:show-22", "expand", "bar:back", "nav:home", "bar:menu"],
		)
		assert.ok(!p.shows.includes("data-tv-expand-place"), p.phone)
		assert.ok(!p.shows.includes("data-tv-scroll"), p.phone)
		assert.ok(!p.shows.includes("data-tv-row"), p.phone)
		// The title screen of a show (2026-10-22: the overview of three sections): every key and the header's take
		// their height from the rule.
		const title = heights(p.title)
		assert.deepEqual(
			title.map((item) => item.id).sort(),
			rendered.titlePhoneItems.filter((id) => id !== "section:overview").sort(),
		)
		for (const item of title)
			assert.ok(item.height * p.scale >= 44, `${p.phone} title ${item.id}`)
	}
})

test("the menu's keys are touch targets on every phone, and the menu fits the picture", () => {
	assert.deepEqual(rendered.guestMenu, [
		"menu:home",
		"menu:tonight",
		"menu:discover",
		"menu:search",
		"menu:quiz",
		"menu:taste",
		"menu:about",
	])
	// The phone (the owner, 2026-10-22: nothing scrolls): every key three to a row under the band with the
	// wordmark and Close, as tall as a key of that phone (44 px or more on its screen), inside the 270 px canvas.
	for (const p of rendered.phones) {
		for (const [html, items] of [
			[p.menu, rendered.guestMenu],
			[p.memberMenu, rendered.memberMenu],
		] as const) {
			assert.deepEqual(ids(html), items, p.phone)
			assert.ok(
				p.menuKey * p.scale >= 44,
				`${p.phone}: ${p.menuKey} canvas px at ${p.scale}`,
			)
			const rows = Math.ceil(items.length / 3)
			assert.match(
				html,
				new RegExp(`grid-template-rows:repeat\\(${rows}, ${p.menuKey}px\\)`),
				p.phone,
			)
			// Three to a row on an upright phone's canvas (480 wide); four on a phone's wide canvas on its side.
			assert.match(html, /grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/)
			// The rows, their 6 px gaps and the foot (10) inside the canvas; the band over them (66 at most) keeps
			// room for the wordmark and Close on every phone of the table.
			const band = Math.min(66, 270 - 10 - rows * p.menuKey - (rows - 1) * 6)
			assert.ok(
				band >= 44,
				`${p.phone}: a band of ${band} over ${rows} rows of ${p.menuKey}`,
			)
			assert.match(html, new RegExp(`style="height:${band}px"`), p.phone)
			assert.match(html, /role="menu" aria-label="Menu"/)
			assert.equal(count(html, 'role="img" aria-label="GoodWatch"'), 1, p.phone)
		}
	}
})

test("the menu lies over everything of the screen under it", () => {
	// A screen's focused tile and its bar's keys are raised (z 2 and z 10): the menu's layer is raised over both,
	// so none of them is drawn over a key of the menu.
	assert.match(
		rendered.underMenu,
		/<div data-tv-layer="" class="absolute inset-0 overflow-hidden tvc-menu z-20">/,
	)
	// The screen under it takes no input.
	assert.match(rendered.underMenu, /<div data-tv-layer="" inert=""/)
	assert.equal(count(rendered.underMenu, "data-tv-layer"), 2)
})

test("the desktop's menu: a column of keys at the right edge, under the GoodWatch wordmark", () => {
	const { desktop } = rendered.menu
	assert.deepEqual(ids(desktop), rendered.guestMenu)
	assert.equal(count(desktop, "h-[54px] gap-4 px-6 text-[23px]"), 7)
	assert.match(
		desktop,
		/w-\[440px\] justify-center gap-1\.5 border-l border-white\/10 px-9/,
	)
	// A member's nine keys fit the canvas's 648 px with the wordmark (30 px type, 8 px under it): 9 × 54 px and
	// 8 gaps of 6 px.
	assert.ok(9 * 54 + 8 * 6 + 38 + 8 < 648)
	assert.ok(!desktop.includes('style="gap:'))
	assert.equal(count(desktop, 'role="img" aria-label="GoodWatch"'), 1)
})

test("What is GoodWatch?: its two answers are touch targets on every phone, under the header", () => {
	assert.deepEqual(rendered.aboutItems, [
		"got-it",
		"rate",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	assert.deepEqual(rendered.aboutPhoneItems, [
		"got-it",
		"rate",
		"bar:back",
		"nav:home",
		"bar:menu",
	])
	for (const p of rendered.phones) {
		const drawn = heights(p.about)
		assert.deepEqual(
			drawn.map((item) => item.id),
			rendered.aboutPhoneItems,
			p.phone,
		)
		for (const item of drawn)
			assert.ok(
				item.height * p.scale >= 44,
				`${p.phone} ${item.id}: ${item.height} canvas px at ${p.scale}`,
			)
		// The words start under the header (66 canvas px, kit.tsx PHONE_HEAD), whose keys fit in it.
		const bar = drawn.find((item) => item.id === "bar:menu")?.height ?? 0
		assert.ok(bar <= 66, `${p.phone}: the header's key is ${bar} tall`)
		assert.match(p.about, /style="top:66px"/)
	}
	// The desktop's answers are as they were.
	assert.equal(count(rendered.about.desktop, "h-[116px] rounded-[26px]"), 2)
})
