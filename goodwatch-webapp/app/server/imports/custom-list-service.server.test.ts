import "../tracking-loader.test-support.ts"
import "react/jsx-runtime"
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import * as nodeModule from "node:module"
import ts from "typescript"
import { afterEach, it } from "node:test"
import { ImportDb } from "./import-db.test-support.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (s: string, c: unknown) => unknown,
		): unknown
		load(
			url: string,
			context: unknown,
			next: (u: string, c: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		return specifier.endsWith(".svg?raw")
			? {
					url: new URL(`../../${specifier.slice(2)}`, import.meta.url).href,
					shortCircuit: true,
				}
			: next(specifier, context)
	},
	load(url, context, next) {
		if (url.endsWith(".svg?raw"))
			return {
				format: "module",
				source: `export default ${JSON.stringify(readFileSync(new URL(url), "utf8"))}`,
				shortCircuit: true,
			}
		if (url.endsWith(".tsx") || url.endsWith("/share-lists/store.server.ts"))
			return {
				format: "module",
				source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
						jsx: ts.JsxEmit.ReactJSX,
					},
				}).outputText,
				shortCircuit: true,
			}
		return next(url, context)
	},
})
process.env.REDIS_HOST = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const {
	previewImport,
	getImportResult,
	getImportItems,
	confirmImport,
	getImport,
	undoImport,
} = await import("./service.server.ts")
const { getList } = await import("../share-lists/store.server.ts")
class ListCrate {
	lists = new Map<string, Record<string, unknown>>()
	failAfterInsert = false
	failAfterDelete = false
	async execute(sql: string, params: unknown[] = []) {
		const s = sql.trim().replace(/\s+/g, " ")
		if (s.startsWith("REFRESH ")) return { json: [], rowcount: 0 }
		if (s.startsWith("SELECT ") && s.includes("FROM doc.user_profile"))
			return { json: [] }
		if (
			s.startsWith("SELECT ") &&
			s.includes("FROM doc.user_list WHERE id = ?")
		) {
			const row = this.lists.get(String(params[0]))
			return {
				json:
					row && (!s.includes("deleted_at IS NULL") || row.deleted_at == null)
						? [row]
						: [],
			}
		}
		if (s.startsWith("SELECT ") && s.includes("FROM movie "))
			return {
				json: params.map((tmdb_id) => ({
					tmdb_id,
					title: `Movie ${tmdb_id}`,
					release_year: 2000,
				})),
			}
		if (s.startsWith("SELECT ") && s.includes("FROM show "))
			return {
				json: params.map((tmdb_id) => ({
					tmdb_id,
					title: `Show ${tmdb_id}`,
					release_year: 2020,
				})),
			}
		if (s.startsWith("INSERT INTO doc.user_list ")) {
			const columns = s.match(/\(([^)]+)\) VALUES/)![1].split(", ")
			const row = Object.fromEntries(
				columns.map((key, at) => [key, params[at]]),
			)
			if (this.lists.has(String(row.id))) throw new Error("duplicate key")
			this.lists.set(String(row.id), row)
			if (this.failAfterInsert) {
				this.failAfterInsert = false
				throw new Error("Lost create response")
			}
			return { json: [], rowcount: 1 }
		}
		if (s.startsWith("UPDATE doc.user_list SET deleted_at = ?")) {
			const row = this.lists.get(String(params[2]))
			if (!row || row.user_id !== params[3] || row.deleted_at != null)
				return { json: [], rowcount: 0 }
			row.deleted_at = params[0]
			if (this.failAfterDelete) {
				this.failAfterDelete = false
				throw new Error("Lost delete response")
			}
			return { json: [], rowcount: 1 }
		}
		throw new Error(`Unexpected list SQL: ${s}`)
	}
}
afterEach(() => {
	setImportDbForTest()
	setImportEffectsForTest()
	setCrateClientForTest(null)
})
const archive = () =>
	zipFixture({
		"lists-lists.json": JSON.stringify([
			{
				name: "Source discoveries",
				description: "A source description",
				ids: { trakt: 91 },
				items: [
					{
						rank: 2,
						type: "show",
						show: { title: "Synthetic show", year: 2020, ids: { tmdb: 43 } },
						notes: "Second note",
					},
					{
						rank: 1,
						type: "movie",
						movie: {
							title: "Synthetic movie",
							year: 1995,
							ids: { imdb: "tt0114709" },
						},
						notes: "First note\nSecond line",
					},
					{
						rank: 3,
						type: "movie",
						movie: { title: "Unmatched movie", ids: { imdb: "tt9999999" } },
						notes: "Retained in preview",
					},
				],
			},
		]),
	})
