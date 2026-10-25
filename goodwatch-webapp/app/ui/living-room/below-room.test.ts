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
) as {
	full: string
	again: string
	empty: string
	social: string
	noRanking: string
}

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

test("all 16 titles are poster card links with the title and year as text", () => {
	const titles = links(rendered.full).filter((link) =>
		/^\/(movie|show)\//.test(link.href),
	)
	assert.equal(titles.length, 16)
	assert.equal(new Set(titles.map((link) => link.href)).size, 16)
	assert.equal(titles[0].href, "/movie/100-title-1")
	// The card's link name: read out and in the HTML for a crawler, not drawn under the poster.
	assert.equal(titles[0].text, "Title 1 (1990)")
	assert.equal(titles[1].href, "/show/101-title-2")
	assert.equal(titles[2].text, "Law &amp; Order: Special Victims Unit (1992)")
	assert.equal(titles[5].text, "Title 6")
	for (const link of titles) {
		// A real address, followed: no script-only link, no nofollow, and no route lookup before the click.
		assert.doesNotMatch(link.attributes, /nofollow|javascript:|onclick/i)
		assert.doesNotMatch(link.attributes, /data-discover/)
	}
	assert.equal(rendered.full.match(/data-poster-card=""/g)?.length, 16)
})

test("each card shows the GoodWatch score it has, and no services", () => {
	const pills = [
		...rendered.full.matchAll(/GoodWatch score <\/span>(\d+)</g),
	].map(([, score]) => Number(score))
	// One of the 16 test titles has no score.
	assert.equal(pills.length, 15)
	assert.deepEqual(pills.slice(0, 4), [60, 61, 62, 64])
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
		// The two arrows and the lip's chevron are decoration and hold no link. A poster card's link name and its
		// pill's words are read out, not drawn, as on every poster grid; the card's link itself is visible. The pill's
		// logo shows on wider cards only, and the card clips the poster to its round corners.
		const withoutDecoration = html
			.replace(/<(span|i) aria-hidden="true">[^<]*<\/\1>/g, "")
			.replace(
				/<span class="sr-only">(<span lang="[^"]+">[^<]*<\/span>)?[^<]*<\/span>/g,
				"",
			)
			.replace(/ class="hidden h-3 [^"]*"/g, "")
			.replace(/ overflow-hidden /g, " ")
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
	const posters = [...rendered.full.matchAll(/<img\b[^>]*>/g)]
		.map(([tag]) => tag)
		.filter((tag) => tag.includes("image.tmdb.org"))
	// One of the 16 test titles has no poster: its card shows the placeholder.
	assert.equal(posters.length, 15)
	assert.match(
		posters[0],
		/ src="https:\/\/image\.tmdb\.org\/t\/p\/w154\/poster0\.jpg"/,
	)
	// The small files only: the cards are at most 140 px wide, so w154 at 1x and w342 at 2x.
	assert.match(
		posters[0],
		/ srcSet="https:\/\/image\.tmdb\.org\/t\/p\/w154\/poster0\.jpg 154w, https:\/\/image\.tmdb\.org\/t\/p\/w185\/poster0\.jpg 185w, https:\/\/image\.tmdb\.org\/t\/p\/w342\/poster0\.jpg 342w"/,
	)
	assert.match(
		posters[0],
		/ sizes="\(min-width: 1100px\) 140px, \(min-width: 900px\) 15vw, \(min-width: 640px\) 22vw, [^"]*30vw"/,
	)
	for (const tag of posters) {
		assert.match(tag, /^<img loading="lazy" decoding="async"/)
		assert.match(tag, / width="140" height="210"/)
		assert.match(tag, / alt="[^"]+"/)
		assert.doesNotMatch(tag, /fetchpriority/)
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

test("the social ranking, post preview and links are present before JavaScript or scrolling", () => {
	assert.ok(rendered.social.includes("Hot on socials"))
	assert.ok(
		links(rendered.social).some(
			(link) =>
				link.href === "/movie/603-the-matrix" &&
				link.text.includes("The Matrix"),
		),
	)
	assert.ok(rendered.social.includes("The Matrix returns to cinemas"))
	assert.ok(
		links(rendered.social).some(
			(link) =>
				link.href === "/hot-on-socials#movie-603" &&
				link.text.includes("The Matrix"),
		),
	)
	assert.doesNotMatch(rendered.social, /tn-wait|<iframe/)
	assert.doesNotMatch(rendered.noRanking, /id="tn-title"|tn-wait/)
})
