import { createEntityResolver } from "../../app/server/discover-query-entities.server.js"
// PROTOTYPE. Loopback-only lab; no production route, database or saved settings.
import { createServer } from "vite"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { loadEnv } from "vite"
import { createServer as createHttpServer } from "node:http"
import { loadFixtures } from "./fixtures.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))
const lab = fileURLToPath(new URL("./", import.meta.url))
const env = { ...loadEnv("development", root, ""), ...process.env }
const origin = env.DISCOVER_LAB_ORIGIN || "https://goodwatch.app"
const cache = new Map()
const port = Number(env.DISCOVER_LAB_PORT || 5198)
const vite = await createServer({
	configFile: false,
	root: lab,
	envFile: false,
	resolve: { alias: { "~": resolve(root, "app") } },
	server: {
		middlewareMode: true,
		hmr: { port: port + 1 },
		fs: { allow: [root] },
	},
})
const modulePath = resolve(
	root,
	"app/domain/discover-query.ts",
)
const json = (res, body, status = 200) => {
	res.statusCode = status
	res.setHeader("Content-Type", "application/json")
	res.setHeader("Cache-Control", "no-store")
	res.end(JSON.stringify(body))
}
async function body(req) {
	let text = ""
	for await (const chunk of req) {
		text += chunk
		if (text.length > 32000) throw Error("Request too large")
	}
	return JSON.parse(text)
}
const resolveEntity = createEntityResolver(fetch, origin)

async function providerCatalog(query) {
	if (cache.has("provider-catalog")) return cache.get("provider-catalog")
	try {
		const response = await fetch(new URL("/api/streaming-providers", origin), {
			signal: AbortSignal.timeout(8000),
		})
		if (!response.ok) return []
		const choices = await response.json()
		if (!Array.isArray(choices)) return []
		cache.set("provider-catalog", choices)
		return choices
	} catch {
		return []
	}
}
const server = createHttpServer(async (req, res) => {
	if (!req.url?.startsWith("/api/")) return vite.middlewares(req, res)
	// Browser calls must originate in this loopback lab.
	if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
		return json(res, { error: "Invalid origin" }, 403)
	try {
		const engine = await vite.ssrLoadModule(modulePath)
		if (req.url === "/api/config")
			return json(res, {
				fingerprintConfigured: Boolean(env.TYPESAFE_API_KEY),
				entitiesConfigured: true,
				origin,
				inventory: engine.ruleInventory,
				fixtures: await loadFixtures(lab),
			})
		if (req.url === "/api/preview" && req.method === "POST") {
			const input = await body(req)
			const interpreted = engine.interpret(
				String(input.query ?? ""),
				String(input.existing ?? ""),
				input.date ? new Date(input.date) : new Date(),
				input.additions ?? [],
				await providerCatalog(String(input.query ?? "")),
			)
			const params = new URLSearchParams(interpreted.filters)
			params.set("page", "1")
			const response = await fetch(
				new URL(`/api/discover/results?${params}`, origin),
				{ signal: AbortSignal.timeout(20000) },
			)
			if (!response.ok)
				throw Error(`Discover preview returned HTTP ${response.status}`)
			const data = await response.json()
			return json(res, {
				total: data.total,
				cards: data.cards,
				residual: interpreted.residual,
				state: data.state,
				sortUsed: data.sortUsed,
			})
		}
		if (req.url === "/api/interpret" && req.method === "POST") {
			const input = await body(req)
			const query = String(input.query ?? "").slice(0, 512)
			const now = input.date ? new Date(input.date) : new Date()
			if (!Number.isFinite(now.getTime())) throw Error("Invalid reference date")
			const providers = await providerCatalog(query)
			const initial = engine.interpret(
				query,
				String(input.existing ?? ""),
				now,
				[],
				providers,
			)
			const additions = [],
				warnings = []
			const attempted = new Set()
			const entityKey = (e) =>
				JSON.stringify([e.parameter, e.name, e.start, e.end, Boolean(e.bare)])
			let entityView = initial,
				resolutionPasses = 0
			// Resolving one reference can expose another in the leftover text.
			// Continue until no new references remain, regardless of word order.
			for (; resolutionPasses < 8; resolutionPasses++) {
				const pending = entityView.entities.filter(
					(e) => !attempted.has(entityKey(e)),
				)
				if (!pending.length) break
				for (const e of pending) attempted.add(entityKey(e))
				const resolved = await Promise.allSettled(
					pending.map((e) => resolveEntity(e)),
				)
				for (const [index, outcome] of resolved.entries()) {
					if (outcome.status === "fulfilled") {
						if (outcome.value) {
							additions.push(outcome.value)
							if (outcome.value.format)
								additions.push({
									parameter: "type",
									value: outcome.value.format,
									phrase: "format qualifier",
									source: "entity lookup",
									reason: "Format separated from the resolved reference",
								})
						}
					} else warnings.push(`Lookup unavailable for ${pending[index].name}`)
				}
				entityView = engine.interpret(
					query,
					String(input.existing ?? ""),
					now,
					additions,
					providers,
				)
			}
			if (entityView.entities.some((e) => !attempted.has(entityKey(e))))
				warnings.push(
					"Some references remain unresolved after the lab's eight lookup passes.",
				)
			let dimensions = [],
				decisions = [],
				usage = null,
				cached = false
			const start = performance.now()
			if (input.semantic && query) {
				if (!env.TYPESAFE_API_KEY)
					warnings.push(
						"Fingerprint read unavailable: set TYPESAFE_API_KEY in goodwatch-webapp/.env. Rule results remain usable.",
					)
				else {
					try {
						const key = `v2:${query.toLowerCase().replace(/\s+/g, " ")}`
						let reading = cache.get(key)
						cached = Boolean(reading)
						if (!reading) {
							const response = await fetch(
								"https://api.typesafe.ai/v1/systemone",
								{
									method: "POST",
									headers: {
										Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
										"Content-Type": "application/json",
									},
									body: JSON.stringify({
										...engine.readQuestions(query),
										model: "jev-1.13.0",
									}),
									signal: AbortSignal.timeout(15000),
								},
							)
							if (!response.ok)
								throw Error(`Fingerprint read returned HTTP ${response.status}`)
							reading = await response.json()
							if (!reading.answers)
								throw Error("Fingerprint read returned no answers")
							if (cache.size >= 500) cache.delete(cache.keys().next().value)
							cache.set(key, reading)
						}
						const decoded = engine.decodeRead(reading.answers)
						additions.push(...decoded.proposals)
						dimensions = decoded.dimensions
						decisions = decoded.decisions
						usage = reading.usage
					} catch (e) {
						warnings.push(`${e.message}. Showing rule results.`)
					}
				}
			}
			const result = engine.interpret(
				query,
				String(input.existing ?? ""),
				now,
				additions,
				providers,
			)
			return json(res, {
				...result,
				warnings: [...result.warnings, ...warnings],
				fingerprint: dimensions,
				entityResolution: {
					passes: resolutionPasses,
					attempts: attempted.size,
				},
				reading: {
					enabled: Boolean(input.semantic),
					cached,
					ms: Math.round(performance.now() - start),
					usage,
					decisions,
				},
				url: new URL(result.path, origin).href,
			})
		}
		return json(res, { error: "Not found" }, 404)
	} catch (e) {
		console.error(e.message)
		return json(res, { error: e.message }, 400)
	}
})
server.listen(port, "127.0.0.1", () =>
	console.log(`Discover query lab: http://127.0.0.1:${port}`),
)
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, async () => {
		server.close()
		await vite.close()
		process.exit(0)
	})
