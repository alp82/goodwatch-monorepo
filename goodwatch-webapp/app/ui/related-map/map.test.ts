import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { relatedMap } = await import("./map.ts")
const { TRAIT_KEYS } = await import("./traits.ts")
import type { RawPack, RawTitle } from "./engine"

const levels = (given: Record<string, number>) =>
	TRAIT_KEYS.map((key) => "0123456789a"[given[key] ?? 5]).join("")
const title = (
	key: string,
	name: string,
	near: number,
	given: Record<string, number> = {},
): RawTitle => [key, name, "2001", `${key}.jpg`, near, levels(given)]

const center = title("m1", "The Middle", 1000, {
	spectacle: 10,
	tension: 8,
	situational_comedy: 1,
})
const around = Array.from({ length: 30 }, (_, i) =>
	// One word each: names that differ only in a number count as one franchise.
	title(`m${i + 2}`, `Neighbor${i + 2}th`, 990 - i * 3),
)
const pack = { c: center, n: around, fl: { "": 0 } }
const draw = (n = around) =>
	relatedMap(null).section({
		root: "m1",
		title: "The Middle",
		pack: { ...pack, n },
		links: [{ href: "/movie/2-neighbor-a", text: "Neighbor A (2001)" }],
	})

/** The posters of a picture: key, and place in px from the middle. */
const posters = (html: string) =>
	[
		...html.matchAll(
			/<button type="button" class="pl-p rm-p[^"]*" style="--x:(-?[\d.]+)px;--y:(-?[\d.]+)px;--s:[\d.]+" data-pl-step="([ms]\d+)"/g,
		),
	].map((found) => ({ k: found[3], x: Number(found[1]), y: Number(found[2]) }))
const distance = (poster: { x: number; y: number }) =>
	Math.hypot(poster.x, poster.y)

test("the server's picture is drawn for a phone: the title in the middle and eight around it", () => {
	const html = draw()
	assert.match(html, /<h2 class="pl-h">Titles like The Middle<\/h2>/)
	assert.match(html, /data-pl-stage="" data-pl-at="m1" data-y="2001" data-p="m1.jpg"/)
	assert.match(html, /data-r-geo="346\|348"/)
	assert.equal((html.match(/data-pl-center=""/g) ?? []).length, 1)
	const drawn = posters(html)
	assert.deepEqual(
		drawn.map((poster) => poster.k).sort(),
		["m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"],
		"the eight most alike titles",
	)
})

test("nearer is more alike: a title's ring is its rank of similarity", () => {
	const drawn = posters(draw())
	const byKey = Object.fromEntries(drawn.map((poster) => [poster.k, poster]))
	// The first ring of a phone's map has six places, the second the two at the sides.
	const first = ["m2", "m3", "m4", "m5", "m6", "m7"].map((k) => distance(byKey[k]))
	const second = ["m8", "m9"].map((k) => distance(byKey[k]))
	assert.ok(Math.max(...first) < Math.min(...second))
	// Around a ring the places are taken clockwise from the top: the most alike title sits straight above.
	assert.equal(byKey.m2.x, 0)
	assert.ok(byKey.m2.y < 0)
	assert.ok(byKey.m3.x > 0 && byKey.m3.y < 0, "the next one to its right")
})

test("no two posters share a place, and every place has its opposite", () => {
	const drawn = posters(draw())
	const places = new Set(drawn.map((poster) => `${poster.x},${poster.y}`))
	assert.equal(places.size, drawn.length)
	for (const poster of drawn)
		assert.ok(places.has(`${-poster.x},${-poster.y}`), `opposite of ${poster.k}`)
})

test("a franchise shows one title: the most alike one", () => {
	const n = [
		title("m50", "Toy Story 2", 995),
		title("m51", "Toy Story", 994),
		title("m52", "Toy Story 3", 993),
		...around,
	]
	const drawn = posters(draw(n)).map((poster) => poster.k)
	assert.ok(drawn.includes("m50"))
	assert.ok(!drawn.includes("m51") && !drawn.includes("m52"))
	assert.equal(drawn.length, 8)
})

test("what the picture has no room for goes along as data, for a wider screen", () => {
	const html = draw()
	const rest = JSON.parse(
		(/data-pl-rest="([^"]*)"/.exec(html)?.[1] ?? "").replace(/&quot;/g, '"'),
	) as string[][]
	assert.equal(rest.length, around.length - 8)
	assert.deepEqual(rest[0], ["m10", "Neighbor10th", "2001", "m10.jpg"])
})

