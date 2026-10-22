// Regression: even a retained loader taste payload cannot replace the member's Watch next home.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-home-sides-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_HOME_SIDES__")
		.at(-1) ?? "",
) as Record<string, { html: string; items: string[]; focus: string }>
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((m) => m[1])
const H1 = "Let&#x27;s find something good to watch next."
/**
 * The items a page of a screen draws: the machine's, in its order (on the phone a page of them, 2026-10-22), and
 * page arrows (`jump:<item>`) to items of the screen that the page doesn't draw.
 */
function assertPageOf(html: string, items: readonly string[]) {
	const drawn = ids(html)
	const own = drawn.filter((id) => !id.startsWith("jump:"))
	assert.deepEqual(
		own,
		items.filter((id) => own.includes(id)),
		"in the machine's order",
	)
	for (const id of own) assert.ok(items.includes(id), id)
	for (const id of drawn.filter((one) => one.startsWith("jump:"))) {
		const target = id.slice("jump:".length)
		assert.ok(items.includes(target) && !own.includes(target), id)
	}
	return { own, drawn }
}

test("members get Start in both editions, with no home taste duplication", () => {
	for (const [name, { html, items }] of Object.entries(rendered)) {
		const phone =
			items.at(-2) === "nav:home" &&
			items.at(-1) === "bar:menu" &&
			!items.includes("nav:tonight")
		if (phone) {
			// The phone's Start pages (2026-10-22): Watch next and four tiles first, an arrow to Your taste, My shows
			// and What is GoodWatch?.
			const { drawn } = assertPageOf(html, items)
			assert.ok(drawn.includes("jump:start:taste"), name)
		} else assert.deepEqual(ids(html), items)
		// The start page's H1 stays, read out but not drawn.
		assert.ok(html.includes(`<h1 class="sr-only">${H1}</h1>`))
		for (const word of [
			"Watch next",
			"Discover",
			"Search",
			"Taste",
			...(phone ? [] : ["Your taste", "My shows"]),
		])
			assert.ok(html.includes(`>${word}<`), word)
		assert.ok(
			!/home-side:|watch-next:|Loved b|Dark, tense crime|app:explorer/.test(
				html,
			),
		)
		assert.ok(!items.includes("service:8"))
		assert.ok(!items.some((id) => id.startsWith("home:")))
	}
})
test("an empty member's Watch next tile says how picks come, and starts the focus", () => {
	assert.ok(
		rendered.phone.html.includes(
			"Add titles with Want to See, and they show here.",
		),
	)
	assert.equal(rendered.phone.focus, "start:tonight")
	assert.ok(rendered.loading.html.includes("Your picks are on their way."))
	assert.ok(!rendered.loading.html.includes("Add titles with Want to See"))
	// Without Popular titles there is no Popular tile and no Popular tab.
	assert.ok(!rendered.phone.items.includes("start:popular"))
	assert.ok(!rendered.onApp.items.includes("nav:popular"))
})

test("the Watch next tile names the pick up next; Popular has its tile once there are titles", () => {
	const { html, items } = rendered.movie
	assert.match(
		html,
		/1 pick for you · <span class="text-amber-300">eXistenZ<\/span> is up next/,
	)
	assert.ok(html.includes("/w185/poster.jpg"))
	assert.ok(items.includes("start:popular"))
	assert.ok(items.includes("nav:popular"))
	assert.ok(html.includes(">Popular<"))
	// The phone has no room for a Popular tab; the menu has it.
	assert.ok(rendered.episode.items.includes("start:popular"))
	assert.ok(!rendered.episode.items.includes("nav:popular"))
})
test("failed and pending reads are distinct from empty personal picks", () => {
	// A Watch next read that failed is not an empty Wishlist.
	assert.ok(
		!rendered.failed.html.includes(
			"Add titles with Want to See, and they show here.",
		),
	)
	assert.ok(rendered.loading.html.includes("Your picks are on their way."))
})

// Regression (2026-10-21): on the phone's shorter Start tile the Popular fan (64 x 96 at 16 px from the top)
// reached into the tile's name, and covered "Popular".
test("on the phone the Popular fan ends above the tile's name", () => {
	const { html } = rendered.episode
	const at = html.indexOf('data-tv-item="start:popular"')
	assert.ok(at >= 0)
	const tile = html.slice(at, html.indexOf("</button>", at))
	const tileH = Number(/style="height:(\d+)px"/.exec(tile)?.[1])
	const fanTop = Number(/absolute flex right-\d top-(\d+)/.exec(tile)?.[1]) * 4
	const posterH = Number(/h-\[(\d+)px\] w-\[\d+px\]/.exec(tile)?.[1])
	assert.ok(
		tileH > 0 && posterH > 0 && fanTop > 0,
		`${tileH} ${fanTop} ${posterH}`,
	)
	// The name at the tile's bottom (2026-10-22, the 480 x 270 canvas): 8 px of padding and 19 px type with its
	// leading; the line under it is read out, not drawn.
	assert.match(tile, /text-\[19px\]">Popular</)
	assert.match(tile, /sr-only">Titles many people watch</)
	const nameTop = tileH - (8 + 24)
	// A poster turned by 7 degrees reaches a little lower: 4 px at these sizes.
	assert.ok(
		fanTop + posterH + 4 <= nameTop,
		`the fan ends at ${fanTop + posterH + 4}, the name starts at ${nameTop}`,
	)
})
