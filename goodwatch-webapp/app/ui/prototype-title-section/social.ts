// PROTOTYPE - throwaway. The social content of one title page, in memory: Resident Evil (2026), No. 1 at the global
// box office on 14 Oct 2026. Every item is a real public post or article; nothing here was scraped.
// - YouTube: the title's own videos from GoodWatch's TMDB data (titles read once through YouTube's keyless oEmbed).
// - Bluesky: posts of Deadline, Polygon and IndieWire, read once through the public getAuthorFeed API.
// - Mastodon: a public post from the #ResidentEvil tag timeline of mastodon.social (author discoverable and indexable).
// - News: the articles those Bluesky posts link to.
// - TikTok, Instagram, Threads, Facebook, Reddit: these are hand-picked sources on the map, and hand-picking is not
//   built yet, so the loaded player shows the vendor's documented public sample from research ticket 538. The facade
//   text is what an editor would write for a Resident Evil post; a "sample" tag says so.

export type SourceKey =
	| "youtube"
	| "short"
	| "tiktok"
	| "reel"
	| "threads"
	| "facebook"
	| "bluesky"
	| "reddit"
	| "mastodon"
	| "news"

export type Vendor = {
	name: string
	/** The company behind it, for the consent line. */
	owner: string
	/** Hosts the official player contacts first. More follow from inside the player. */
	hosts: string[]
	/** A small mark colour; no third-party logo is loaded. */
	color: string
	/** How the item loads after the click. */
	kind: "iframe" | "script" | "link"
}

export const VENDORS: Record<SourceKey, Vendor> = {
	youtube: { name: "YouTube", owner: "Google", hosts: ["www.youtube-nocookie.com"], color: "#ff0033", kind: "iframe" },
	short: { name: "YouTube Shorts", owner: "Google", hosts: ["www.youtube-nocookie.com"], color: "#ff0033", kind: "iframe" },
	tiktok: { name: "TikTok", owner: "TikTok", hosts: ["www.tiktok.com"], color: "#25f4ee", kind: "iframe" },
	reel: { name: "Instagram", owner: "Meta", hosts: ["www.instagram.com"], color: "#e1306c", kind: "script" },
	threads: { name: "Threads", owner: "Meta", hosts: ["www.threads.com"], color: "#d4d4d4", kind: "script" },
	facebook: { name: "Facebook", owner: "Meta", hosts: ["connect.facebook.net", "www.facebook.com"], color: "#1877f2", kind: "script" },
	bluesky: { name: "Bluesky", owner: "Bluesky", hosts: ["embed.bsky.app"], color: "#1185fe", kind: "script" },
	reddit: { name: "Reddit", owner: "Reddit", hosts: ["embed.reddit.com"], color: "#ff4500", kind: "script" },
	mastodon: { name: "Mastodon", owner: "the author's server", hosts: ["mastodon.social"], color: "#6364ff", kind: "script" },
	news: { name: "News", owner: "the publisher", hosts: [], color: "#f59e0b", kind: "link" },
}

export const SOURCE_ORDER: SourceKey[] = ["youtube", "short", "tiktok", "reel", "threads", "facebook", "bluesky", "reddit", "mastodon", "news"]

export type Embed =
	| { type: "youtube"; videoId: string }
	| { type: "tiktok"; postId: string }
	| { type: "instagram"; permalink: string }
	| { type: "threads"; permalink: string; postId: string }
	| { type: "facebook"; href: string }
	| { type: "bluesky"; uri: string; cid: string; text: string; authorDid: string; postRkey: string; authorLabel: string; createdAt: string }
	| { type: "reddit"; href: string; title: string; author: string; subreddit: string }
	| { type: "mastodon"; embedUrl: string; url: string; instance: string }
	| { type: "link" }

