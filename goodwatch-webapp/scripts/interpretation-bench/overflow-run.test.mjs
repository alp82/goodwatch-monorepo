import assert from "node:assert/strict"
import { test } from "node:test"
import {
	SpendGuard,
	inference,
	rateFilter,
	validateModels,
} from "./overflow-run.mjs"
import { loadProduction } from "./production.mjs"
const api = await loadProduction()
test("spending guard reserves concurrent calls, settles actual charges, and retains unknown exposure", () => {
	const g = new SpendGuard(0.12, 0.04)
	const first = g.reserve(),
		second = g.reserve(),
		third = g.reserve()
	assert.throws(() => g.reserve(), /before dispatch/)
	g.settle(first, 0.001)
	g.settle(second, null)
	g.settle(third, 0.002)
	assert.deepEqual(g.snapshot(), {
		limitUsd: 0.12,
		reservationPerReadingUsd: 0.04,
		knownActualUsd: 0.003,
		unknownHeldUsd: 0.04,
		inFlightReservedUsd: 0,
	})
	g.reserve()
	assert.throws(() => g.reserve(), /before dispatch/)
})
test("no fallback routes or extra request fees; rate filters do not claim to cap total charges", () => {
	assert.deepEqual(
		rateFilter({ providers: ["fixture"], inputPerMillion: 0.02 }),
		{
			allow_fallbacks: false,
			only: ["fixture"],
			max_price: { prompt: "0.02", completion: "0", request: "0" },
		},
	)
	assert.throws(() => validateModels([]), /ten native/)
})
test("failed half of a complete reading retains successful raw evidence and known partial cost, without retry or credential echo", async () => {
	let calls = 0
	const m = {
		model: "fixture",
		responseModel: "fixture-20261112",
		kind: "openrouter-decisions",
		providers: ["fixture"],
		inputPerMillion: 0.02,
	}
	const result = await inference(
		api,
		m,
		"something scary",
		{ openrouter: "secret-fixture", typesafe: "unused" },
		async (_url, opts) => {
			calls++
			const body = JSON.parse(opts.body)
			assert.equal(body.messages, undefined)
			assert.equal(body.provider.allow_fallbacks, false)
			if (Object.keys(body.questions).length === 148)
				return new Response(
					JSON.stringify({ error: { message: "bad secret-fixture" } }),
					{ status: 400 },
				)
			return new Response(
				JSON.stringify({
					model: m.responseModel,
					answers: {},
					usage: { input_tokens: 10, cost: 0.00001 },
					provider: "fixture",
				}),
			)
		},
	)
	assert.equal(calls, 2)
	assert.equal(result.status, "provider-error")
	assert.equal(result.costUsd, null)
	assert.equal(result.knownPartialUsd, 0.00001)
	assert.equal(result.raw[0].usage.cost, 0.00001)
	assert.ok(!JSON.stringify(result).includes("secret-fixture"))
})
test("declared batching preserves every question and original state content, records all charges, and bounds HTTP concurrency", async () => {
	let active = 0,
		peak = 0
	const bodies = []
	const m = {
		model: "fixture",
		responseModel: "fixture-native",
		kind: "openrouter-decisions",
		providers: ["fixture"],
		inputPerMillion: 0.02,
		maxQuestions: 16,
		stringState: true,
	}
	const query = "something scary"
	const requests = [api.attributeRequest(query), api.fingerprintRequest(query)]
	const result = await inference(
		api,
		m,
		query,
		{ openrouter: "fixture-key" },
		async (_url, opts) => {
			active++
			peak = Math.max(peak, active)
			const body = JSON.parse(opts.body)
			bodies.push(body)
			assert.ok(Object.keys(body.questions).length <= 16)
			await new Promise((resolve) => setTimeout(resolve, 1))
			active--
			const answers = Object.fromEntries(
				Object.entries(body.questions).map(([key, q]) => [
					key,
					q.type === "noul"
						? { type: "noul", noul: 0.4 }
						: {
								type: "choice",
								choice: Object.keys(q.criteria)[0],
								probabilities: Object.fromEntries(
									Object.keys(q.criteria).map((k, i) => [k, Number(i === 0)]),
								),
							},
				]),
			)
			return new Response(
				JSON.stringify({
					model: m.responseModel,
					answers,
					usage: { input_tokens: 10, output_tokens: 0, cost: 0.00001 },
					provider: "fixture",
				}),
			)
		},
	)
	assert.equal(result.status, "ok")
	assert.equal(bodies.length, 12)
	assert.equal(peak, 2)
	assert.equal(Object.keys(result.raw[1].answers).length, 148)
	assert.deepEqual(
		result.requestTraces.flatMap((t) => t.questionKeys).sort(),
		requests.flatMap((r) => Object.keys(r.questions)).sort(),
	)
	for (const body of bodies)
		assert.ok(requests.some((r) => JSON.stringify(r.state) === body.state))
	assert.ok(Math.abs(result.costUsd - 0.00012) < 1e-12)
	assert.equal(result.requestTraces.length, 12)
})
