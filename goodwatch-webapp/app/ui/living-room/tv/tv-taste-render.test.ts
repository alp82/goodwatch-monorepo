// Your taste, a side's screen, Rate titles and the rating as they are drawn: the items in the markup are the
// machine's, in its order, in both editions; the rating strip is the app's levels from low to high with the ten
// exact scores, under the levels on the desktop and in one band on the phone; and the Expand key is there once. The phone
// draws its header (the white G and Menu), pages its sides with arrows (`jump:` items), and leaves Rate titles'
// Your taste to the menu.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import { scoreLabels } from "../../../utils/ratings.ts"
import { RATING_LEVELS } from "../../scoring/score-model.ts"
import { TASTE_GROUPS_NAME } from "../../taste/taste-groups-name.ts"

type Drawn = { items: string[]; focus: string; html: string }
type Editions = { desktop: Drawn; phone: Drawn }
type Phone = { items: string[]; html: string }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-taste-render.test-support.tsx",
		],
		{
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			// Every screen in both editions and on six phones: more than the default megabyte.
			maxBuffer: 64 * 1024 * 1024,
		},
	)
		.split("__TV_TASTE_RENDER__")
		.at(-1) ?? "",
) as {
	taste: Record<
		| "start"
		| "started"
		| "reading"
		| "two"
		| "three"
		| "four"
		| "five"
		| "threeSecond"
		| "threeOnBar"
		| "picks"
		| "picksSecond"
		| "picksWaiting"
		| "picksNone"
		| "side"
		| "sideShort"
		| "sideGone",
		Editions
	>
	quiz: Record<
		| "asking"
		| "onScore"
		| "onLevel"
		| "onSkip"
		| "onNotInterested"
		| "more"
		| "lit"
		| "given"
		| "failed"
		| "long"
		| "waiting"
		| "none",
		Editions
	>
	rate: Record<"fresh" | "again" | "againOnIt" | "againOnLevel", Editions>
	phones: ({ phone: string; scale: number } & Record<
		"start" | "sides" | "picks" | "quiz" | "rate",
		Phone
	>)[]
	first: Record<"taste" | "side" | "quiz" | "tasteWithData", string>
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
/** An item's opening tag. */
const tag = (html: string, id: string) =>
	new RegExp(`<button[^>]*data-tv-item="${id}"[^>]*>`).exec(html)?.[0] ?? ""
const styleOf = (html: string, id: string) =>
	/style="([^"]*)"/.exec(tag(html, id))?.[1] ?? ""
/**
 * An item's height in canvas pixels: its own, or, for a key that fills its row (`h-full`, a phone list's keys,
 * TitleList.tsx), the row's.
 */
const heightOf = (html: string, id: string) => {
	const own = /(?:^|;)height:(\d+)px/.exec(styleOf(html, id))?.[1]
	if (own) return Number(own)
	const at = html.indexOf(`data-tv-item="${id}"`)
	const tagOf = html.slice(
		html.lastIndexOf("<button", at),
		html.indexOf(">", at),
	)
	if (at < 0 || !/\bh-full\b/.test(tagOf)) return Number.NaN
	const rows = [
		...html
			.slice(0, at)
			.matchAll(/<div class="[^"]*" style="height:(\d+)px">/g),
	]
	return Number(rows.at(-1)?.[1] ?? Number.NaN)
}
const count = (html: string, part: string) => html.split(part).length - 1

/**
 * The phone's last row with the Expand key at its right end (kit.tsx, `PhoneFoot`): its height and what stands
 * before the key, or null when the screen has no such row.
 */
const phoneFoot = (html: string) => {
	// kit.tsx's PhoneFoot, or a phone list's row of keys ending with the Expand key (TitleList.tsx, 2026-10-22).
	const m =
		/<div class="flex shrink-0 items-center gap-2[^"]*" style="height:(\d+)px">(?:<div class="flex min-w-0 flex-1 items-center gap-2">)?((?:(?!style="height:).)*?)(?:<\/div>)?<button type="button" data-tv-item="expand"/.exec(
			html,
		)
	return m ? { height: Number(m[1]), before: m[2] } : null
}
/** A screen's own items and its bar's, without the Expand key: for the lists written out here. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
/** The desktop bar of a screen without the navigation: the white G (since 2026-10-22), Back, Search, Menu. */
const BAR = ["nav:home", "bar:back", "bar:search", "bar:menu"]
/** The phone's header on every screen. */
/** The phone's header on every screen but home (2026-10-22): Back, the white G and Menu. */
const HEADER = ["bar:back", "nav:home", "bar:menu"]
const barOf = (edition: "desktop" | "phone") =>
	edition === "phone" ? HEADER : BAR
