import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
const here = (name) => fileURLToPath(new URL(name, import.meta.url))
const cwd = fileURLToPath(new URL("../../../../", import.meta.url))
const bin = here("./node_modules/.bin/mcp-inspector")
const state = here("../results/")
const env = {
	...process.env,
	MCP_INSPECTOR_OAUTH_STATE_PATH: `${state}inspector-oauth.json`,
	MCP_INSPECTOR_SECRET_STORE: "file",
	MCP_INSPECTOR_SECRET_FILE: `${state}inspector-secrets.json`,
}
const deadline = Date.now() + 120000
while (true) {
	try {
		if (
			(
				await fetch(
					"http://127.0.0.1:3356/.well-known/oauth-protected-resource/mcp",
				)
			).ok
		)
			break
	} catch {}
	if (Date.now() > deadline)
		throw new Error("Local MCP server readiness timeout")
	await new Promise((resolve) => setTimeout(resolve, 500))
}
async function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			env,
			stdio: ["ignore", "pipe", "pipe"],
			...options,
		})
		let output = ""
		let stdout = ""
		let authorizing = false
		let browser = Promise.resolve()
		const capture = (chunk) => {
			const text = chunk.toString()
			output += text
			const match = output.match(
				/http:\/\/127\.0\.0\.1:3356\/api\/auth\/oauth2\/authorize\?[!-~]+/,
			)
			if (match && !authorizing) {
				authorizing = true
				browser = new Promise((res, rej) => {
					const login = spawn(
						process.execPath,
						[here("browser-login.mjs"), match[0]],
						{
							cwd,
							env: { ...env, ...options.browserEnv },
							stdio: ["ignore", "pipe", "pipe"],
						},
					)
					let errors = ""
					login.stderr.on("data", (c) => {
						errors += c
					})
					login.on("exit", (code) =>
						code === 0
							? res()
							: rej(
									new Error(
										`Browser login failed (${code}): ${errors.split("\n")[0]}`,
									),
								),
					)
				})
				browser.catch(() => child.kill("SIGTERM"))
			}
		}
		child.stdout.on("data", (chunk) => {
			stdout += chunk
			capture(chunk)
		})
		child.stderr.on("data", capture)
		child.on("error", reject)
		child.on("exit", async (code) => {
			try {
				await browser
				if (code !== 0) throw new Error(`${command} failed (${code})`)
				resolve(stdout)
			} catch (error) {
				reject(error)
			}
		})
	})
}
const inspector = await run(
	bin,
	[
		"--cli",
		"http://127.0.0.1:3356/mcp",
		"--transport",
		"http",
		"--protocol-era",
		"modern",
		"--method",
		"tools/list",
		"--strict",
		"--connect-timeout",
		"0",
		"--relogin",
		"--no-revoke",
	],
	{ browserEnv: { EXPECT_DCR: "1" } },
)
assert.ok(inspector.includes('"get_my_shows"'))
console.log(
	"PASS: Inspector DCR browser login, all-permissions consent and strict modern listing",
)
await run(process.execPath, [here("inspector-calls.mjs")])
console.log("PASS: Inspector calls all seven real read tools")
const name = `goodwatch-authorization-566-${process.pid}`
let configured = false
try {
	await run("claude", [
		"mcp",
		"add",
		"--transport",
		"http",
		"--scope",
		"local",
		"--callback-port",
		"6277",
		name,
		"http://127.0.0.1:3356/mcp",
	])
	configured = true
	await run("claude", ["mcp", "login", name, "--no-browser"], {
		browserEnv: { EXPECT_CIMD: "1" },
	})
	console.log(
		"PASS: Claude Code CIMD browser login, consent and issuer callback",
	)
	const prompt = `Use only ${name} MCP tools. Call search_titles with query "Local Movie", get_title with title_id "show:1399", and get_my_shows. Report the show name and next episode. Do not read files or use other tools.`
	const args = [
		"-p",
		prompt,
		"--allowedTools",
		["search_titles", "get_title", "get_my_shows"]
			.map((t) => `mcp__${name}__${t}`)
			.join(","),
		"--permission-mode",
		"dontAsk",
		"--no-session-persistence",
		"--output-format",
		"json",
	]
	const first = JSON.parse(await run("claude", args))
	assert.equal(first.is_error, false)
	assert.deepEqual(first.permission_denials, [])
	assert.ok(first.result.includes("Local Orbit"))
	writeFileSync(`${state}claude-result.json`, JSON.stringify(first), {
		mode: 0o600,
	})
	console.log(
		"PASS: real Claude Code prompt called the catalog/title/member tools",
	)
	const until = Date.now() + 65000
	while (Date.now() < until)
		await new Promise((resolve) =>
			setTimeout(resolve, Math.min(10000, until - Date.now())),
		)
	await run(process.execPath, [here("inspector-calls.mjs")])
	const later = JSON.parse(
		await run("claude", [
			"-p",
			`Use only ${name} to call get_my_shows and report Local Orbit's next episode. Do not read files or use other tools.`,
			"--allowedTools",
			`mcp__${name}__get_my_shows`,
			"--permission-mode",
			"dontAsk",
			"--no-session-persistence",
			"--output-format",
			"json",
		]),
	)
	assert.equal(later.is_error, false)
	assert.deepEqual(later.permission_denials, [])
	assert.ok(later.result.includes("Local Orbit"))
	const trace = readFileSync(`${state}server.log`, "utf8")
	assert.ok(trace.includes('"grantType":"refresh_token","status":200'))
	console.log(
		"PASS: both real clients call tools after the 60-second access-token lifetime; server observes successful refresh",
	)
} finally {
	if (configured) {
		try {
			await run("claude", ["mcp", "logout", name])
		} catch {}
		await run("claude", ["mcp", "remove", "--scope", "local", name])
	}
}
