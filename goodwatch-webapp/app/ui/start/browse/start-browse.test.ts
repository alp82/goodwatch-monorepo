// The Where to start section in the server's HTML (StartBrowse.tsx): where a crawler that reads only the start page
// finds title pages and every hub. These tests hold what that depends on: plain visible links, in the HTML.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

// The hubs the start page has always linked (the old section below the room, living-room/below-room.test.ts).
const HUBS = [
	"/discover",
	"/movies",
	"/shows",
	"/explorer",
	"/taste",
	"/how-it-works",
	"/movies/moods",
	"/movies/genres",
	"/movies/streaming",
	"/shows/moods",
	"/shows/genres",
	"/shows/streaming",
	"/movies/best",
	"/shows/best",
	"/new",
]

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/browse/start-browse-render.test-support.tsx",
		],
		// The router's server render warnings go to stderr; a failure still throws with them.
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__START_BROWSE_RENDER__")
		.at(-1) ?? "",
) as { full: string; again: string; empty: string; dataBytes: number }

const links = (html: string) =>
	[...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)].map(
		([, attributes, inner]) => ({
			attributes,
			href: /\bhref="([^"]*)"/.exec(attributes)?.[1] ?? "",
			text: inner
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim(),
		}),
	)

test("every hub is a plain link with its name as text, with and without rails", () => {
	for (const html of [rendered.full, rendered.empty]) {
		const found = new Set(links(html).map((link) => link.href))
		for (const hub of HUBS) assert.ok(found.has(hub), hub)
		for (const link of links(html).filter((link) => HUBS.includes(link.href))) {
			assert.match(
				link.attributes,
				/^( class="[^"]+")? href="[^"]+"$/,
				link.href,
			)
			assert.ok(link.text.length > 3, link.href)
		}
	}
	assert.match(rendered.empty, /<h2 id="sb-title">Where to start<\/h2>/)
	assert.doesNotMatch(rendered.empty, /<img|\/movie\/|\/show\//)
})

test("every title of Top 10 and New on streaming is a poster card link", () => {
	const titles = links(rendered.full).filter((link) =>
		/^\/(movie|show)\/\d+-/.test(link.href),
	)
	// Both Top 10 lists are in the HTML (movies, then shows), then New on streaming.
	assert.equal(titles.length, 10 + 10 + 12)
	assert.equal(titles[0].href, "/movie/100-a-title-number-100")
	assert.equal(titles[1].text, "Law &amp; Order: Special Victims Unit (1991)")
	assert.deepEqual(
		titles.slice(10, 20).map((link) => link.href.split("-")[0]),
		Array.from({ length: 10 }, (_, i) => `/show/${200 + i}`),
	)
	for (const link of titles)
		assert.doesNotMatch(
			link.attributes,
			/nofollow|javascript:|onclick|data-discover/i,
		)
	assert.equal(rendered.full.match(/data-poster-card=""/g)?.length, 32)
})

test("the Top 10 shows movies first; the shows wait in the same cell, invisible and inert", () => {
	const stack =
		/<div class="sb-stack">(.*?)<\/section>/s.exec(rendered.full)?.[1] ?? ""
	const panels = [
		...stack.matchAll(
			/<div( aria-hidden="true" inert="")?><div class="sb-rail"><ul aria-label="([^"]+)"/g,
		),
	]
	assert.deepEqual(
		panels.map(([, away, name]) => [name, Boolean(away)]),
		[
			["Top 10 movies", false],
			["Top 10 shows", true],
		],
	)
	assert.match(
		rendered.full,
		/<button type="button" role="tab" aria-selected="true">Movies<\/button>/,
	)
})

test("every mood, service, and genre is a link to its page, named by it", () => {
	const all = links(rendered.full)
	const moods = all.filter((link) => link.href.startsWith("/movies/moods/"))
	assert.equal(moods.length, 10)
	assert.equal(moods[0].href, "/movies/moods/feel-good")
	assert.match(moods[0].text, /^Cozy Warm and hopeful/)
	const services = all.filter((link) =>
		/^\/(shows\/streaming|new\/us)\/s\d/.test(link.href),
	)
	assert.deepEqual(
		services.map((link) => link.text),
		["Netflix", "Amazon Prime Video", "Disney+", "HBO Max", "Apple TV", "Hulu"],
	)
	const genres = all.filter((link) =>
		/^\/(movies|shows)\/genres\/./.test(link.href),
	)
	assert.equal(genres.length, 15)
	assert.ok(
		genres.some((link) => link.href === "/shows/genres/scifi-and-fantasy"),
	)
})

test("headings: one H2 for the section, an H3 per rail, no H1", () => {
	assert.doesNotMatch(rendered.full, /<h1\b/)
	assert.equal(rendered.full.match(/<h2\b/g)?.length, 1)
	assert.deepEqual(
		[...rendered.full.matchAll(/<h3 id="[^"]+">([^<]+)<\/h3>/g)].map(
			([, text]) => text,
		),
		[
			"Top 10 on GoodWatch",
			"New on streaming",
			"By mood",
			"Streaming services",
			"Genres",
			"More ways to browse",
		],
	)
})

test("every image waits until it is near (the section is below the first screen)", () => {
	const images = [...rendered.full.matchAll(/<img\b[^>]*>/g)].map(
		([tag]) => tag,
	)
	assert.ok(images.length > 60)
	for (const tag of images) {
		assert.match(tag, / loading="lazy"/)
		assert.doesNotMatch(tag, /fetchpriority="high"/)
	}
	// Decorative posters hold their place with their size and say nothing.
	for (const tag of images.filter((tag) => tag.includes("sb-poster"))) {
		assert.match(tag, / alt=""/)
		assert.match(tag, / width="\d+" height="\d+"/)
	}
})

test("each rail has its arrows in the HTML, in place: back off, forward on", () => {
	for (const name of [
		"Top 10 movies",
		"New on streaming",
		"Moods",
		"Streaming services",
	]) {
		assert.match(
			rendered.full,
			new RegExp(
				`<button type="button" aria-label="Previous: ${name}" disabled=""`,
			),
		)
		assert.match(
			rendered.full,
			new RegExp(
				`<button type="button" aria-label="Next: ${name}" class="sb-arrow sb-edge sb-next"`,
			),
		)
	}
})

test("Escape closes a peek a chip opened by keyboard focus", () => {
	const steps = JSON.parse(
		execFileSync(
			"node_modules/.bin/vite-node",
			[
				"--config",
				"app/ui/imports/source-import-test-vite.config.ts",
				"app/ui/start/browse/genre-cloud-interaction.test-support.tsx",
			],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		)
			.split("__GENRE_CLOUD__")
			.at(-1) ?? "",
	)
	assert.deepEqual(steps.focused, {
		on: true,
		describedBy: "sb-peek",
		peekOpacity: "1",
		peekText: "Title 10 · Title 11 · Title 12",
		focused: true,
	})
	assert.deepEqual(steps.escaped, {
		on: false,
		describedBy: null,
		peekOpacity: "0",
		peekText: "Title 10 · Title 11 · Title 12",
		focused: true,
	})
})

test("the same data gives the same HTML", () => {
	assert.equal(rendered.again, rendered.full)
})
