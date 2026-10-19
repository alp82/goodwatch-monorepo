import assert from "node:assert/strict"
import test from "node:test"
import posts from "../content/blog/posts.json" with { type: "json" }
import {
	blogIndexRobots,
	isDraft,
	lastUpdated,
	listedPosts,
	postRobots,
} from "./blog-posts.ts"
import type { BlogPost } from "./blog-structured-data.ts"
import { rssFeed } from "./rss.ts"

const post = (slug: string, published: string, draft?: boolean): BlogPost => ({
	slug,
	title: slug,
	description: "",
	kind: "Data study",
	published,
	updated: published,
	...(draft === undefined ? {} : { draft }),
})

test("a draft is left out of the listed posts, which are newest first", () => {
	const listed = listedPosts([
		post("old", "2026-01-01"),
		post("wip", "2026-12-01", true),
		post("new", "2026-10-01"),
		post("explicit", "2026-10-01", false),
	])
	assert.deepEqual(
		listed.map((p) => p.slug),
		["explicit", "new", "old"],
	)
})

test("a draft is noindex, nofollow; a published post is indexed", () => {
	assert.equal(postRobots(post("wip", "2026-10-19", true)), "noindex, nofollow")
	assert.equal(postRobots(post("live", "2026-10-19")), "index, follow")
})

test("/blog is noindex until it lists a post", () => {
	assert.equal(blogIndexRobots([]), "noindex, follow")
	assert.equal(blogIndexRobots([post("live", "2026-10-19")]), "index, follow")
})

test("the feed's date comes from listed posts only, and an empty feed is still valid", () => {
	assert.equal(lastUpdated([]), null)
	assert.equal(
		lastUpdated([post("a", "2026-10-01"), post("b", "2026-10-12")]),
		"2026-10-12",
	)
	const xml = rssFeed({
		title: "GoodWatch blog",
		url: "https://goodwatch.app/blog",
		feedUrl: "https://goodwatch.app/blog/rss.xml",
		description: "Studies",
		updated: null,
		items: [],
	})
	assert.doesNotMatch(xml, /<item>/)
	assert.doesNotMatch(xml, /lastBuildDate/)
	assert.match(xml, /<channel>/)
})

test("every post in posts.json says plainly whether it's a draft", () => {
	for (const p of posts as BlogPost[])
		assert.ok(
			p.draft === undefined || typeof p.draft === "boolean",
			`${p.slug}: draft is true, false or absent`,
		)
	assert.ok(isDraft({ draft: true }))
	assert.ok(!isDraft({}))
})
