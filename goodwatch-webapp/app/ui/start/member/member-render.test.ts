// A member's start in the server's HTML (MemberStart.tsx): one H1 and no boot, "this or that" or the first steps in
// the card, and the open door's section with its real links, for members with more and less on their lists.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Member = "full" | "few" | "noShows" | "noWishlist" | "new" | "later"
type Section = Record<"room" | "pending" | "full" | "sparse" | "error", string>

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/member/member-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__MEMBER_START_RENDER__")
		.at(-1) ?? "",
) as Record<Member, string> & {
	sections: Record<"hot" | "forYou" | "forming", Section>
	results: Record<"any" | "mine", string>
}

const { sections, results, ...pages } = rendered
const all = Object.entries(pages) as [Member, string][]

/** The doors in their order, and which one is open. */
const doors = (html: string) =>
	[
		...html.matchAll(
			/<button type="button" aria-expanded="(true|false)" aria-controls="start-door-section" class="([^"]*)"><span[^>]*>([^<]*)</g,
		),
	].map(([, open, classes, label]) => ({
		open: open === "true",
		classes,
		label,
	}))
/** The open section's heading. */
const section = (html: string) =>
	/id="start-door-section"[\s\S]*?<h3[^>]*>([^<]*)<\/h3>/.exec(html)?.[1]

test("one H1, the page's heading; every other heading is an H2 or H3", () => {
	for (const [name, html] of all) {
		assert.equal(html.match(/<h1\b/g)?.length, 1, name)
		assert.match(
			html,
			/<h1 id="start-heading"[^>]*>Find something to watch<\/h1>/,
		)
		assert.ok(!/<h[4-6]\b/.test(html), name)
	}
})

