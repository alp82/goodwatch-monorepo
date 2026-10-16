// The old Settings tabs that moved: their addresses stay in bookmarks, emails and other apps, so each answers with a
// permanent redirect to its new home, keeping the query.
import "../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const cases = [
	{
		route: "settings.country",
		from: "/settings/country",
		to: "/settings/where-you-watch",
	},
	{
		route: "settings.streaming",
		from: "/settings/streaming",
		to: "/settings/where-you-watch",
	},
]

for (const { route, from, to } of cases)
	test(`${from} redirects to ${to}`, async () => {
		const { loader } = await import(`../../routes/${route}.ts`)
		const response: Response = await loader({
			request: new Request(`https://goodwatch.app${from}?from=menu`),
			params: {},
			context: {},
		})
		assert.equal(response.status, 301)
		assert.equal(response.headers.get("Location"), `${to}?from=menu`)
	})