/** The items a screen draws: the machine's, but the phone's quiz leaves Your taste to the menu where it asks. */
const shownOf = (
	items: string[],
	edition: "desktop" | "phone",
	quiz: boolean,
) =>
	edition === "phone" && quiz && items.includes("skip")
		? items.filter((item) => item !== "your-taste")
		: items
/** The item ids in the markup without the page arrows, which stand for the items they lead to. */
const own = (html: string) => ids(html).filter((id) => !id.startsWith("jump:"))
/** The quiz has the TV's navigation along the top, in the bar's place. */
const NAV = [
	"nav:home",
	"nav:tonight",
	"nav:discover",
	"nav:search",
	"nav:quiz",
	"bar:menu",
]
const LEVELS = RATING_LEVELS.map((level) => `level:${level.score}`)
const SCORES = Array.from({ length: 10 }, (_, at) => `score:${at + 1}`)
const EDITIONS = ["desktop", "phone"] as const
const all = <K extends string>(group: Record<K, Editions>) =>
	(Object.entries(group) as [K, Editions][]).flatMap(([name, screen]) =>
		EDITIONS.map((edition) => ({ name, edition, ...screen[edition] })),
	)

test("every screen's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const [group, quiz] of [
		[all(rendered.taste), false],
		[all(rendered.quiz), true],
		[all(rendered.rate), false],
	] as const)
		for (const screen of group)
			assert.deepEqual(
				own(screen.html),
				shownOf(screen.items, screen.edition, quiz).filter(
					// The phone's sides show a page of three; the others are a page arrow away.
					(item) =>
						!(screen.edition === "phone" && item.startsWith("side:")) ||
						own(screen.html).includes(item),
				),
				`${screen.name} ${screen.edition}`,
			)
})

test("exactly the focused item is marked, and the focus starts where the machine says", () => {
	for (const screen of [
		...all(rendered.taste),
		...all(rendered.quiz),
		...all(rendered.rate),
	])
		assert.deepEqual(
			focused(screen.html),
			[screen.focus],
			`${screen.name} ${screen.edition}`,
		)
	assert.equal(rendered.taste.start.desktop.focus, "start-quiz")
	assert.equal(rendered.taste.three.desktop.focus, "side:dark-crime")
	assert.equal(rendered.taste.picks.phone.focus, "title:show-901")
	assert.equal(rendered.taste.side.desktop.focus, "title:movie-10")
	// The strip starts on Good.
	for (const edition of EDITIONS) {
		assert.equal(rendered.quiz.asking[edition].focus, "level:7")
		assert.equal(rendered.rate.fresh[edition].focus, "level:7")
	}
})

test("Your taste before the taste is ready: the next step, the totals, and Rate titles", () => {
	const { start, started } = rendered.taste
	for (const edition of EDITIONS) {
		// A guest can sign up to keep what they rated.
		assert.deepEqual(drawn(start[edition].items), [
			"start-quiz",
			"sign-up",
			...barOf(edition),
		])
		assert.match(
			start[edition].html,
			/aria-label="Sign up to save your scores and taste"/,
		)
		assert.match(start[edition].html, />5 more liked to your taste\.</)
		assert.match(start[edition].html, />0 rated · 0 liked \(6 or higher\)\.</)
		assert.match(start[edition].html, />Rate titles</)
		// Liked titles count toward the taste, not every score.
		assert.match(started[edition].html, />3 more liked to your taste\.</)
		assert.match(started[edition].html, />3 rated · 2 liked \(6 or higher\)\.</)
		assert.match(started[edition].html, />Rate titles</)
	}
	// The first title the quiz will ask about is the picture, once the quiz knows it.
	assert.equal(count(start.desktop.html, "<img"), 0)
	assert.equal(count(started.desktop.html, "/t/p/w1280/next.jpg"), 1)
	assert.equal(count(started.phone.html, "/t/p/w780/next.jpg"), 1)
})

