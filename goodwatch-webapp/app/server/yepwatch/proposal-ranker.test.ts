import test from "node:test"
import assert from "node:assert/strict"
import { rankingSnapshot } from "./proposal-ranking-test-support.ts"
import {
	rankDeck,
	groupTaste,
	candidateReason,
	ideaFit,
	RANK_WEIGHTS,
	type RankInput,
} from "./proposal-ranker.ts"
import { qualityPriors, unitFingerprint, roomJitter } from "./proposal-pool.ts"
import { FEEDBACK_RANK_HEAD } from "./proposal-feedback.ts"
import type { PersonSignal } from "./proposal-person-signal.ts"
export const person = (vector: number[], confidence = 1): PersonSignal => ({
	vector: Float32Array.from([...vector, ...Array(74).fill(0)].slice(0, 74)),
	quantiles: Float32Array.from([
		...Array.from({ length: 100 }, (_, i) => i / 100),
		...Array.from({ length: 9 }, (_, i) => (991 + i) / 1000),
		...Array.from({ length: 9 }, (_, i) => (9991 + i) / 10000),
		1,
	]),
	confidence,
	unseen: new Set(),
	source: "member",
	snapshotVersion: "fixture",
})
const input = (): RankInput => ({
	snapshot: rankingSnapshot([
		{ key: 1e12 + 1, fp: [10, 0] },
		{ key: 1e12 + 2, fp: [7, 7] },
		{ key: 1e12 + 3, fp: [0, 10] },
	]),
	pool: [1e12 + 1, 1e12 + 2, 1e12 + 3],
	people: [],
	ideas: [],
	wishlist: new Map(),
	excluded: new Set(),
	seed: "couch",
	peopleCount: 2,
})
test("least misery ranks moderate mutual fit above one beloved/one hated; veto only applies to first page", () => {
	const i = input()
	i.people = [person([1, 0]), person([0, 1])]
	assert.ok(
		groupTaste(i.snapshot, 1e12 + 2, i.people).taste >
			groupTaste(i.snapshot, 1e12 + 1, i.people).taste,
	)
	assert.deepEqual(
		rankDeck(i, 20).map((r) => r.key),
		[1e12 + 2],
	)
	assert.equal(rankDeck({ ...i, refill: true }, 20).length, 3)
	assert.equal(groupTaste(i.snapshot, 1e12 + 1, [person([0, 1], 0.1)]).minimum, 0.45)
	assert.equal(groupTaste(i.snapshot, 1e12 + 1, [person([0, 1], 0)]).count, 0)
	const missing = rankingSnapshot([{ key: 1e12 + 1, fp: null }])
	assert.equal(groupTaste(missing, 1e12 + 1, [person([0, 1])]).minimum, 0.5)
	assert.equal(groupTaste(missing, 1e12 + 1, [person([0, 1])]).veto, false)
})
test("weights, exclusions, Want to See, repeat Nopes and deterministic seed", () => {
	const i = input(),
		baseline = rankDeck(i, 20)
	assert.deepEqual(rankDeck(i, 20), baseline)
	assert.notDeepEqual(
		rankDeck({ ...i, seed: "different" }, 20).map((r) => r.score),
		baseline.map((r) => r.score),
	)
	assert.equal(
		rankDeck({ ...i, excluded: new Set([1e12 + 1]) }, 20).some((r) => r.key === 1e12 + 1),
		false,
	)
	const boosted = rankDeck({ ...i, wishlist: new Map([[1e12 + 3, 2]]) }, 20).find(
		(r) => r.key === 1e12 + 3,
	)!
	const original = baseline.find((r) => r.key === boosted.key)!
	assert.ok(Math.abs(boosted.score - original.score - RANK_WEIGHTS.wishlist) < 1e-9)
	const withTaste = { ...i, people: [person([0, 1])] }
	const before = rankDeck(withTaste, 20).find((r) => r.key === 1e12 + 3)!
	const repeat = rankDeck({ ...withTaste, nopeProfiles: [new Set([1e12 + 3])] }, 20).find(
		(r) => r.key === 1e12 + 3,
	)!
	assert.ok(Math.abs(repeat.score - before.score + 0.1) < 1e-9)
	assert.ok(Math.abs(repeat.parts.repeat + 0.1) < 1e-9)
	assert.equal(original.parts.repeat, 0)
})
test("ideas steer with wants/avoids and each idea gets its highest scoring remaining titles early", () => {
	const dimensions = new Map([["romance", 0]])
	assert.equal(ideaFit(undefined, 2, ["romance"], [], Uint8Array.of(7), dimensions), 0.1)
	assert.equal(ideaFit(0, 2, [], ["romance"], Uint8Array.of(7), dimensions), 0.7)
	const i = input()
	i.ideas = [
		{ id: "a", nickname: "Mia", rankedKeys: [1e12 + 3], wants: [], avoids: [] },
		{ id: "b", nickname: "Joe", rankedKeys: [1e12 + 1], wants: [], avoids: [] },
	]
	const ranked = rankDeck(i, 20)
	assert.deepEqual(
		ranked.slice(0, 2).map((r) => r.key),
		[1e12 + 3, 1e12 + 1],
	)
	assert.equal(ranked[0].reason.text, "Fits Mia's idea")
	assert.equal(
		rankDeck({ ...i, ideas: [] }, 20).some((r) => r.reason.code === "fits_idea"),
		false,
	)
})
test("diversity prevents four same-kind cards when both kinds are available", () => {
	const titles = Array.from({ length: 12 }, (_, i) => ({
		key: (i < 8 ? 1e12 : 2e12) + i + 1,
		fp: i < 8 ? [10, 0] : [0, 10],
	}))
	const i = { ...input(), snapshot: rankingSnapshot(titles), pool: titles.map((t) => t.key) }
	const keys = rankDeck(i, 12).map((r) => r.key)
	for (let n = 3; n < 8; n++)
		assert.ok(new Set(keys.slice(n - 3, n + 1).map((k) => k >= 2e12)).size > 1)
})
test("reason precedence and privacy, including the three-person Want to See gate", () => {
	const base = {
		wishlist: 1,
		peopleCount: 3,
		tasteCount: 3,
		minimum: 0.9,
		idea: 0.8,
		nickname: "Mia",
		short: true,
		service: "Prime Video",
		score: 90,
	}
	const cases = [
		[base, "want_to_see", "On someone's Want to See list"],
		[{ ...base, peopleCount: 2 }, "fits_everyone", "Fits all 3 of you"],
		[{ ...base, wishlist: 0, minimum: 0.6 }, "fits_idea", "Fits Mia's idea"],
		[
			{ ...base, wishlist: 0, tasteCount: 1, idea: 0 },
			"close_to_your_taste",
			"Close to your taste",
		],
		[
			{ ...base, wishlist: 0, tasteCount: 0, idea: 0 },
			"short_episodes",
			"Short episodes, easy to start",
		],
		[
			{ ...base, wishlist: 0, tasteCount: 0, idea: 0, short: false },
			"on_service_for_everyone",
			"On Prime Video for everyone",
		],
		[
			{ ...base, wishlist: 0, tasteCount: 0, idea: 0, short: false, service: undefined },
			"well_liked",
			"Well liked on GoodWatch",
		],
		[
			{ ...base, wishlist: 0, tasteCount: 0, idea: 0, short: false, service: undefined, score: 70 },
			"popular_now",
			"Popular right now",
		],
	] as const
	for (const [values, code, text] of cases) {
		const reason = candidateReason(values)
		assert.deepEqual(reason, { code, text })
		assert.ok(reason.text.length <= 80)
		if (code !== "fits_idea") assert.equal(reason.text.includes("Mia"), false)
	}
})
// Speed is checked on demand only (owner 2026-11-14): YEPWATCH_SPEED=1 runs the two budget tests.
const speed = { skip: process.env.YEPWATCH_SPEED !== "1" }
test("3000 titles and 12 tastes: measure warm rank budget", speed, () => {
	const titles = Array.from({ length: 3000 }, (_, i) => ({
		key: (i % 2 ? 1e12 : 2e12) + i + 1,
		fp: [5 + (i % 6), 5 + ((i * 3) % 6)],
	}))
	const snapshot = rankingSnapshot(titles),
		quality = qualityPriors(
			snapshot,
			titles.map((t) => t.key),
		),
		i = {
			...input(),
			snapshot,
			quality,
			pool: titles.map((t) => t.key),
			people: Array.from({ length: 12 }, () => person([0.707, 0.707])),
			peopleCount: 12,
		}
	for (let n = 0; n < 20; n++) rankDeck(i, 200)
	const times = Array.from({ length: 5 }, () => {
		const start = performance.now()
		rankDeck(i, 200)
		return performance.now() - start
	}).sort((a, b) => a - b)
	console.info(JSON.stringify({ event: "test_rank_speed", medianMs: times[2], targetMs: 10 }))
	assert.ok(
		times[2] < 10,
		"prepared pool supplies cached quality priors; warm rank budget is 10 ms",
	)
})
test("feedback promotes Yep neighbors and demotes group Nope neighbors only in the pre-feedback head", () => {
	const titles = Array.from({ length: 400 }, (_, i) => ({
		key: 1e12 + i + 1,
		fp: i % 2 ? [10, 0] : [0, 10],
	}))
	const i = {
		...input(),
		snapshot: rankingSnapshot(titles),
		pool: titles.map((t) => t.key),
		refill: true,
	}
	const baseline = rankDeck(i, 400),
		contenders = new Set(baseline.slice(0, FEEDBACK_RANK_HEAD).map((r) => r.key))
	// These full weights are the feedback classes produced by multiple people's votes.
	const feedback = {
		yeps: [{ vector: unitFingerprint(i.snapshot, 1e12 + 2)!, weight: 1 }],
		nopes: [{ vector: unitFingerprint(i.snapshot, 1e12 + 1)!, weight: 1 }],
	}
	const ranked = rankDeck({ ...i, feedback }, 400)
	for (const original of baseline) {
		const changed = ranked.find((r) => r.key === original.key)!
		const adjustment = contenders.has(original.key) ? (original.key % 2 === 0 ? 0.12 : -0.15) : 0
		assert.ok(Math.abs(changed.score - original.score - adjustment) < 1e-7)
		assert.ok(Math.abs(changed.parts.feedback - adjustment) < 1e-7)
	}
	assert.ok(
		baseline.some(
			(r, at) =>
				contenders.has(r.key) &&
				r.key % 2 === 0 &&
				ranked.findIndex((next) => next.key === r.key) < at,
		),
	)
})
test(
	"3000 titles, 12 tastes and 120+120 feedback entries: bounded warm refill rank budget",
	speed,
	() => {
		const titles = Array.from({ length: 3000 }, (_, i) => ({
			key: (i % 2 ? 1e12 : 2e12) + i + 1,
			fp: [5 + (i % 6), 5 + ((i * 3) % 6)],
		}))
		const snapshot = rankingSnapshot(titles),
			pool = titles.map((t) => t.key)
		const feedback = {
			yeps: pool
				.slice(0, 120)
				.map((key) => ({ vector: unitFingerprint(snapshot, key)!, weight: 1 })),
			nopes: pool
				.slice(120, 240)
				.map((key) => ({ vector: unitFingerprint(snapshot, key)!, weight: 1 })),
		}
		const i = {
			...input(),
			snapshot,
			pool,
			quality: qualityPriors(snapshot, pool),
			people: Array.from({ length: 12 }, () => person([0.707, 0.707])),
			peopleCount: 12,
			refill: true,
			feedback,
		}
		for (let n = 0; n < 20; n++) rankDeck(i, 200)
		const times = Array.from({ length: 5 }, () => {
			const start = performance.now()
			rankDeck(i, 200)
			return performance.now() - start
		}).sort((a, b) => a - b)
		const budget = process.env.CI ? 30 : 15
		console.info(
			JSON.stringify({
				event: "test_rank_feedback_speed",
				medianMs: times[2],
				targetMs: 15,
				budgetMs: budget,
			}),
		)
		assert.ok(
			times[2] < budget,
			`warm feedback rank budget is ${budget} ms (15 ms target, CI slack)`,
		)
	},
)

