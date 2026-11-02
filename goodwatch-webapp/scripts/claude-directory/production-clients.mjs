// Credentials arrive on stdin as {email,password}; never pass them as arguments.
// Run only with the designated disposable reviewer member. --writes exercises
// reversible fixtures; existing ratings, settings and show status are retained.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { stripVTControlCharacters } from "node:util"
import { chromium } from "../auth-mcp/clients/node_modules/playwright/index.mjs"

const origin = "https://goodwatch.app"
const endpoint = `${origin}/mcp`
const inspector = fileURLToPath(new URL("../auth-mcp/clients/node_modules/.bin/mcp-inspector", import.meta.url))
let input = ""
for await (const chunk of process.stdin) input += chunk
const credentials = JSON.parse(input)
input = ""
assert.equal(typeof credentials.email, "string")
assert.equal(typeof credentials.password, "string")
const evidence = mkdtempSync(join(tmpdir(), "goodwatch-claude-review-"))
chmodSync(evidence, 0o700)
const env = {
	...process.env,
	MCP_INSPECTOR_OAUTH_STATE_PATH: join(evidence, "inspector-oauth.json"),
	MCP_INSPECTOR_SECRET_STORE: "file",
	MCP_INSPECTOR_SECRET_FILE: join(evidence, "inspector-secrets.json"),
}
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const replayPath = process.env.GOODWATCH_REPLAY_EVIDENCE
const records = replayPath ? JSON.parse(readFileSync(join(replayPath, "calls.json"), "utf8")) : []
const runId = `directory-${Date.now()}`
const name = `goodwatch-directory-${process.pid}`
let configured = false
let temporaryList
let temporaryWatch
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function save(file, data) {
	writeFileSync(join(evidence, file), JSON.stringify(data, null, 2), { mode: 0o600 })
}
function parseJson(output) {
	const clean = stripVTControlCharacters(output).trim()
	// Interactive PTYs merge stderr notices with the final JSON response.
	for (let i = clean.indexOf("{"); i >= 0; i = clean.indexOf("{", i + 1)) {
		try { return JSON.parse(clean.slice(i)) } catch {}
	}
	throw Error("Client returned no final JSON object")
}
async function login(url) {
	assert.equal(new URL(url).origin, origin)
	assert.equal(new URL(url).pathname, "/api/auth/oauth2/authorize")
	const page = await context.newPage()
	try {
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
		await Promise.race([
			page.locator('input[name="email"]').waitFor({ timeout: 20000 }),
			page.getByRole("button", { name: /^Allow\b/ }).waitFor({ timeout: 20000 }),
		])
		if (await page.locator('input[name="email"]').isVisible()) {
			await page.waitForFunction(() => {
				const form = document.querySelector("form")
				return form && Object.keys(form).some((key) => key.startsWith("__react"))
			}, null, { timeout: 20000 })
			await page.locator('input[name="email"]').fill(credentials.email)
			await page.locator('input[name="password"]').fill(credentials.password)
			await page.getByRole("button", { name: "Sign in", exact: true }).click()
		}
		await page.getByRole("button", { name: /^Allow\b/ }).click({ timeout: 20000 })
		await page.waitForURL((u) => ["127.0.0.1", "localhost"].includes(u.hostname), { timeout: 30000 })
		assert.equal(new URL(page.url()).searchParams.get("iss"), `${origin}/api/auth`)
		console.log("PASS: production browser password login, consent and issuer callback")
	} finally { await page.close() }
}
async function run(command, args, interactive = false) {
	return new Promise((resolve, reject) => {
		const child = spawn(interactive ? "python3" : command, interactive
			? ["-c", "import pty,sys; sys.exit(pty.spawn(sys.argv[1:]) >> 8)", command, ...args]
			: args, { cwd: evidence, env, stdio: ["ignore", "pipe", "pipe"] })
		let output = "", stdout = "", authorizing = false
		let auth = Promise.resolve()
		const timer = setTimeout(() => child.kill("SIGTERM"), 180000)
		const capture = (chunk) => {
			output += chunk.toString()
			const match = stripVTControlCharacters(output).match(/https:\/\/goodwatch\.app\/api\/auth\/oauth2\/authorize\?[^\s]+/)
			if (interactive && match && !authorizing) {
				authorizing = true
				auth = login(match[0])
				auth.catch(() => child.kill("SIGTERM"))
			}
		}
		child.stdout.on("data", (chunk) => { stdout += chunk; capture(chunk) })
		child.stderr.on("data", capture)
		child.on("error", (error) => { clearTimeout(timer); reject(error) })
		child.on("close", async (code) => {
			clearTimeout(timer)
			try {
				await auth
				if (code !== 0) {
					writeFileSync(join(evidence, "client-failure.log"), output, { mode: 0o600 })
					throw Error(`Client command failed (${code}); protected evidence retained`)
				}
				resolve(stdout)
			} catch (error) { reject(error) }
		})
	})
}
const inspectorBase = ["--cli", endpoint, "--transport", "http", "--protocol-era", "modern"]
async function call(tool, args = {}, expectedError = false) {
	// Each CLI run initializes a connection; keep comfortably below 60 requests/minute.
	await pause(3500)
	const raw = await run(inspector, [...inspectorBase, "--stored-auth-only", "--method", "tools/call", "--tool-name", tool, "--tool-args-json", JSON.stringify(args)])
	const result = parseJson(raw)
	records.push({ client: "Inspector", tool, args, result, at: new Date().toISOString() })
	save("calls.json", records)
	assert.equal(Boolean(result.isError), expectedError, `${tool}: unexpected error state; inspect protected evidence`)
	console.log(`PASS: Inspector ${tool}${expectedError ? " rejects invalid input" : ""}`)
	return result.structuredContent ?? JSON.parse(result.content.find((c) => c.type === "text").text)
}
const action = (label) => `${runId}-${label}`
try {
	const inventory = replayPath ? JSON.parse(readFileSync(join(replayPath, "inventory.json"), "utf8")) : parseJson(await run(inspector, [...inspectorBase, "--method", "tools/list", "--strict", "--connect-timeout", "90000", "--relogin", "--no-revoke"], true))
	save("inventory.json", inventory)
	const tools = inventory.tools ?? inventory.result?.tools
	assert.equal(tools.length, 25)
	assert.ok(tools.every((t) => t.name.length <= 64 && t.title && t.annotations))
	console.log(replayPath ? "Loaded protected prior Inspector evidence: 25 tools" : "PASS: Inspector strict production discovery, 25 tools")
	if (!replayPath) {
	const settings = await call("get_settings")
	await call("search_titles", { query: "Arrival", limit: 3 })
	await call("discover_titles", { limit: 3 })
	await call("get_discover_filters")
	await call("get_title", { title_id: "movie:329865" })
	await call("get_similar_titles", { title_id: "movie:329865", limit: 3 })
	const shows = await call("get_my_shows", { limit: 5 })
	const showId = shows.items[0].id
	const progress = await call("get_show_progress", { title_id: showId, limit: 3 })
	await call("get_tonight")
	await call("get_library", { limit: 5 })
	await call("get_taste")
	const people = await call("search_people", { query: "Greta Gerwig", limit: 3 })
	await call("get_person", { person_id: people.items[0].person_id, limit: 3 })
	const lists = await call("get_my_lists", { limit: 3 })
	const list = await call("get_list", { list_id: lists.items[0].list_id })
	if (process.argv.includes("--writes")) {
		// Setters keep current values. All actual additions below are isolated and removed.
		const show = await call("get_title", { title_id: showId, include: [] })
		await call("rate_title", { action_id: action("rate"), title_id: showId, score: show.member.score })
		const statuses = { watching: "Watching", not_started: "Not started", on_hold: "On hold", dropped: "Dropped" }
		assert.ok(statuses[progress.status], "Choose an existing non-Seen show for no-op status test")
		await call("set_show_status", { action_id: action("status"), title_id: showId, status: statuses[progress.status] })
		await call("set_my_services", { action_id: action("services"), country: settings.country, services: settings.service_ids })
		await call("set_settings", { action_id: action("settings"), country: settings.country, language: settings.language })
		let clean
		for (const id of ["movie:424", "movie:680", "movie:13", "movie:550", "movie:155"]) {
			const title = await call("get_title", { title_id: id, include: [] })
			if (title.member.score === null && title.member.watch_count === 0 && !title.member.want_to_see && !title.member.not_interested && !list.items.some((t) => t.id === id)) { clean = { id, member: title.member }; break }
		}
		assert.ok(clean, "No clean disposable title found; no title writes started")
		await call("set_want_to_see", { action_id: action("wishlist"), title_id: clean.id, want_to_see: false })
		await call("set_not_interested", { action_id: action("hidden"), title_id: clean.id, not_interested: false })
		const watched = await call("log_watch", { action_id: action("watch"), title_id: clean.id })
		assert.equal(watched.changes.watches_added.length, 1)
		temporaryWatch = { title_id: clean.id, watch_id: watched.changes.watches_added[0].id }
		const replay = await call("log_watch", { action_id: action("watch"), title_id: clean.id })
		assert.equal(replay.replayed, true)
		await call("undo_watch", { action_id: action("undo"), ...temporaryWatch })
		temporaryWatch = undefined
		const restored = await call("get_title", { title_id: clean.id, include: [] })
		assert.deepEqual(restored.member, clean.member)
		const created = await call("create_list", { action_id: action("list"), list_name: `Disposable connector check ${runId}`, visibility: "unlisted", titles: list.items.map((t) => ({ title_id: t.id })) })
		temporaryList = created.list_id
		const replacement = clean.id
		assert.ok(!list.items.some((t) => t.id === replacement))
		await call("update_list_titles", { action_id: action("list-edit"), list_id: temporaryList, remove_title_ids: [list.items[0].id], add_titles: [{ title_id: replacement }] })
		const updated = await call("get_list", { list_id: temporaryList })
		assert.equal(updated.items.length, 5)
		assert.equal(updated.items.at(-1).id, replacement)
		const removed = await context.request.post(`${origin}/api/share-lists`, { headers: { Origin: origin }, data: { intent: "delete", id: temporaryList } })
		assert.equal(removed.status(), 200)
		assert.equal((await removed.json()).deleted, true)
		temporaryList = undefined
		console.log("PASS: temporary watch and unlisted list removed; title marks restored")
	}
	}
	await run("claude", ["mcp", "add", "--transport", "http", "--scope", "local", "--callback-port", "6277", name, endpoint])
	configured = true
	await run("claude", ["mcp", "login", name, "--no-browser"], true)
	const config = { mcpServers: { [name]: { type: "http", url: endpoint, oauth: { callbackPort: 6277 } } } }
	const readCases = records.filter((r) => !r.result.isError && tools.find((t) => t.name === r.tool)?.annotations.readOnlyHint)
	const unique = [...new Map([...readCases].reverse().map((r) => [r.tool, { tool: r.tool, args: r.args }])).values()].filter((c) => !process.env.GOODWATCH_READ_TOOLS || process.env.GOODWATCH_READ_TOOLS.split(",").includes(c.tool))
	const prompt = `Validate this disposable review account. Call each of these GoodWatch read tools exactly once with its supplied arguments: ${JSON.stringify(unique)}. Use only the listed tools. Report each success or error, without printing account identifiers, list URLs or personal data. Do not change anything.`
	const output = await run("claude", ["--strict-mcp-config", "--mcp-config", JSON.stringify(config), "-p", prompt, "--allowedTools", unique.map((c) => `mcp__${name}__${c.tool}`).join(","), "--permission-mode", "dontAsk", "--no-session-persistence", "--output-format", "stream-json", "--verbose"])
	writeFileSync(join(evidence, "claude-reads.jsonl"), output, { mode: 0o600 })
	const events = output.trim().split("\n").map((line) => JSON.parse(line))
	const result = events.findLast((e) => e.type === "result")
	assert.equal(result?.is_error, false)
	for (const event of events.filter((e) => e.type === "user")) for (const item of event.message.content) if (item.type === "tool_result") assert.notEqual(item.is_error, true, "Claude read tool returned an error")
	const called = events.filter((e) => e.type === "assistant").flatMap((e) => e.message.content.filter((c) => c.type === "tool_use").map((c) => c.name))
	for (const c of unique) assert.ok(called.includes(`mcp__${name}__${c.tool}`), `Claude omitted ${c.tool}`)
	console.log(`PASS: real Claude Code called all ${unique.length} production read tools`)

	if (process.env.GOODWATCH_EXAMPLE_PROMPTS === "1") {
		const prompts = [
			"Find three unseen movies under two hours on my saved services. Explain my taste match and where each streams.",
			"Find Arrival (2016), show its scores and where I can watch it, then find three similar movies I haven't seen.",
			"What should I watch next, and where am I in my current show? Use only GoodWatch-returned streaming availability; say unknown if none is returned.",
		]
		for (const [i, prompt] of prompts.entries()) {
			if (process.env.GOODWATCH_EXAMPLE_ONLY && Number(process.env.GOODWATCH_EXAMPLE_ONLY) !== i + 1) continue
			const result = await run("claude", ["--strict-mcp-config", "--mcp-config", JSON.stringify(config), "-p", prompt, "--allowedTools", tools.filter((t) => t.annotations.readOnlyHint).map((t) => `mcp__${name}__${t.name}`).join(","), "--permission-mode", "dontAsk", "--no-session-persistence", "--output-format", "stream-json", "--verbose"])
			writeFileSync(join(evidence, `example-${i + 1}.jsonl`), result, { mode: 0o600 })
			const events = result.trim().split("\n").map((line) => JSON.parse(line))
			assert.equal(events.findLast((e) => e.type === "result")?.is_error, false)
			assert(events.some((e) => e.type === "assistant" && e.message.content.some((c) => c.type === "tool_use" && c.name.startsWith(`mcp__${name}__`))), "Example did not call GoodWatch")
			console.log(`Completed example prompt ${i + 1}; inspect protected evidence for result quality`)
		}
	}

	const writes = [...new Map(records.filter((r) => !r.result.isError && !tools.find((t) => t.name === r.tool)?.annotations.readOnlyHint).map((r) => [r.tool, { tool: r.tool, args: r.args }])).values()]
	if (writes.length && !process.env.GOODWATCH_READ_TOOLS) {
		assert.equal(writes.length, 10)
		const writePrompt = `This is an authorized idempotency test on a disposable GoodWatch reviewer account. Replay EACH of these exact tool requests once: ${JSON.stringify(writes)}. Keep every action_id and every other argument EXACTLY as supplied. These actions already completed; their temporary watch and list were removed. Replays must return historical receipts without changing current state. Do not create new action IDs, infer success from historical state, call extra tools, or modify the requests. Report only tool success/error and whether it replayed.`
		const writeOutput = await run("claude", ["--strict-mcp-config", "--mcp-config", JSON.stringify(config), "-p", writePrompt, "--allowedTools", writes.map((c) => `mcp__${name}__${c.tool}`).join(","), "--permission-mode", "dontAsk", "--no-session-persistence", "--output-format", "stream-json", "--verbose"])
		writeFileSync(join(evidence, "claude-writes.jsonl"), writeOutput, { mode: 0o600 })
		const events = writeOutput.trim().split("\n").map((line) => JSON.parse(line))
		assert.equal(events.findLast((e) => e.type === "result")?.is_error, false)
		for (const event of events.filter((e) => e.type === "user")) for (const item of event.message.content) if (item.type === "tool_result") assert.notEqual(item.is_error, true, "Claude write tool returned an error")
		const calls = events.filter((e) => e.type === "assistant").flatMap((e) => e.message.content.filter((c) => c.type === "tool_use"))
		for (const expected of writes) {
			const found = calls.find((c) => c.name === `mcp__${name}__${expected.tool}`)
			assert.ok(found, `Claude omitted ${expected.tool}`)
			assert.deepEqual(found.input, expected.args, `Claude changed arguments for ${expected.tool}`)
		}
		console.log("PASS: real Claude Code called all 10 production writes with exact completed action IDs")
	}

	save("summary.json", { at: new Date().toISOString(), inspectorTools: [...new Set(records.map((r) => r.tool))], claudeReadTools: unique.map((c) => c.tool), cleanup: "complete", submitted: false })
} finally {
	let cleanupFailed = false
	if (temporaryWatch) {
		try { await call("undo_watch", { action_id: action("cleanup-watch"), ...temporaryWatch }); temporaryWatch = undefined } catch { cleanupFailed = true; console.error("FAIL: temporary watch cleanup pending in protected evidence") }
	}
	if (temporaryList) {
		try {
			const r = await context.request.post(`${origin}/api/share-lists`, { headers: { Origin: origin }, data: { intent: "delete", id: temporaryList } })
			assert.equal(r.status(), 200)
			temporaryList = undefined
		} catch { cleanupFailed = true; console.error("FAIL: temporary list cleanup pending in protected evidence") }
	}
	if (configured) {
		try { await run("claude", ["mcp", "logout", name]) } catch {}
		await run("claude", ["mcp", "remove", "--scope", "local", name])
	}
	if (existsSync(env.MCP_INSPECTOR_OAUTH_STATE_PATH)) {
		try {
			const state = JSON.parse(readFileSync(env.MCP_INSPECTOR_OAUTH_STATE_PATH, "utf8"))
			const clientIds = new Set(Object.values(state.servers ?? {}).flatMap((s) => Object.values(s.byIssuer ?? {}).map((issuer) => issuer.clientInformation?.client_id)).filter(Boolean))
			const response = await context.request.get(`${origin}/api/auth/oauth2/get-consents`)
			assert.equal(response.status(), 200)
			for (const grant of await response.json()) {
				if (!clientIds.has(grant.clientId)) continue
				const removed = await context.request.post(`${origin}/api/auth/oauth2/delete-consent`, { headers: { Origin: origin }, data: { id: grant.id } })
				assert.equal(removed.status(), 200)
			}
			console.log("PASS: test-created Inspector grants revoked")
		} catch { cleanupFailed = true; console.error("FAIL: Inspector grant cleanup pending in protected evidence") }
	}
	await browser.close()
	console.log(`Protected evidence directory: ${evidence}`)
	if (cleanupFailed) throw Error("Review fixture or grant cleanup is incomplete")
}
