// PROTOTYPE - throwaway (#545). Sample "Talked about now" items, in memory. Titles, TMDB ids and image paths,
// YouTube keys (official uploads listed on TMDB), TikTok post ids and Bluesky post URIs are real, checked on
// 2026-10-14. The "why" lines are written by hand from that weekend's box office and release news.

export type Vendor = "youtube" | "tiktok" | "bluesky"

export type Post =
	| { id: string; vendor: "youtube"; videoId: string; label: string; author: string }
	| { id: string; vendor: "tiktok"; postId: string; label: string; author: string }
	| { id: string; vendor: "bluesky"; uri: string; label: string; author: string }

export type TalkedAbout = {
	tmdbId: number
	type: "movie" | "tv"
	title: string
	year: number
	posterPath: string
	backdropPath: string
	why: string
	posts: Post[]
}

export const TMDB_IMAGE = "https://image.tmdb.org/t/p"

export const TALKED_ABOUT: TalkedAbout[] = [
	{
		tmdbId: 1400837,
		type: "movie",
		title: "Other Mommy",
		year: 2026,
		posterPath: "/fGRNCssTRrhYZxNzykGGCoMsAVq.jpg",
		backdropPath: "/ncm7djsVTHQQMX2HEbEVxMUFchG.jpg",
		why: "No. 1 at the box office with $27.5M, after the trailer that scared Odyssey audiences",
		posts: [
			{
				id: "om-tt",
				vendor: "tiktok",
				postId: "7664965741153717534",
				label: "Reaction to the trailer",
				author: "@roomforscream",
			},
			{
				id: "om-bsky",
				vendor: "bluesky",
				uri: "did:plc:7exlcsle4mjfhu3wnhcgizz6/app.bsky.feed.post/3mxphchmvpj2e",
				label: "“Other Mommy is having an unexpected moment”",
				author: "The Verge",
			},
		],
	},
	{
		tmdbId: 1236045,
		type: "movie",
		title: "Animals",
		year: 2026,
		posterPath: "/iISM36voS1E8gX9BM0DVK0kgi3E.jpg",
		backdropPath: "/tzoarEu7TsG959upiELyYPm5kO9.jpg",
		why: "Ben Affleck's Netflix thriller, out Friday, and the reviews are split",
		posts: [
			{
				id: "an-yt",
				vendor: "youtube",
				videoId: "ZkN2M4ODdys",
				label: "Official Trailer #2",
				author: "Netflix",
			},
			{
				id: "an-bsky",
				vendor: "bluesky",
				uri: "did:plc:sanfemo6qfnbaxdoi2q2vnvl/app.bsky.feed.post/3mxg6wptndd2q",
				label: "Review",
				author: "Deadline",
			},
		],
	},
	{
		tmdbId: 1281331,
		type: "movie",
		title: "The Social Reckoning",
		year: 2026,
		posterPath: "/7jK6NuxVg1XuEV7UdNa6KO03IgZ.jpg",
		backdropPath: "/wXTaGcqX3jvdXSKCJAkl5jZyrKp.jpg",
		why: "Aaron Sorkin's Facebook follow-up opened to $5.5M",
		posts: [
			{
				id: "sr-yt",
				vendor: "youtube",
				videoId: "v5oVaS2lW2s",
				label: "In cinemas now",
				author: "Sony Pictures",
			},
			{
				id: "sr-bsky",
				vendor: "bluesky",
				uri: "did:plc:vvclu5gn722rmop3be267ncq/app.bsky.feed.post/3mxmbfl6mem23",
				label: "Why the opening fell flat",
				author: "IndieWire",
			},
		],
	},
	{
		tmdbId: 1368337,
		type: "movie",
		title: "The Odyssey",
		year: 2026,
		posterPath: "/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg",
		backdropPath: "/bulFtfy3oBQtCnAMSi7g6DSSds3.jpg",
		why: "Nolan's epic comes home on 17 November",
		posts: [
			{
				id: "od-yt",
				vendor: "youtube",
				videoId: "2mfqNJTC1QU",
				label: "Watch at home November 17",
				author: "Universal Pictures",
			},
			{
				id: "od-tt",
				vendor: "tiktok",
				postId: "7665059046680038670",
				label: "In the cinema for The Odyssey",
				author: "@grace.mitscherlich",
			},
		],
	},
	{
		tmdbId: 258165,
		type: "tv",
		title: "East of Eden",
		year: 2026,
		posterPath: "/axdUor6gLMTrrB1UF4Qfy0TTSyX.jpg",
		backdropPath: "/70RZX7kNjA0Qjn6HigB1oMvFJ8R.jpg",
		why: "Florence Pugh as Cathy Ames, two weeks into Netflix's charts",
		posts: [
			{
				id: "ee-yt",
				vendor: "youtube",
				videoId: "M9NWvGZViCg",
				label: "Official Trailer",
				author: "Netflix",
			},
		],
	},
]

export const VENDORS: Record<
	Vendor,
	{ name: string; host: string; privacy: string; what: string; color: string }
> = {
	youtube: {
		name: "YouTube",
		host: "youtube-nocookie.com",
		privacy: "https://policies.google.com/privacy",
		what: "Trailers and clips",
		color: "#ff0033",
	},
	tiktok: {
		name: "TikTok",
		host: "tiktok.com",
		privacy: "https://www.tiktok.com/legal/privacy-policy-eea",
		what: "Short videos",
		color: "#25f4ee",
	},
	bluesky: {
		name: "Bluesky",
		host: "embed.bsky.app",
		privacy: "https://bsky.social/about/support/privacy-policy",
		what: "Posts and reviews",
		color: "#1185fe",
	},
}

export const VENDOR_KEYS = Object.keys(VENDORS) as Vendor[]

export const isVideo = (post: Post) => post.vendor !== "bluesky"
