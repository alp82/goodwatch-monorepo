import "./settings-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import type { LoaderFunctionArgs } from "@remix-run/node"
import { ImportDb } from "./import-db.test-support.ts"
const { setImportDbForTest } = await import("./store.server.ts")
const { previewFetchedImport } = await import("./service.server.ts")
const { loader } = await import("./settings-loader.server.ts")
afterEach(() => setImportDbForTest())
test("the return destination opens an owned TMDB preview absent from history, but rejects other members and sources", async () => {
	setImportDbForTest(new ImportDb())
	const preview = await previewFetchedImport("member", "TMDB account", {
		source: "tmdb",
		observations: [],
		warnings: [],
	})
	const load = (id: string, member = "member") =>
		loader({
			request: new Request(
				`https://goodwatch.test/settings/imports?source=tmdb&import=${id}`,
				{ headers: { Member: member } },
			),
			params: {},
			context: {},
		} as LoaderFunctionArgs).then((r) => r.json())
	const data = await load(preview.id)
	assert.equal(data.openImport, preview.id)
	assert.deepEqual(data.sourceImports, [])
	assert.equal((await load(preview.id, "other")).openImport, undefined)
	assert.equal((await load(preview.id, "")).openImport, undefined)
	const csv = await previewFetchedImport("member", "CSV", {
		source: "csv",
		observations: [],
		warnings: [],
	})
	assert.equal((await load(csv.id)).openImport, undefined)
	assert.equal((await load("missing")).openImport, undefined)
})

test("Plex return opens its owned fetched preview and does not cross sources", async () => {
	setImportDbForTest(new ImportDb())
	const preview = await previewFetchedImport("member", "Plex", {
		source: "plex",
		observations: [],
		warnings: [],
	})
	const load = (source: string) =>
		loader({
			request: new Request(
				`https://goodwatch.test/settings/imports?source=${source}&import=${preview.id}&connect=${preview.id}`,
				{ headers: { Member: "member" } },
			),
			params: {},
			context: {},
		} as LoaderFunctionArgs).then((r) => r.json())
	const data = await load("plex")
	assert.equal(data.initialSource, "plex")
	assert.equal(data.openImport, preview.id)
	assert.equal((await load("tmdb")).openImport, undefined)
})
