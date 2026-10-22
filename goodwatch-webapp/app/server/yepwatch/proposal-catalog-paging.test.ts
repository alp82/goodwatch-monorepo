import { proposalCatalog } from "./proposal-catalog.server.ts"
import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type {
	EpisodeIdentity,
	RoomCommand,
	RoomConstraints,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import type { CatalogReads, CatalogDisplay } from "./catalog-adapter.ts"
import { createContinuousCatalog } from "./continuous-catalog.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"
for (const mixed of [false, true])
	test(`Protocol3 saved continuation ${
		mixed ? "mixed" : "only"
	} pages deliver every canonical title once and preserve complete final saved map`, async () => {
		const saved = new Map<number, EpisodeIdentity>(
			Array.from({ length: 25 }, (_, i) => [
				100 + i,
				{ tmdbId: 10000 + i, season: 1, number: 2 },
			])
		)
		const shows = [...saved.keys(), ...(mixed ? [901, 902, 903] : [])]
		const movies = mixed ? [801, 802] : []
		const displays = new Map<number, CatalogDisplay>(
			[
				...shows.map((tmdbId) => ({
					key: 2_000_000_000_000 + tmdbId,
					mediaType: "show" as const,
					tmdbId,
				})),
				...movies.map((tmdbId) => ({
					key: 1_000_000_000_000 + tmdbId,
					mediaType: "movie" as const,
					tmdbId,
				})),
			].map((value) => [
				value.key,
				{
					...value,
					title: "Controlled truthful catalog " + value.tmdbId,
					year: 2020,
					overview: null,
					posterUrl: null,
					runtimeMinutes: 30,
				},
			])
		)
		let freshCalls = 0
		let savedReads = 0
		const reads: CatalogReads = {
			async rankedKeys() {
				return [...displays.keys()]
			},
			async displays(keys) {
				return new Map(
					keys.flatMap((key) =>
						displays.has(key) ? [[key, displays.get(key)!] as const] : []
					)
				)
			},
			async episodes(id) {
				const next = saved.get(id)
				return [
					{
						tmdbId: next?.tmdbId ?? 20000 + id,
						season: 1,
						number: next ? 2 : 1,
						name: "Catalog episode",
						airDate: "2020-01-01",
					},
				]
			},
			async availability(titles, screens, fresh) {
				if (fresh) freshCalls++
				return new Map(
					titles.map((t) => [
						t.key,
						screens.map((s) => ({
							screenId: s.id,
							state: "watchable" as const,
							scope: "title" as const,
							checkedAt: Date.now(),
							offers: [
								{
									serviceId: 8,
									name: "Controlled provider",
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
				async savedContinuations() {
					savedReads++
					return saved
				},
			})
		)
		const repo = new ProposalMemoryRepository()
		const service = new ProposalService(
			repo,
			catalog,
			"catalog-paging-test-secret-at-least-thirty-two"
		)
		const a = await service.create({
			contractVersion: 3,
			commandId: randomBytes(16).toString("hex"),
			admissionSecret: randomBytes(32).toString("base64url"),
			nickname: "Member",
		})
		const id = a.credential.roomId
		const credential = {
			participantId: a.credential.participantId,
			token: a.credential.token,
		}
		let old = (await repo.read(id))!
		old.room.participants[0].member = { state: "linked", prefill: null }
		old.room.participants[0].memberUserId = "verified-controlled-member"
		old.room.participants[0].memberGrant = {
			accessToken: "verified-controlled-token",
			expiresAt: Date.now() + 100000,
		}
		await repo.compareAndSwap((await repo.read(id))!, old.room, false)
		const read = () => service.read(id, credential)
		const send = async (command: RoomCommand) => {
			const s = await read()
			return service.command(id, credential, {
				commandId: randomBytes(16).toString("hex"),
				sequence: s.own.nextSequence,
				command,
			})
		}
		const kinds: RoomConstraints["kinds"] = mixed
			? ["movie", "show_start", "show_continue"]
			: ["show_continue"]
		await send({
			type: "setup",
			expectedContextVersion: 1,
			screens: [
				{
					id: "screen",
					label: "TV",
					country: "DE",
					serviceIds: [8],
					confirmed: true,
				},
			],
			constraints: { kinds, maxMinutes: null, moods: [] },
			screenId: "screen",
		})
		let s = await read()
		await send({
			type: "start",
			expectedRosterVersion: s.shared.rosterVersion,
			expectedContextVersion: s.shared.contextVersion,
			hostReady: true,
		})
		s = await read()
		assert.equal(s.shared.candidates.length, 20)
		const delivered = new Map<string, string>()
		let finalCandidate = s.shared.candidates[0]
		for (let page = 0; page < 4; page++) {
			s = await read()
			const unanswered = s.shared.candidates.filter(
				(c) =>
					!s.own.votes.some((v) => v.candidateId === c.id && v.value !== null)
			)
			for (const c of unanswered) {
				const key = `${c.identity.kind === "movie" ? "movie" : "show"}_${
					c.identity.tmdbId
				}`
				assert.ok(!delivered.has(key), "No repeated canonical title on refill")
				delivered.set(key, c.identity.kind)
				finalCandidate = c
				await send({
					type: "vote",
					generation: s.shared.generation,
					candidateId: c.id,
					expectedVoteRevision: 0,
					value: "pass",
				})
			}
			s = await read()
			if (s.shared.stream.state === "exhausted") break
			await send({
				type: "refill",
				generation: s.shared.generation,
				expectedStreamVersion: s.shared.stream.version,
			})
		}
		s = await read()
		assert.equal(s.shared.stream.state, "exhausted")
		assert.equal(delivered.size, displays.size)
		for (const showId of saved.keys())
			assert.equal(
				delivered.get("show_" + showId),
				"show_continue",
				"Seen continuation must never become show_start"
			)
		if (mixed) {
			assert.equal(delivered.get("show_901"), "show_start")
			assert.equal(delivered.get("movie_801"), "movie")
		}
		// The full map must still authorize an already delivered earlier episode,
		// even though its title is excluded from subsequent page generation.
		const firstShow = [...saved.keys()][0]
		const canonical = {
			...finalCandidate,
			id: "recheck-first",
			identity: {
				kind: "show_continue" as const,
				tmdbId: firstShow,
				episode: saved.get(firstShow)!,
			},
		}
		const before = savedReads
		await catalog.recheck((await repo.read(id))!.room, canonical)
		assert.equal(savedReads, before + 1)
		assert.equal(freshCalls, 1)
		const stale = {
			...canonical,
			identity: {
				...canonical.identity,
				episode: { ...canonical.identity.episode, tmdbId: 999999 },
			},
		}
		await assert.rejects(
			() => catalog.recheck(repo.rows.get(id)!.room, stale),
			{ code: "needs_progress" }
		)
	})
