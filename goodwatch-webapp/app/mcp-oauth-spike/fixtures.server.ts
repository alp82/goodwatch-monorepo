// #535: fictional data only. Never import production data clients into this spike.
export type Title = {
	id: string
	name: string
	kind: "movie" | "show"
	year: number
	aliases: string[]
	genres: string[]
	synopsis: string
	episodes: { season: number; episode: number }[]
	services: string[]
}
const movieNames = [
	"Paper Moonlight",
	"Autumn Signal",
	"The Quiet Tram",
	"Cloud Atlas Garden",
	"Night Post",
	"The Missing Piano",
	"Letters from Mars",
	"Window Seat",
	"Summer Telephone",
	"Winter Library",
	"The Glass Lake",
	"Silent Kitchen",
	"Midnight Kite",
	"The Long Walk",
	"Cloud Tea",
	"The Last Bicycle",
	"Station Seven",
	"Snow and Ink",
	"Tuesday's Comet",
	"The Blue Door",
]
export const titles: Title[] = [
	{
		id: "movie:603",
		name: "The Last Lighthouse",
		kind: "movie",
		year: 2026,
		aliases: ["Lighthouse"],
		genres: ["Mystery", "Drama"],
		synopsis: "A lighthouse keeper solves a mystery on an island.",
		episodes: [],
		services: ["prime_video"],
	},
	{
		id: "show:1399",
		name: "Orbit Garden",
		kind: "show",
		year: 2026,
		aliases: [],
		genres: ["Science fiction", "Comedy"],
		synopsis: "Gardeners build a home on a distant station.",
		episodes: Array.from({ length: 6 }, (_, i) => ({
			season: 1,
			episode: i + 1,
		})),
		services: ["netflix"],
	},
	{
		id: "show:1400",
		name: "Small Town Detectives",
		kind: "show",
		year: 2025,
		aliases: [],
		genres: ["Mystery"],
		synopsis: "Two friends investigate their town's curious history.",
		episodes: Array.from({ length: 6 }, (_, i) => ({
			season: 2,
			episode: i + 1,
		})),
		services: ["disney_plus"],
	},
	...[2019, 2024].map(
		(year, i): Title => ({
			id: `movie:${1001 + i}`,
			name: "Harbor",
			kind: "movie",
			year,
			aliases: [],
			genres: [i === 0 ? "Drama" : "Comedy"],
			synopsis: "A fictional story at a harbor.",
			episodes: [],
			services: ["netflix"],
		}),
	),
	...movieNames.map(
		(name, i): Title => ({
			id: `movie:${2000 + i}`,
			name,
			kind: "movie",
			year: 2020 + (i % 6),
			aliases: [],
			genres: [i % 2 ? "Comedy" : "Drama"],
			synopsis: "A fictional catalog entry for the paging exercise.",
			episodes: [],
			services: ["netflix"],
		}),
	),
]
export type ShowStatus =
	| "Not started"
	| "Watching"
	| "On hold"
	| "Dropped"
	| "Seen"
export type Watch = {
	watch_id: string
	title_id: string
	season: number | null
	episode: number | null
	date: string | null
	date_precision: "unknown" | "day"
	origin: "single" | "score" | "seen" | "fixture"
	pass: number
}
export type Member = {
	id: string
	flags: { REC_MCP_TASTE: boolean }
	revision: number
	sequence: number
	watches: Watch[]
	shows: Record<string, { status: ShowStatus; pass: number; activity: number }>
	ratings: Record<string, number>
	wishlist: Set<string>
	notInterested: Set<string>
	country: string
	services: string[]
	actions: Map<string, { key: string; watchId: string }>
	confirmations: Map<string, { key: string; revision: number; expires: number }>
	search: { day: string; chargedQueries: Set<string> }
}
const members = new Map<string, Member>()
export function getMember(id: string): Member {
	let member = members.get(id)
	if (!member) {
		member = {
			id,
			flags: { REC_MCP_TASTE: true },
			revision: 0,
			sequence: 3,
			watches: [
				{
					watch_id: "fixture-orbit-1",
					title_id: "show:1399",
					season: 1,
					episode: 1,
					date: null,
					date_precision: "unknown",
					origin: "fixture",
					pass: 1,
				},
				{
					watch_id: "fixture-orbit-2",
					title_id: "show:1399",
					season: 1,
					episode: 2,
					date: null,
					date_precision: "unknown",
					origin: "fixture",
					pass: 1,
				},
				{
					watch_id: "fixture-detectives-1",
					title_id: "show:1400",
					season: 2,
					episode: 1,
					date: null,
					date_precision: "unknown",
					origin: "fixture",
					pass: 1,
				},
			],
			shows: {
				"show:1399": { status: "Watching", pass: 1, activity: 2 },
				"show:1400": { status: "On hold", pass: 1, activity: 1 },
			},
			ratings: {},
			wishlist: new Set(["movie:603"]),
			notInterested: new Set(),
			country: "DE",
			services: ["netflix", "prime_video"],
			actions: new Map(),
			confirmations: new Map(),
			search: { day: "", chargedQueries: new Set() },
		}
		members.set(id, member)
	}
	return member
}
export function setTasteFlag(memberId: string, enabled: boolean) {
	getMember(memberId).flags.REC_MCP_TASTE = enabled
}
export function summary(title: Title, origin: string) {
	return {
		id: title.id,
		name: title.name,
		kind: title.kind,
		year: title.year,
		url: `${origin}/fixture/${title.id.replace(":", "/")}`,
	}
}
const normalize = (value: string) =>
	value
		.trim()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
