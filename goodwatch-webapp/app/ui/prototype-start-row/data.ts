// PROTOTYPE - throwaway (#541). Sample data for the "Talked about now" row, as of 14 October 2026.
//
// The titles are real and really in the news this week (Netflix's Top 10 for 28 Sep to 4 Oct, the October premieres,
// the December blockbusters' trailers); their TMDB ids, posters and backdrops are TMDB's. The reasons are close to
// the week's news, the numbers and the buzz curves are made up. The posts are by made-up people. The headlines are
// paraphrased from the week's coverage. Nothing here is fetched: the row is the same for every visitor and would
// come from the buzz score (#538) and the content flows (#539, #540).

export type WhyKind = "trailer" | "top10" | "news" | "season" | "release"

export type Why = {
	kind: WhyKind
	/** Two or three words for the chip: "Trailer drop", "Netflix Top 10". */
	label: string
	/** One short line of fact under it: "#1 in 22 countries". */
	detail: string
}

export type HotTitle = {
	media_type: "movie" | "show"
	tmdb_id: number
	title: string
	release_year: number
	poster_path: string
	backdrop_path: string
	/** Where it is, in a word: "Netflix", "In cinemas Dec 18". */
	where: string
	why: Why
	/** Places up or down since yesterday; "new" for a title that entered the row today. */
	move: number | "new"
	/** The buzz signal over the last 14 days, oldest first (made up; Wikipedia pageviews in the real thing). */
	buzz: number[]
	/** Index into `buzz` of the day the reason happened. */
	spikeAt: number
}

export type Video = {
	kind: "video"
	id: string
	about: number
	platform: "YouTube"
	channel: string
	label: string
	duration: string
	ago: string
	views: string
	/** Our own picture of the title (TMDB backdrop): the facade shows no third-party image before the click. */
	still: string
}
export type Post = {
	kind: "post"
	id: string
	about: number
	platform: "Bluesky" | "Mastodon"
	name: string
	handle: string
	text: string
	ago: string
	likes: string
	replies: string
}
export type Headline = {
	kind: "headline"
	id: string
	about: number
	source: string
	headline: string
	ago: string
}
export type Content = Video | Post | Headline

const curve = (base: number, spikeAt: number, peak: number, tail = 0.55) =>
	Array.from({ length: 14 }, (_, day) => {
		const wobble = ((day * 37 + base) % 11) / 30
		if (day < spikeAt) return base * (1 + wobble * 0.6)
		const since = day - spikeAt
		return base + (peak - base) * tail ** since + base * wobble * 0.4
	})