test("a member's HTML has no boot, no gate and no centered stage; the room is lit", () => {
	for (const [name, html] of all) {
		assert.ok(!/boot/i.test(html), name)
		assert.ok(!/sessionStorage/.test(html), name)
		assert.ok(!/data-centered/.test(html), name)
		assert.ok(!/id="start-card"[^>]*data-hidden/.test(html), name)
		assert.match(html, /--start-night:0[;"]/, name)
	}
})

test("a member searches with the mood picker under the bar, as a guest does", () => {
	for (const [name, html] of all) {
		assert.match(
			html,
			/class="start-moods"[\s\S]*?Any mood[\s\S]*?Pick up to three/,
			name,
		)
	}
})

test("the doors follow what the member has, and the first is open in the server's HTML", () => {
	const expect: Record<Member, string[]> = {
		full: ["Continue watching", "Wishlist", "For you", "Hot"],
		few: ["Continue watching", "Wishlist", "For you", "Hot"],
		noShows: ["Wishlist", "For you", "Hot", "Continue watching"],
		noWishlist: ["Continue watching", "For you", "Hot", "Wishlist"],
		new: ["Hot", "Continue watching", "Wishlist", "For you"],
		later: ["Continue watching", "Wishlist", "For you", "Hot"],
	}
	for (const [name, html] of all) {
		const found = doors(html)
		assert.deepEqual(
			found.map((d) => d.label),
			expect[name],
			name,
		)
		assert.deepEqual(
			found.map((d) => d.open),
			[true, false, false, false],
			name,
		)
		assert.equal(section(html), expect[name][0], name)
	}
})

test("doors never change height: every door has the same fixed height, open or not", () => {
	for (const [name, html] of all)
		for (const door of doors(html)) {
			assert.match(
				door.classes,
				/(^| )h-\[6\.5rem\]( |$)/,
				`${name} ${door.label}`,
			)
			assert.match(door.classes, /(^| )sm:h-28( |$)/, `${name} ${door.label}`)
		}
})

test("the open section's titles and its page are real links in the HTML", () => {
	const full = rendered.full
	const open = full.slice(full.indexOf('id="start-door-section"'))
	assert.match(open, /href="\/my-shows"/)
	assert.match(open, /href="\/show\/1-show-1"/)
	assert.match(open, /S1 E1 · Pilot/)
	// New members open Hot on socials: its ranked titles with why each is talked about.
	const hot = rendered.new.slice(
		rendered.new.indexOf('id="start-door-section"'),
	)
	assert.match(hot, /href="\/movie\/301-movie-301"/)
	assert.match(hot, /New trailer · today/)
	assert.match(hot, /href="\/hot-on-socials"/)
})

test("the card: this or that from the member's lists, the first steps for a new member", () => {
	for (const name of ["full", "few", "noShows", "noWishlist"] as const) {
		assert.match(rendered[name], /This or that\?/, name)
		assert.ok(!/Start here/.test(rendered[name]), name)
	}
	// Full: Tonight's pick (show 1) on the left, a challenger from the Wishlist on the right.
	assert.match(rendered.full, /Show 1<\/span>[\s\S]*?Movie 101<\/span>/)
	const fresh = rendered.new
	assert.ok(!/This or that\?/.test(fresh))
	assert.match(fresh, /Start here/)
	for (const href of ["/taste", "/settings/imports", "/discover"])
		assert.match(fresh, new RegExp(`href="${href}"`))
})

test("empty and sparse sections say why in one strip, with the way forward", () => {
	// No shows: the Wishlist is open with titles and no strip; the Continue door says it has none.
	assert.match(rendered.noShows, />No shows yet</)
	assert.ok(
		!/Track a show and its next episode waits here/.test(rendered.noShows),
	)
	// Few: For you's door counts the ratings so far.
	assert.match(rendered.few, />4 of 10 ratings</)
	// New: For you needs ratings; the Wishlist says nothing is saved.
	assert.match(rendered.new, />Needs ratings</)
	assert.match(rendered.new, />Nothing saved yet</)
})

test("nothing on the page writes: no form but the search bar's", () => {
	for (const [name, html] of all) {
		assert.equal(html.match(/<form\b/g)?.length, 1, name)
		assert.match(html, /<form[^>]*role="search"/, name)
	}
})

test("For you and Hot on socials on their way: the page is the same around them, the open section complete", () => {
	const html = rendered.later
	const full = rendered.full
	const open = (page: string) =>
		page.slice(page.indexOf('id="start-door-section"'))
	assert.equal(open(html), open(full))
	assert.match(html, />Your taste</)
	assert.match(html, />Right now</)
	// The card deals from the own lists, as with every list there.
	assert.match(html, /Show 1<\/span>[\s\S]*?Movie 101<\/span>/)
})

test("a door whose list comes later keeps one room from the skeleton to every answer, so nothing moves", () => {
	for (const [name, states] of Object.entries(sections)) {
		const cells = (html: string) =>
			html.match(/<li class="min-w-0"/g)?.length ?? 0
		// The skeleton is the room itself: the chips' row where the list can have chips, a full grid of twelve.
		assert.ok(states.pending.includes(states.room), name)
		assert.equal(cells(states.room), 12, name)
		assert.equal(/class="mb-4 flex h-9/.test(states.room), name !== "hot", name)
		// Hot on socials' slots keep room for the two lines of why under each poster.
		assert.equal(
			/h-\[calc\(2\*1\.375\*0\.75rem\)\]/.test(states.room),
			name === "hot",
			name,
		)
		for (const answer of ["full", "sparse", "error"] as const) {
			const html = states[answer]
			// The answer lies over the same room, unseen, in one grid cell.
			assert.match(
				html,
				/<div aria-hidden="true" data-door-reserve="true" class="invisible col-start-1 row-start-1 min-w-0">/,
				`${name} ${answer}`,
			)
			assert.ok(html.includes(states.room), `${name} ${answer}`)
			assert.ok(
				!/aria-busy/.test(html.replace(states.room, "")),
				`${name} ${answer}`,
			)
		}
		// The caption under the heading keeps its line, also when the list couldn't be read.
		const note = /<p[^>]*class="[^"]*mt-0\.5 text-sm[^"]*"[^>]*>([^<]+)<\/p>/
		const caption = note.exec(states.pending)?.[1]
		assert.ok(caption, name)
		for (const answer of ["full", "sparse", "error"] as const)
			assert.equal(note.exec(states[answer])?.[1], caption, `${name} ${answer}`)
		assert.match(states.error, /Couldn&#x27;t load this right now/, name)
	}
	// A full answer has the titles and, where the list has them, the chips the room kept a row for.
	assert.match(sections.forYou.full, /<legend class="sr-only">Filter<\/legend>/)
	assert.match(sections.hot.full, /New trailer · today/)
})

test("the results line says the services scope as the mood picker's counts do", () => {
	assert.match(results.any, /aria-live="polite">1,234 titles<\/h2>/)
	assert.match(results.mine, /aria-live="polite">1,234 on your services<\/h2>/)
})