test("the chips are the middle title's own: full ones to drop, low ones to add, none on", () => {
	const html = draw()
	const chips = [...html.matchAll(/data-pl-act="tk" data-arg="([^"]+)"[^>]*aria-pressed="(\w+)"/g)]
	assert.deepEqual(
		chips.map((chip) => chip[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">")),
		["spectacle<4", "tension<4", "situational_comedy>6"],
	)
	assert.ok(chips.every((chip) => chip[2] === "false"))
	assert.match(html, /aria-label="Spectacle: 10 of 10 here. Tap: titles with 4 or less."/)
})

test("the trail starts at the page's title, with back off and no count of steps", () => {
	const html = draw()
	assert.match(html, /<button type="button" class="fn-bk" disabled aria-label="Back">/)
	assert.match(html, /aria-current="step" title="The Middle"/)
	assert.doesNotMatch(html, /Step \d/)
	assert.match(html, /<span class="fn-this">This page<\/span>/)
})

test("the plain links are real links, out of the tab order", () => {
	assert.match(
		draw(),
		/<p class="pl-more"><span>Open a page:<\/span><a data-pl-nav="" tabindex="-1" href="\/movie\/2-neighbor-a">Neighbor A \(2001\)<\/a><\/p>$/,
	)
})

test("a title's name can't break out of the markup", () => {
	const html = relatedMap(null).section({
		root: "m1",
		title: 'A "<b>" & more',
		pack: { ...pack, n: [title("m2", '<img onerror="x">', 990)] },
		links: [],
	})
	assert.doesNotMatch(html, /<img onerror/)
	assert.match(html, /Titles like A &quot;&lt;b&gt;&quot; &amp; more/)
})

// --- Without the pack ---------------------------------------------------------------------------------------------
// robots.txt keeps crawlers from /api/, so a crawler that renders a title page never has the pack.

const { LINKS, packLinks } = await import("../../server/related-map-pack.ts")
const WAITING = /on their way/

/** The section as the title page's loader draws it (server/related-map.server.ts). */
const served = () => {
	const n = Array.from({ length: 80 }, (_, i) =>
		title(`m${i + 2}`, `Neighbor${i + 2}th`, 990 - i * 3),
	)
	return relatedMap(null).section({
		root: "m1",
		title: "The Middle",
		pack: { ...pack, n },
		links: packLinks({ ...pack, n }),
	})
}

test("the server's HTML has the chips, the plain links, and no waiting line", () => {
	const html = served()
	assert.doesNotMatch(html, WAITING)
	assert.match(html, /aria-label="The traits of The Middle\. /)
	assert.equal((html.match(/data-pl-act="tk"/g) ?? []).length, 3)
	const links = [
		...html.matchAll(
			/<a data-pl-nav="" tabindex="-1" href="(\/movie\/\d+-[^"]+)">[^<]+<\/a>/g,
		),
	]
	assert.equal(links.length, LINKS)
	assert.equal(links[0][1], "/movie/2-neighbor2th")
	// The levels of the page's title go along, for the pictures the browser draws.
	assert.ok(html.includes(` data-s="${center[5]}">`))
})

const attr = (tag: string, name: string) =>
	new RegExp(` ${name}="([^"]*)"`)
		.exec(tag)?.[1]
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&") ?? null

/**
 * A browser that holds the server's HTML: as much of a document as the engine reads before it draws, with a stage
 * wider than a phone's, so that the engine draws its own picture. `answer` is what a request for a pack gets.
 */