export const HOT: HotTitle[] = [
	{
		media_type: "show",
		tmdb_id: 258165,
		title: "East of Eden",
		release_year: 2026,
		poster_path: "/axdUor6gLMTrrB1UF4Qfy0TTSyX.jpg",
		backdrop_path: "/70RZX7kNjA0Qjn6HigB1oMvFJ8R.jpg",
		where: "Netflix",
		why: {
			kind: "top10",
			label: "Netflix Top 10",
			detail: "#1 show in 22 countries",
		},
		move: 0,
		buzz: curve(30, 9, 100, 0.85),
		spikeAt: 9,
	},
	{
		media_type: "show",
		tmdb_id: 285322,
		title: "Below",
		release_year: 2026,
		poster_path: "/vgLqqhMUbljp585qPp1EFCyJtcz.jpg",
		backdrop_path: "/cn0feYcDvVzVjUDoXa1O8sRgzz.jpg",
		where: "Netflix",
		why: {
			kind: "top10",
			label: "Netflix Top 10",
			detail: "Took #1 in the US from East of Eden",
		},
		move: 3,
		buzz: curve(12, 11, 88, 0.92),
		spikeAt: 11,
	},
	{
		media_type: "movie",
		tmdb_id: 1003596,
		title: "Avengers: Doomsday",
		release_year: 2026,
		poster_path: "/sLYCyO58UvBuBtbHTQjPCCgJ4dG.jpg",
		backdrop_path: "/g3gpP5YDbA85DsA0bt5mgGQIe5q.jpg",
		where: "In cinemas Dec 18",
		why: {
			kind: "trailer",
			label: "Trailer drop",
			detail: "Final trailer, out yesterday",
		},
		move: "new",
		buzz: curve(40, 12, 100, 0.6),
		spikeAt: 12,
	},
	{
		media_type: "show",
		tmdb_id: 288673,
		title: "Carrie",
		release_year: 2026,
		poster_path: "/6mUMquPQBFJGqTACS3Azkwwrx8d.jpg",
		backdrop_path: "/9yCJtipMeDe8uAdSJKvw8BnYfRz.jpg",
		where: "Prime Video",
		why: {
			kind: "season",
			label: "New series",
			detail: "All 10 episodes, out a week",
		},
		move: -1,
		buzz: curve(8, 6, 70, 0.8),
		spikeAt: 6,
	},
	{
		media_type: "movie",
		tmdb_id: 1170608,
		title: "Dune: Part Three",
		release_year: 2026,
		poster_path: "/d43fvHQsIMa4kpyhKXw0haEJIvI.jpg",
		backdrop_path: "/i5E9H7Ik0u61ylDDTbmUpTL3Yw.jpg",
		where: "In cinemas Dec 18",
		why: {
			kind: "news",
			label: "News spike",
			detail: "IMAX 70mm tickets sold out",
		},
		move: 2,
		buzz: curve(35, 10, 80, 0.65),
		spikeAt: 10,
	},
	{
		media_type: "movie",
		tmdb_id: 1492640,
		title: "UNABOMBER",
		release_year: 2026,
		poster_path: "/39aMkR8Y5vhCG9dTkjiqRl8AVqp.jpg",
		backdrop_path: "/58D9nalUYW5L5K0guw7hcpsEJBH.jpg",
		where: "Netflix",
		why: {
			kind: "top10",
			label: "Netflix Top 10",
			detail: "#1 film in 31 countries",
		},
		move: -2,
		buzz: curve(5, 4, 60, 0.82),
		spikeAt: 4,
	},
	{
		media_type: "movie",
		tmdb_id: 1153576,
		title: "Street Fighter",
		release_year: 2026,
		poster_path: "/dJPT2Uf12X6aFg8i5N67NTpIZ9t.jpg",
		backdrop_path: "/m45xBFqUT4EYpb8eIbamPGK3qea.jpg",
		where: "In cinemas Friday",
		why: {
			kind: "release",
			label: "Out Friday",
			detail: "First reviews are in",
		},
		move: 4,
		buzz: curve(10, 12, 45, 0.9),
		spikeAt: 12,
	},
	{
		media_type: "show",
		tmdb_id: 259909,
		title: "Dexter: Resurrection",
		release_year: 2025,
		poster_path: "/o2Oyi3boT100bY5kCP4MBiTeetO.jpg",
		backdrop_path: "/vcpj6rRDS93ImHCLPY8bwBuFGjR.jpg",
		where: "Paramount+",
		why: {
			kind: "season",
			label: "New season",
			detail: "Season 2 trailer, back Oct 30",
		},
		move: "new",
		buzz: curve(14, 13, 40, 0.7),
		spikeAt: 13,
	},
	{
		media_type: "movie",
		tmdb_id: 1400940,
		title: "Clayface",
		release_year: 2026,
		poster_path: "/5jCpQnWPikggmQZoDp1eAi6BI6w.jpg",
		backdrop_path: "/kVtOcoUJ68chBD2tmERkdWz7lK5.jpg",
		where: "In cinemas Oct 23",
		why: {
			kind: "news",
			label: "News spike",
			detail: "First reactions call it gross, in a good way",
		},
		move: 1,
		buzz: curve(6, 11, 30, 0.75),
		spikeAt: 11,
	},
	{
		media_type: "show",
		tmdb_id: 213375,
		title: "VisionQuest",
		release_year: 2026,
		poster_path: "/WGyAyBPncfuu8MZhLY9RtfZPM0.jpg",
		backdrop_path: "/vLOdytDyJ9OBwV0EwAQOdASW8Y5.jpg",
		where: "Disney+",
		why: {
			kind: "trailer",
			label: "Trailer drop",
			detail: "First full trailer",
		},
		move: -3,
		buzz: curve(9, 8, 38, 0.7),
		spikeAt: 8,
	},
]

