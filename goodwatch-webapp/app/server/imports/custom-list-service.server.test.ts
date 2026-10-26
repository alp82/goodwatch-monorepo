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
	previewFetchedImport,
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
	beforeDelete?: () => void
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
						? [
								s.includes("_seq_no AS seq")
									? {
											...row,
											seq: row._seq_no ?? 1,
											term: row._primary_term ?? 1,
										}
									: row,
							]
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
			row._seq_no = 1
			row._primary_term = 1
			this.lists.set(String(row.id), row)
			if (this.failAfterInsert) {
				this.failAfterInsert = false
				throw new Error("Lost create response")
			}
			return { json: [], rowcount: 1 }
		}
		if (s.startsWith("UPDATE doc.user_list SET deleted_at = ?")) {
			this.beforeDelete?.()
			this.beforeDelete = undefined
			const row = this.lists.get(String(params[2]))
			if (
				!row ||
				(s.includes("_seq_no = ?")
					? row._seq_no !== params[3] || row._primary_term !== params[4]
					: row.user_id !== params[3]) ||
				row.deleted_at != null
			)
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
		assert.equal(list?.collection?.entryNotes?.[0], "First note\nSecond line")
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
		(await getList(stored.customList!.createdId!))?.collection?.entryNotes?.[0],
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

it("keeps a large imported note once in collection metadata", async () => {
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
	const note = "A synthetic long list note. ".repeat(2000)
	const data = zipFixture({
		"lists-lists.json": JSON.stringify([
			{
				name: "Long source list",
				ids: { trakt: 95 },
				items: [
					{
						rank: 1,
						type: "movie",
						movie: { title: "Synthetic movie", ids: { tmdb: 862 } },
						notes: note,
					},
				],
			},
		]),
	})
	const preview = await previewImport("member", "trakt", "synthetic.zip", data)
	await confirmImport("member", preview.id, {
		kinds: ["list"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finish(preview.id)).status, "done")
	const row = [...lists.lists.values()][0]
	const metadata = JSON.parse(String(row.collection_metadata))
	assert.ok(Buffer.byteLength(String(row.collection_metadata)) > 32766)
	assert.deepEqual(metadata.entryNotes, [note])
	assert.equal("notes" in metadata, false)
})

it("Undo keeps imported lists that were edited or shared and records why they were not restored", async () => {
	for (const change of ["content", "visibility"]) {
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
		const preview = await previewImport(
			"member",
			"trakt",
			"synthetic.zip",
			archive(),
		)
		await confirmImport("member", preview.id, {
			kinds: ["list"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		assert.equal((await finish(preview.id)).status, "done")
		const item = (await getImportItems("member", preview.id, undefined, 0, 200))
			.items[0]
		const id = item.customList!.createdId!,
			row = lists.lists.get(id)!
		if (change === "content") row.content_hash = "member-edit"
		else row.visibility = "unlisted"
		await undoImport("member", preview.id)
		assert.ok(await getList(id))
		const kept = (await getImportItems("member", preview.id, undefined, 0, 200))
			.items[0]
		assert.match(kept.customList?.undoReason ?? "", /changed|shared/i)
		assert.equal(
			(await getImportResult("member", preview.id)).customLists?.notRestored,
			1,
		)
	}
})

it("Undo preserves a member edit arriving between its read and delete", async () => {
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
	const preview = await previewImport(
		"member",
		"trakt",
		"synthetic.zip",
		archive(),
	)
	await confirmImport("member", preview.id, {
		kinds: ["list"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finish(preview.id)).status, "done")
	const item = (await getImportItems("member", preview.id, undefined, 0, 200))
		.items[0]
	const id = item.customList!.createdId!,
		row = lists.lists.get(id)!
	lists.beforeDelete = () => {
		row.content_hash = "concurrent edit"
		row._seq_no = Number(row._seq_no ?? 1) + 1
	}
	await undoImport("member", preview.id)
	assert.ok(await getList(id))
	assert.match(
		(await getImportItems("member", preview.id, undefined, 0, 200)).items[0]
			.customList?.undoReason ?? "",
		/changed/i,
	)
})

it("TMDB fetched lists preview without library changes, Confirm privately, and Undo only the unchanged imported list", async () => {
	const { createTmdbClient } = await import("./tmdb-client.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 862, title: "Synthetic movie", release_year: 1995 },
		{ tmdb_id: 43, title: "Synthetic show", release_year: 2020 },
	]
	const lists = new ListCrate()
	setCrateClientForTest(lists)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const client = createTmdbClient({
		apiKey: "synthetic-app",
		sleep: async () => {},
		fetch: async (input) => {
			const path = new URL(String(input)).pathname
			if (path.endsWith("/lists"))
				return new Response(
					JSON.stringify({
						page: 1,
						total_pages: 1,
						total_results: 1,
						results: [
							{
								id: 9,
								name: "Source TMDB list",
								description: "TMDB description",
								item_count: 2,
							},
						],
					}),
				)
			if (path === "/3/list/9")
				return new Response(
					JSON.stringify({
						id: 9,
						name: "Source TMDB list",
						description: "TMDB description",
						item_count: 2,
						page: 1,
						total_pages: 1,
						total_results: 2,
						items: [
							{ id: 43, media_type: "tv", name: "Synthetic show" },
							{ id: 862, media_type: "movie", title: "Synthetic movie" },
						],
					}),
				)
			return new Response(
				JSON.stringify({
					page: 1,
					total_pages: 0,
					total_results: 0,
					results: [],
				}),
			)
		},
	})
	const parsed = await client.readAccount("42", "synthetic-session")
	for (const edited of [false, true]) {
		const preview = await previewFetchedImport("member", "TMDB account", parsed)
		assert.equal(preview.kinds.list, 1)
		assert.equal(lists.lists.size, edited ? 1 : 0)
		await confirmImport("member", preview.id, {
			kinds: ["list"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		assert.equal((await finish(preview.id)).status, "done")
		const row = (
			await getImportItems("member", preview.id, undefined, 0, 100)
		).items.find((row) => row.kind === "list")!
		const id = row.customList!.createdId!
		const saved = await getList(id)
		assert.equal(saved?.title, "Source TMDB list")
		assert.equal(saved?.visibility, "private")
		assert.equal(saved?.collection?.description, "TMDB description")
		assert.deepEqual(
			saved?.items.map((item) => [item.media_type, item.tmdb_id]),
			[
				["show", 43],
				["movie", 862],
			],
		)
		if (edited) {
			lists.lists.get(id)!.title = "Member edit"
			lists.lists.get(id)!.content_hash = "member-edit"
			lists.lists.get(id)!._seq_no = 2
		}
		await undoImport("member", preview.id)
		assert.equal(
			(await getList(id))?.title ?? null,
			edited ? "Member edit" : null,
		)
	}
	assert.equal(db.wishlist.length, 0)
	assert.equal(db.scores.length, 0)
})
