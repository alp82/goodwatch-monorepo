import type { SocialFixture } from "../../app/server/talked-about-now/social-store.server.ts"

/** Each mutation exercises a separate eligibility or ranking rule against the frozen SQL. */
export function socialFixture(now = Date.now()) {
	const fixture: Required<Pick<SocialFixture, "posts" | "links" | "quality" | "relevance" | "reports">> & { images: { post_id: string; status: string }[] } = { posts: [], links: [], quality: [], relevance: [], reports: [], images: [] }
	const id = (n: number) => n.toString(16).padStart(64, "0")
	for (let n = 1; n <= 540; n++) {
		const post_id = id(n)
		fixture.posts.push({ post_id, source: "rss", source_id: null, url: `https://example.com/${n}`, author: "Fixture", text: String(n), published_at: new Date(now - 3600_000).toISOString(), content_hash: "current" })
		fixture.links.push({ media_type: "movie", media_tmdb_id: 1, post_id, lane: "exact", content_hash: "current", duplicate_group: n > 40 ? "padding" : null })
		fixture.quality.push({ post_id, content_hash: "current", status: "pass", version: "content-quality-1" })
		fixture.relevance.push({ media_type: "movie", media_tmdb_id: 1, post_id, content_hash: "current", status: "keep", version: "relevance-1", score: 1, dup_group: null })
		fixture.images.push({ post_id, status: "ok" })
	}
	fixture.links[0].hidden_at = new Date(now).toISOString()
	fixture.posts[1].deleted_at = new Date(now).toISOString()
	fixture.posts[2].published_at = new Date(now - 31 * 86400_000).toISOString()
	fixture.links[3].content_hash = "old"
	fixture.quality[4].content_hash = "old"
	fixture.quality[5].status = "reject"
	fixture.quality[6].version = "old"
	fixture.quality.splice(7, 1)
	fixture.relevance[8].content_hash = "old"
	fixture.relevance[9].status = "drop"
	fixture.relevance[10].version = "old"
	fixture.links[11].lane = "disabled"
	for (const [n, status] of [[13, "open"], [14, "confirmed"], [15, "dismissed"]] as const) fixture.reports.push({ report_id: id(n), media_type: "movie", media_tmdb_id: 1, post_id: id(n), status, reason: "fixture", created_at: new Date(now).toISOString() })
	fixture.reports.push({ ...fixture.reports[0], report_id: "other-title", media_tmdb_id: 2, post_id: id(16) })
	fixture.links[16].duplicate_group = "link-group"
	fixture.links[17].duplicate_group = "link-group"
	fixture.relevance[16].score = 2
	fixture.relevance[18].dup_group = "relevance-group"
	fixture.relevance[19].dup_group = "relevance-group"
	fixture.posts[18].published_at = new Date(now - 1800_000).toISOString()
	fixture.links[20].duplicate_group = "link-group"
	fixture.relevance[20].dup_group = "override"
	fixture.relevance[21].score = null
	fixture.images[22].status = "failed"
	fixture.images[23].status = "none"
	fixture.images.splice(24, 1)
	fixture.posts[25].content_hash = null
	fixture.links[25].content_hash = null
	fixture.quality.find(q => q.post_id === id(26))!.content_hash = null
	fixture.relevance[25].content_hash = null
	fixture.relevance.splice(26, 1)
	// Same post and duplicate group for another title must survive independently.
	fixture.links.push({ ...fixture.links[16], media_type: "tv", media_tmdb_id: 2 })
	fixture.relevance.push({ ...fixture.relevance.find(r => r.post_id === id(17))!, media_type: "tv", media_tmdb_id: 2 })
	// A third title has enough distinct groups to exercise the ranking's global LIMIT 400.
	fixture.links.push(...fixture.links.filter(l => l.media_tmdb_id === 1).map(l => ({ ...l, media_tmdb_id: 3, duplicate_group: null })))
	fixture.relevance.push(...fixture.relevance.filter(r => r.media_tmdb_id === 1).map(r => ({ ...r, media_tmdb_id: 3, dup_group: null })))
	return fixture
}
