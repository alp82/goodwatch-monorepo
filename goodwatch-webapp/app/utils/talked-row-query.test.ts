import assert from "node:assert/strict"
import { test } from "node:test"
import { talkedRowQuery } from "./talked-row-query.ts"

test("the new start row's URL and query key use the same normalized full language", async (t) => {
	const urls: string[] = []
	t.mock.method(globalThis, "fetch", async (url: string) => {
		urls.push(url)
		return Response.json({ row: { day: "2026-10-14", titles: [] } })
	})
	for (const language of ["fr", "zh-Hant", "pt-BR", "unsupported"]) {
		const query = talkedRowQuery(language)
		const normalized = query.queryKey[1]
		await query.queryFn()
		assert.equal(
			new URL(urls.at(-1)!, "https://goodwatch.test").searchParams.get(
				"displayLanguage",
			),
			normalized,
		)
	}
	assert.notDeepEqual(
		talkedRowQuery("en").queryKey,
		talkedRowQuery("fr").queryKey,
	)
	assert.notDeepEqual(
		talkedRowQuery("zh-Hans").queryKey,
		talkedRowQuery("zh-Hant").queryKey,
	)
	assert.equal(talkedRowQuery("unsupported").queryKey[1], "en")
})

test("an unavailable or disabled row keeps main's empty/error behavior", async (t) => {
	t.mock.method(
		globalThis,
		"fetch",
		async () => new Response(null, { status: 404 }),
	)
	assert.equal(await talkedRowQuery("fr").queryFn(), null)
	t.mock.method(
		globalThis,
		"fetch",
		async () => new Response(null, { status: 503 }),
	)
	await assert.rejects(talkedRowQuery("fr").queryFn(), /503/)
})
