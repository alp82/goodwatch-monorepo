import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { afterEach, it } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const service = await import("./service.server.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const { clearResultCacheForTest } = await import("./result-catalog.server.ts")
afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
	clearResultCacheForTest()
})

type Row = Record<string, unknown>
const movie = {
	tmdb_id: 862,
	title: "Toy Story",
	release_year: 1995,
	poster_path: null,
	adult: false,
}
const offer = {
	media_type: "movie",
	media_tmdb_id: 862,
	stream_url: "https://www.netflix.com/title/8001",
}
async function setup(items: unknown[]) {
	const db = new ImportDb()
	db.catalog = [{ ...movie, imdb_id: "tt0114709" }]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const parent = await service.previewImport(
		"member",
		"wishlist",
		"capture.json",
		new TextEncoder().encode(
			JSON.stringify({
				format: "goodwatch-wishlist",
				version: 1,
				source: "netflix",
				completeness: "unknown",
				items,
			}),
		),
	)
	return { db, parent }
}
async function withCatalog(
	read: (
		sql: string,
		args: unknown[],
		signal: AbortSignal,
	) => Row[] | Promise<Row[]>,
	run: () => Promise<void>,
) {
	const host = process.env.CRATE_HOSTS
	const port = process.env.CRATE_PORT
	const server = createServer(async (request, response) => {
		const controller = new AbortController()
		response.once("close", () => controller.abort())
		try {
			const chunks: Buffer[] = []
			for await (const chunk of request) chunks.push(chunk)
			const input = JSON.parse(Buffer.concat(chunks).toString())
			const rows = await read(input.stmt, input.args, controller.signal)
			const cols = [...new Set(rows.flatMap((row) => Object.keys(row)))]
			response.setHeader("Content-Type", "application/json")
			response.end(
				JSON.stringify({
					cols,
					rows: rows.map((row) => cols.map((col) => row[col] ?? null)),
					rowcount: rows.length,
				}),
			)
		} catch {
			response.writeHead(400).end(JSON.stringify({ error: "Fixture failure" }))
		}
	})
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	process.env.CRATE_HOSTS = "127.0.0.1"
	process.env.CRATE_PORT = String(address.port)
	setCrateClientForTest(null)
	try {
		await run()
	} finally {
		server.closeAllConnections()
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		)
		if (host === undefined) Reflect.deleteProperty(process.env, "CRATE_HOSTS")
		else process.env.CRATE_HOSTS = host
		if (port === undefined) Reflect.deleteProperty(process.env, "CRATE_PORT")
		else process.env.CRATE_PORT = port
		setCrateClientForTest(new FakeTrackingCrate())
	}
}

function catalog(sql: string): Row[] {
	if (sql.includes("FROM streaming_availability")) return [offer]
	if (sql.includes("FROM movie ")) return [movie]
	return []
}