test("Nope score penalty leaves raw taste, reasons and vetoes unchanged", () => {
	const i = { ...input(), people: [person([0.1, 0.995])], refill: true }
	const baseline = rankDeck(i, 20)
	const penalized = rankDeck({ ...i, nopeProfiles: [new Set(i.pool)] }, 20)
	for (const before of baseline) {
		const after = penalized.find((r) => r.key === before.key)!
		assert.deepEqual(after.reason, before.reason)
		assert.equal(after.parts.taste, before.parts.taste)
		assert.equal(after.parts.minimum, before.parts.minimum)
		assert.equal(after.veto, before.veto)
		assert.ok(
			Math.abs(before.score - after.score - 0.1) < 1e-12,
			"everyone Noped: exactly 0.1 score drop",
		)
	}
	assert.ok(
		baseline.some((r) => r.veto),
		"fixture includes a raw veto",
	)
	assert.ok(
		baseline.some((r) => !r.veto),
		"fixture includes an eligible title",
	)
})

for (const n of [1, 2, 3, 4]) {
	test(`one Noper among ${n} profiles drops a first-page title by ${0.1 / n} score`, () => {
		// A dense set of plausible top contenders and a broad lower tail. Each title
		// has distinct fingerprint dimensions, avoiding an artificial diversity tie.
		const titles = Array.from({ length: 60 }, (_, at) => ({
			key: 1e12 + at + 1,
			score: 95 - Math.floor(at / 2),
			votes: 100000 - at * 1000,
			fp: Array.from({ length: 74 }, (_, d) => (d === at + 1 ? 10 : 0)),
		}))
		const snapshot = rankingSnapshot(titles)
		const people = Array.from({ length: n }, (_, p) =>
			person(
				Array.from({ length: 74 }, (_, d) =>
					d === 0 ? 0 : d <= 20 ? 0.145 + p * 0.002 - d * 0.0005 : 0.12 - (d - 20) * 0.002,
				),
			),
		)
		// The calibration table maps the cosine spread into realistic percentiles.
		for (const p of people) p.quantiles = Float32Array.from(p.quantiles, (q) => q * 0.19)
		const i = {
			...input(),
			snapshot,
			pool: titles.map((t) => t.key),
			people,
			peopleCount: n,
			nopeProfiles: Array.from({ length: n }, () => new Set<number>()),
		}
		const baseline = rankDeck(i, 60)
		const target = baseline[8]
		assert.ok(baseline.slice(0, 10).some((r) => r.key === target.key))
		assert.ok(
			new Set(baseline.map((r) => r.parts.taste.toFixed(3))).size > 20,
			"realistic spread of taste percentiles",
		)
		assert.ok(
			new Set(i.pool.map((k) => roomJitter(i.seed, k))).size > 20,
			"production room jitter varies across the pool",
		)
		i.nopeProfiles[n - 1].add(target.key) // the highest-fit person, not the minimum
		const penalized = rankDeck(i, 60),
			after = penalized.find((r) => r.key === target.key)!
		assert.ok(
			!penalized.slice(0, 10).some((r) => r.key === target.key),
			"Nope moves the title off the first page",
		)
		assert.ok(Math.abs(target.score - after.score - 0.1 / n) < 1e-12, `score drop = ${0.1 / n}`)
		assert.equal(after.parts.repeat, -0.1 / n)
		console.info(JSON.stringify({ peopleCount: n, scoreDrop: 0.1 / n }))
		const everyone = rankDeck(
			{ ...i, nopeProfiles: i.nopeProfiles.map(() => new Set([target.key])) },
			60,
		).find((r) => r.key === target.key)!
		assert.ok(
			Math.abs(target.score - everyone.score - 0.1) < 1e-12,
			"everyone Noped: exactly 0.1 score drop",
		)
	})
}

