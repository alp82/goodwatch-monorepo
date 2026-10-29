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
	const pictures = imgs(rendered.guest).filter((tag) => /start-room/.test(tag))
	assert.equal(pictures.length, 2)
	// The ledge's posters never compete with the painting for the first paint.
	for (const tag of imgs(rendered.guest).filter(
		(tag) => !/start-room/.test(tag),
	))
		assert.doesNotMatch(tag, /fetchpriority|elementtiming/)
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

test("the stage starts dim at its normal framing, the card closed: only the ledge reachable", () => {
	for (const html of [rendered.guest, rendered.member]) {
		assert.match(
			html,
			/class="start-camera" style="--start-night:0\.55;--start-camera:1"/,
		)
		assert.doesNotMatch(html, /data-open|data-centered|data-hidden/)
		assert.match(
			html,
			/<div id="start-card" class="start-card" data-start-obstacle="">/,
		)
		// The card is in the HTML but out of reach; the ledge's one button does its action.
		assert.match(html, /class="start-ledge-card" inert="">[\s\S]*The card/)
		assert.match(
			html,
			/class="start-ledge-cover" aria-label="Surprise me: Tap three you loved" aria-controls="start-card"/,
		)
	}
})

test("the stage carries both scenes' numbers for start.css", () => {
	for (const name of ["landscape", "phone"])
		for (const key of ["hw", "fcx", "wtop", "win", "lt", "lb"])
			assert.match(
				rendered.guest,
				new RegExp(`--start-${name}-${key}:[0-9.]+`),
				`${name} ${key}`,
			)
})

test("a guest's opening comes first in the stage: the gate, its script, then the boot; a member's page has none", () => {
	const guest = rendered.guest
	const gate = guest.indexOf('<input id="start-boot-gate" type="checkbox"')
	const script = guest.indexOf("<script>", gate)
	const boot = guest.indexOf('class="start-opening"')
	const room = guest.indexOf('class="start-camera"')
	assert.ok(gate > guest.indexOf("<section"), "the gate is in the stage")
	assert.ok(
		gate < script && script < boot && boot < room,
		"gate, script, boot, room",
	)
	// The box is unticked in the HTML (one HTML for every guest); the script decides in the browser.
	assert.doesNotMatch(guest, /<input[^>]*checked/)
	assert.match(guest, /gw-start-boot-seen/)
	assert.match(guest, /class="boot"/)
	assert.match(
		guest,
		/<div aria-hidden="true" class="start-opening-cover"><\/div>/,
	)
	assert.ok(
		guest.indexOf("start-opening-cover") > guest.indexOf("</section>"),
		"the cover is outside the stage",
	)
	for (const part of [
		"start-boot-gate",
		"start-opening",
		"gw-start-boot-seen",
		'class="boot"',
		"<script",
	])
		assert.ok(!rendered.member.includes(part), part)
})
