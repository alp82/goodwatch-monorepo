// My shows, the Seen it key of a show the member is midway through, home's My shows tile, the menu and What is
// GoodWatch? as they are drawn: the items in the markup are the machine's, in its order, in both editions; every
// key is a touch target on every phone of the room's table; and the Expand key's corner stays free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Editions = { desktop: string; phone: string }
type MenuLayout = { key: number; gap: number; head: boolean }
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
	emptyItems: string[]
	titleItems: string[]
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
		menuLayout: MenuLayout
		memberMenuLayout: MenuLayout
		about: string
	}[]
	firstMenu: MenuLayout
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
	for (const html of Object.values(rendered.shows.signal)) {
		assert.deepEqual(ids(html), rendered.items)
		assert.equal(focused(html), "title:show-10")
		// The Expand key, once: in its corner on the desktop, at the end of the last row on the phone.
		assert.equal(count(html, 'data-tv-item="expand"'), 1)
		assert.ok(
			/<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*aria-label="Expand"[^>]*>.*?Expand<\/button><\/div>/.test(
				html,
			) !== Boolean(phoneFoot(html)),
		)
	}
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
	assert.equal(count(phone, "/t/p/w185/poster-"), 6)
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
	for (const html of Object.values(rendered.shows.empty)) {
		assert.deepEqual(ids(html), rendered.emptyItems)
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
	for (const html of Object.values(rendered.title.episode)) {
		assert.deepEqual(ids(html), rendered.titleItems)
		assert.equal(key(html), "Seen S2 E4")
	}
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
		// My shows: the bar's keys take their size from the rule; the posters share the height the name, the facts
		// and the Expand key's row leave, and the drive script measures them on the page.
		assert.deepEqual(ids(p.shows), rendered.items)
		for (const item of heights(p.shows))
			assert.ok(item.height * p.scale >= 44, `${p.phone} shows ${item.id}`)
		assert.deepEqual(
			heights(p.shows).map((item) => item.id),
			["expand", "bar:back", "bar:search", "bar:menu"],
		)
		// The row under the posters is a key tall, has no key of its own, and ends with the Expand key.
		const foot = phoneFoot(p.shows)
		const row = foot?.height ?? 0
		assert.ok(row * p.scale >= 44, `${p.phone}: the last row is ${row}`)
		assert.ok(!/data-tv-item=/.test(foot?.before ?? "x"), `${p.phone}: the last row has only the Expand key`)
		assert.ok(!p.shows.includes("data-tv-expand-place"), p.phone)
		// The title screen of a show: its keys and the bar's take their height from the rule. The Fingerprint is a
		// card as tall as its readings, in the markup between them.
		const title = heights(p.title)
		assert.deepEqual(
			title.map((item) => item.id),
			rendered.titleItems.filter((id) => id !== "fingerprint"),
		)
		assert.deepEqual(ids(p.title), rendered.titleItems)
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
	for (const p of rendered.phones) {
		for (const [html, items, layout] of [
			[p.menu, rendered.guestMenu, p.menuLayout],
			[p.memberMenu, rendered.memberMenu, p.memberMenuLayout],
		] as const) {
			const drawn = heights(html)
			assert.deepEqual(
				drawn.map((item) => item.id),
				items,
				p.phone,
			)
			for (const item of drawn) {
				assert.equal(item.height, layout.key)
				assert.ok(
					item.height * p.scale >= 44,
					`${p.phone} ${item.id}: ${item.height} canvas px at ${p.scale}`,
				)
			}
			// The keys stand two to a row. The column is as tall as its rows, its gaps and, where it stands, the
			// wordmark over them (44 canvas px with its space): inside the picture, with room to spare at both ends.
			const rows = Math.ceil(items.length / 2)
			const column =
				rows * layout.key + (rows - 1) * layout.gap + (layout.head ? 44 : 0)
			assert.ok(
				column <= p.h - 12,
				`${p.phone}: ${column} canvas px of ${p.h}`,
			)
			assert.ok(layout.gap >= 4 && layout.gap <= 8, `${p.phone} gap`)
			assert.match(html, new RegExp(`style="gap:${layout.gap}px"`))
			assert.match(html, /class="grid grid-cols-2"/)
			// The wordmark stands over the keys only where it has room; the menu's name is read out either way.
			assert.equal(
				count(html, 'role="img" aria-label="GoodWatch"'),
				layout.head ? 1 : 0,
				p.phone,
			)
			assert.match(html, /role="menu" aria-label="Menu"/)
		}
	}
	// Two keys to a row leave the wordmark room on every phone, for a guest's seven keys and a member's eight.
	assert.deepEqual(
		rendered.phones.map((p) => [p.phone, p.key, p.menuLayout.head]),
		[
			["360x740", 67, true],
			["375x667", 64, true],
			["390x700", 61, true],
			["390x844", 61, true],
			["430x932", 55, true],
			["844x390", 48, true],
		],
	)
	assert.ok(rendered.phones.every((p) => p.memberMenuLayout.head))
	// Before the window is measured nobody knows the scale: the design's size.
	assert.deepEqual(rendered.firstMenu, { key: 48, gap: 8, head: true })
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
	assert.match(desktop, /w-\[440px\] gap-1\.5 border-l border-white\/10 px-9/)
	// A member's nine keys fit the canvas's 648 px with the wordmark (30 px type, 8 px under it): 9 × 54 px and
	// 8 gaps of 6 px.
	assert.ok(9 * 54 + 8 * 6 + 38 + 8 < 648)
	assert.ok(!desktop.includes('style="gap:'))
	assert.equal(count(desktop, 'role="img" aria-label="GoodWatch"'), 1)
})

test("What is GoodWatch?: its two answers are touch targets on every phone, under the bar's keys", () => {
	assert.deepEqual(rendered.aboutItems, [
		"got-it",
		"rate",
		"bar:back",
		"bar:search",
		"bar:menu",
	])
	for (const p of rendered.phones) {
		const drawn = heights(p.about)
		assert.deepEqual(
			drawn.map((item) => item.id),
			rendered.aboutItems,
			p.phone,
		)
		for (const item of drawn)
			assert.ok(
				item.height * p.scale >= 44,
				`${p.phone} ${item.id}: ${item.height} canvas px at ${p.scale}`,
			)
		// The words start under the bar's keys: 12 px from the top and a key tall.
		const bar = drawn.find((item) => item.id === "bar:menu")?.height ?? 0
		assert.ok(12 + bar <= 84, `${p.phone}: the bar ends at ${12 + bar}`)
		assert.match(p.about, /px-5 pb-3 pt-\[84px\]/)
	}
	// The desktop's answers are as they were.
	assert.equal(count(rendered.about.desktop, "h-[116px] rounded-[26px]"), 2)
})
