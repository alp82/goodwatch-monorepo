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
		// The Expand key stands in its corner.
		assert.match(html, /<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*aria-label="Expand"[^>]*>.*?Expand<\/button><\/div>/)
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
	assert.equal(count(desktop, 'style="width:172px;height:258px"'), 6)
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
			/>No show for tonight\. Want to See on a show puts it here to start\./,
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
		// The Expand key's row under the posters is a key tall, and empty.
		const row = Number(
			/<div class="flex shrink-0 items-center gap-2 pr-\[158px\]" style="height:(\d+)px"><\/div>/.exec(
				p.shows,
			)?.[1],
		)
		assert.ok(row * p.scale >= 44, `${p.phone}: the corner's row is ${row}`)
		// The title screen of a show: its three keys and the bar's.
		const title = heights(p.title)
		assert.deepEqual(
			title.map((item) => item.id),
			rendered.titleItems,
		)
		for (const item of title)
			assert.ok(item.height * p.scale >= 44, `${p.phone} title ${item.id}`)
	}
})

test("the menu's keys are touch targets on every phone, and the menu fits the picture", () => {
	assert.deepEqual(rendered.guestMenu, [
		"menu:home",
		"menu:search",
		"menu:sign-in",
		"menu:about",
		"menu:off",
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
			// The column is as tall as its keys, its gaps and, where it stands, the word over them: inside the
			// picture, with room to spare at both ends.
			const gaps = items.length - 1 + (layout.head ? 1 : 0)
			const column =
				items.length * layout.key + gaps * layout.gap + (layout.head ? 22 : 0)
			assert.ok(
				column <= p.h - 12,
				`${p.phone}: ${column} canvas px of ${p.h}`,
			)
			assert.ok(layout.gap >= 4 && layout.gap <= 8, `${p.phone} gap`)
			assert.match(html, new RegExp(`style="gap:${layout.gap}px"`))
			// The word "Menu" stands over the keys only where it has room; the menu's name is read out either way.
			assert.equal(count(html, ">Menu</div>"), layout.head ? 1 : 0, p.phone)
			assert.match(html, /role="menu" aria-label="Menu"/)
		}
	}
	// Where the word has room: every phone but the short one, where five keys fill the picture.
	assert.deepEqual(
		rendered.phones.map((p) => [p.phone, p.key, p.menuLayout.head]),
		[
			["360x740", 67, true],
			["375x667", 64, false],
			["390x700", 61, true],
			["390x844", 61, true],
			["430x932", 55, true],
			["844x390", 48, true],
		],
	)
	// A member's menu has one key less, so the word stands on the short phone too.
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

test("the desktop's menu is as it was", () => {
	const { desktop } = rendered.menu
	assert.deepEqual(ids(desktop), rendered.guestMenu)
	assert.equal(count(desktop, "h-[76px] px-9 text-[30px]"), 5)
	assert.match(desktop, /w-\[440px\] gap-4 px-10/)
	assert.ok(!desktop.includes('style="gap:'))
	assert.match(desktop, />Menu<\/div>/)
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
