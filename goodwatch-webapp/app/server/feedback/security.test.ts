import assert from "node:assert/strict"
import { generateKeyPairSync, sign } from "node:crypto"
import { mock, test } from "node:test"
import { EPHEMERAL, IS_COMPONENTS_V2 } from "../discord/cards.ts"
import {
	feedbackDetailsId,
	parseFeedbackDetailsId,
} from "../discord/custom-id.ts"
import { handleInteraction } from "../discord/endpoint.server.ts"
import { createFeedbackStore } from "./store.server.ts"

const reportId = "a".repeat(64)

test("Details custom ids accept only the exact prefix and lowercase SHA-256 id", () => {
	assert.equal(parseFeedbackDetailsId(feedbackDetailsId(reportId)), reportId)
	for (const invalid of [
		"",
		"a".repeat(63),
		"a".repeat(65),
		"A".repeat(64),
		`${reportId}:extra`,
		`${reportId}\n`,
		"' OR 1=1 --",
	]) {
		assert.equal(
			parseFeedbackDetailsId(`gw1:feedback-details:${invalid}`),
			null,
		)
		assert.throws(() => feedbackDetailsId(invalid))
	}
	assert.equal(parseFeedbackDetailsId(`gw2:feedback-details:${reportId}`), null)
})

test("Details cannot read storage until its interaction signature is verified", async () => {
	const keys = generateKeyPairSync("ed25519")
	const publicKey = keys.publicKey
		.export({ format: "der", type: "spki" })
		.subarray(-32)
		.toString("hex")
	const timestamp = String(Math.floor(Date.now() / 1000))
	const body = JSON.stringify({
		type: 3,
		user: { id: "111111111111111111" },
		data: { custom_id: feedbackDetailsId(reportId) },
	})
	const signature = sign(
		null,
		Buffer.from(timestamp + body),
		keys.privateKey,
	).toString("hex")
	const feedbackDetails = mock.fn(async (_id: string) => null)
	const dependencies = {
		feedbackDetails,
		env: { DISCORD_FEEDBACK_STAFF_USER_IDS: "111111111111111111" },
		log: () => {},
	}
	for (const valid of [false, true]) {
		const response = await handleInteraction(
			new Request("https://goodwatch.app/api/discord/interactions", {
				method: "POST",
				body,
				headers: {
					"X-Signature-Timestamp": timestamp,
					"X-Signature-Ed25519": valid ? signature : "00".repeat(64),
				},
			}),
			{ publicKey, dependencies },
		)
		assert.equal(response.status, valid ? 200 : 401)
		assert.equal(feedbackDetails.mock.callCount(), valid ? 1 : 0)
		if (valid) {
			const answer = await response.json()
			assert.equal(answer.type, 4)
			assert.equal(answer.data.flags, EPHEMERAL | IS_COMPONENTS_V2)
			assert.deepEqual(answer.data.allowed_mentions, { parse: [] })
			assert.match(JSON.stringify(answer.data), /isn't stored/)
			assert.ok(!JSON.stringify(answer.data).includes(reportId))
		}
	}
	assert.deepEqual(feedbackDetails.mock.calls[0].arguments, [reportId])
})

test("Details storage reads parameterize ids, select no sender email, and map the stored row", async () => {
	const calls: { sql: string; params: unknown[] }[] = []
	const store = createFeedbackStore(async (sql, params) => {
		calls.push({ sql, params })
		return {
			rowcount: params[0] === reportId ? 1 : 0,
			json:
				params[0] === reportId
					? [
							{
								id: reportId,
								kind: "bug",
								status: "new",
								member_id: "member-1",
								metadata: { url: "/support" },
								dedupe_key: null,
								duplicate_count: 3,
								has_screenshot: true,
								created_at: "1800000000000",
							},
						]
					: [],
		}
	})
	assert.deepEqual(await store.details(reportId), {
		id: reportId,
		kind: "bug",
		status: "new",
		memberId: "member-1",
		metadata: { url: "/support" },
		dedupeKey: null,
		duplicateCount: 3,
		hasScreenshot: true,
		createdAt: 1800000000000,
	})
	const hostile = "' OR 1=1 --"
	assert.equal(await store.details(hostile), null)
	assert.equal(calls.length, 2)
	assert.equal(calls[0].sql, calls[1].sql)
	assert.match(calls[1].sql, /WHERE id = \?$/)
	assert.doesNotMatch(calls[1].sql, /sender_email|SELECT \*|OR 1=1/)
	assert.deepEqual(calls[1].params, [hostile])
})
