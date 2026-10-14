// Taste, a side's screen, the taste quiz and the rating as they are drawn: the items in the markup are the
// machine's, in its order, in both editions; the rating strip is the app's levels from low to high with the ten
// exact scores on the desktop and without them on the phone; and the Expand key's corner stays free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import { scoreLabels } from "../../../utils/ratings.ts"
import { RATING_LEVELS } from "../../taste-quiz/quiz-flow.ts"

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
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
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
		| "more"
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
const heightOf = (html: string, id: string) =>
	Number(/(?:^|;)height:(\d+)px/.exec(styleOf(html, id))?.[1] ?? Number.NaN)
const count = (html: string, part: string) => html.split(part).length - 1
/** A screen's own items and its bar's, without the Expand key: for the lists written out here. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
const BAR = ["bar:back", "bar:search", "bar:menu"]
const LEVELS = RATING_LEVELS.map((level) => `level:${level.score}`)
const SCORES = Array.from({ length: 10 }, (_, at) => `score:${at + 1}`)
const EDITIONS = ["desktop", "phone"] as const
const all = <K extends string>(group: Record<K, Editions>) =>
	(Object.entries(group) as [K, Editions][]).flatMap(([name, screen]) =>
		EDITIONS.map((edition) => ({ name, edition, ...screen[edition] })),
	)

test("every screen's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of [
		...all(rendered.taste),
		...all(rendered.quiz),
		...all(rendered.rate),
	])
		assert.deepEqual(
			ids(screen.html),
			screen.items,
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

test("Taste before five scores: the words, how many are rated, and the way into the quiz", () => {
	const { start, started } = rendered.taste
	for (const edition of EDITIONS) {
		assert.deepEqual(drawn(start[edition].items), ["start-quiz", ...BAR])
		assert.match(start[edition].html, />Rate 5 titles you&#x27;ve seen\.</)
		assert.match(
			start[edition].html,
			/>0 of 5 rated\. Then GoodWatch knows your taste\.</,
		)
		assert.match(start[edition].html, />Start rating</)
		assert.match(started[edition].html, />3 of 5 rated\./)
		assert.match(started[edition].html, />Keep rating</)
	}
	// The first title the quiz will ask about is the picture, once the quiz knows it.
	assert.equal(count(start.desktop.html, "<img"), 0)
	assert.equal(count(started.desktop.html, "/t/p/w1280/next.jpg"), 1)
	assert.equal(count(started.phone.html, "/t/p/w780/next.jpg"), 1)
})

test("Taste while the portrait is read keeps its one key", () => {
	for (const edition of EDITIONS) {
		const { html, items } = rendered.taste.reading[edition]
		assert.deepEqual(drawn(items), ["start-quiz", ...BAR])
		assert.match(html, />Reading your taste\.</)
		assert.match(html, />Rate more</)
	}
})

test("the sides are tiles, two to four of them, counted in the bar, with Rate more after them", () => {
	const { two, three, four } = rendered.taste
	for (const [screen, word, sides] of [
		[two, "Two", 2],
		[three, "Three", 3],
		[four, "Four", 4],
	] as const)
		for (const edition of EDITIONS) {
			const { html, items } = screen[edition]
			assert.match(html, new RegExp(`>${word} sides of you<`))
			assert.equal(
				items.filter((item) => item.startsWith("side:")).length,
				sides,
			)
			assert.deepEqual(drawn(items).slice(sides), ["start-quiz", ...BAR])
			assert.match(html, />Rate more</)
		}
	assert.match(three.desktop.html, />Slow-burning crime stories</)
	assert.match(three.desktop.html, />Warm comedies</)
	// The desktop's tiles say their line; the phone says the focused side's over the tiles.
	assert.equal(count(three.desktop.html, ">Line of "), 3)
	assert.equal(count(three.phone.html, ">Line of "), 1)
	assert.match(three.phone.html, />Line of dark-crime\.</)
})

test("the picture and the phone's line follow the focused side, and stay while the focus is on the bar", () => {
	const { three, threeSecond, threeOnBar } = rendered.taste
	assert.equal(count(three.desktop.html, "/t/p/w1280/side-dark-crime.jpg"), 1)
	assert.equal(
		count(threeSecond.desktop.html, "/t/p/w1280/side-gentle-comedy.jpg"),
		1,
	)
	assert.match(threeSecond.phone.html, />Line of gentle-comedy\.</)
	assert.equal(
		count(threeOnBar.desktop.html, "/t/p/w1280/side-dark-crime.jpg"),
		1,
	)
	// A tile's own picture is the small file, once per tile.
	assert.equal(count(three.desktop.html, "/t/p/w780/side-"), 3)
})

test("four sides stand two by two on the phone, and side by side on the desktop", () => {
	const { three, four } = rendered.taste
	assert.match(four.phone.html, /grid-template-columns:repeat\(2,/)
	assert.match(three.phone.html, /grid-template-columns:repeat\(3,/)
	assert.match(four.desktop.html, /grid-template-columns:repeat\(4,/)
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
			...BAR,
		])
		assert.match(html, />Slow-burning crime stories</)
		assert.match(html, />Title 10</)
		assert.match(html, />2019 · Movie · 810 score · You gave it 10</)
		// The shared list's posters: the small file on the phone.
		assert.equal(
			count(html, `/t/p/${edition === "phone" ? "w185" : "w342"}/poster-`),
			4,
		)
		// No Rate more here.
		assert.ok(!html.includes("Rate more"))
		// There can be fewer than four.
		assert.deepEqual(drawn(sideShort[edition].items), [
			"title:movie-20",
			"title:movie-21",
			...BAR,
		])
		// A side the portrait no longer has: the bar, and words.
		assert.deepEqual(drawn(sideGone[edition].items), BAR)
		assert.match(
			sideGone[edition].html,
			/>This side of you isn&#x27;t there any more\.</,
		)
	}
	assert.equal(count(side.desktop.html, "/t/p/w1280/backdrop-10.jpg"), 1)
	assert.equal(count(side.phone.html, "/t/p/w780/backdrop-10.jpg"), 1)
})

test("five scores and no sides yet: the quiz's picks as Made for you, four of them, with Rate more", () => {
	const { picks, picksSecond, picksWaiting, picksNone } = rendered.taste
	for (const edition of EDITIONS) {
		const { html, items } = picks[edition]
		assert.deepEqual(drawn(items), [
			"title:show-901",
			"title:show-902",
			"title:show-903",
			"title:show-904",
			"start-quiz",
			...BAR,
		])
		assert.match(html, />Made for you</)
		assert.match(html, />Title 1</)
		assert.match(html, />Rate more</)
		assert.match(picksSecond[edition].html, />Title 2</)
		// Without picks the screen says why, and Rate more is still there.
		for (const [screen, words] of [
			[picksWaiting, "Your picks are on their way."],
			[picksNone, "No picks right now. Rate a few more titles."],
		] as const) {
			assert.deepEqual(drawn(screen[edition].items), ["start-quiz", ...BAR])
			assert.ok(screen[edition].html.includes(`>${words}<`))
			assert.equal(screen[edition].focus, "start-quiz")
		}
	}
})

test("the Expand key stands in its corner on Taste and a side, and the quiz and the rating have none", () => {
	for (const screen of all(rendered.taste)) {
		assert.match(
			screen.html,
			/<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*aria-label="Expand"[^>]*>.*?Expand<\/button><\/div>/,
			`${screen.name} ${screen.edition}`,
		)
		assert.ok(screen.items.includes("expand"))
		assert.equal(count(screen.html, 'data-tv-item="expand"'), 1)
	}
	for (const screen of [...all(rendered.quiz), ...all(rendered.rate)]) {
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

test("the strip on the phone: the four levels alone, as equal keys in one row, without the exact scores", () => {
	for (const { items, html } of [
		rendered.quiz.asking.phone,
		rendered.rate.fresh.phone,
	]) {
		assert.deepEqual(
			items.filter((item) => item.startsWith("level:")),
			LEVELS,
		)
		assert.equal(items.filter((item) => item.startsWith("score:")).length, 0)
		assert.equal(count(html, 'data-tv-item="score:'), 0)
		assert.match(html, /grid-template-columns:repeat\(4,/)
		for (const level of RATING_LEVELS) {
			assert.ok(html.includes(`>${level.name}<`))
			// No range, and no span: the keys are equal.
			assert.ok(!html.includes(`>${level.lo}–${level.hi}<`))
			assert.ok(!styleOf(html, `level:${level.score}`).includes("grid-column"))
		}
	}
})

test("a line says what the focus would give, on a level and on an exact score", () => {
	const { asking, onScore, onLevel, onSkip } = rendered.quiz
	assert.match(asking.desktop.html, />Good · OK gives it 7</)
	assert.match(asking.phone.html, />Good · gives 7</)
	assert.match(onLevel.desktop.html, />Bad · OK gives it 3</)
	assert.match(onScore.desktop.html, />8 · Great</)
	// Off the strip the line is the quiz's question.
	assert.match(onSkip.desktop.html, />2005 · Show\. Have you seen it\?</)
	assert.match(onSkip.phone.html, />2005 · Show\. Have you seen it\?</)
	// The phone has no exact score to focus: its focus falls back to Good.
	assert.equal(onScore.phone.focus, "level:7")
})

test("the level the focus is in lights its scores; the focused score is at full colour", () => {
	const alpha = (html: string, score: number) =>
		/background:#[0-9a-f]{6}([0-9a-f]{2})?/i.exec(
			styleOf(html, `score:${score}`),
		)?.[1] ?? ""
	const good = rendered.quiz.asking.desktop.html
	assert.deepEqual(
		[6, 7, 8, 9].map((score) => alpha(good, score)),
		["30", "88", "88", "30"],
	)
	const eight = rendered.quiz.onScore.desktop.html
	assert.deepEqual(
		[6, 7, 8, 9].map((score) => alpha(eight, score)),
		["30", "88", "", "30"],
	)
	// With the focus off the strip every score is lit the same.
	const off = rendered.quiz.onSkip.desktop.html
	assert.deepEqual(
		[1, 5, 8, 10].map((score) => alpha(off, score)),
		["55", "55", "55", "55"],
	)
})

test("the quiz asks about one title: its name, how far the person is, and Haven't seen it as its own key", () => {
	const { asking, more, long, waiting, none } = rendered.quiz
	for (const edition of EDITIONS) {
		const { html, items } = asking[edition]
		assert.match(html, />Taste · 2 of 5 rated</)
		assert.match(html, />The Office</)
		assert.equal(drawn(items).at(-4), "skip")
		assert.match(html, /data-tv-item="skip"[^>]*>Haven&#x27;t seen it</)
		assert.match(more[edition].html, />Taste · 7 rated</)
		assert.match(
			long[edition].html,
			/line-clamp-2[^>]*>The Lord of the Rings: The Fellowship of the Ring</,
		)
		// Without a title to ask about there is no strip, only the bar and words.
		assert.deepEqual(drawn(waiting[edition].items), BAR)
		assert.match(waiting[edition].html, />Finding titles you may have seen\.</)
		assert.deepEqual(drawn(none[edition].items), BAR)
		assert.match(
			none[edition].html,
			/>No more titles to ask about right now\.</,
		)
	}
	assert.equal(count(asking.desktop.html, "/t/p/w1280/office.jpg"), 1)
	assert.equal(count(asking.phone.html, "/t/p/w780/office.jpg"), 1)
})

test("the rating is the same strip without Haven't seen it, and marks the score the title has", () => {
	const { fresh, again, againOnIt, againOnLevel } = rendered.rate
	for (const edition of EDITIONS) {
		assert.match(fresh[edition].html, />Seen it</)
		assert.match(fresh[edition].html, />How was The Matrix\?</)
		assert.ok(!ids(fresh[edition].html).includes("skip"))
		assert.ok(!fresh[edition].html.includes("inset 0 0 0 3px"))
	}
	// Rated 8 before: Good is marked in its colour, and the 8 has a white edge. The focus is on Good, whose own
	// look goes first, so the level's mark shows once the focus is elsewhere.
	assert.match(styleOf(again.desktop.html, "score:8"), /inset 0 0 0 3px #fff/)
	assert.ok(!styleOf(again.desktop.html, "level:7").includes("inset"))
	assert.match(
		styleOf(againOnIt.desktop.html, "level:7"),
		/box-shadow:inset 0 0 0 3px #/,
	)
	assert.ok(!styleOf(againOnIt.desktop.html, "score:8").includes("inset"))
	assert.ok(!styleOf(againOnLevel.desktop.html, "level:9").includes("inset"))
	// The phone marks the level: it has no exact score.
	assert.match(
		styleOf(rendered.rate.againOnIt.phone.html, "level:7"),
		/^height:\d+px$/,
	)
})

test("on every phone of the room's table every key is 44 px or more on the phone's screen", () => {
	assert.deepEqual(
		rendered.phones.map((p) => p.phone),
		["360x740", "375x667", "390x700", "390x844", "430x932", "844x390"],
	)
	for (const p of rendered.phones)
		for (const screen of ["start", "sides", "picks", "quiz", "rate"] as const) {
			const { html, items } = p[screen]
			assert.deepEqual(ids(html), items, `${p.phone} ${screen}`)
			// A side's tile and a title's poster fill what is left of the picture; the drive script measures them in
			// the browser. Every other item is a key with its height from the rule.
			const keys = items.filter(
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
	// The strip's levels are 68 canvas px tall, 45 px or more on every phone.
	const narrow = rendered.phones[0]
	assert.equal(heightOf(narrow.quiz.html, "level:7"), 68)
	assert.ok(68 * narrow.scale >= 45)
})

test("on the phone the last row keeps the Expand key's corner free, with or without Rate more", () => {
	for (const p of rendered.phones)
		for (const screen of ["sides", "picks"] as const)
			assert.match(
				p[screen].html,
				/pr-\[158px\]" style="height:\d+px"/,
				`${p.phone} ${screen}`,
			)
	// A side's list has no key in that row, and the row is still there.
	assert.match(
		rendered.taste.side.phone.html,
		/pr-\[158px\]" style="height:\d+px"><\/div>/,
	)
})

test("a screen in a chunk of its own is not in the server's HTML: its bar alone is, and no h1", () => {
	// With the Expand key where the screen has a page: a focus that came back to it is on something.
	assert.deepEqual(ids(rendered.first.quiz), BAR)
	for (const html of [
		rendered.first.taste,
		rendered.first.side,
		rendered.first.tasteWithData,
	])
		assert.deepEqual(ids(html), ["expand", ...BAR])
	for (const html of Object.values(rendered.first)) {
		assert.ok(!html.includes("<template"))
		assert.equal(count(html, "<h1"), 0)
		assert.ok(!html.includes("Rate 5 titles"))
	}
})