export type TitleInput = {
	title_id?: string
	title_name?: string
	year?: number
}
export function resolveTitle(input: TitleInput, origin: string) {
	const pool = titles.filter(
		(title) => input.year === undefined || title.year === input.year,
	)
	let matches: Title[]
	if (input.title_id)
		matches = pool.filter((title) => title.id === input.title_id)
	else {
		const name = normalize(input.title_name ?? "")
		matches = pool.filter((title) =>
			[title.name, ...title.aliases].some((label) => normalize(label) === name),
		)
		if (!matches.length && name)
			matches = pool.filter((title) =>
				[title.name, ...title.aliases].some((label) =>
					normalize(label).includes(name),
				),
			)
	}
	if (matches.length === 1) return { title: matches[0] }
	return {
		result: {
			status: matches.length ? "ambiguous_title" : "title_not_found",
			choices: matches.slice(0, 20).map((title) => summary(title, origin)),
			total_choices: matches.length,
		},
	}
}
export function showState(member: Member, titleId: string) {
	return (
		member.shows[titleId] ?? {
			status: "Not started" as const,
			pass: 1,
			activity: 0,
		}
	)
}
export function progress(member: Member, title: Title) {
	const state = showState(member, title.id)
	const watches = member.watches.filter(
		(watch) => watch.title_id === title.id && watch.pass === state.pass,
	)
	const watched = new Set(
		watches.map((watch) => `${watch.season}:${watch.episode}`),
	)
	const furthest = title.episodes.reduce(
		(index, episode, i) =>
			watched.has(`${episode.season}:${episode.episode}`) ? i : index,
		-1,
	)
	const missing = (episode: { season: number; episode: number }) =>
		!watched.has(`${episode.season}:${episode.episode}`)
	const next =
		title.episodes.slice(furthest + 1).find(missing) ??
		title.episodes.find(missing) ??
		null
	return {
		status: state.status,
		pass: state.pass,
		watched_episodes: title.episodes.filter((episode) =>
			watched.has(`${episode.season}:${episode.episode}`),
		).length,
		total_episodes: title.episodes.length,
		next_episode: next,
	}
}
export function isSeen(member: Member, title: Title) {
	return title.kind === "show"
		? showState(member, title.id).status === "Seen"
		: member.watches.some((watch) => watch.title_id === title.id)
}
export function libraryEntry(member: Member, title: Title, origin: string) {
	return {
		...summary(title, origin),
		score: member.ratings[title.id] ?? null,
		want_to_see: member.wishlist.has(title.id),
		not_interested: member.notInterested.has(title.id),
		seen: isSeen(member, title),
		...(title.kind === "show" ? { progress: progress(member, title) } : {}),
		watch_count: member.watches.filter((watch) => watch.title_id === title.id)
			.length,
	}
}
export function page<T>(items: T[], cursor?: string, limit = 20) {
	const offset = Number(cursor?.slice(7) ?? 0)
	return {
		items: items.slice(offset, offset + limit),
		next_cursor:
			offset + limit < items.length ? `offset:${offset + limit}` : null,
		total: items.length,
	}
}
