// Security properties of the staff Discord delivery that survive the Details button's removal: the technical
// details reply exposes nothing beyond the listed fields and cannot be injected, and a stale Details press on an
// old post is refused by the signed interactions endpoint without touching storage or the environment.
import assert from "node:assert/strict"
import { generateKeyPairSync, sign } from "node:crypto"
import { mock, test } from "node:test"
import {
	type Component,
	EPHEMERAL,
	IS_COMPONENTS_V2,
	componentCount,
	textLength,
} from "../discord/cards.ts"
import { handleInteraction } from "../discord/endpoint.server.ts"
import {
	type PostReport,
	SUPPRESS_NOTIFICATIONS,
	detailsMessage,
} from "./discord-post.ts"

const reportId = "a".repeat(64)
const all = (components: Component[]): Component[] =>
	components.flatMap((c) => [
		c,
		...all((c.components ?? []) as Component[]),
		...all(((c.items ?? []) as Component[]).filter(Boolean)),
	])
const texts = (components: Component[]) =>
	all(components)
		.filter((c) => c.type === 10)
		.map((c) => String(c.content))
		.join("\n")

test("the details reply carries no email, no unrequested metadata, and no injectable text", () => {
	const attack =
		"line one\nline two ||spoiler|| `code` @everyone <@123> [click](https://evil/path) private@example.com token=secret-value \\`"
	const reply = detailsMessage(
		{
			id: reportId,
			kind: "bug",
			message: attack,
			memberId: attack,
			createdAt: 1800000000000,
			dedupeKey: attack,
			screenshot: "webp",
			email: "member@example.com",
			metadata: {
				url: `/support?token=abc&tab=1#${attack}`,
				routeId: attack,
				userAgent: attack,
				locale: attack,
				colorScheme: attack,
				country: attack,
				buildCommit: attack,
				sentryReplayId: attack,
				viewport: { width: 1440, height: 900 },
				dpr: 2,
				email: "meta@example.com",
				cookies: "session=abc",
				authorization: "Bearer xyz",
				extra: { nested: "member@example.com" },
			},
		} as PostReport,
		"https://goodwatch.app",
	)
	const output = JSON.stringify(reply)
	for (const forbidden of [
		"member@example.com",
		"meta@example.com",
		"private@example.com",
		"session=abc",
		"Bearer xyz",
		"secret-value",
		"token=abc",
		"https://evil",
		"[click](",
		"@everyone",
		"<@123>",
		"||",
		"cookies",
		"authorization",
		"nested",
		"custom_id",
		"line one\\nline two",
	])
		assert.ok(!output.includes(forbidden), forbidden)
	// Every value sits in exactly one inline code span on its own line, so member text can't close it.
	for (const line of texts(reply.components).split("\n").slice(2))
		assert.match(line, /^\*\*[A-Za-z ]+\*\* `[^`]*`$/, line)
	assert.equal(reply.flags, IS_COMPONENTS_V2 | SUPPRESS_NOTIFICATIONS)
	assert.equal(reply.flags & EPHEMERAL, 0)
	assert.deepEqual(reply.allowed_mentions, { parse: [] })
	assert.ok(textLength(reply.components) <= 4000)
	assert.ok(componentCount(reply.components) <= 40)
	const buttons = all(reply.components).filter((c) => c.type === 2)
	assert.equal(buttons.length, 1)
	assert.equal(buttons[0].style, 5)
	assert.equal(
		buttons[0].url,
		`https://goodwatch.app/api/feedback/${reportId}/screenshot`,
	)
})

test("metadata keys that match Object prototype names leave the details reply intact", () => {
	const metadata = JSON.parse(
		'{"__proto__":{"url":"/evil"},"constructor":"x","toString":"y","hasOwnProperty":"z"}',
	)
	assert.doesNotThrow(() => {
		const reply = detailsMessage(
			{
				id: reportId,
				kind: "bug",
				message: "m",
				memberId: null,
				createdAt: 1800000000000,
				dedupeKey: null,
				metadata,
			},
			"https://goodwatch.app",
		)
		assert.ok(!JSON.stringify(reply).includes("/evil"))
		assert.match(texts(reply.components), /\*\*Member id\*\* `Guest`/)
	})
})

test("a stale Details press is refused by the signed endpoint without storage or environment reads", async () => {
	const keys = generateKeyPairSync("ed25519")
	const publicKey = keys.publicKey
		.export({ format: "der", type: "spki" })
		.subarray(-32)
		.toString("hex")
	const timestamp = String(Math.floor(Date.now() / 1000))
	const body = JSON.stringify({
		type: 3,
		guild_id: "1",
		member: { user: { id: "111111111111111111" }, roles: ["2"] },
		data: { custom_id: `gw1:feedback-details:${reportId}` },
	})
	const signature = sign(
		null,
		Buffer.from(timestamp + body),
		keys.privateKey,
	).toString("hex")
	const take = mock.fn(async () => ({ allowed: true }))
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
			{ publicKey, dependencies: { take: take as never, log: () => {} } },
		)
		assert.equal(response.status, valid ? 200 : 401)
		if (valid) {
			const answer = await response.json()
			assert.equal(answer.type, 4)
			assert.equal(answer.data.flags & EPHEMERAL, EPHEMERAL)
			assert.deepEqual(answer.data.allowed_mentions, { parse: [] })
			assert.match(JSON.stringify(answer.data), /not supported/)
			assert.ok(!JSON.stringify(answer.data).includes(reportId))
		}
	}
})
