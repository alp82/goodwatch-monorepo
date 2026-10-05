import assert from "node:assert/strict"
import { test } from "node:test"
import { json } from "@remix-run/node"
import { pageHeaders } from "../utils/headers.ts"
import {
	KEYED_PAGE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
	applyCachePolicy,
} from "./cache-identity.server.ts"
import { INCOMPLETE_PAGE_HEADERS } from "./incomplete-page.ts"
import { createPageCache } from "./page-cache.server.ts"

function documentHeaders(loaderHeaders: Headers) {
	return new Headers(
		pageHeaders({
			parentHeaders: new Headers({
				"Cache-Control": SHARED_PAGE_CACHE_CONTROL,
			}),
			loaderHeaders,
			actionHeaders: new Headers(),
			errorHeaders: undefined,
		}),
	)
}

test("incomplete loader responses stay private through the document and page cache", (t) => {
	const response = json({ initial: null }, { headers: INCOMPLETE_PAGE_HEADERS })
	const headers = documentHeaders(response.headers)
	assert.equal(response.status, 200)
	assert.equal(headers.get("Cache-Control"), "private, no-store")
	const routePolicy = headers.get("Cache-Control")
	const request = new Request("https://goodwatch.test/discover")
	const decision = applyCachePolicy(request, response.status, headers)
	assert.equal(decision, "private")
	assert.equal(headers.get("Cache-Control"), "private, no-store")
	const cache = createPageCache()
	t.after(() => cache.stop())
	assert.equal(cache.wants(request, 200, headers, decision, routePolicy), null)
})

test("loader responses without incomplete headers keep the anonymous cache policy", () => {
	const response = json({ initial: null })
	const headers = documentHeaders(response.headers)
	assert.equal(headers.get("Cache-Control"), SHARED_PAGE_CACHE_CONTROL)
	const request = new Request("https://goodwatch.test/discover?q=alien")
	assert.equal(applyCachePolicy(request, response.status, headers), "keyed")
	assert.equal(headers.get("Cache-Control"), KEYED_PAGE_CACHE_CONTROL)
})