export type SocialItem = {
	id: string
	source: SourceKey
	author: string
	handle?: string
	/** ISO date of the post. */
	date: string
	/** What the facade says before the click. "post" is the post's own text from an open network; "note" is
	 * GoodWatch's own line about a hand-picked post; "title" is the video's or article's title. */
	text: string
	textKind: "post" | "note" | "title"
	url: string
	embed: Embed
	/** TMDB artwork of the title, for facades of videos. */
	art?: { kind: "backdrop" | "poster"; path: string }
	/** Shown on the item in the prototype: the loaded player is a vendor sample, not a post about this title. */
	sample?: string
	/** The item is left out. The prototype lists it in the state panel with the reason. */
	skip?: string
}

export const TITLE = {
	tmdbId: 1423191,
	title: "Resident Evil",
	why: "No. 1 at the global box office again, $320M worldwide",
	backdrops: [
		"/3icyRAqgakNcQn6aDVz9libFmBA.jpg",
		"/qXlWN4Byqovzr5YybkjaWUpMxQt.jpg",
		"/xwtPNksIWB2DDWzNY4A3L97HtQP.jpg",
		"/wTybxZpgko9rzqlJQCiRS0MuPuI.jpg",
		"/zn7P2TZBzvFwNPlBXHWofHclXmc.jpg",
		"/wPdmWcBUgaECS3Z7jqIlDdg10NX.jpg",
	],
	posters: ["/i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg", "/yy0PUL8HCR3ZExczT9wECjx6ht7.jpg", "/hzb2ADPCR5h8svkMeDzCv2weuO5.jpg"],
}

const SAMPLE_NOTE = "Sample post: hand-picking is not built, so the player shows the vendor's documented public sample."

