// The Hot on socials card: the top five of the page's list (titles with posts), with their ranks.
import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { TalkedRow, TalkedTitle } from "../../domain/talked-about-now.ts"

const { hotCardContent } = await import("./hot-content.server.ts")

const title = (rank: number, said = true, poster: string | null = "/p.jpg") =>
	({
		mediaType: "movie",
		tmdbId: rank,
		title: `Title ${rank}`,
		year: 2026,
		poster,
		backdrop: null,
		rank,
		lift: 3,
		views: 900,
		usual: 100,
		curve: [100, 120, 900],
		reason: null,
		move: null,
		items: said ? [{}] : [],
	}) as unknown as TalkedTitle

const row = (titles: TalkedTitle[]): TalkedRow => ({
	day: "2026-11-06",
	titles,
})
const deps = (ranking: TalkedRow | null, enabled = true) => ({
	enabled: () => enabled,
	ranking: async () => ranking,
})

test("the card lists the page's top five with their ranks and reads: titles with posts, with or without a poster", async () => {
	const titles = [7, 6, 5, 4, 3, 2, 1].map((rank) =>
		title(rank, rank !== 2, rank === 1 ? null : "/p.jpg"),
	)
	const content = await hotCardContent(deps(row(titles)))
	assert.equal(content?.kind, "hot")
	assert.deepEqual(
		content?.titles.map((t) => t.rank),
		[1, 3, 4, 5, 6],
	)
	assert.deepEqual(content?.titles[0], {
		rank: 1,
		title: "Title 1",
		curve: [100, 120, 900],
	})
})

test("a page that is off or has no ranking has no card", async () => {
	assert.equal(await hotCardContent(deps(row([title(1)]), false)), null)
	assert.equal(await hotCardContent(deps(null)), null)
	assert.equal(await hotCardContent(deps(row([]))), null)
})

test("a ranking that can't be read throws, so no card is stored", async () => {
	await assert.rejects(
		hotCardContent({
			enabled: () => true,
			ranking: async () => {
				throw new Error("down")
			},
		}),
	)
})
