// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { titleQuestions } = await import("./titleQuestions.ts")

const show = (details: Record<string, unknown>) =>
	({
		mediaType: "show",
		details: {
			title: "DAS!",
			genres: [],
			keywords: [],
			tropes: [],
			age_certifications: [],
			number_of_seasons: 36,
			number_of_episodes: 4000,
			...details,
		},
		fingerprint: null,
		streaming_availabilities: [],
		streaming_services: [],
	}) as never

const lengthOf = (media: never) =>
	titleQuestions(media, "US").find((faq) => faq.id === "length")?.a

test("a show's length answer names the episode length from episode_runtime", () => {
	assert.equal(
		lengthOf(show({ episode_runtime: [45] })),
		"It has 36 seasons with 4000 episodes of about 45 minutes each.",
	)
})

test("a show without an episode length leaves that part out", () => {
	for (const episode_runtime of [null, undefined, []])
		assert.equal(
			lengthOf(show({ episode_runtime })),
			"It has 36 seasons with 4000 episodes.",
		)
})

const { fingerprintAnswers } = await import("./fingerprintQuestions.ts")
const { matrix, toyStory, breakingBad } = await import(
	"./fingerprint/titles.test-support.ts"
)

// A title page payload around one of the fixture fingerprints.
const withFingerprint = (t: typeof matrix) =>
	({
		mediaType: t.mediaType,
		details: {
			title: t.title,
			genres: t.genres,
			keywords: [],
			tropes: [],
			age_certifications: [],
			runtime: 136,
			number_of_seasons: 5,
			number_of_episodes: 62,
		},
		fingerprint: t.fingerprint,
		streaming_availabilities: [],
		streaming_services: [],
	}) as never

const answers = (t: typeof matrix) =>
	Object.fromEntries(
		fingerprintAnswers(withFingerprint(t)).map((x) => [x.id, x.a]),
	)

test("the six fingerprint questions follow the first facts, for every title with a fingerprint", () => {
	const ids = titleQuestions(withFingerprint(matrix), "US").map((faq) => faq.id)
	assert.deepEqual(
		ids.slice(ids.indexOf("length"), ids.indexOf("length") + 7),
		["length", "laugh", "drive", "halfWatch", "date", "scare", "feelGood"],
	)
	const questions = titleQuestions(withFingerprint(matrix), "US")
	assert.equal(
		questions.find((faq) => faq.id === "laugh")?.q,
		"Will The Matrix make me laugh?",
	)
	assert.equal(
		questions.find((faq) => faq.id === "feelGood")?.q,
		"Will I feel good after watching The Matrix?",
	)
})

test("a title without a fingerprint gets no fingerprint questions", () => {
	const ids = titleQuestions(show({}), "US").map((faq) => faq.id)
	for (const id of ["laugh", "drive", "halfWatch", "date", "scare", "feelGood"])
		assert.ok(!ids.includes(id as never))
})

test("the fingerprint answers read the traits behind them", () => {
	assert.deepEqual(answers(matrix), {
		laugh: "A little. The humor is mostly sharp wit.",
		drive:
			"Mostly plot-driven. Intrigue and spectacle carry it more than its characters do.",
		halfWatch:
			"No, it needs your attention. The plot is layered, and it's easy to lose the thread.",
		date: "Yes. Our viewing guide lists it for date night. Romance plays a supporting part.",
		scare: "Barely. The scares are mild. It's tense rather than scary.",
		feelGood: "Mixed feelings. It balances dark and hopeful moments.",
	})
	assert.deepEqual(answers(toyStory), {
		laugh: "A little. The humor is mostly slapstick and situational comedy.",
		drive: answers(toyStory).drive,
		halfWatch: "Yes. It's easy to follow.",
		date: "It's better for a family night. Our viewing guide lists it for kids and families, and it also works for couples.",
		scare: "No.",
		feelGood: "Yes. It's an uplifting movie that leaves you hopeful.",
	})
	assert.match(
		answers(breakingBad).feelGood,
		/^Probably not\. Its tone is bleak/,
	)
})

test("each fingerprint answer has a visual and the traits behind it", () => {
	const byId = Object.fromEntries(
		fingerprintAnswers(withFingerprint(matrix)).map((x) => [x.id, x]),
	)
	assert.deepEqual(byId.laugh.visual, {
		kind: "meter",
		tier: 2,
		area: "Humor",
		word: "Light",
	})
	assert.equal(byId.drive.visual.kind, "slider")
	assert.deepEqual(
		byId.drive.evidence.map((ev) => ev.side),
		["Characters", "Plot"],
	)
	// Date night highlights the flags the answer rests on.
	assert.deepEqual(byId.date.visual, {
		kind: "chips",
		items: matrix.fingerprint.socialSuitability.map((x) => x.name),
		highlighted: ["Date Night", "Partner Watch"],
	})
	for (const x of Object.values(byId))
		for (const ev of x.evidence) assert.ok(ev.traits.length > 0)
})

test("the area details header, the area's slider, and the FAQ humor meter use the same level word for every tier", async () => {
	const { AREAS, areaLevelWord } = await import("./fingerprint/areas.ts")
	const { readScale, scalesOf } = await import("./fingerprint/scales.ts")
	for (const area of AREAS)
		for (const tier of [0, 1, 2, 3, 4]) {
			const t = {
				...matrix,
				fingerprint: {
					...matrix.fingerprint,
					pillars: { ...matrix.fingerprint.pillars, [area]: tier },
				},
			}
			const slider = scalesOf(area).find((sc) => sc.name === area)
			assert.ok(slider, `${area} has a slider`)
			const header = areaLevelWord(area, tier)
			assert.equal(readScale(slider, t).word, header, `${area} tier ${tier}`)
			if (area !== "Humor") continue
			const laugh = fingerprintAnswers(withFingerprint(t)).find(
				(answer) => answer.id === "laugh",
			)
			assert.deepEqual(laugh?.visual, {
				kind: "meter",
				tier,
				area: "Humor",
				word: header,
			})
		}
})