const still = (key: number) =>
	HOT.find((title) => title.tmdb_id === key)?.backdrop_path ?? ""

export const CONTENT: Content[] = [
	{
		kind: "video",
		id: "v-eden",
		about: 258165,
		platform: "YouTube",
		channel: "Netflix",
		label: "Official trailer",
		duration: "2:24",
		ago: "2 weeks ago",
		views: "8.1M views",
		still: still(258165),
	},
	{
		kind: "headline",
		id: "h-eden",
		about: 258165,
		source: "What's on Netflix",
		headline:
			"East of Eden scores 6.5 million views in its first week and sends Steinbeck back up the book charts",
		ago: "3 days ago",
	},
	{
		kind: "post",
		id: "p-eden",
		about: 258165,
		platform: "Bluesky",
		name: "Maren Ostby",
		handle: "marenwatches.bsky.social",
		text: "Florence Pugh's Cathy is the scariest thing on TV this year and she barely raises her voice. Episode 5, the kitchen scene. That's the post.",
		ago: "5h",
		likes: "2.4K",
		replies: "186",
	},
	{
		kind: "post",
		id: "p-below",
		about: 285322,
		platform: "Bluesky",
		name: "Theo Achterberg",
		handle: "theo.achterberg.net",
		text: "Started Below at 11pm 'for one episode'. It is now 4am. Six episodes. Do not do what I did.",
		ago: "9h",
		likes: "5.1K",
		replies: "412",
	},
	{
		kind: "video",
		id: "v-doom",
		about: 1003596,
		platform: "YouTube",
		channel: "Marvel Entertainment",
		label: "Final trailer",
		duration: "2:51",
		ago: "Yesterday",
		views: "41M views",
		still: still(1003596),
	},
	{
		kind: "headline",
		id: "h-doom",
		about: 1003596,
		source: "Variety",
		headline:
			"Avengers: Doomsday's final trailer races past 40 million views in a day, Doom finally speaks",
		ago: "18h",
	},
	{
		kind: "post",
		id: "p-carrie",
		about: 288673,
		platform: "Mastodon",
		name: "Ines Varga",
		handle: "@ines@mastodon.social",
		text: "Flanagan's Carrie keeps the prom for the last episode and spends nine hours making you dread it. Best horror series since Hill House.",
		ago: "1d",
		likes: "640",
		replies: "38",
	},
	{
		kind: "headline",
		id: "h-dune",
		about: 1170608,
		source: "IndieWire",
		headline:
			"Dune: Part Three's 70mm IMAX opening weekend sells out within hours of going on sale",
		ago: "2 days ago",
	},
	{
		kind: "video",
		id: "v-dexter",
		about: 259909,
		platform: "YouTube",
		channel: "Paramount+",
		label: "Season 2 trailer",
		duration: "1:58",
		ago: "6 hours ago",
		views: "1.3M views",
		still: still(259909),
	},
	{
		kind: "post",
		id: "p-street",
		about: 1153576,
		platform: "Bluesky",
		name: "Kofi Mensah",
		handle: "kofireviews.bsky.social",
		text: "Street Fighter is exactly as silly as it should be and the Guile theme drop got applause at my screening. 3.5/5, bring friends.",
		ago: "3h",
		likes: "880",
		replies: "71",
	},
]

/** "×4.2": today's buzz against the title's own usual (its days before the reason). */
export function heatOf(title: HotTitle) {
	const before = title.buzz.slice(0, Math.max(title.spikeAt, 1))
	const usual = before.reduce((sum, v) => sum + v, 0) / before.length
	return title.buzz[title.buzz.length - 1] / usual
}

export const hotOf = (key: number) =>
	HOT.find((title) => title.tmdb_id === key) as HotTitle
export const contentOf = (key: number) =>
	CONTENT.filter((item) => item.about === key)

export const UPDATED = "Updated 40 min ago"
