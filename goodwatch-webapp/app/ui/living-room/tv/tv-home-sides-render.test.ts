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
test("members get Start in both editions, with no home taste duplication", () => {
	for (const { html, items } of Object.values(rendered)) {
		assert.deepEqual(ids(html), items)
		// The start page's H1 stays, read out but not drawn.
		assert.ok(html.includes(`<h1 class="sr-only">${H1}</h1>`))
		for (const name of ["Watch next", "Discover", "Search", "Taste", "Your taste", "My shows"])
			assert.ok(html.includes(`>${name}<`), name)
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
