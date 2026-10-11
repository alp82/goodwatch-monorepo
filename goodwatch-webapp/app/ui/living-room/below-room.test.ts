// The section below the living room (#352) is where a crawler that reads only the start page's server HTML
// finds title pages and every hub. These tests hold what that depends on: plain visible links, in the HTML.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { test } from "node:test"

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
]

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/below-room-render.test-support.tsx",
		],
		// The router's server render warnings go to stderr; a failure still throws with them.
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__BELOW_ROOM_RENDER__")
		.at(-1) ?? "",
) as { full: string; again: string; empty: string; docked: string }

/** Every `<a>` of the HTML: its attributes and its text. */
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

test("all 16 titles are plain links with the title as text", () => {
	const titles = links(rendered.full).filter((link) =>
		/^\/(movie|show)\//.test(link.href),
	)
	assert.equal(titles.length, 16)
	assert.equal(new Set(titles.map((link) => link.href)).size, 16)
	assert.deepEqual(titles[0], {
		attributes: ' href="/movie/100-title-1"',
		href: "/movie/100-title-1",
		text: "Title 1",
	})
	assert.equal(titles[1].href, "/show/101-title-2")
	assert.equal(titles[2].text, "Law &amp; Order: Special Victims Unit")
	// Nothing but the address: no script-only link, no nofollow.
	for (const link of titles) assert.match(link.attributes, /^ href="[^"]+"$/)
	assert.match(rendered.full, /<span>Movie · 1990<\/span>/)
	assert.match(rendered.full, /<span>TV show<\/span>/)
})

test("every hub is a plain link with its name as text, with and without titles", () => {
	for (const html of [rendered.full, rendered.empty]) {
		const hubs = links(html).filter((link) => HUBS.includes(link.href))
		assert.deepEqual(hubs.map((link) => link.href).sort(), [...HUBS].sort())
		for (const link of hubs) {
			assert.match(link.attributes, /^ href="[^"]+"$/)
			assert.ok(link.text.length > 3, link.href)
		}
	}
	assert.match(rendered.full, /<a href="\/movies\/moods">Movies by mood<\/a>/)
})

test("nothing in the section's HTML hides a link", () => {
	for (const html of [rendered.full, rendered.empty]) {
		// The two arrows and the lip's chevron are decoration and hold no link.
		const withoutDecoration = html.replace(
			/<(span|i) aria-hidden="true">[^<]*<\/\1>/g,
			"",
		)
		assert.doesNotMatch(
			withoutDecoration,
			/aria-hidden|\bhidden\b|\binert\b|sr-only|style=|<template|<noscript/,
		)
	}
})

test("the stylesheet hides nothing of the section but the lip's extras", () => {
	const css = readFileSync(
		"app/ui/living-room/living-room.css",
		"utf8",
	).replace(/\/\*[\s\S]*?\*\//g, "")
	const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
		.map(([, selector, body]) => ({ selector: selector.trim(), body }))
		.filter(({ selector }) => /\.lrb(?![\w-]*-lip)/.test(selector))
		// The lip is the control, not content: its longer line and, in phone landscape, the tab itself give way.
		.filter(({ selector }) => !selector.includes(".lrb-lip"))
	assert.ok(rules.length > 30)
	for (const { selector, body } of rules)
		assert.doesNotMatch(
			body,
			/display:\s*none|visibility:\s*(hidden|collapse)|opacity:\s*0(\.0+)?\s*;|clip(-path)?:|text-indent|font-size:\s*0[;\s]|(^|[\s;])(max-)?(height|width):\s*0[;\s]|content-visibility|position:\s*fixed|(^|[\s;])transform:/,
			selector,
		)
})

test("each poster is an image in the HTML that loads lazily and holds its place", () => {
	const images = [...rendered.full.matchAll(/<img\b[^>]*>/g)].map(
		([tag]) => tag,
	)
	// One of the 16 test titles has no poster.
	assert.equal(images.length, 15)
	assert.equal(
		images[0],
		'<img src="https://image.tmdb.org/t/p/w92/poster0.jpg" srcSet="https://image.tmdb.org/t/p/w92/poster0.jpg 92w, https://image.tmdb.org/t/p/w154/poster0.jpg 154w" sizes="46px" width="46" height="69" alt="Title 1 poster" loading="lazy" decoding="async"/>',
	)
	for (const tag of images) {
		assert.match(tag, / loading="lazy"/)
		assert.match(tag, / width="46" height="69"/)
		assert.match(tag, / alt="[^"]+ poster"/)
	}
	assert.doesNotMatch(rendered.empty, /<img/)
})

test("without titles the section still stands: the hubs, no list", () => {
	assert.doesNotMatch(rendered.empty, /<ol|<img|\/movie\/|\/show\//)
	assert.match(rendered.empty, /<h2 id="browse-title">Browse GoodWatch<\/h2>/)
	assert.match(rendered.empty, /<a href="#browse"/)
	assert.match(rendered.empty, /<a href="#room"/)
})

test("the same titles give the same HTML", () => {
	assert.equal(rendered.again, rendered.full)
})

test("the lip and the way back are links that work without a script", () => {
	assert.match(rendered.full, /<section id="browse"/)
	assert.match(rendered.full, /<a href="#browse" class="lrb-lip">/)
	assert.equal(
		rendered.full.match(/<a href="#room" class="lrb-back">/g)?.length,
		2,
	)
})

test("over the navigation's dock only the section's class differs", () => {
	assert.match(
		rendered.docked,
		/<section id="browse"[^>]* class="lrb lrb-docked">/,
	)
	assert.equal(
		rendered.docked.replace('class="lrb lrb-docked"', 'class="lrb"'),
		rendered.full,
	)
})

test("the page is held still until it is open, and a script is not needed to open it", () => {
	const css = readFileSync(
		"app/ui/living-room/living-room.css",
		"utf8",
	).replace(/\/\*[\s\S]*?\*\//g, "")
	const rule = (selector: string) =>
		[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selectors]) =>
			selectors
				.split(",")
				.map((part) => part.trim())
				.includes(selector),
		)?.[2] ?? ""
	// Locked by default, for every page that has the room.
	assert.match(rule("html:has(.living-room)"), /overflow:\s*hidden/)
	// Open after the first arrival below (use-below-room.ts), and without a script while the URL ends in #browse.
	const open = rule('html[data-lr="open"]')
	assert.match(open, /overflow:\s*visible auto/)
	assert.equal(rule("html:not([data-lr]):has(#browse:target)"), open)
})