test("Taste while the portrait is read keeps its one key", () => {
	for (const edition of EDITIONS) {
		const { html, items } = rendered.taste.reading[edition]
		assert.deepEqual(drawn(items), ["start-quiz", "sign-up", ...barOf(edition)])
		assert.match(html, />Reading your taste\.</)
		assert.match(html, />Rate titles</)
	}
})

test("the sides are tiles, two to five of them, under the view's name in the bar, with Rate titles after them", () => {
	const { two, three, four, five } = rendered.taste
	for (const [screen, sides] of [
		[two, 2],
		[three, 3],
		[four, 4],
		[five, 5],
	] as const)
		for (const edition of EDITIONS) {
			const { html, items } = screen[edition]
			// The phone leaves the name out for a guest, whose sign-up takes a row.
			if (edition === "desktop")
				assert.ok(html.includes(`>${TASTE_GROUPS_NAME.title}<`))
			assert.ok(!/\bsides? of you\b/i.test(html))
			assert.equal(
				items.filter((item) => item.startsWith("side:")).length,
				sides,
			)
			assert.deepEqual(drawn(items).slice(sides), [
				"start-quiz",
				"sign-up",
				...barOf(edition),
			])
			assert.match(html, />Rate titles</)
		}
	assert.match(three.desktop.html, />Slow-burning crime stories</)
	assert.match(three.desktop.html, />Warm comedies</)
	// The desktop's tiles say their line; the phone's tiles their names alone.
	assert.equal(count(three.desktop.html, ">Line of "), 3)
	assert.equal(count(three.phone.html, ">Line of "), 0)
})

test("the picture and the phone's line follow the focused side, and stay while the focus is on the bar", () => {
	const { three, threeSecond, threeOnBar } = rendered.taste
	assert.equal(count(three.desktop.html, "/t/p/w1280/side-dark-crime.jpg"), 1)
	assert.equal(
		count(threeSecond.desktop.html, "/t/p/w1280/side-gentle-comedy.jpg"),
		1,
	)
	assert.equal(
		count(threeOnBar.desktop.html, "/t/p/w1280/side-dark-crime.jpg"),
		1,
	)
	// A tile's own picture is the small file, once per tile.
	assert.equal(count(three.desktop.html, "/t/p/w780/side-"), 3)
})