function browser(
	html: string,
	answer: () => Promise<unknown>,
	sectionTag = '<section data-pl-root="m1" data-pl-title="The Middle">',
	win: Record<string, unknown> = {},
) {
	const el = (tag: string, more: Record<string, unknown> = {}) => ({
		getAttribute: (name: string) => attr(tag, name),
		hasAttribute: (name: string) => attr(tag, name) !== null,
		querySelector: () => null,
		...more,
	})
	const drawn = [
		...html.matchAll(/<button type="button" class="pl-p rm-p[^>]*>(<img[^>]*>)/g),
	]
		.filter((found) => !found[0].includes('data-pl-center=""'))
		.map((found) => el(found[0], { querySelector: () => el(found[1]) }))
	const stage = {
		...el(/<div class="pl-stage pl-map"[^>]*>/.exec(html)?.[0] ?? ""),
		innerHTML: "",
		firstChild: null,
		setAttribute() {},
		removeAttribute() {},
	}
	const rest = el(/<div class="rm [^>]*>/.exec(html)?.[0] ?? "")
	const section = {
		...el(sectionTag),
		querySelector: (selector: string) =>
			selector === "[data-pl-stage]"
				? stage
				: selector === "[data-pl-rest]"
					? rest
					: selector === "[data-r-map]"
						? { clientWidth: 900, clientHeight: 470 }
						: null,
		querySelectorAll: (selector: string) =>
			selector === "[data-pl-stage] [data-pl-step]" ? drawn : [],
		contains: () => false,
		addEventListener() {},
	}
	const asked: string[] = []
	const signals: (AbortSignal | undefined)[] = []
	const w: Record<string, unknown> = {
		document: {
			querySelectorAll: (selector: string) =>
				selector === "[data-related-map]" ? [section] : [],
			addEventListener() {},
			activeElement: null,
		},
		addEventListener() {},
		removeEventListener() {},
		setTimeout() {},
		clearTimeout() {},
		performance: { now: () => 0 },
		fetch: (url: string, init?: { signal?: AbortSignal }) => {
			asked.push(url)
			signals.push(init?.signal)
			return answer()
		},
		...win,
	}
	relatedMap(w)
	return { stage, asked, signals, win: w }
}

/** A window whose listeners and timers a test runs by hand. */
function handWindow() {
	const listeners: Record<string, ((event: unknown) => void)[]> = {}
	let timers: (() => void)[] = []
	return {
		win: {
			addEventListener: (type: string, run: (event: unknown) => void) => {
				listeners[type] = (listeners[type] ?? []).concat([run])
			},
			removeEventListener: (type: string, run: (event: unknown) => void) => {
				listeners[type] = (listeners[type] ?? []).filter((one) => one !== run)
			},
			setTimeout: (run: () => void) => {
				timers.push(run)
				return timers.length
			},
			AbortController,
		},
		fire(type: string, target: unknown, more: Record<string, unknown> = {}) {
			for (const run of listeners[type] ?? []) run({ type, target, ...more })
		},
		tick() {
			const due = timers
			timers = []
			for (const run of due) run()
		},
	}
}
const outsideLink = {
	closest: (selector: string) =>
		selector === "a[href]"
			? { closest: () => null, getAttribute: () => "/person/31-tom-hanks" }
			: null,
}
const plainSpot = { closest: () => null }
const engineOf = (win: Record<string, unknown>) =>
	(win as { __gwRelatedMap: { navigating: (on: boolean) => void } }).__gwRelatedMap
const ahead = (asked: string[]) => asked.filter((url) => url !== "/api/related-map?key=m1")
const settled = () => new Promise((done) => setTimeout(done, 0))

test("a browser that may not ask for the pack keeps the chips of the page's title", async () => {
	const page = browser(served(), () => Promise.reject(new TypeError("blocked")))
	await settled()
	assert.deepEqual(page.asked, ["/api/related-map?key=m1"])
	const html = page.stage.innerHTML
	assert.ok(posters(html).length > 8, "the engine drew its own, wider picture")
	assert.doesNotMatch(html, WAITING)
	assert.match(html, /aria-label="The traits of The Middle\. /)
	assert.match(html, /aria-label="Spectacle: 10 of 10 here. Tap: titles with 4 or less."/)
	assert.equal((html.match(/data-pl-act="tk"/g) ?? []).length, 3)
})

test("the same holds while the pack is on its way", async () => {
	const page = browser(served(), () => new Promise(() => {}))
	await settled()
	assert.ok(posters(page.stage.innerHTML).length > 8)
	assert.doesNotMatch(page.stage.innerHTML, WAITING)
	assert.match(page.stage.innerHTML, /aria-label="The traits of The Middle\. /)
})

test("localized map SSR redraw keeps actual field languages and canonical neighbor paths before a pack arrives", async () => {
	const local = (row: RawTitle): RawTitle => [row[0], `Traduit ${row[1]}`, row[2], row[3], row[4], row[5], { language: "fr-FR", canonicalTitle: row[1] }]
	const translated: RawPack = { ...pack, language: "fr", c: local(center), n: around.map(local) }
	const html = relatedMap(null).section({ root: "m1", title: translated.c[1], pack: translated, links: packLinks(translated) })
	const page = browser(html, () => Promise.reject(new TypeError("blocked fixture")), '<section data-pl-root="m1" data-pl-title="Traduit The Middle" data-media-language="fr" data-title-language="fr-FR" data-canonical-title="The Middle">')
	await settled()
	assert.deepEqual(page.asked, ["/api/related-map?key=m1&displayLanguage=fr"])
	assert.match(page.stage.innerHTML, /lang="fr-FR"/)
	assert.ok(page.stage.innerHTML.includes("Traduit The Middle"))
	assert.match(html, /href="\/movie\/2-neighbor2th"/)
	assert.doesNotMatch(html, /href="\/movie\/2-traduit-/)
})

test("a press on a link that leaves the page asks for no packs ahead", async () => {
	const hand = handWindow()
	const page = browser(served(), () => new Promise(() => {}), undefined, hand.win)
	await settled()
	hand.fire("touchstart", outsideLink)
	hand.fire("pointerdown", outsideLink)
	hand.fire("keydown", outsideLink, { key: "Enter" })
	hand.tick()
	hand.tick()
	assert.deepEqual(ahead(page.asked), [])
	hand.fire("pointerdown", plainSpot)
	hand.tick()
	assert.deepEqual(ahead(page.asked), [], "the packs wait for a moment after the first use")
	hand.tick()
	hand.tick()
	assert.equal(ahead(page.asked).length, 8)
})

test("packs ahead wait while the app loads another page, and stop when one starts", async () => {
	const hand = handWindow()
	const page = browser(served(), () => new Promise(() => {}), undefined, hand.win)
	await settled()
	const engine = engineOf(page.win)
	hand.fire("pointerdown", plainSpot)
	engine.navigating(true)
	hand.tick()
	hand.tick()
	assert.deepEqual(ahead(page.asked), [])
	engine.navigating(false)
	hand.tick()
	assert.equal(ahead(page.asked).length, 8)
	const first = page.signals.slice(1)
	assert.ok(first.every((signal) => signal && !signal.aborted))
	engine.navigating(true)
	assert.ok(first.every((signal) => signal?.aborted))
	assert.equal(page.signals[0], undefined, "the page title's own pack is never stopped")
})

test("an engine that starts during a page change waits for it to end", async () => {
	const hand = handWindow()
	const page = browser(served(), () => new Promise(() => {}), undefined, {
		...hand.win,
		__gwAppLoading: true,
	})
	await settled()
	hand.fire("pointerdown", plainSpot)
	hand.tick()
	hand.tick()
	assert.deepEqual(ahead(page.asked), [])
	engineOf(page.win).navigating(false)
	hand.tick()
	assert.equal(ahead(page.asked).length, 8)
})

test("the page title's pack waits for the app's navigation work when the app hands over a wait (#753)", async () => {
	const held: (() => void)[] = []
	const page = browser(served(), () => new Promise(() => {}), undefined, {
		__gwRelatedMapDefer: (run: () => void) => held.push(run),
	})
	await settled()
	assert.deepEqual(page.asked, [], "nothing is asked for while the app's work goes on")
	assert.equal(held.length, 1)
	held[0]()
	assert.deepEqual(page.asked, ["/api/related-map?key=m1"])
})

test("a wait that ends after the section shows another title, or has gone, asks for nothing (#753)", async () => {
	for (const change of ["another title", "gone"] as const) {
		const held: (() => void)[] = []
		const page = browser(served(), () => new Promise(() => {}), undefined, {
			__gwRelatedMapDefer: (run: () => void) => held.push(run),
		})
		await settled()
		const section = (page.win.document as { querySelectorAll: (s: string) => Record<string, unknown>[] })
			.querySelectorAll("[data-related-map]")[0]
		if (change === "gone") section.isConnected = false
		else {
			const own = section.getAttribute as (name: string) => string | null
			section.getAttribute = (name: string) => (name === "data-pl-root" ? "m2" : own(name))
		}
		held[0]()
		assert.deepEqual(page.asked, [], change)
	}
})
