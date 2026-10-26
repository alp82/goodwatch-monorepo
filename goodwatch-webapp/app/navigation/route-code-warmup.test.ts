// A phone's first page change to a title or a person: the route's code is ready before the tap (#753).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const out = execFileSync(
	"node_modules/.bin/vite-node",
	[
		"--config",
		"app/ui/imports/source-import-test-vite.config.ts",
		"app/navigation/route-code-warmup.test-support.ts",
	],
	{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
)
const rendered = JSON.parse(out.split("__WARMUP__").at(-1) ?? "") as Record<
	"viewport" | "afterPress" | "all",
	string[]
>

test("what a phone shows warms its page type's code once, at low priority", () => {
	// Two title links on screen: one set of the title route's files, not two. The person route isn't asked for.
	assert.deepEqual(rendered.viewport, [
		"modulepreload /assets/movie.js low",
		"modulepreload /assets/details.js low",
		"modulepreload /assets/shell.js low",
	])
})

test("a press raises a waiting warm-up, and loads another page type's code at once", () => {
	assert.deepEqual(rendered.afterPress, [
		"modulepreload /assets/movie.js high",
		"modulepreload /assets/details.js high",
		"modulepreload /assets/shell.js high",
	])
	assert.deepEqual(rendered.all.slice(3), [
		"modulepreload /assets/person.js auto",
		"modulepreload /assets/person-parts.js auto",
	])
})
