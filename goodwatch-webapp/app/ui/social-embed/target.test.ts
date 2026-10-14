import assert from "node:assert/strict"
import { test } from "node:test"
import { ago, consentLine, embedTarget, hostLabel, safeHref, youtubeVideo } from "./target.ts"

test("a YouTube post plays its stored video id, and a Short is vertical", () => {
	assert.deepEqual(embedTarget({ source: "youtube", url: "https://www.youtube.com/watch?v=mNd1gb19A-c", sourceId: "mNd1gb19A-c" }), {
		kind: "youtube",
		videoId: "mNd1gb19A-c",
		vertical: false,
	})
	assert.deepEqual(embedTarget({ source: "youtube", url: "https://www.youtube.com/shorts/d8N873GDkIk" }), {
		kind: "youtube",
		videoId: "d8N873GDkIk",
		vertical: true,
	})
	assert.deepEqual(youtubeVideo("https://youtu.be/3g28OdIj6cY"), { videoId: "3g28OdIj6cY", vertical: false })
})

test("a YouTube address that names no video, or another host, keeps only its link", () => {
	assert.deepEqual(embedTarget({ source: "youtube", url: "https://www.youtube.com/@SonyPictures" }), { kind: "link" })
	assert.deepEqual(embedTarget({ source: "youtube", url: "https://evil.example/watch?v=mNd1gb19A-c" }), { kind: "link" })
	assert.deepEqual(embedTarget({ source: "youtube", url: "https://www.youtube.com/watch?v=bad\"id" }), { kind: "link" })
})

test("a Bluesky post loads from its AT URI", () => {
	assert.deepEqual(
		embedTarget({
			source: "bluesky",
			url: "https://bsky.app/profile/deadline.com/post/3mxmequr2h32i",
			sourceId: "at://did:plc:sanfemo6qfnbaxdoi2q2vnvl/app.bsky.feed.post/3mxmequr2h32i",
		}),
		{ kind: "bluesky", did: "did:plc:sanfemo6qfnbaxdoi2q2vnvl", rkey: "3mxmequr2h32i" },
	)
	assert.deepEqual(embedTarget({ source: "bluesky", url: "https://bsky.app/profile/x/post/y", sourceId: "at://x/other/y" }), { kind: "link" })
	assert.deepEqual(embedTarget({ source: "bluesky", url: "https://bsky.app/profile/x/post/y" }), { kind: "link" })
})

test("a Mastodon post loads its permalink's embed page, on https only", () => {
	assert.deepEqual(embedTarget({ source: "mastodon", url: "https://mastodon.social/@codorco/117434744718433658" }), {
		kind: "mastodon",
		embedUrl: "https://mastodon.social/@codorco/117434744718433658/embed",
		origin: "https://mastodon.social",
	})
	assert.deepEqual(embedTarget({ source: "mastodon", url: "http://mastodon.social/@codorco/117434744718433658" }), { kind: "link" })
	assert.deepEqual(embedTarget({ source: "mastodon", url: "https://misskey.io/notes/9xyz" }), { kind: "link" })
	assert.deepEqual(embedTarget({ source: "mastodon", url: "https://mastodon.social/@a/1?x=1" }), { kind: "link" })
})

test("news is always a link, and only https addresses are linked", () => {
	assert.deepEqual(embedTarget({ source: "news", url: "https://deadline.com/2026/10/x/" }), { kind: "link" })
	assert.equal(safeHref("javascript:alert(1)"), null)
	assert.equal(safeHref("http://deadline.com/"), null)
	assert.equal(hostLabel("https://www.polygon.com/a"), "polygon.com")
})

test("the consent line names who the click contacts", () => {
	assert.equal(consentLine("youtube"), "Loads YouTube (Google), which may set cookies")
	assert.equal(consentLine("bluesky"), "Loads Bluesky, which may set cookies")
	assert.equal(consentLine("news"), "Opens the publisher's site")
})

test("ages count whole days back from now", () => {
	const now = Date.parse("2026-10-14T12:00:00Z")
	assert.equal(ago("2026-10-14T01:00:00Z", now), "today")
	assert.equal(ago("2026-10-13T08:00:00Z", now), "yesterday")
	assert.equal(ago("2026-10-10T12:00:00Z", now), "4 days ago")
	assert.equal(ago("not a date", now), "")
})