async function finish(id: string) {
	for (let attempt = 0; attempt < 200; attempt++) {
		const current = await getImport("member", id)
		if (current.status === "done" || current.status === "failed") return current
		await new Promise((r) => setTimeout(r, 5))
	}
	assert.fail("Import did not finish")
}
it("previews source lists, creates private ordered lists in the existing store, repeats as a second list, and Undo deletes only its created list", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Synthetic movie",
			release_year: 1995,
		},
		{ tmdb_id: 43, title: "Synthetic show", release_year: 2020 },
	]
	const lists = new ListCrate()
	setCrateClientForTest(lists)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const created: string[] = []
	for (let copy = 0; copy < 2; copy++) {
		const preview = await previewImport(
			"member",
			"trakt",
			"synthetic-trakt.zip",
			archive(),
		)
		assert.equal(preview.kinds.list, 1)
		const row = (
			await getImportItems("member", preview.id, undefined, 0, 200)
		).items.find((row) => row.kind === "list")!
		assert.equal(row.outcome, "new")
		assert.equal(row.customList?.entries[0].entry.tmdbId, 862)
		assert.equal(row.customList?.entries[2].entry.problem?.outcome, "unmatched")
		if (process.env.CUSTOM_LIST_PREVIEW_OUTPUT) {
			writeFileSync(
				process.env.CUSTOM_LIST_PREVIEW_OUTPUT,
				JSON.stringify(preview),
			)
			writeFileSync(
				`${process.env.CUSTOM_LIST_PREVIEW_OUTPUT}.items.json`,
				JSON.stringify({ items: [row], total: 1 }),
			)
		}
		await confirmImport("member", preview.id, {
			kinds: ["list"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		assert.equal((await finish(preview.id)).status, "done")
		assert.deepEqual(
			(await getImportResult("member", preview.id)).customLists,
			{ created: 1, deleted: 0 },
		)
		const stored = (
			await getImportItems("member", preview.id, undefined, 0, 200)
		).items.find((row) => row.kind === "list")!
		const id = stored.customList!.createdId!
		created.push(id)
		const list = await getList(id)
		assert.equal(list?.title, "Source discoveries")
		assert.equal(list?.visibility, "private")
		assert.deepEqual(
			list?.items.map((item) => [item.media_type, item.tmdb_id]),
			[
				["movie", 862],
				["show", 43],
			],
		)
		assert.equal(list?.collection?.description, "A source description")
		assert.equal(
			list?.collection?.notes["movie:862"],
			"First note\nSecond line",
		)
		await confirmImport("member", preview.id, {
			kinds: ["list"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		assert.equal(lists.lists.size, copy + 1)
		if (copy === 1) {
			await undoImport("member", preview.id)
			assert.deepEqual(
				(await getImportResult("member", preview.id)).customLists,
				{ created: 0, deleted: 1 },
			)
			assert.equal(await getList(id), null)
			assert.ok(await getList(created[0]))
		}
	}
	assert.notEqual(created[0], created[1])
	assert.equal(db.wishlist.length, 0)
	assert.equal(db.scores.length, 0)
})

it("declining Lists creates none; a Letterboxd list imports without changing library intent, and IMDb uses its supplied list name", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Synthetic movie",
			release_year: 1995,
		},
	]
	const lists = new ListCrate()
	setCrateClientForTest(lists)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const csv =
		"Letterboxd list export v7\nDate,Name,Tags,URL,Description\n2020-01-01,Source Letterboxd name,,,Description\nPosition,Name,Year,URL,Description\n1,Synthetic movie,1995,,Note\n"
	const skipped = await previewImport(
		"member",
		"letterboxd",
		"synthetic.zip",
		zipFixture({ "lists/source.csv": csv }),
	)
	await confirmImport("member", skipped.id, {
		kinds: [],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finish(skipped.id)).status, "done")
	assert.equal(lists.lists.size, 0)
	const preview = await previewImport(
		"member",
		"letterboxd",
		"synthetic.zip",
		zipFixture({ "lists/source.csv": csv }),
	)
	await confirmImport("member", preview.id, {
		kinds: ["list"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finish(preview.id)).status, "done")
	assert.equal(
		(
			await getList(
				(
					await getImportItems("member", preview.id, undefined, 0, 200)
				).items[0].customList!.createdId!,
			)
		)?.title,
		"Source Letterboxd name",
	)
	const { createImdbFilePreview } = await import(
		"../imdb-import/dispatch.server.ts"
	)
	const imdb = await createImdbFilePreview(
		"member",
		"Original IMDb name.csv",
		"Position,Const,Created,Description,Title,Title Type\n1,tt0114709,2020-02-01,IMDb note,Synthetic movie,Movie\n",
		"custom-list",
		"Exact source name",
	)
	assert.ok("source" in imdb)
	const item = (
		await getImportItems("member", imdb.id, undefined, 0, 200)
	).items.find((row) => row.kind === "list")!
	assert.equal(item.customList?.name, "Exact source name")
	await confirmImport("member", imdb.id, {
		kinds: ["list"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finish(imdb.id)).status, "done")
	const stored = (
		await getImportItems("member", imdb.id, undefined, 0, 200)
	).items.find((row) => row.kind === "list")!
	assert.equal(
		(await getList(stored.customList!.createdId!))?.collection?.notes[
			"movie:862"
		],
		"IMDb note",
	)
	await undoImport("member", imdb.id)
	assert.equal(await getList(stored.customList!.createdId!), null)
	assert.equal(db.wishlist.length, 0)
})

it("resuming after a lost list-create or delete response uses the durable list ID, with no duplicate and no orphan", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Synthetic movie",
			release_year: 1995,
		},
		{ tmdb_id: 43, title: "Synthetic show", release_year: 2020 },
	]
	const lists = new ListCrate()
	setCrateClientForTest(lists)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	lists.failAfterInsert = true
	const preview = await previewImport(
		"member",
		"trakt",
		"synthetic.zip",
		archive(),
	)
	const options = {
		kinds: ["list" as const],
		conflictChoice: "keep" as const,
		watchDates: "preserve" as const,
	}
	await confirmImport("member", preview.id, options)
	assert.equal((await finish(preview.id)).status, "failed")
	assert.equal(lists.lists.size, 1)
	await confirmImport("member", preview.id, options)
	assert.equal((await finish(preview.id)).status, "done")
	assert.equal(lists.lists.size, 1)
	const item = (await getImportItems("member", preview.id, undefined, 0, 200))
		.items[0]
	lists.failAfterDelete = true
	await assert.rejects(undoImport("member", preview.id), /Lost delete response/)
	assert.equal((await getImport("member", preview.id)).status, "failed")
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(await getList(item.customList!.createdId!), null)
})

it("keeps separate ranked source notes when two entries resolve to the same canonical title", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Synthetic movie",
			release_year: 1995,
		},
	]
	const lists = new ListCrate()
	setCrateClientForTest(lists)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const file = zipFixture({
		"lists-lists.json": JSON.stringify([
			{
				name: "Two source entries",
				ids: { trakt: 94 },
				items: [
					{
						rank: 1,
						type: "movie",
						movie: { title: "Synthetic movie", ids: { tmdb: 862 } },
						notes: "First source note",
					},
					{
						rank: 2,
						type: "movie",
						movie: { title: "Synthetic movie", ids: { imdb: "tt0114709" } },
						notes: "Second source note",
					},
				],
			},
		]),
	})
	const preview = await previewImport("member", "trakt", "synthetic.zip", file)
	await confirmImport("member", preview.id, {
		kinds: ["list"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finish(preview.id)).status, "done")
	const item = (await getImportItems("member", preview.id, undefined, 0, 200))
		.items[0]
	const stored = await getList(item.customList!.createdId!)
	assert.deepEqual(
		stored?.items.map((entry) => entry.tmdb_id),
		[862, 862],
	)
	assert.deepEqual(stored?.collection?.entryNotes, [
		"First source note",
		"Second source note",
	])
})
