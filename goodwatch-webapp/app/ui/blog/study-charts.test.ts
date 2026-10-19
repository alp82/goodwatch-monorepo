import assert from "node:assert/strict"
import test from "node:test"
import posts from "../../content/blog/posts.json" with { type: "json" }
import data from "../../content/blog/streaming-by-country-2026/data.json" with {
	type: "json",
}
import { STATIC_PAGE_COPY, SUBTEXT_MAX_LENGTH } from "../og-image/copy.ts"
import {
	CHART_WIDTH,
	LABEL_WIDTH,
	barPath,
	layoutBars,
} from "./ranked-bars-layout.ts"
import {
	CHART_IDS,
	type StudyData,
	aboutShare,
	chartSpec,
	pickCountries,
} from "./study-charts.ts"

const study = data as unknown as StudyData

test("a share reads as the nearest simple fraction", () => {
	assert.equal(aboutShare(3478, 4683), "about 3 in 4")
	assert.equal(aboutShare(633, 4683), "about 1 in 7")
	assert.equal(aboutShare(1924, 4683), "about 2 in 5")
	assert.equal(aboutShare(0, 0), "about 1 in 10")
})

test("a bar is square at the baseline with a 4 px rounded end", () => {
	assert.equal(
		barPath(108, 10, 100, 11),
		"M108,10h96a4,4 0 0 1 4,4v3a4,4 0 0 1 -4,4h-96z",
	)
	// A bar too short to round fully still draws.
	assert.match(barPath(108, 10, 1, 11), /^M108,10h1a1,1/)
})

test("bars fit the 358-unit chart and keep room for their values", () => {
	const layout = layoutBars(
		[
			{ code: "A", label: "A", value: 4000 },
			{ code: "B", label: "B", value: 10 },
		],
		{ scale: 4000, steps: 2 },
	)
	assert.equal(layout.width, CHART_WIDTH)
	for (const bar of layout.bars) {
		assert.ok(
			bar.valueX + 40 <= CHART_WIDTH,
			"the value label fits after the bar",
		)
		assert.ok(bar.width >= 2)
	}
	assert.deepEqual(
		layout.ticks.map((t) => [t.value, t.anchor]),
		[
			[0, "start"],
			[2000, "middle"],
			[4000, "end"],
		],
	)
	assert.equal(layout.ticks[0].x, LABEL_WIDTH)
})

test("one highlighted row puts the others in gray", () => {
	const layout = layoutBars(
		[
			{ code: "US", label: "United States", value: 5, highlight: true },
			{ code: "CH", label: "Switzerland", value: 8 },
		],
		{ scale: 10, steps: 2 },
	)
	assert.deepEqual(
		layout.bars.map((b) => b.accent),
		[true, false],
	)
})

test("the charts pick the top, the bottom and the always-shown countries", () => {
	const countries = study.countries.filter((c) => c.major)
	const picked = pickCountries(countries, (c) => c.movies?.netflix ?? 0)
	for (const code of ["US", "GB", "DE", "FR", "JP", "IN", "BR"])
		assert.ok(
			picked.some((c) => c.code === code),
			code,
		)
	const values = picked.map((c) => c.movies?.netflix ?? 0)
	assert.deepEqual(
		values,
		[...values].sort((a, b) => b - a),
		"highest first",
	)
})

test("every chart's answer names the numbers its bars show", () => {
	for (const id of CHART_IDS) {
		const spec = chartSpec(study, id)
		assert.ok(spec.rows.length >= 15, `${id} has rows`)
		assert.ok(spec.question.endsWith("?"), `${id} asks a question`)
		assert.ok(
			spec.rows.every((r) => r.value <= spec.scale),
			`${id} fits its scale`,
		)
		const shown = spec.rows.map((r) => r.value.toLocaleString("en-US"))
		const named = spec.answer.match(/\d{1,3}(?:,\d{3})*/g) ?? []
		assert.ok(
			named.some((n) => shown.includes(n)),
			`${id}: the answer quotes a bar (${spec.answer})`,
		)
		assert.ok(spec.note.includes(study.snapshot.date), `${id} dates its source`)
	}
})

test("the downloads stay out of /blog, or /blog would be a folder that redirects to /blog/", () => {
	assert.ok(!study.csv.base.startsWith("/blog"), study.csv.base)
	assert.equal(study.csv.base, `/downloads/${study.slug}`)
})

test("the Netflix chart highlights the United States", () => {
	const spec = chartSpec(study, "netflix")
	assert.deepEqual(
		spec.rows.filter((r) => r.highlight).map((r) => r.code),
		["US"],
	)
})

test("every post has its own Open Graph card copy", () => {
	for (const post of posts) {
		const copy = STATIC_PAGE_COPY[`/blog/${post.slug}`]
		assert.ok(copy, post.slug)
		assert.ok(
			copy.subtitle.length <= SUBTEXT_MAX_LENGTH,
			`${post.slug} subtitle fits`,
		)
		assert.equal(copy.title, post.title, "the card says the post's title")
	}
	assert.ok(STATIC_PAGE_COPY["/blog"])
})
