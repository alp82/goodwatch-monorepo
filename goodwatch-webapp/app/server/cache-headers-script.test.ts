import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { runInNewContext } from "node:vm"

const script = readFileSync(
	new URL("../../scripts/check-cache-headers.mjs", import.meta.url),
	"utf8",
)

// Exercise the CLI with fetch fixtures: no server or external connection is needed.
async function run(broken = "") {
	const fixture = `
		let calls = 0
		globalThis.fetch = async (url, options) => {
			if (options.redirect !== "manual" || !options.headers["User-Agent"].includes("Mozilla/5.0")) throw new Error("Request options")
			if (calls++ === 0) return new Response('<script>{"SUPABASE_URL":"https://testproject.supabase.co"}</script>')
			const member = options.headers.Cookie?.startsWith("sb-testproject-auth-token=")
			const keyed = !!options.headers["GW-Cache-Identity"]
			const missing = url.pathname.includes("nothing") || url.pathname.includes("does/not")
			const list = url.pathname === "/u/sample/lists/sample"
			const profile = url.pathname === "/u/sample"
			const headers = {}
			if (member || missing) headers["Cache-Control"] = "private, no-store"
			else {
				headers["Cache-Control"] = keyed ? ((list || profile) ? "public, max-age=0, s-maxage=10, stale-while-revalidate=10" : "public, max-age=0, s-maxage=1800") : "private, max-age=0"
				headers.Vary = keyed ? "GW-Cache-Identity" : "Accept-Language"
				headers["GW-Cache-Identity"] = "anon;US;en"
			}
			const broken = ${JSON.stringify(broken)}
			if (broken === "cookie") headers.Vary = "Cookie"
			if (broken === "member" && member) headers["Cache-Control"] = "public"
			if (broken === "error" && missing) headers["Cache-Control"] = "private"
			if (broken === "key" && !member && !keyed) delete headers["GW-Cache-Identity"]
			if (broken === "vary" && keyed) headers.Vary = "Accept-Language"
			if (broken === "list" && list) headers["Cache-Control"] = "public"
			if (list && keyed && !member) {
				if (broken === "list-fresh") headers["Cache-Control"] = "public, s-maxage=11, stale-while-revalidate=10"
				if (broken === "list-stale") headers["Cache-Control"] = "public, s-maxage=10, stale-while-revalidate=11"
				if (broken === "list-error") headers["Cache-Control"] += ", stale-if-error=1"
			}
			if (profile && keyed && !member) {
				if (broken === "profile-fresh") headers["Cache-Control"] = "public, s-maxage=11, stale-while-revalidate=10"
				if (broken === "profile-stale") headers["Cache-Control"] = "public, s-maxage=10, stale-while-revalidate=11"
				if (broken === "profile-error") headers["Cache-Control"] += ", stale-if-error=1"
				if (broken === "profile-key") delete headers["GW-Cache-Identity"]
			}
			if (broken === "profile" && profile) headers["Cache-Control"] = "public"
			if (broken === "profile-member" && profile && member) headers["Cache-Control"] = "private, max-age=0"
			if (broken === "list-member" && list && member) headers["Cache-Control"] = "private, max-age=0"
			return new Response("fixture", { status: missing ? 404 : 200, headers })
		}
	`
	const process = {
		argv: [
			"node",
			"check-cache-headers.mjs",
			"https://goodwatch.test",
			"--list",
			"/u/sample/lists/sample",
		],
		exitCode: 0,
	}
	const output: string[] = []
	const errors: string[] = []
	await runInNewContext(fixture + script, {
		process,
		Response,
		URL,
		AbortSignal,
		console: {
			log: (line: string) => output.push(line),
			error: (line: string) => errors.push(line),
		},
	})
	return {
		status: process.exitCode,
		stdout: output.join("\n"),
		stderr: errors.join("\n"),
	}
}

test("header checker covers all five audiences and ten paths without disclosing the project", async () => {
	const result = await run()
	assert.equal(result.status, 0, result.stderr)
	assert.equal(result.stdout.trim().split("\n").length, 50)
	assert.match(result.stdout, /member identity/)
	assert.match(result.stdout, /<share profile>/)
	assert.doesNotMatch(
		result.stdout + result.stderr,
		/testproject|sb-.*-auth-token|\/u\/sample/,
	)
})

test("header checker fails for each cache contract violation", async () => {
	for (const violation of [
		"cookie",
		"member",
		"error",
		"key",
		"vary",
		"list",
		"list-fresh",
		"list-stale",
		"list-error",
		"list-member",
		"profile",
		"profile-fresh",
		"profile-stale",
		"profile-error",
		"profile-key",
		"profile-member",
	]) {
		const result = await run(violation)
		assert.equal(result.status, 1, violation)
		assert.match(result.stderr, /FAIL/)
		assert.doesNotMatch(
			result.stdout + result.stderr,
			/testproject|sb-.*-auth-token|\/u\/sample/,
		)
	}
})
