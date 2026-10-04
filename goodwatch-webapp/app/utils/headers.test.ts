import assert from "node:assert/strict"
import { test } from "node:test"
import { pageHeaders } from "./headers.ts"

test("page headers allow a child to shorten the shared lifetime, with privacy taking precedence", () => {
	const parent = "public, s-maxage=1800, stale-while-revalidate=7200"
	const short = "public, s-maxage=10, stale-while-revalidate=10"
	for (const [parentPolicy, loaderPolicy, expected] of [
		[parent, short, short],
		[short, parent, short],
		["private, no-store", short, "private, no-store"],
		[parent, "private, no-store", "private, no-store"],
		["", short, short],
	]) {
		const headers = pageHeaders({
			parentHeaders: new Headers(
				parentPolicy ? { "Cache-Control": parentPolicy } : {},
			),
			loaderHeaders: new Headers({ "Cache-Control": loaderPolicy }),
			actionHeaders: new Headers(),
			errorHeaders: new Headers(),
		})
		assert.equal(new Headers(headers).get("Cache-Control"), expected)
	}
	for (const source of [
		"parentHeaders",
		"loaderHeaders",
		"actionHeaders",
		"errorHeaders",
	] as const) {
		const inputs = {
			parentHeaders: new Headers({ "Cache-Control": parent }),
			loaderHeaders: new Headers({ "Cache-Control": short }),
			actionHeaders: new Headers(),
			errorHeaders: new Headers(),
		}
		inputs[source].set("Set-Cookie", "a=b")
		assert.equal(
			new Headers(pageHeaders(inputs)).get("Cache-Control"),
			"private, no-store",
		)
	}
})