export const ITEMS: SocialItem[] = [
	{
		id: "yt-trailer",
		source: "youtube",
		author: "Sony Pictures Entertainment",
		date: "2026-07-23",
		text: "RESIDENT EVIL – Official Trailer (4K)",
		textKind: "title",
		url: "https://www.youtube.com/watch?v=mNd1gb19A-c",
		embed: { type: "youtube", videoId: "mNd1gb19A-c" },
		art: { kind: "backdrop", path: TITLE.backdrops[0] },
	},
	{
		id: "yt-imax",
		source: "youtube",
		author: "IMAX",
		date: "2026-09-10",
		text: "Resident Evil | 1.90 Scene Breakdown | Filmed For IMAX®",
		textKind: "title",
		url: "https://www.youtube.com/watch?v=nSSig89WVBI",
		embed: { type: "youtube", videoId: "nSSig89WVBI" },
		art: { kind: "backdrop", path: TITLE.backdrops[1] },
	},
	{
		id: "yt-reactions",
		source: "youtube",
		author: "Sony Pictures Releasing UK",
		date: "2026-09-12",
		text: "Resident Evil - First Reactions",
		textKind: "title",
		url: "https://www.youtube.com/watch?v=oi043MvmRx4",
		embed: { type: "youtube", videoId: "oi043MvmRx4" },
		art: { kind: "backdrop", path: TITLE.backdrops[2] },
	},
	{
		id: "short-out-now",
		source: "short",
		author: "Sony Pictures Releasing UK",
		date: "2026-09-18",
		text: "Uhhh… Resident Evil is out now! #ResidentEvil #Shorts",
		textKind: "title",
		url: "https://www.youtube.com/shorts/d8N873GDkIk",
		embed: { type: "youtube", videoId: "d8N873GDkIk" },
		art: { kind: "poster", path: TITLE.posters[0] },
	},
	{
		id: "short-imax",
		source: "short",
		author: "IMAX",
		date: "2026-07-26",
		text: "Zach Cregger's making this #ResidentEvil his own #FilmedForIMAX",
		textKind: "title",
		url: "https://www.youtube.com/shorts/GpDJiI0L36U",
		embed: { type: "youtube", videoId: "GpDJiI0L36U" },
		art: { kind: "poster", path: TITLE.posters[1] },
	},
	{
		id: "tiktok-1",
		source: "tiktok",
		author: "A fan reaction",
		handle: "@scout2015",
		date: "2026-10-12",
		text: "A fan's reaction right after the screening. Picked by an editor for its honest first take.",
		textKind: "note",
		url: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
		embed: { type: "tiktok", postId: "6718335390845095173" },
		art: { kind: "backdrop", path: TITLE.backdrops[4] },
		sample: SAMPLE_NOTE,
	},
	{
		id: "reel-1",
		source: "reel",
		author: "Behind the scenes",
		handle: "Instagram",
		date: "2026-10-09",
		text: "A behind-the-scenes look at the creature effects. Picked by an editor for the making-of angle.",
		textKind: "note",
		url: "https://www.instagram.com/p/fA9uwTtkSN/",
		embed: { type: "instagram", permalink: "https://www.instagram.com/p/fA9uwTtkSN/" },
		art: { kind: "backdrop", path: TITLE.backdrops[5] },
		sample: SAMPLE_NOTE,
	},
	{
		id: "threads-1",
		source: "threads",
		author: "Discussion",
		handle: "@threads",
		date: "2026-10-13",
		text: "How faithful is it to the games? Picked by an editor for the argument it started.",
		textKind: "note",
		url: "https://www.threads.com/@threads/post/DWjTI0cgH5O",
		embed: { type: "threads", permalink: "https://www.threads.com/@threads/post/DWjTI0cgH5O", postId: "DWjTI0cgH5O" },
		sample: SAMPLE_NOTE,
	},
	{
		id: "facebook-1",
		source: "facebook",
		author: "Premiere clip",
		handle: "Facebook Reel",
		date: "2026-10-10",
		text: "The cast at a premiere. Picked by an editor for the fan turnout.",
		textKind: "note",
		url: "https://www.facebook.com/reel/3305054673010377",
		embed: { type: "facebook", href: "https://www.facebook.com/reel/3305054673010377" },
		art: { kind: "backdrop", path: TITLE.backdrops[3] },
		sample: SAMPLE_NOTE,
	},
	{
		id: "bsky-deadline",
		source: "bluesky",
		author: "Deadline",
		handle: "@deadline.com",
		date: "2026-10-11",
		text: "China propelled 'Resident Evil' to the top of the global weekend box office with $62M+, but also is Zach Cregger's highest grossing movie ever at $320M; 'Other Mommy' solid $45M+ WW opening.",
		textKind: "post",
		url: "https://bsky.app/profile/deadline.com/post/3mxmequr2h32i",
		embed: {
			type: "bluesky",
			uri: "at://did:plc:sanfemo6qfnbaxdoi2q2vnvl/app.bsky.feed.post/3mxmequr2h32i",
			cid: "bafyreid2kt57aoq7mo6aoxje6gaxwjeedb75e6sbmrcaobcmb3ftiqhm4a",
			text: "China propelled 'Resident Evil' to the top of the global weekend box office with $62M+, but also is Zach Cregger's highest grossing movie ever at $320M; 'Other Mommy' solid $45M+ WW opening.",
			authorDid: "did:plc:sanfemo6qfnbaxdoi2q2vnvl",
			postRkey: "3mxmequr2h32i",
			authorLabel: "Deadline (@deadline.com)",
			createdAt: "2026-10-11T16:00:20Z",
		},
	},
	{
		id: "bsky-polygon",
		source: "bluesky",
		author: "Polygon",
		handle: "@polygon.com",
		date: "2026-10-13",
		text: "Zach Cregger's new horror movie has now made over $320 million worldwide",
		textKind: "post",
		url: "https://bsky.app/profile/polygon.com/post/3mxptfix3aw25",
		embed: {
			type: "bluesky",
			uri: "at://did:plc:ft4gwdn3b552cg4eidqfz7gm/app.bsky.feed.post/3mxptfix3aw25",
			cid: "bafyreihmlyibnnfp7y7uopbwxf7o7o52hpfbyvcrnlqcjybzqoqejbjvxq",
			text: "Zach Cregger's new horror movie has now made over $320 million worldwide",
			authorDid: "did:plc:ft4gwdn3b552cg4eidqfz7gm",
			postRkey: "3mxptfix3aw25",
			authorLabel: "Polygon (@polygon.com)",
			createdAt: "2026-10-13T01:00:24Z",
		},
	},
	{
		id: "bsky-optout",
		source: "bluesky",
		author: "A film critic",
		handle: "@critic.example",
		date: "2026-10-12",
		text: "(not shown)",
		textKind: "post",
		url: "https://bsky.app/",
		embed: { type: "link" },
		skip: "Bluesky author set !no-unauthenticated: no embed, no text, no link. (Made-up entry; the label is the real rule.)",
	},
	{
		id: "reddit-1",
		source: "reddit",
		author: "r/movies",
		handle: "Reddit",
		date: "2026-10-08",
		text: "Zach Cregger's Reddit AMA. Picked by an editor as the main discussion thread.",
		textKind: "note",
		url: "https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/",
		embed: {
			type: "reddit",
			href: "https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/",
			title: "Continuing our infrastructure updates: What’s changing in the coming months",
			author: "judy-funnie",
			subreddit: "modnews",
		},
		sample: SAMPLE_NOTE,
	},
	{
		id: "masto-codorco",
		source: "mastodon",
		author: "CODORÇO",
		handle: "@codorco@mastodon.social",
		date: "2026-10-13",
		text: "A nova adaptação live-action de Resident Evil superou a marca de US$ 320,2 milhões em bilheteria global. Com o resultado, o longa ultrapassou Weapons e se consagrou como a maior arrecadação da carreira do diretor Zach Cregger.",
		textKind: "post",
		url: "https://mastodon.social/@codorco/117434744718433658",
		embed: {
			type: "mastodon",
			embedUrl: "https://mastodon.social/@codorco/117434744718433658/embed",
			url: "https://mastodon.social/@codorco/117434744718433658",
			instance: "https://mastodon.social/",
		},
	},
	{
		id: "masto-optout",
		source: "mastodon",
		author: "Urluck_UR",
		handle: "@Urluck_UR@retro.pizza",
		date: "2026-10-12",
		text: "(not shown)",
		textKind: "post",
		url: "https://retro.pizza/@Urluck_UR/117429536875348307",
		embed: { type: "link" },
		skip: "Mastodon author is not discoverable (a real post from the #ResidentEvil tag): left out like a Bluesky opt-out.",
	},
	{
		id: "news-deadline",
		source: "news",
		author: "Deadline",
		date: "2026-10-11",
		text: "Box Office Global: 'Resident Evil' No. 1, Zach Cregger Record; 'Other Mommy' $45M+ WW No 2",
		textKind: "title",
		url: "https://deadline.com/2026/10/box-office-global-resident-evil-other-mommy-social-reckoning-bombs-1237154279/",
		embed: { type: "link" },
	},
	{
		id: "news-polygon",
		source: "news",
		author: "Polygon",
		date: "2026-10-13",
		text: "Resident Evil Continues to Set New Box Office Records",
		textKind: "title",
		url: "https://www.polygon.com/resident-evil-box-office-record-zach-cregger/",
		embed: { type: "link" },
	},
	{
		id: "news-indiewire",
		source: "news",
		author: "IndieWire",
		date: "2026-10-04",
		text: "Q3’s Horror Box Office Shows the Trouble with Always Hunting Another ‘Obsession’",
		textKind: "title",
		url: "https://www.indiewire.com/features/commentary/horror-box-office-q3-2026-1235220127/",
		embed: { type: "link" },
	},
]

/** The items a section shows: skipped ones out, then only the chosen sources. */
export function visibleItems(sources: Set<SourceKey>) {
	return ITEMS.filter((item) => !item.skip && sources.has(item.source))
}

const TODAY = Date.parse("2026-10-14T12:00:00Z")

export function ago(date: string) {
	const days = Math.round((TODAY - Date.parse(date)) / 86_400_000)
	if (days <= 0) return "today"
	if (days === 1) return "yesterday"
	if (days < 14) return `${days} days ago`
	if (days < 60) return `${Math.round(days / 7)} weeks ago`
	return `${Math.round(days / 30)} months ago`
}
