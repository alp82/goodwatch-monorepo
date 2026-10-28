// The start page's first screen in the server's HTML (StartStage.tsx, StartRoom.tsx): what a crawler reads, and what
// the first paint shows before any script runs.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/stage/stage-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__START_STAGE_RENDER__")
		.at(-1) ?? "",
) as { guest: string; member: string }

const imgs = (html: string) =>
	[...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag)

test("one H1, the page's heading", () => {
	for (const html of [rendered.guest, rendered.member]) {
		assert.equal(html.match(/<h1\b/g)?.length, 1)
		assert.match(
			html,
			/<h1 id="start-heading"[^>]*>Find something to watch<\/h1>/,
		)
		assert.match(html, /<section aria-labelledby="start-heading"/)
	}
})

test("both paintings are in the HTML at full opacity, each blanked where the other one is drawn", () => {
	const pictures = imgs(rendered.guest)
	assert.equal(pictures.length, 2)
	for (const tag of pictures) {
		assert.match(tag, /fetchpriority="high"/)
		assert.match(tag, /elementtiming="hero"/)
		assert.match(tag, /alt=""/)
		// The painting itself never starts hidden: only the night over it fades.
		assert.doesNotMatch(tag, /opacity|style=/)
		assert.doesNotMatch(tag, /loading="lazy"/)
	}
	assert.match(pictures[0], /start-room-1536[^"]*\.webp/)
	assert.match(pictures[1], /start-room-phone[^"]*\.webp/)
	assert.match(
		rendered.guest,
		/<source media="\(max-width: 767\.98px\) and \(orientation: portrait\)[^"]*" srcSet="data:image\/gif/,
	)
	assert.match(
		rendered.guest,
		/<source media="\(min-width: 768px\)[^"]*" srcSet="data:image\/gif/,
	)
	assert.match(
		rendered.guest,
		/type="image\/avif" srcSet="[^"]*start-room-1536[^"]*\.avif"/,
	)
	assert.match(
		rendered.guest,
		/type="image\/avif" srcSet="[^"]*start-room-phone[^"]*\.avif"/,
	)
})

test("the shelf covers wait for the browser: no title links in the server's HTML", () => {
	assert.doesNotMatch(rendered.guest, /href="\/(movie|show)\//)
	assert.match(rendered.guest, /<div class="start-shelf"><\/div>/)
})

test("a guest's stage starts dark, close up, centered, with the card out of reach; a member's is lit", () => {
	assert.match(
		rendered.guest,
		/class="start-camera" style="--start-night:0\.9;--start-camera:1\.12"/,
	)
	assert.match(rendered.guest, /class="start-stage"[^>]*data-centered=""/)
	assert.match(
		rendered.guest,
		/id="start-card" class="start-card" data-start-obstacle="" data-hidden="" inert=""/,
	)
	assert.match(
		rendered.member,
		/class="start-camera" style="--start-night:0;--start-camera:1"/,
	)
	assert.doesNotMatch(rendered.member, /data-centered|data-hidden|inert/)
})

test("the stage carries both scenes' numbers for start.css", () => {
	for (const name of ["landscape", "phone"])
		for (const key of ["band", "k", "hw", "fy", "fcx"])
			assert.match(
				rendered.guest,
				new RegExp(`--start-${name}-${key}:[0-9.]+`),
				`${name} ${key}`,
			)
})
