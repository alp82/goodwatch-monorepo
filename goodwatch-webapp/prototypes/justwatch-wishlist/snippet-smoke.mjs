// Runs the built console snippet with browser stubs against the fake JustWatch server.
// Checks: it only contacts the GraphQL endpoint, sends no cookies, never writes session values to the file,
// and falls back when the server rejects `objectId`. Run: node prototypes/justwatch-wishlist/snippet-smoke.mjs
import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { runSnippet, SESSION_SECRETS } from "./snippet-harness.mjs"

for (const rejectObjectId of [false, true]) {
	const respond = (body) =>
		rejectObjectId && body.query.includes("objectId")
			? { status: 400, body: { errors: [{ message: 'Cannot query field "objectId"', extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }] } }
			: undefined
	const { destinations, savedText, alerted } = await runSnippet({ respond })
	assert.equal(alerted, null)
	assert.ok(savedText, "the snippet saved a file")
	const saved = JSON.parse(savedText)
	assert.deepEqual([...new Set(destinations.map((d) => d.url))], ["https://apis.justwatch.com/graphql"])
	assert.ok(destinations.every((d) => d.method === "POST" && d.credentials === "omit"))
	for (const secret of SESSION_SECRETS) assert.ok(!savedText.includes(secret), "no session values in the file")
	assert.equal(saved.sharedFile.items.length, 47)
	assert.equal(saved.watchlistRuns[0].completeness, "complete")
	assert.equal(saved.watchlistRuns[1].members.length, 47)
	assert.equal(saved.watchlistRuns[0].query, rejectObjectId ? "fallback" : "full")
	assert.equal(saved.sharedFile.completeness, "complete")
	assert.equal(saved.reconciled.chosenRun, 2)
	if (process.env.SAVE_TO && !rejectObjectId) writeFileSync(process.env.SAVE_TO, savedText)
	console.log(
		`snippet ok (${rejectObjectId ? "objectId rejected, fallback" : "full query"}): ${destinations.length} requests, all to ${destinations[0].url}; ${saved.sharedFile.items.length} wishes; Seen list ${saved.seenlist.members.length}`,
	)
}
