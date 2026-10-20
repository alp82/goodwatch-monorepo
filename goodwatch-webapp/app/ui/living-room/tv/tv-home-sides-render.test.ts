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
test("members keep Watch next and library navigation in both editions, with no home taste duplication", () => {
	for (const { html, items } of Object.values(rendered)) {
		assert.deepEqual(ids(html), items)
		assert.match(html, />Watch next<\/h1>/)
		assert.ok(
			html.includes("My movies") &&
				html.includes("My shows") &&
				html.includes("Taste"),
		)
		assert.ok(
			!/home-side:|watch-next:|Loved b|Dark, tense crime|app:explorer/.test(
				html,
			),
		)
		assert.ok(!items.includes("service:8"))
	}
})
test("an empty member gets an actionable empty pick and popular loading state", () => {
	assert.ok(rendered.phone.html.includes("No pick yet"))
	assert.ok(rendered.phone.html.includes("Loading popular titles"))
	assert.equal(rendered.phone.focus, "home:movies")
})

test("the decision uses actual runtime, match and availability; episode runtime is not a show's usual runtime", () => {
	assert.match(rendered.movie.html, /97 min · 92% match/)
	assert.ok(rendered.movie.html.includes("On Netflix"))
	assert.ok(rendered.movie.html.includes("From your Wishlist"))
	assert.ok(rendered.episode.html.includes("Next episode · S2 E4 · 48 min"))
	assert.ok(!rendered.episode.html.includes("99 min"))
	assert.ok(rendered.showToStart.html.includes("55 min episodes"))
	assert.ok(rendered.noServices.html.includes("Check availability in details"))
	assert.ok(rendered.noServices.html.includes("Wider catalog"))
	assert.ok(!rendered.noServices.html.includes("% match"))
})
test("failed and pending reads are distinct from empty personal picks", () => {
	assert.ok(
		rendered.failed.html.includes("Your Watch next picks could not be loaded"),
	)
	assert.ok(rendered.failed.html.includes("Popular titles are unavailable"))
	assert.ok(rendered.loading.html.includes("Finding something to watch next"))
})
