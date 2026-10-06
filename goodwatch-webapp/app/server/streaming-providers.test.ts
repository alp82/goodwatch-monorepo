// The streaming providers statement against a stand-in for Crate's HTTP endpoint, through the real driver and the real
// client: what matters here is the value the driver rejects with, which a fake client would not reproduce.
import "node-crate"
import assert from "node:assert/strict"
import { type Server, createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { after, afterEach, before, test } from "node:test"
import Redis from "ioredis"
import "./title-filter/test-alias.ts"

type Answer = { status: number; body: unknown }
let answer: (stmt: string) => Answer = () => ({ status: 200, body: {} })
const statements: string[] = []

const rows = (list: [number, string][]) => ({
	status: 200,
	body: {
		cols: ["id", "name", "logo_path", "order_by_country"],
		col_types: [9, 4, 4, 12],
		rows: list.map(([id, name]) => [id, name, `/${id}.jpg`, { US: id }]),
		rowcount: list.length,
		duration: 1,
	},
})
// Crate's answer to a subscript that no row has a key for, as production gives it (HTTP 404, code 4043).
const columnUnknown = (country: string) => ({
	status: 404,
	body: {
		error: {
			message: `ColumnUnknownException[Column order_by_country['${country}'] unknown]`,
			code: 4043,
		},
	},
})

const server: Server = createServer((request, response) => {
	let text = ""
	request.on("data", (chunk) => {
		text += chunk
	})
	request.on("end", () => {
		const { stmt } = JSON.parse(text) as { stmt: string }
		statements.push(stmt)
		const { status, body } = answer(stmt)
		response.writeHead(status, { "Content-Type": "application/json" })
		response.end(JSON.stringify(body))
	})
})

// The client logs every failed statement; the failures here are the point.
const consoleError = console.error
const consoleTrace = console.trace
const consoleLog = console.log

let _getStreamingProviders: typeof import("./streaming-providers.server.ts")["_getStreamingProviders"]
let CrateError: typeof import("../utils/crate.ts")["CrateError"]
let toCrateError: typeof import("../utils/crate.ts")["toCrateError"]

before(async () => {
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
	process.env.CRATE_HOSTS = "127.0.0.1"
	process.env.CRATE_PORT = String((server.address() as AddressInfo).port)
	process.env.CRATE_USER = "test"
	process.env.CRATE_PASS = "test"
	console.error = () => {}
	console.trace = () => {}
	console.log = () => {}
	// Suppress cache.ts's import-time cluster connection; nothing here reads the cache.
	const originalConnect = Redis.Cluster.prototype.connect
	Redis.Cluster.prototype.connect = async () => {}
	;({ _getStreamingProviders } = await import("./streaming-providers.server.ts"))
	;({ CrateError, toCrateError } = await import("../utils/crate.ts"))
	Redis.Cluster.prototype.connect = originalConnect
})

afterEach(() => {
	statements.length = 0
})

after(async () => {
	console.error = consoleError
	console.trace = consoleTrace
	console.log = consoleLog
	server.closeAllConnections()
	await new Promise((done) => server.close(done))
})

const orderOf = (stmt: string) =>
	stmt.replace(/\s+/g, " ").match(/ORDER BY (.*) ASC/)?.[1]

test("a country with a key is ordered by that country", async () => {
	answer = () => rows([[8, "Netflix"]])
	const providers = await _getStreamingProviders({ country: "US" })
	assert.deepEqual(statements.map(orderOf), ["order_by_country['US']"])
	assert.equal(providers[0].name, "Netflix")
})

test("a country without a key gets the default order", async () => {
	answer = (stmt) =>
		stmt.includes("order_by_country['CN']")
			? columnUnknown("CN")
			: rows([
					[8, "Netflix"],
					[337, "Disney Plus"],
				])
	const providers = await _getStreamingProviders({ country: "CN" })
	assert.deepEqual(statements.map(orderOf), [
		"order_by_country['CN']",
		"order_default",
	])
	// Crate refuses to order a DISTINCT result by a column that isn't selected.
	for (const stmt of statements)
		assert.match(stmt, /SELECT DISTINCT[^]*order_default[^]*FROM/)
	assert.deepEqual(
		providers.map(({ id }) => id),
		[8, 337],
	)
})

test("another Crate failure leaves the function as an Error with Crate's code", async () => {
	answer = () => ({
		status: 404,
		body: {
			error: {
				message: "RelationUnknown[Relation 'streaming_service' unknown]",
				code: 4041,
			},
		},
	})
	await assert.rejects(_getStreamingProviders({ country: "US" }), (error) => {
		assert.ok(error instanceof CrateError)
		assert.match(error.message, /^RelationUnknown\[/)
		assert.equal(error.code, 4041)
		return true
	})
	// No retry with the default order for a failure that isn't about the country's key.
	assert.equal(statements.length, 1)
})

test("a failure of the default order statement is not swallowed", async () => {
	answer = (stmt) =>
		stmt.includes("order_by_country['CN']")
			? columnUnknown("CN")
			: {
					status: 500,
					body: {
						error: { message: "SQLParseException[boom]", code: 4000 },
					},
				}
	await assert.rejects(
		_getStreamingProviders({ country: "CN" }),
		/SQLParseException/,
	)
	assert.equal(statements.length, 2)
})

test("a value that isn't a two-letter code never reaches the statement text", async () => {
	answer = () => rows([[8, "Netflix"]])
	const values = [
		"",
		"us",
		"USA",
		"U",
		"U1",
		"US'] ASC, (SELECT 1) --",
		"'] OR 1=1 --",
		"US\n",
		" US",
		"ÄÖ",
	]
	for (const country of values) {
		statements.length = 0
		const providers = await _getStreamingProviders({ country })
		assert.deepEqual(statements.map(orderOf), ["order_default"], country)
		assert.equal(providers.length, 1)
		for (const stmt of statements)
			assert.ok(!stmt.includes("order_by_country["), country)
	}
})

test("the client keeps an Error as it is and turns the driver's object into one", () => {
	const timeout = new Error("timeout")
	assert.equal(toCrateError(timeout), timeout)
	const refused = toCrateError({ message: "ColumnUnknownException[x]", code: 4043 })
	assert.ok(refused instanceof Error)
	assert.equal(refused.message, "ColumnUnknownException[x]")
	assert.equal((refused as InstanceType<typeof CrateError>).code, 4043)
	assert.ok(toCrateError(undefined) instanceof Error)
	assert.ok(toCrateError("plain text").message.includes("plain text"))
})
