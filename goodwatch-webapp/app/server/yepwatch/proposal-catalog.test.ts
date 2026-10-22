import { test } from "node:test"
import assert from "node:assert/strict"
import { proposalCatalog } from "./proposal-catalog.server.ts"
import {
	proposalFixtureCatalog,
	ProposalMemoryRepository,
} from "./proposal-test-support.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { randomBytes } from "node:crypto"
test("Duration adapter distinguishes movie runtime from show average and preserves fresh evidence methods", async () => {
	const service = new ProposalService(
		new ProposalMemoryRepository(),
		proposalFixtureCatalog,
		"catalog-adapter-ordinary-secret-at-least32"
	)
	const a = await service.create({
		contractVersion: 3,
		commandId: "duration",
		admissionSecret: randomBytes(32).toString("base64url"),
		nickname: "A",
	})
	const room = (await service.repository.read(a.credential.roomId))!.room
	room.screens = [
		{ id: "tv", label: "TV", country: "DE", serviceIds: [1], confirmed: true },
	]
	room.participants[0].screenId = "tv"
	const source = await proposalFixtureCatalog.page(room)
	let refreshed = 0
	const base = {
		...proposalFixtureCatalog,
		page: async () => ({
			candidates: source.candidates.map((c) => ({
				...c,
				runtimeMinutes: c.identity.kind === "movie" ? 95 : 42,
			})),
			exhausted: true,
		}),
		recheck: async () => {
			refreshed++
			return source.candidates[0].availability
		},
	}
	const wrapped = proposalCatalog(base)
	const page = await wrapped.page(room)
	assert.deepEqual(
		page.candidates.find((c) => c.identity.kind === "movie")!.viewingDuration,
		{ minutes: 95, scope: "movie" }
	)
	assert.equal(
		page.candidates.find((c) => c.identity.kind !== "movie")!.viewingDuration,
		null
	)
	await wrapped.recheck(room, page.candidates[0])
	assert.equal(refreshed, 1)
})
