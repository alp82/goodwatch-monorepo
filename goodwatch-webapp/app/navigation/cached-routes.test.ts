import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { test } from "node:test"
import { CACHED_ROUTE_IDS, WARM_ROUTE_IDS } from "./cached-routes.ts"

const routes = new URL("../routes/", import.meta.url)
const source = (id: string) => {
	const file = new URL(`${id.replace(/^routes\//, "")}.tsx`, routes)
	return existsSync(file) ? readFileSync(file, "utf8") : null
}

test("each cached route exports the cache's clientLoader with its own id", () => {
	for (const id of CACHED_ROUTE_IDS) {
		const code = source(id)
		assert.ok(code, `${id} has a route file`)
		assert.ok(
			code.includes(`export const clientLoader = cachedClientLoader("${id}")`),
			`${id} exports clientLoader`,
		)
	}
})

test("no route hydrates through a clientLoader or renders a fallback: the first load stays server rendered", () => {
	for (const name of readdirSync(routes)) {
		const code = readFileSync(new URL(name, routes), "utf8")
		assert.doesNotMatch(code, /clientLoader\.hydrate|HydrateFallback/, name)
		if (code.includes("cachedClientLoader("))
			assert.ok(
				CACHED_ROUTE_IDS.some((id) => code.includes(`"${id}"`)),
				name,
			)
	}
})

test("the warm-up loads only cached routes' code", () => {
	for (const id of WARM_ROUTE_IDS) assert.ok(CACHED_ROUTE_IDS.includes(id))
})
