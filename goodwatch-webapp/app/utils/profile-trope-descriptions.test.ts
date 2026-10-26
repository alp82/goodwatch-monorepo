import assert from "node:assert/strict"
import { test } from "node:test"
import { readJsonLimited } from "../server/profile/request.server.ts"
import type { RankedTrope } from "../ui/profile/tropes/model.ts"
import {
	describeTrope,
	descriptionBatches,
	descriptionIds,
	mergeDescriptionEntries,
	previewDescriptions,
} from "./profile-trope-descriptions.ts"
const tag: RankedTrope = {
	id: "https://tvtropes.org/pmwiki/pmwiki.php/Main/Actual",
	name: "Actual heading",
	count: 3,
	loved: 2,
	z: 1,
	average: 8,
	top: [],
	description: "The SSR definition.",
	url: "https://tvtropes.org/pmwiki/pmwiki.php/Main/Actual",
}

test("description batches cover pagination above sixty IDs without oversized or duplicate requests", () => {
	const ids = Array.from({ length: 145 }, (_, i) => `id${i}`)
	assert.deepEqual(
		descriptionBatches([...ids, ids[0]]).map((batch) => batch.length),
		[60, 60, 25],
	)
	assert.deepEqual(descriptionBatches(ids).flat(), ids)
	assert.deepEqual(descriptionIds(["known", "known"]), ["known"])
	for (const invalid of [
		null,
		{},
		[""],
		[1],
		["x\n"],
		["x".repeat(4097)],
		Array(61).fill("known"),
	])
		assert.equal(descriptionIds(invalid), null)
})

test("thin-matrix hydration and failed or pending queries preserve SSR definitions; current null rows clear them", () => {
	const seeds = previewDescriptions([tag])
	const thinTag = { ...tag, description: null }
	assert.equal(
		describeTrope(thinTag, mergeDescriptionEntries(seeds, [undefined], {}))
			.description,
		"The SSR definition.",
	)
	assert.equal(
		describeTrope(thinTag, mergeDescriptionEntries(seeds, [{}], {}))
			.description,
		"The SSR definition.",
	)
	const updated = {
		[tag.id ?? tag.name]: {
			url: tag.url,
			title: "Updated actual heading",
			text: "A corrected current definition.",
		},
	}
	const latest = describeTrope(
		thinTag,
		mergeDescriptionEntries(seeds, [undefined], updated),
	)
	assert.equal(latest.id, tag.id)
	assert.equal(latest.name, "Updated actual heading")
	assert.equal(latest.description, "A corrected current definition.")
	const removed = {
		[tag.id ?? tag.name]: {
			url: tag.url,
			title: "Updated actual heading",
			text: null,
		},
	}
	assert.equal(
		describeTrope(thinTag, mergeDescriptionEntries(seeds, [updated], removed))
			.description,
		null,
	)
	assert.equal(tag.description, "The SSR definition.")
})

test("request-body byte limit rejects a dishonest Content-Length and Unicode bytes before JSON parsing", async () => {
	let canceled = false
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new TextEncoder().encode("["))
			controller.enqueue(new TextEncoder().encode(`"${"ü".repeat(140000)}"]`))
		},
		cancel() {
			canceled = true
		},
	})
	const request = new Request("https://example.test/descriptions", {
		method: "POST",
		headers: { "Content-Length": "1" },
		body,
		duplex: "half",
	} as RequestInit)
	assert.deepEqual(await readJsonLimited(request, 262144), {
		ok: false,
		problem: "too-large",
	})
	assert.equal(canceled, true)
	assert.deepEqual(
		await readJsonLimited(
			new Request("https://example.test/", {
				method: "POST",
				body: '["valid"]',
			}),
			262144,
		),
		{ ok: true, value: ["valid"] },
	)
})
