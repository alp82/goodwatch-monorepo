import assert from "node:assert/strict"
import { test } from "node:test"
import {
	ASSET_PROBE,
	assetSettings,
	createAssetAddress,
	createAssetProbe,
	isStaticHost,
	probeAsset,
} from "./asset-address.server.ts"
import { renderMetrics } from "./metrics/registry.server.ts"

const base = "https://static.example.com"
const production = { NODE_ENV: "production" }

test("settings default safely and warn once for each invalid setting", () => {
	const warnings: string[] = []
	const parse = (env: Record<string, string | undefined>) =>
		assetSettings({ ...production, ...env }, (line) => warnings.push(line))
	assert.deepEqual(parse({}), { mode: "origin", base: "", host: "" })
	assert.equal(parse({ STATIC_ASSETS: "unknown" }).mode, "origin")
	assert.equal(warnings.length, 1)
	assert.equal(parse({ STATIC_ASSETS: "auto" }).mode, "origin")
	assert.equal(warnings.length, 2)
	for (const host of [
		"https://static.example.com/path",
		"ftp://static.example.com",
		"a b",
		"https://user:pass@static.example.com",
		"https://static.example.com?x",
		"https://static.example.com#x",
	]) {
		assert.deepEqual(
			parse({ STATIC_ASSETS: "static", STATIC_ASSETS_HOST: host }),
			{
				mode: "origin",
				base: "",
				host: "",
			},
		)
	}
	assert.equal(warnings.length, 8)
})

test("hostnames and local origins are normalized, but development stays on origin", () => {
	assert.deepEqual(
		assetSettings({
			...production,
			STATIC_ASSETS: "auto",
			STATIC_ASSETS_HOST: " STATIC.Example.COM/ ",
		}),
		{
			mode: "auto",
			base,
			host: "static.example.com",
		},
	)
	assert.deepEqual(
		assetSettings({
			...production,
			STATIC_ASSETS: "static",
			STATIC_ASSETS_HOST: " http://127.0.0.1:3112/ ",
		}),
		{
			mode: "static",
			base: "http://127.0.0.1:3112",
			host: "127.0.0.1:3112",
		},
	)
	assert.deepEqual(
		assetSettings({
			...production,
			STATIC_ASSETS: "static",
			STATIC_ASSETS_HOST: "https://STATIC.EXAMPLE.COM:443/",
		}),
		{ mode: "static", base, host: "static.example.com" },
	)

	for (const NODE_ENV of [undefined, "test", "development"])
		assert.equal(
			assetSettings({
				NODE_ENV,
				STATIC_ASSETS: "static",
				STATIC_ASSETS_HOST: "static.example.com",
			}).mode,
			"origin",
		)
})

test("static host comparison is exact and case insensitive, including the port", () => {
	assert.equal(isStaticHost("STATIC.EXAMPLE.COM", "static.example.com"), true)
	assert.equal(
		isStaticHost("static.example.com:3112", "static.example.com:3112"),
		true,
	)
	for (const header of [
		undefined,
		"",
		"static.example.com",
		"static.example.com:443",
		"static.example.com:3112.evil",
		" static.example.com:3112",
	])
		assert.equal(isStaticHost(header, "static.example.com:3112"), false)
	assert.equal(isStaticHost("", ""), false)
})

test("auto switches immediately on its first success and requires three consecutive failures", () => {
	const lines: string[] = []
	const address = createAssetAddress({
		mode: "auto",
		base,
		log: (line) => lines.push(line),
	})
	assert.equal(address.base(), "")
	address.report(true)
	assert.equal(address.base(), base)
	address.report(false)
	address.report(false)
	address.report(true)
	address.report(false)
	address.report(false)
	assert.equal(address.base(), base)
	address.report(false)
	assert.equal(address.base(), "")
	assert.equal(lines.length, 2)
	assert.match(lines[0], /first probe succeeded/)
	assert.match(lines[1], /3 consecutive probe failures/)
})