test("the phone shows three sides a page, with arrows to more; the desktop all of them side by side", () => {
	const { two, three, four, five } = rendered.taste
	for (const [screen, n] of [
		[two, 2],
		[three, 3],
		[four, 3],
		[five, 3],
	] as const)
		assert.equal(count(screen.phone.html, 'data-tv-item="side:'), n)
	// More than three: the next page is an arrow away, to the fourth side; none before the first page.
	assert.ok(!three.phone.html.includes('data-tv-item="jump:'))
	for (const screen of [four, five]) {
		assert.match(
			screen.phone.html,
			/data-tv-item="jump:side:[^"]+" aria-label="More sides"/,
		)
		assert.ok(!screen.phone.html.includes('aria-label="Sides before"'))
	}
	assert.match(four.desktop.html, /grid-template-columns:repeat\(4,/)
	assert.match(five.desktop.html, /grid-template-columns:repeat\(5,/)
	// Five tiles are narrow: their names are drawn smaller than four's.
	assert.match(five.desktop.html, /text-\[21px\]/)
	assert.ok(!four.desktop.html.includes("text-[21px]"))
	// Two sides keep a tile's width: they do not stretch over the picture.
	assert.match(
		rendered.taste.two.desktop.html,
		/grid-template-columns:repeat\(3,/,
	)
})

test("a side's screen lists the titles of it the person rated, under the side's name", () => {
	const { side, sideShort, sideGone } = rendered.taste
	for (const edition of EDITIONS) {
		const { html, items } = side[edition]
		assert.deepEqual(drawn(items), [
			"title:movie-10",
			"title:movie-11",
			"title:movie-12",
			"title:movie-13",
			...barOf(edition),
		])
		// The side's name: in the crumb on the desktop; on the phone see the test after this one.
		if (edition === "desktop")
			assert.match(html, />Slow-burning crime stories</)
		assert.match(html, />Title 10</)
		assert.match(html, />2019 · Movie · 810 score · You gave it 10</)
		// The shared list's posters: the small file on the phone.
		assert.equal(
			count(html, `/t/p/${edition === "phone" ? "w185" : "w342"}/poster-`),
			4,
		)
		// No Rate titles here.
		assert.ok(!html.includes("Rate titles"))
		// There can be fewer than four.
		assert.deepEqual(drawn(sideShort[edition].items), [
			"title:movie-20",
			"title:movie-21",
			...barOf(edition),
		])
		// A side the portrait no longer has: the bar, and words.
		assert.deepEqual(drawn(sideGone[edition].items), barOf(edition))
		assert.match(
			sideGone[edition].html,
			/>This isn&#x27;t in your taste any more\.</,
		)
	}
	assert.equal(count(side.desktop.html, "/t/p/w1280/backdrop-10.jpg"), 1)
	assert.equal(count(side.phone.html, "/t/p/w780/backdrop-10.jpg"), 1)
})

// The phone's list has no crumb (TitleList.tsx): a list's own name goes in the header (`phoneName`), as Discover's
// "Funny". A side's screen and the quiz's picks still say which list it is.
test("on the phone a side's screen names the side, and the quiz's picks say Made for you", () => {
	assert.match(rendered.taste.side.phone.html, />Slow-burning crime stories</)
	assert.match(rendered.taste.picks.phone.html, />Made for you</)
})

test("a ready taste and no sides yet: the flow's picks as Made for you, four of them, with Rate titles", () => {
	const { picks, picksSecond, picksWaiting, picksNone } = rendered.taste
	for (const edition of EDITIONS) {
		const { html, items } = picks[edition]
		assert.deepEqual(drawn(items), [
			"title:show-901",
			"title:show-902",
			"title:show-903",
			"title:show-904",
			"start-quiz",
			"sign-up",
			...barOf(edition),
		])
		if (edition === "desktop") assert.match(html, />Made for you</)
		assert.match(html, />Title 1</)
		assert.match(html, />Rate titles</)
		assert.match(picksSecond[edition].html, />Title 2</)
		// Without picks the screen says why, and Rate titles is still there.
		for (const [screen, words] of [
			[picksWaiting, "Your picks are on their way."],
			[picksNone, "No picks right now. Rate a few more titles."],
		] as const) {
			assert.deepEqual(drawn(screen[edition].items), [
				"start-quiz",
				"sign-up",
				...barOf(edition),
			])
			assert.ok(screen[edition].html.includes(`>${words}<`))
			assert.equal(screen[edition].focus, "start-quiz")
		}
	}
})

test("the Expand key stands in its corner on Your taste and a side, Rate titles has it once, and the rating has none", () => {
	for (const screen of all(rendered.taste)) {
		// In its corner on the desktop; on the phone with the screen's keys, never in a corner over them.
		const corner =
			/<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*aria-label="Expand"[^>]*>.*?Expand<\/button><\/div>/.test(
				screen.html,
			)
		assert.ok(
			screen.edition === "desktop"
				? corner
				: !screen.html.includes("data-tv-expand-place"),
			`${screen.name} ${screen.edition}`,
		)
		assert.ok(screen.items.includes("expand"))
		assert.equal(count(screen.html, 'data-tv-item="expand"'), 1)
	}
	// Rate titles grows into the site's /taste/quiz.
	for (const screen of all(rendered.quiz)) {
		assert.ok(screen.items.includes("expand"), screen.name)
		assert.equal(
			count(screen.html, 'data-tv-item="expand"'),
			1,
			`${screen.name} ${screen.edition}`,
		)
	}
	for (const screen of all(rendered.rate)) {
		assert.ok(!screen.html.includes("data-tv-expand-place"))
		assert.ok(!screen.items.includes("expand"))
	}
})

test("the strip on the desktop: four levels low to high, each as wide as its scores, over the ten exact scores", () => {
	for (const { items, html } of [
		rendered.quiz.asking.desktop,
		rendered.rate.fresh.desktop,
	]) {
		const strip = items.filter(
			(item) => item.startsWith("level:") || item.startsWith("score:"),
		)
		assert.deepEqual(strip, [...LEVELS, ...SCORES])
		assert.deepEqual(LEVELS, ["level:3", "level:5", "level:7", "level:9"])
		// Each level says its name and range, read from the app's levels, and spans its scores.
		for (const level of RATING_LEVELS) {
			const id = `level:${level.score}`
			assert.match(
				tag(html, id),
				new RegExp(`aria-label="${level.name}, ${level.score}"`),
			)
			assert.match(
				styleOf(html, id),
				new RegExp(`grid-column:span ${level.hi - level.lo + 1}`),
			)
			assert.ok(html.includes(`>${level.name}<`))
			assert.ok(html.includes(`>${level.lo}–${level.hi}<`))
		}
		assert.match(html, /grid-template-columns:repeat\(10,/)
		// Each exact score says its number, and the app's name for it to a screen reader.
		for (let score = 1; score <= 10; score++)
			assert.match(
				tag(html, `score:${score}`),
				new RegExp(`aria-label="${score}, ${scoreLabels[score]}"`),
			)
	}
})

test("both phone rating screens render one band: each of the four words joined over its own exact scores", () => {
	for (const { items, html } of [
		rendered.quiz.asking.phone,
		rendered.rate.fresh.phone,
	]) {
		assert.deepEqual(
			items.filter((item) => /^(level|score):/.test(item)),
			[...LEVELS, ...SCORES],
		)
		assert.equal(count(html, 'data-tv-item="score:'), 10)
		assert.match(html, /grid-template-columns:repeat\(10,/)
		assert.match(html, /gap-x-1 gap-y-0/)
		for (const level of RATING_LEVELS)
			assert.match(
				styleOf(html, `level:${level.score}`),
				new RegExp(`grid-column:span ${level.hi - level.lo + 1}`),
			)
	}
})

test("a line says what the focus would give, on a level and on an exact score", () => {
	const { asking, onScore, onLevel, onSkip } = rendered.quiz
	assert.match(asking.desktop.html, />Good · OK gives it 7</)
	assert.match(onLevel.desktop.html, />Bad · OK gives it 3</)
	assert.match(onScore.desktop.html, />8 · Great</)
	// Off the strip the line is Rate titles' question.
	assert.match(onSkip.desktop.html, />2005 · Show\. Have you seen it\?</)
	// The phone has no line: its keys say their words, and the header names the title asked about, with its year,
	// and the next step under it.
	assert.ok(!asking.phone.html.includes("Good · gives 7"))
	assert.match(
		onSkip.phone.html,
		/<nav aria-label="TV"[\s\S]*?>The Office \(2005\)<\/span><span[^>]*>3 more liked to your taste</,
	)
	// The phone keeps its exact-score focus, just like desktop.
	assert.equal(onScore.phone.focus, "score:8")
})

test("selected numerals stay white on their full score color, with one lighter inset edge of that color independent of focus", () => {
	for (const edition of EDITIONS) {
		for (const drawn of [
			rendered.rate.again[edition],
			rendered.rate.againOnIt[edition],
		]) {
			assert.match(tag(drawn.html, "score:8"), /aria-pressed="true"/)
			assert.match(styleOf(drawn.html, "score:8"), /color:#fff/)
			assert.match(styleOf(drawn.html, "score:8"), /background:#25a73d/)
			assert.match(styleOf(drawn.html, "score:8"), /inset 0 0 0 2px color-mix\(in srgb, #25a73d 45%, #fff\)/)
			assert.match(tag(drawn.html, "level:7"), /aria-pressed="true"/)
		}
	}
})

test("Rate titles asks about one title: its name, the next step, and its two marks as keys of their own", () => {
	const { asking, more, long, waiting, none } = rendered.quiz
	for (const edition of EDITIONS) {
		const { html, items } = asking[edition]
		const nav = edition === "phone" ? HEADER : NAV
		assert.match(html, edition === "desktop" ? />The Office</ : />The Office \(2005\)</)
		// The two marks and Your taste are keys of their own after the strip.
		const mine = drawn(items).slice(0, -nav.length)
		assert.deepEqual(mine.slice(-3), ["skip", "not-interested", "your-taste"])
		assert.deepEqual(drawn(items).slice(-nav.length), nav)
		assert.match(html, /data-tv-item="skip"[^>]*>Haven&#x27;t seen it</)
		assert.match(html, /data-tv-item="not-interested"[^>]*>Not interested</)
		// The top line is the web's top strip: liked titles toward the taste, then ratings toward new picks.
		assert.match(html, />3 more liked to your taste</)
		assert.match(more[edition].html, />4 more to new picks</)
		assert.ok(!/\bquiz\b|of 5 rated|Taste ·/i.test(html.replace(/data-tv-item="[^"]*"/g, "")))
		if (edition === "desktop") {
			// Your taste is the web's taste bar: a key beside the marks (the row's end is the Expand key's), and with
			// its totals beside it where there is no title to ask about.
			assert.match(html, /data-tv-item="your-taste"[^>]*>Your taste</)
			assert.ok(!html.includes("2 rated · 2 liked"))
			assert.match(none[edition].html, /data-tv-item="your-taste"/)
			assert.match(
				long[edition].html,
				/line-clamp-2[^>]*>The Lord of the Rings: The Fellowship of the Ring</,
			)
		} else {
			// The phone's row has room for the two marks and the Expand key: Your taste is in its menu there. The
			// header names the title with its year, and says the next step under it.
			assert.ok(!html.includes('data-tv-item="your-taste"'))
			assert.match(html, />The Office \(2005\)</)
		}
		// Without a title to ask about there is no strip, only Your taste, the navigation and words.
		assert.deepEqual(drawn(waiting[edition].items), ["your-taste", ...nav])
		assert.match(waiting[edition].html, />Finding titles for you…</)
		assert.deepEqual(drawn(none[edition].items), ["your-taste", ...nav])
		assert.match(none[edition].html, />That&#x27;s every title for now\.</)
	}
	assert.equal(count(asking.desktop.html, "/t/p/w1280/office.jpg"), 1)
	assert.equal(count(asking.phone.html, "/t/p/w780/office.jpg"), 1)
})

test("a milestone lights Your taste amber and never ends rating", () => {
	const { lit, asking } = rendered.quiz
	for (const edition of EDITIONS) {
		// The strip and the marks stay: rating goes on.
		assert.ok(lit[edition].items.includes("level:7"))
		assert.ok(lit[edition].items.includes("skip"))
		assert.match(lit[edition].html, /aria-live="polite">Your taste is ready</)
		assert.ok(!asking[edition].html.includes("Your taste is ready"))
	}
	// The desktop's key turns amber and says so; the phone's header says it in amber under the title.
	assert.match(
		lit.desktop.html,
		/data-tv-item="your-taste"[^>]*class="[^"]*tvc-cta[^"]*"[^>]*>Your taste is ready</,
	)
	assert.ok(!/data-tv-item="your-taste"[^>]*tvc-cta/.test(asking.desktop.html))
	assert.match(lit.phone.html, /text-amber-300[^"]*">Your taste is ready</)
})

test("an answer just given and a save that failed: the title stays named on the phone", () => {
	const { given, failed, onNotInterested } = rendered.quiz
	// The answer in full under the question on the desktop; in a few words under the title on the phone.
	assert.match(
		given.desktop.html,
		/>Haven&#x27;t seen it\. We won&#x27;t ask about it again\.</,
	)
	assert.match(given.phone.html, />The Office \(2005\)</)
	assert.match(given.phone.html, /text-amber-300[^"]*">Haven&#x27;t seen it</)
	for (const edition of EDITIONS) {
		// A failed save says so, keeps the title, and its "Haven't seen it" key reads Next title.
		assert.match(
			failed[edition].html,
			/>Couldn&#x27;t save\. Try again, or go to the next title\.</,
		)
		assert.match(failed[edition].html, /data-tv-item="skip"[^>]*>Next title</)
		assert.equal(onNotInterested[edition].focus, "not-interested")
	}
	assert.match(failed.phone.html, />The Office \(2005\)</)
})

test("the rating is the same strip without Haven't seen it, and marks the score the title has", () => {
	const { fresh, again, againOnIt, againOnLevel } = rendered.rate
	for (const edition of EDITIONS) {
		// The phone's header has the screen's name from the TV (TvScreen.tsx), not drawn here.
		if (edition === "desktop") assert.match(fresh[edition].html, />Seen it</)
		assert.match(fresh[edition].html, />How was The Matrix\?</)
		assert.ok(!ids(fresh[edition].html).includes("skip"))
		assert.ok(!fresh[edition].html.includes("inset 0 0 0 3px"))
	}
})

test("on every phone of the room's table every key is 44 px or more on the phone's screen", () => {
	assert.deepEqual(
		rendered.phones.map((p) => p.phone),
		["360x740", "375x667", "390x700", "390x844", "430x932", "844x390"],
	)
	for (const p of rendered.phones)
		for (const screen of ["start", "sides", "picks", "quiz", "rate"] as const) {
			const { html, items } = p[screen]
			assert.deepEqual(
				own(html),
				shownOf(items, "phone", screen === "quiz").filter(
					(item) => !item.startsWith("side:") || own(html).includes(item),
				),
				`${p.phone} ${screen}`,
			)
			// A side's tile and a title's poster fill what is left of the picture; the drive script measures them in
			// the browser. Every other item is a key with its height from the rule.
			const keys = ids(html).filter(
				(item) => !item.startsWith("side:") && !item.startsWith("title:"),
			)
			for (const item of keys) {
				const height = heightOf(html, item)
				assert.ok(
					height * p.scale >= 44,
					`${p.phone} ${screen} ${item}: ${height} canvas px at ${p.scale}`,
				)
			}
		}
	// The band's two rows are each 44 px or more on every phone.
	const narrow = rendered.phones[0]
	assert.ok(heightOf(narrow.quiz.html, "level:7") * narrow.scale >= 44)
	assert.ok(heightOf(narrow.quiz.html, "score:7") * narrow.scale >= 44)
})

test("on the phone the last row ends with the Expand key, with or without Rate titles", () => {
	for (const p of rendered.phones) {
		// The sides: Rate titles and the Expand key share a row (a member) under the tiles; never a corner.
		assert.equal(count(p.sides.html, 'data-tv-item="expand"'), 1, p.phone)
		assert.ok(!p.sides.html.includes("data-tv-expand-place"), p.phone)
	}
	for (const p of rendered.phones)
		for (const screen of ["picks"] as const) {
			const foot = phoneFoot(p[screen].html)
			assert.ok(foot, `${p.phone} ${screen}`)
			assert.ok(
				(foot?.height ?? 0) * p.scale >= 44,
				`${p.phone} ${screen}: a key tall`,
			)
			assert.ok(
				!p[screen].html.includes("data-tv-expand-place"),
				`${p.phone} ${screen}`,
			)
		}
	// A side's list has no key in that row, and the row is still there, with the Expand key.
	const side = phoneFoot(rendered.taste.side.phone.html)
	assert.ok(side)
	assert.ok(!/data-tv-item=/.test(side?.before ?? "x"))
})

test("a screen in a chunk of its own is not in the server's HTML: its bar alone is, and no h1", () => {
	// With the Expand key where the screen has a page: a focus that came back to it is on something.
	assert.deepEqual(ids(rendered.first.quiz), ["expand", ...NAV])
	for (const html of [
		rendered.first.taste,
		rendered.first.side,
		rendered.first.tasteWithData,
	])
		assert.deepEqual(ids(html), ["expand", ...BAR])
	for (const html of Object.values(rendered.first)) {
		assert.ok(!html.includes("<template"))
		assert.equal(count(html, "<h1"), 0)
		assert.ok(!html.includes("more liked to your taste"))
	}
})