it("suggests one native-ID corroborated local title without changing its unknown source, then accepts it through preview, Confirm, receipt and Undo", async () => {
	const { parent } = await setup([
		{ title: "Source label", mediaType: "unknown", sourceId: "8001" },
	])
	await withCatalog(catalog, async () => {
		const suggestions = await service.getWishlistSuggestions(
			"member",
			parent.id,
		)
		assert.deepEqual(suggestions, {
			groups: [
				{
					representativeIndex: 0,
					state: "suggested",
					proposal: {
						mediaType: "movie",
						tmdbId: 862,
						title: "Toy Story",
						year: 1995,
						posterPath: null,
					},
				},
			],
			total: 1,
			offset: 0,
			hasMore: false,
			nextOffset: null,
		})
		const items = await service.getImportItems(
			"member",
			parent.id,
			undefined,
			0,
			50,
		)
		assert.equal(items.items[0].wishlistOriginal?.mediaType, "unknown")
		assert.equal(items.items[0].wishlistResolution, undefined)
		assert.equal(items.items[0].outcome, "unmatched")
	})
	const child = await service.resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	await service.confirmImport("member", child.import.id, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	for (let index = 0; index < 100; index++) {
		if ((await service.getImport("member", child.import.id)).status === "done")
			break
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.equal(
		(await service.getImport("member", child.import.id)).status,
		"done",
	)
	const result = await service.getImportResult("member", child.import.id)
	assert.ok(JSON.stringify(result).includes("Toy Story"))
	await service.undoImport("member", child.import.id)
	assert.equal(
		(await service.getImport("member", child.import.id)).status,
		"undone",
	)
})

it("finds a localized alias missed by both typed title searches and deduplicates repeated aliases before catalog validation", async () => {
	const { parent } = await setup([
		{ title: "Spielzeuggeschichte", mediaType: "unknown", sourceId: "8001" },
	])
	await withCatalog(
		(sql) => {
			if (
				sql.includes("FROM translation ") ||
				sql.includes("FROM alternative_title ")
			)
				return [
					{
						media_type: "movie",
						media_tmdb_id: 862,
						title: "Spielzeuggeschichte",
					},
					{
						media_type: "movie",
						media_tmdb_id: 862,
						title: "Spielzeuggeschichte",
					},
				]
			if (sql.includes("MATCH((title,original_title)")) return []
			return catalog(sql)
		},
		async () => {
			const result = await service.getWishlistSuggestions("member", parent.id)
			assert.equal(result.groups[0].state, "suggested")
			assert.equal(result.groups[0].proposal?.tmdbId, 862)
		},
	)
})

it("corroborates only strict Netflix detail URLs and one trusted wrapper, rejecting hostile URL normalization and provider conflicts", async () => {
	const { parent } = await setup([
		{ title: "Source label", mediaType: "unknown", sourceId: "8001" },
	])
	const context = (provider: string) =>
		Buffer.from(
			JSON.stringify({
				schema: "iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0",
				data: [
					{
						schema: "iglu:com.justwatch/clickout_context/jsonschema/1-1-0",
						data: { provider, providerId: 8 },
					},
				],
			}),
		).toString("base64url")
	const wrapped = (target: string) =>
		`https://click.justwatch.com/a?r=${encodeURIComponent(target)}`
	const valid = [
		offer.stream_url,
		"https://netflix.com/de/title/8001/?trackId=123",
		wrapped(offer.stream_url),
		`${wrapped(offer.stream_url)}&cx=${context("Netflix")}&uct_country=DE`,
		`${wrapped(offer.stream_url)}&cx=${context("Netflix")}&uct_country=de`,
	]
	const invalid = [
		"http://www.netflix.com/title/8001",
		"https://www.netflix.com.evil.invalid/title/8001",
		"https://user:pass@www.netflix.com/title/8001",
		"https://www.netflix.com:444/title/8001",
		"https://www.netflix.com/watch/8001",
		"https://www.netflix.com/title/08001",
		"https://www.netflix.com/title/8001/extra",
		"https://www.netflix.com/title/8001#secret",
		"https://www.netflix.com/watch/../title/8001",
		"https://www.netflix.com/%2e%2e/title/8001",
		"https://www.net\nflix.com/title/8001",
		"https://www.netflix.com\\title\\8001",
		wrapped(offer.stream_url).replace("https:", "http:"),
		wrapped(offer.stream_url).replace(
			"click.justwatch.com",
			"user:pass@click.justwatch.com",
		),
		wrapped(offer.stream_url).replace(
			"click.justwatch.com",
			"click.justwatch.com:444",
		),
		`${wrapped(offer.stream_url)}&r=${encodeURIComponent(offer.stream_url)}`,
		wrapped(wrapped(offer.stream_url)),
		wrapped("https://www.net\nflix.com/title/8001"),
		`${wrapped(offer.stream_url)}&cx=${context("Amazon Prime Video")}`,
		`${wrapped(offer.stream_url)}&cx=bad`,
	]
	for (const stream_url of [...valid, ...invalid])
		await withCatalog(
			(sql) =>
				sql.includes("FROM streaming_availability")
					? [{ ...offer, stream_url }]
					: catalog(sql),
			async () => {
				const result = await service.getWishlistSuggestions("member", parent.id)
				assert.equal(
					result.groups[0].state,
					valid.includes(stream_url) ? "suggested" : "manual",
					`URL case ${[...valid, ...invalid].indexOf(stream_url)}`,
				)
			},
		)
})

it("keeps a source-year contradiction and conflicting duplicate source evidence for manual review", async () => {
	const { parent } = await setup([
		{
			title: "Source label",
			mediaType: "unknown",
			sourceId: "8001",
			year: 2020,
		},
		{ title: "First label", mediaType: "unknown", sourceId: "8002" },
		{ title: "Conflicting label", mediaType: "unknown", sourceId: "8002" },
	])
	await withCatalog(catalog, async () => {
		const result = await service.getWishlistSuggestions("member", parent.id)
		assert.deepEqual(
			result.groups.map((row) => [row.state, row.reason]),
			[
				["manual", "source_metadata_conflict"],
				["manual", "conflicting_source_evidence"],
			],
		)
	})
})

it("paginates source groups ten at a time with bounded catalog work, and preserves accepted choices on the derived preview", async () => {
	const { parent } = await setup(
		Array.from({ length: 11 }, (_, index) => ({
			title: "Source label",
			mediaType: "unknown",
			sourceId: String(8001 + index),
		})),
	)
	let active = 0
	let peak = 0
	await withCatalog(
		async (sql) => {
			active++
			peak = Math.max(peak, active)
			await new Promise((resolve) => setTimeout(resolve, 5))
			active--
			return catalog(sql)
		},
		async () => {
			const first = await service.getWishlistSuggestions("member", parent.id)
			assert.equal(first.groups.length, 10)
			assert.equal(first.total, 11)
			assert.equal(first.nextOffset, 10)
			assert.equal(first.hasMore, true)
			assert.ok(
				peak <= 6,
				`At most three groups with two typed reads each: ${peak}`,
			)
			const last = await service.getWishlistSuggestions("member", parent.id, 10)
			assert.equal(last.groups.length, 1)
			assert.equal(last.groups[0].representativeIndex, 10)
			assert.equal(last.nextOffset, null)
		},
	)
	const child = await service.resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	await withCatalog(catalog, async () => {
		const result = await service.getWishlistSuggestions(
			"member",
			child.import.id,
		)
		assert.deepEqual(result.groups[0], {
			representativeIndex: 0,
			state: "already_resolved",
		})
	})
})

it("retains native-ID evidence on retired catalog aliases while returning canonical display metadata", async () => {
	const { parent } = await setup([
		{ title: "Source label", mediaType: "unknown", sourceId: "8001" },
	])
	await withCatalog(
		(sql, args) => {
			if (
				sql.includes("MATCH((title,original_title)") &&
				sql.includes("FROM movie ")
			)
				return [{ tmdb_id: 162483 }]
			if (sql.includes("FROM movie "))
				return [{ ...movie, tmdb_id: 10679, title: "Canonical work" }]
			if (sql.includes("FROM streaming_availability"))
				return args.includes(162483)
					? [{ ...offer, media_tmdb_id: 162483 }]
					: []
			return []
		},
		async () => {
			const result = await service.getWishlistSuggestions("member", parent.id)
			assert.deepEqual(result.groups[0].proposal, {
				mediaType: "movie",
				tmdbId: 10679,
				title: "Canonical work",
				year: 1995,
				posterPath: null,
			})
		},
	)
})

it("keeps cross-type native-ID collisions manual and never promotes adult or missing local targets", async () => {
	const { parent } = await setup([
		{ title: "Same name", mediaType: "unknown", sourceId: "8001" },
	])
	for (const mode of ["collision", "adult", "missing"] as const)
		await withCatalog(
			(sql, args) => {
				if (sql.includes("FROM movie "))
					return mode === "missing"
						? []
						: [{ ...movie, adult: mode === "adult" }]
				if (sql.includes("FROM show "))
					return mode === "collision" ? [{ ...movie, tmdb_id: 42 }] : []
				if (sql.includes("FROM streaming_availability"))
					return [{ ...offer, media_tmdb_id: args[0] === "show" ? 42 : 862 }]
				return []
			},
			async () => {
				const result = await service.getWishlistSuggestions("member", parent.id)
				assert.deepEqual(result.groups[0], {
					representativeIndex: 0,
					state: "manual",
					reason:
						mode === "collision" ? "ambiguous_native_id" : "no_native_id_match",
				})
			},
		)
})

it("reports capped aliases, capped offers and failed optional lanes as unavailable even with a corroborated title candidate", async () => {
	const { parent } = await setup([
		{ title: "Source label", mediaType: "unknown", sourceId: "8001" },
	])
	for (const mode of ["alias_cap", "offer_cap", "alias_failure"] as const)
		await withCatalog(
			(sql) => {
				if (sql.includes("FROM translation ")) {
					if (mode === "alias_failure")
						throw new Error("Synthetic catalog failure")
					if (mode === "alias_cap")
						return Array.from({ length: 101 }, () => ({
							media_type: "movie",
							media_tmdb_id: 862,
						}))
				}
				if (mode === "offer_cap" && sql.includes("FROM streaming_availability"))
					return Array.from({ length: 5001 }, () => offer)
				return catalog(sql)
			},
			async () => {
				const result = await service.getWishlistSuggestions("member", parent.id)
				assert.deepEqual(result.groups[0], {
					representativeIndex: 0,
					state: "unavailable",
					reason: "catalog_unavailable",
				})
			},
		)
})

it("cancels in-flight catalog reads and leaves queued groups unavailable rather than starting further reads", async () => {
	const { parent } = await setup(
		Array.from({ length: 10 }, (_, index) => ({
			title: "Source label",
			mediaType: "unknown",
			sourceId: String(8001 + index),
		})),
	)
	const controller = new AbortController()
	let reads = 0
	await withCatalog(
		async (sql) => {
			reads++
			controller.abort()
			await new Promise((resolve) => setTimeout(resolve, 10))
			return catalog(sql)
		},
		async () => {
			const result = await service.getWishlistSuggestions(
				"member",
				parent.id,
				0,
				controller.signal,
			)
			assert.equal(result.groups.length, 10)
			assert.ok(
				result.groups.every(
					(row) =>
						row.state === "unavailable" && row.reason === "catalog_unavailable",
				),
			)
			await new Promise((resolve) => setTimeout(resolve, 20))
			assert.ok(reads <= 6)
		},
	)
})

it("does not search unsupported source identities, does not expose foreign previews and validates pagination", async () => {
	const { parent } = await setup([
		{
			title: "Source label",
			mediaType: "unknown",
			sourceId: "native-not-numeric",
		},
	])
	await withCatalog(
		() => {
			throw new Error("Must not query unsupported identity")
		},
		async () => {
			assert.deepEqual(
				(await service.getWishlistSuggestions("member", parent.id)).groups,
				[
					{
						representativeIndex: 0,
						state: "manual",
						reason: "unsupported_source",
					},
				],
			)
		},
	)
	await assert.rejects(
		service.getWishlistSuggestions("another-member", parent.id),
		{ status: 404 },
	)
	await assert.rejects(
		service.getWishlistSuggestions("member", parent.id, -1),
		{ status: 400, code: "wishlist_search_invalid" },
	)
})

it("aborts a stalled sibling catalog read before an early failure releases its group worker", async () => {
	const { parent } = await setup(
		Array.from({ length: 10 }, (_, index) => ({
			title: "Source label",
			mediaType: "unknown",
			sourceId: String(8001 + index),
		})),
	)
	let active = 0
	let peak = 0
	await withCatalog(
		async (sql, _args, signal) => {
			if (sql.includes("FROM show "))
				throw new Error("Synthetic early sibling failure")
			active++
			peak = Math.max(peak, active)
			await new Promise<void>((resolve) =>
				signal.addEventListener("abort", () => resolve(), { once: true }),
			)
			active--
			return []
		},
		async () => {
			const result = await service.getWishlistSuggestions("member", parent.id)
			assert.ok(result.groups.every((group) => group.state === "unavailable"))
			await new Promise((resolve) => setTimeout(resolve, 10))
			assert.equal(active, 0, "Every stalled SQL sibling was cancelled")
			assert.ok(peak <= 3, `Stalled reads respect group concurrency: ${peak}`)
		},
	)
})