// The production taste ranker receives the broad catalog, not roomIntentKeys' filtered list.
test("active ideas strictly constrain the production ranker on Start and refill", () => {
	const i = input()
	const ideas = [
		{
			id: "scifi",
			nickname: "Host",
			rankedKeys: [1e12 + 3],
			wants: [],
			avoids: [],
		},
	]
	for (const refill of [false, true]) {
		const ranked = rankDeck({ ...i, ideas, refill, wishlist: new Map([[1e12 + 1, 2]]) }, 20)
		assert.deepEqual(
			ranked.map((r) => r.key),
			[1e12 + 3],
		)
		assert.deepEqual(rankDeck({ ...i, ideas: [{ ...ideas[0], rankedKeys: [] }], refill }, 20), [])
	}
	assert.equal(rankDeck(i, 20).length, 3, "turning all ideas off explicitly broadens the deck")
})

test("nonmatching titles cannot consume the ranker scan budget before idea results", () => {
	const i = input(),
		key = 1e12 + 3
	const pool = [...Array.from({ length: 4000 }, (_, n) => 1e12 + 100 + n), key]
	const ideas = [{ id: "scifi", nickname: "Host", rankedKeys: [key], wants: [], avoids: [] }]
	assert.deepEqual(
		rankDeck({ ...i, pool, ideas }, 20).map((r) => r.key),
		[key],
	)
})
