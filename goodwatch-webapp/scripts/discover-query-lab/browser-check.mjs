import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

let playwright
try {
	playwright = await import("playwright")
} catch {
	// Reuse the monorepo's browser tooling without adding a production dependency.
	const workspace = createRequire(
		new URL("../../../yepwatch-app/package.json", import.meta.url),
	)
	playwright = await import(pathToFileURL(workspace.resolve("playwright")).href)
}
playwright = playwright.chromium ? playwright : playwright.default
const base = process.env.DISCOVER_LAB_URL ?? "http://127.0.0.1:5198"
const browser = await playwright.chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
const deferred = () => {
	let resolve
	const promise = new Promise((done) => (resolve = done))
	return { promise, resolve }
}
const gates = []
async function interpret(query) {
	await page.locator("#query").fill(query)
	await page.locator("#run").click()
	await page.waitForFunction(
		(value) =>
			JSON.parse(document.querySelector("#state").textContent).query === value,
		query,
	)
	return JSON.parse(await page.locator("#state").textContent())
}
async function fixtures(rows) {
	await page
		.locator("#fixtures")
		.evaluate((element) => (element.closest("details").open = true))
	await page.locator("#fixtures").fill(JSON.stringify(rows))
	await page.locator("#load").click()
}
try {
	await page.goto(base)
	await page.waitForFunction(() =>
		document.querySelector("#status").textContent.includes("Rules applied"),
	)
	for (const [query, expected] of [
		["with Tom Hanks and Brad Pitt", { people: "31,287" }],
		["like No Country for Old Men", { similar: "1000000006977" }],
		["under 1 hour 30 minutes", { maxRuntime: "89" }],
		["not very scary", {}],
	]) {
		const data = await interpret(query)
		for (const [key, value] of Object.entries(expected))
			assert.equal(data.filters[key], value, query)
		if (query.startsWith("not")) assert(!data.filters.moods)
	}
	console.log("PASS independent query examples")

	// A prior preview must not publish either data or errors into a new query.
	await interpret("brad pitt")
	const previewGate = deferred()
	gates.push(previewGate)
	await page.route("**/api/preview", async (route) => {
		await previewGate.promise
		await route.fulfill({
			status: 400,
			contentType: "application/json",
			body: JSON.stringify({ error: "stale preview error" }),
		})
	})
	const previewRequest = page.waitForRequest((request) =>
		request.url().endsWith("/api/preview"),
	)
	await page.locator("#preview").click()
	await previewRequest
	await interpret("netflix")
	const staleResponse = page.waitForResponse((response) =>
		response.url().endsWith("/api/preview"),
	)
	previewGate.resolve()
	await staleResponse
	await page.waitForTimeout(50)
	assert(
		!(await page.locator("#preview-status").textContent()).includes(
			"stale preview error",
		),
	)
	await page.unroute("**/api/preview")
	console.log("PASS stale preview error isolation")

	// The fixture set and semantic mode are immutable for a running evaluation.
	await fixtures([
		{ query: "brad pitt", expect: { people: "287" } },
		{ query: "tom hanks", expect: { people: "31" } },
	])
	const runGate = deferred()
	gates.push(runGate)
	const sent = []
	await page.route("**/api/interpret", async (route) => {
		sent.push(route.request().postDataJSON())
		await runGate.promise
		await route.continue()
	})
	const started = page.waitForRequest((request) =>
		request.url().endsWith("/api/interpret"),
	)
	await page.locator("#suite").click()
	await started
	for (const id of ["load", "add", "fixtures", "suite-semantic"])
		assert(await page.locator(`#${id}`).isDisabled(), id)
	await page.evaluate(() => {
		const editor = document.querySelector("#fixtures"),
			load = document.querySelector("#load")
		editor.disabled = false
		editor.value = JSON.stringify([
			{ query: "netflix", expect: { services: "8" } },
		])
		load.disabled = false
		load.click()
		document.querySelector("#suite-semantic").checked = true
	})
	runGate.resolve()
	await page.waitForFunction(() => !document.querySelector("#suite").disabled)
	assert((await page.locator("#count").textContent()).includes("2 cases"))
	assert.equal(sent.length, 2)
	assert(sent.every((request) => request.semantic === false))
	assert(
		(await page.locator("#suite-status").textContent()).includes(
			"2 match expectations",
		),
	)
	assert(
		(await page.locator("#suite-status").textContent()).includes("Rules only"),
	)
	assert(
		(await page.locator("#cases tr").first().textContent()).includes(
			"Brad Pitt",
		),
	)
	await page.unroute("**/api/interpret")
	await page.locator("#suite-semantic").uncheck()
	console.log("PASS frozen suite inputs and model mode")

	await fixtures([
		{ query: "brad pitt", expect: { people: "287" } },
		{ query: "tom hanks", expect: { people: "287" } },
		{ query: "matrix" },
	])
	await page.locator("#suite").click()
	await page.waitForFunction(() => !document.querySelector("#suite").disabled)
	const statuses = await page
		.locator("#cases tr td:nth-child(3)")
		.allTextContents()
	assert(statuses[0].includes("Matches expectations"))
	assert(statuses[1].includes("Mismatch"))
	assert(statuses[2].includes("Review probe"))
	assert(
		(await page.locator("#suite-status").textContent()).includes(
			"1 review probes",
		),
	)
	await page.setViewportSize({ width: 390, height: 844 })
	assert.equal(
		await page.evaluate(
			() => document.documentElement.scrollWidth > innerWidth,
		),
		false,
	)
	assert.deepEqual(errors, [])
	console.log("PASS truthful pass/fail/probe counts and mobile layout")
} finally {
	for (const gate of gates) gate.resolve()
	await browser.close()
}
