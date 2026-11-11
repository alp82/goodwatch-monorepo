import assert from "node:assert/strict"
import { test } from "node:test"
import { attributedSearch, browserSearchOrigin } from "./search-attribution.ts"

test("browser diagnostics accept bounded origins and discard claimed integration and actor identity", () => {
	const origin = browserSearchOrigin({
		surface: "start",
		trigger: "enter",
		actor: "member",
		consumer: "yepwatch",
		search_id: "forged",
	})
	assert.deepEqual(origin, { surface: "start", trigger: "enter" })
	const guest = attributedSearch(
		{
			...origin,
			consumer: "web",
			reported_by: "client",
			search_id: "server-id",
		},
		null,
	)
	assert.equal(guest.actor_kind, "guest")
	assert.equal(guest.consumer, "web")
	assert.equal(guest.search_id, "server-id")
	assert.equal(
		attributedSearch(
			{ ...origin, consumer: "web", reported_by: "client" },
			"verified-account",
		).actor_kind,
		"member",
	)
	for (const value of [
		undefined,
		null,
		"start",
		{ surface: "yepwatch", trigger: "api" },
		{ surface: "anything", trigger: "keypress:private-text" },
	])
		assert.deepEqual(browserSearchOrigin(value), {
			surface: "unknown",
			trigger: "unknown",
		})
})

test("verified integration actor can differ from the local account identity", () => {
	for (const actor of ["member", "guest", "unknown"] as const)
		assert.equal(
			attributedSearch(
				{
					consumer: "yepwatch",
					surface: "yepwatch",
					trigger: "api",
					reported_by: "server",
					actor,
				},
				null,
			).actor_kind,
			actor,
		)
})