test("a failed first probe requires two minutes of successes, restarted by any failure", () => {
	let time = 0
	const lines: string[] = []
	const address = createAssetAddress({
		mode: "auto",
		base,
		now: () => time,
		log: (line) => lines.push(line),
	})
	address.report(false)
	address.report(true)
	time = 119_999
	address.report(true)
	assert.equal(address.usesStatic(), false)
	address.report(false)
	time = 120_000
	address.report(true)
	time = 239_999
	address.report(true)
	assert.equal(address.base(), "")
	time = 240_000
	address.report(true)
	assert.equal(address.base(), base)
	for (let i = 0; i < 3; i++) address.report(false)
	address.report(true)
	time += 120_000
	address.report(true)
	assert.equal(address.base(), base)
	assert.equal(lines.length, 4)
	assert.match(lines[0], /first probe failed/)
	assert.match(lines[3], /2 minutes/)
})

test("forced modes ignore probe reports", () => {
	for (const mode of ["static", "origin"] as const) {
		const address = createAssetAddress({
			mode,
			base,
			log: () => assert.fail("unexpected switch"),
		})
		for (const ok of [false, false, false, true, true]) address.report(ok)
		assert.equal(address.base(), mode === "static" ? base : "")
	}
})

test("probe checks status, CORS, complete body, request options and thrown errors", async () => {
	for (const [status, cors, expected] of [
		[200, true, true],
		[200, false, false],
		[404, true, false],
	] as const) {
		assert.equal(
			await probeAsset(`${base}/assets/manifest.js`, async (url, init) => {
				assert.equal(url, `${base}/assets/manifest.js`)
				assert.equal(init?.method, "GET")
				assert.equal(init?.redirect, "error")
				assert.equal(
					new Headers(init?.headers).get("User-Agent"),
					"goodwatch-asset-probe",
				)
				assert.ok(init?.signal instanceof AbortSignal)
				return new Response("body", {
					status,
					headers: cors ? { "Access-Control-Allow-Origin": "*" } : {},
				})
			}),
			expected,
		)
	}
	assert.equal(
		await probeAsset(base, async () => {
			throw new Error("offline")
		}),
		false,
	)
	assert.equal(
		await probeAsset(
			base,
			async () =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new Error("body failed"))
						},
					}),
					{ headers: { "Access-Control-Allow-Origin": "*" } },
				),
		),
		false,
	)
})

test("probe loop starts once, waits for the body, schedules without overlap and stops", async () => {
	let finish!: () => void
	let calls = 0
	let next: (() => void) | undefined
	let stop!: () => unknown
	let cancelled = false
	const address = createAssetAddress({ mode: "auto", base, log: () => {} })
	const start = createAssetProbe({ mode: "auto", base }, address, {
		fetch: async () => {
			calls++
			return new Response(
				new ReadableStream({
					start(controller) {
						finish = () => controller.close()
					},
				}),
				{ headers: { "Access-Control-Allow-Origin": "*" } },
			)
		},
		schedule(run, ms) {
			assert.equal(ms, ASSET_PROBE.INTERVAL_MS)
			next = run
			return () => {
				cancelled = true
			}
		},
		shutdown(name, fn) {
			assert.equal(name, "asset probe")
			stop = fn
		},
	})
	const first = start("/assets/manifest.js")
	await start("/ignored")
	assert.equal(calls, 1)
	assert.equal(typeof next, "undefined")
	assert.equal(address.base(), "")
	finish()
	await first
	assert.equal(address.base(), base)
	assert.ok(next)
	stop()
	assert.equal(cancelled, true)
	next()
	assert.equal(calls, 1)
	for (const mode of ["static", "origin"] as const)
		await createAssetProbe({ mode, base }, address, {
			fetch: async () => {
				assert.fail("must not probe")
			},
		})("/assets/x.js")
})

test("singleton gauge survives a second module evaluation", async () => {
	const second = new URL("./asset-address.server.ts?second", import.meta.url)
		.href
	const again = await import(second)
	assert.equal(again.currentAssetBase(), "")
	const metrics = renderMetrics()
	assert.equal(
		metrics.split("# TYPE goodwatch_static_assets_in_use gauge").length,
		2,
	)
	assert.match(metrics, /goodwatch_static_assets_in_use\{mode="origin"\} 0/)
})
