import { test } from "node:test"
import assert from "node:assert/strict"
import { roomSearch, roomIntentKeys } from "./proposal-intent.ts"
import { createContinuousCatalog } from "./continuous-catalog.ts"
import { proposalCatalog } from "./proposal-catalog.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"
import type { CatalogReads } from "./catalog-adapter.ts"
const intent = {
	prompt: "A funny film",
	attributes: [{ text: "Funny", kind: "want" as const }],
	rankedKeys: [1000000000003, 1000000000001, 1000000000099],
	interpretedAt: 123,
}
test("Jev interpretation uses its own service authorization and rejects a failed or mismatched reading", async () => {
	const search = roomSearch(
		{ YEPWATCH_SEARCH_SECRET: "a".repeat(32) },
		async (input, init) => {
			const request = new Request(input, init)
			assert.equal(request.url, "https://goodwatch.app/api/combined-search")
			assert.equal(request.headers.get("x-goodwatch-consumer"), "yepwatch")
			assert.equal(request.headers.get("origin"), null)
			assert.deepEqual(await request.json(), {
				prompt: intent.prompt,
				country: "DE",
				serviceIds: [8],
			})
			return Response.json(intent)
		}
	)!
	assert.deepEqual(await search(intent.prompt, "DE", [8]), intent)
	for (const response of [
		new Response("", { status: 503 }),
		new Response("not json", { status: 200 }),
		Response.json({ prompt: intent.prompt }),
		Response.json({ ...intent, prompt: "Wrong prompt" }),
	]) {
		const unavailable = roomSearch(
			{ YEPWATCH_SEARCH_SECRET: "a".repeat(32) },
			async () => response
		)!
		await assert.rejects(unavailable(intent.prompt, "DE", [8]), {
			code: "busy",
			retryable: true,
		})
	}
})
test("Published prompt ranking changes actual cards, keeps availability checks, and cannot reinsert seen or ineligible titles", async () => {
	let checked: number[] = []
	const reads: CatalogReads = {
		async rankedKeys() {
			return [1000000000001, 1000000000002, 1000000000003]
		},
		async displays(keys) {
			return new Map(
				keys.map((key) => [
					key,
					{
						key,
						mediaType: "movie" as const,
						tmdbId: key % 1000000000000,
						title: `Movie ${key}`,
						year: 2020,
						overview: null,
						posterUrl: null,
						runtimeMinutes: 90,
					},
				])
			)
		},
		async episodes() {
			return []
		},
		async availability(titles, contexts) {
			checked.push(...titles.map((t) => t.key))
			return new Map(
				titles.map((t) => [
					t.key,
					contexts.map((s) => ({
						screenId: s.id,
						state: "watchable" as const,
						scope: "title" as const,
						checkedAt: Date.now(),
						offers: [
							{
								serviceId: 8,
								name: "Provider",
								url: null,
								kind: "where_to_watch" as const,
								offerType: "flatrate" as const,
							},
						],
					})),
				])
			)
		},
	}
	const catalog = proposalCatalog(
		createContinuousCatalog(reads, proposalFixtureCatalog.metadata, {
			rank: async (room, base) =>
				roomIntentKeys(
					room as import("./proposal-types.ts").ProposalRoom,
					base
				),
		})
	)
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(
			repo,
			catalog,
			"prompt-tests-secret-at-least-thirty-two",
			undefined,
			Date.now,
			undefined,
			async () => intent
		)
	const a = await service.create({
		contractVersion: 3,
		commandId: "create-intent",
		admissionSecret: "x".repeat(43),
		nickname: "Host",
	})
	const id = a.credential.roomId,
		credential = a.credential
	await service.command(id, credential, {
		commandId: "describe",
		sequence: 1,
		command: {
			type: "configure",
			expectedContextVersion: 1,
			country: "DE",
			serviceIds: [1],
			constraints: { kinds: ["movie"], moods: [], maxMinutes: null },
			prompt: intent.prompt,
		},
	})
	let s = await service.read(id, credential)
	await service.command(id, credential, {
		commandId: "start",
		sequence: 2,
		command: {
			type: "start",
			expectedContextVersion: s.shared.contextVersion,
			expectedRosterVersion: s.shared.rosterVersion,
			hostReady: true,
		},
	})
	s = await service.read(id, credential)
	assert.deepEqual(
		s.shared.candidates.map((c) => c.identity.tmdbId),
		[3, 1]
	)
	assert.deepEqual(checked, [1000000000003, 1000000000001])
	const room = (await repo.read(id))!.room
	const again = await catalog.page(room)
	assert.equal(again.candidates.length, 0)
	assert.equal(again.exhausted, true)
})
