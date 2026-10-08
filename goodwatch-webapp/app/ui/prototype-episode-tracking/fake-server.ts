// HARNESS - development only (#384). Stands in for the server on /prototype/episode-tracking-real, in the browser:
// it answers the requests the real components send, from memory. It runs the real state machine and the real
// mapping to rows (domain/tracking), with "aired" as the server reads it (UTC, with the device's date for group
// actions), so every flow of episode tracking can be driven without a member, a database or TMDB.
import {
	type EpisodeRatings,
	matchEpisodeRatings,
} from "~/domain/tracking/episode-ratings"
import {
	type ListedEpisode,
	type TrackingEvent,
	serverShow,
	utcDay,
} from "~/domain/tracking/machine"
import {
	type ActionAnswer,
	type PageAction,
	type PageEpisode,
	type Restore,
	type ShowCopy,
	type ShowTrackingPage,
	applyLocally,
	watchStateEntryOf,
} from "~/domain/tracking/show-page"
import { applyShowEvent } from "~/domain/tracking/storage"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { Show } from "~/ui/prototype-episode-list/model"

export const SCENARIOS = {
	fresh: "Never tracked",
	watching: "Watching, partway",
	on_hold: "On hold",
	dropped: "Dropped after 3",
	all: "All aired but the last",
	seen_new: "Seen, new episodes since",
	seen_ticked: "Seen by ticking every episode",
	rated: "Rated, never started (the question is open)",
	wanted: "On the Wishlist, never started",
} as const
export type Scenario = keyof typeof SCENARIOS

export interface HarnessOptions {
	show: Show
	grid: EpisodeGrid
	/** The harness's date, "YYYY-MM-DD": the device's and the server's. */
	today: string
	scenario: Scenario
	/** The show has no episode list, as before the catalog's crawl reached it. */
	noList: boolean
	/** Send the fixture's descriptions. The real server has none: the episode catalog does not store them. */
	overviews: boolean
	/** How long an answer takes, in milliseconds. */
	latency: number
}

export interface RequestRecord {
	method: string
	path: string
	body: unknown
	startedAt: number
	endedAt: number | null
	status: number | null
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})

export class FakeServer {
	private options: HarnessOptions
	private episodes: PageEpisode[]
	private listed: ListedEpisode[]
	private ratings: EpisodeRatings
	private copy: ShowCopy = { state: null, log: [] }
	private score: { score: number; updatedAt: string } | null = null
	private wishlistAt: number | null = null
	private notInterested = false
	private made = 0
	/** Every request the page sent, for the checks: none of the tracking requests may overlap. */
	requests: RequestRecord[] = []
	/** The next request to the tracking endpoint fails with this status. */
	failNext: number | null = null

	constructor(options: HarnessOptions) {
		this.options = options
		const { show } = options
		const all = show.seasons.flatMap((season) =>
			season.episodes.map((episode) => ({ season, episode })),
		)
		this.ratings = matchEpisodeRatings(
			all.map(({ season, episode }) => ({
				id: episode.id,
				season: season.number,
				number: episode.n,
				name: episode.name,
			})),
			options.grid.seasons,
		)
		this.episodes = options.noList
			? []
			: all.map(({ season, episode }) => {
					const rated = this.ratings.byEpisode.get(episode.id)
					return {
						id: episode.id,
						season: season.number,
						number: episode.n,
						name: episode.name,
						airDate: episode.air_date,
						runtime: episode.runtime,
						still: episode.still_path,
						overview: options.overviews ? episode.overview : null,
						rating: rated?.score ?? null,
						ratedBy: rated?.how ?? null,
					}
				})
		this.listed = this.episodes
		this.seed(options.scenario)
	}

	/** Noon of the harness's day, so that the device's date and the UTC date agree. */
	now() {
		return Date.parse(`${this.options.today}T12:00:00Z`) + this.made
	}

	private id() {
		this.made += 1
		return `seed-${String(this.made).padStart(6, "0")}`
	}

	private apply(event: TrackingEvent, actionId?: string) {
		const now = this.now()
		const applied = applyShowEvent({
			showId: this.options.show.id,
			show: serverShow(this.listed, event, utcDay(now)),
			state: this.copy.state,
			log: this.copy.log,
			flags: {
				score: this.score?.score ?? null,
				wantToSee: this.wishlistAt !== null,
				notInterested: this.notInterested,
			},
			event,
			actionId,
			now,
			resend: true,
		})
		if (applied.refused) return applied
		const gone = new Set(applied.changes.deleteIds)
		this.copy = {
			state: applied.changes.state,
			log: [
				...this.copy.log.filter((row) => !gone.has(row.watch_id)),
				...applied.changes.insert,
			],
		}
		return applied
	}

	private seed(scenario: Scenario) {
		const today = this.options.today
		const aired = this.listed
			.filter((e) => e.season > 0 && e.airDate !== null && e.airDate <= today)
			.sort((a, b) => a.season - b.season || a.number - b.number)
		const watch = (episode: ListedEpisode, day?: string) =>
			this.apply(
				{
					type: "watch",
					season: episode.season,
					number: episode.number,
					when: day ? { precision: "day", day } : undefined,
				},
				this.id(),
			)
		const daysAgo = (n: number) =>
			new Date(Date.parse(`${today}T00:00:00Z`) - n * 86_400_000)
				.toISOString()
				.slice(0, 10)
		const seasons = [...new Set(aired.map((e) => e.season))]
		if (scenario === "fresh") return
		if (scenario === "wanted") {
			this.wishlistAt = Date.parse(`${daysAgo(30)}T09:00:00Z`)
			return
		}
		if (scenario === "rated") {
			this.score = { score: 8, updatedAt: new Date(this.now()).toISOString() }
			this.apply({ type: "rate", score: 8 })
			return
		}
		if (scenario === "dropped") {
			aired.slice(0, 3).forEach((e) => watch(e, daysAgo(40)))
			this.apply({ type: "drop" })
			return
		}
		if (scenario === "all") {
			const last = aired[aired.length - 1]
			this.apply(
				{
					type: "watchUpTo",
					season: aired[aired.length - 2]?.season ?? 1,
					number: aired[aired.length - 2]?.number ?? 0,
					today,
				},
				this.id(),
			)
			void last
			return
		}
		if (scenario === "seen_ticked") {
			aired.forEach((e) => watch(e, daysAgo(10)))
			return
		}
		if (scenario === "seen_new") {
			// Seen was pressed before the latest episodes aired.
			const late =
				seasons.length > 1
					? aired.filter((e) => e.season === seasons[seasons.length - 1])
					: aired.slice(-2)
			const before = late[0]?.airDate ?? today
			const pressDay = new Date(Date.parse(`${before}T00:00:00Z`) - 86_400_000)
				.toISOString()
				.slice(0, 10)
			const kept = this.listed
			this.listed = kept.map((e) =>
				late.some((l) => l.id === e.id) ? { ...e, airDate: "9999-12-31" } : e,
			)
			this.apply({ type: "pressSeen", today: pressDay }, this.id())
			this.listed = kept
			this.score = { score: 8, updatedAt: new Date(this.now()).toISOString() }
			return
		}
		// watching / on_hold: the first season as a group, then a few by hand with dates, and a special.
		const first = aired.filter((e) => e.season === seasons[0])
		if (seasons.length > 1)
			this.apply({ type: "markSeason", season: seasons[0], today }, this.id())
		else
			first
				.slice(0, Math.max(1, Math.floor(first.length / 2)))
				.forEach((e) => watch(e, daysAgo(12)))
		if (seasons.length > 1) {
			const rest = aired.filter((e) => e.season === seasons[1]).slice(0, 4)
			rest.forEach((e, i) => watch(e, daysAgo((rest.length - i) * 3)))
		}
		const special = this.listed.find(
			(e) => e.season === 0 && e.airDate !== null && e.airDate <= today,
		)
		if (special) watch(special, daysAgo(20))
		if (scenario === "on_hold") this.apply({ type: "hold" })
	}

	private page(): ShowTrackingPage {
		const { show, grid } = this.options
		return {
			state: this.copy.state,
			log: this.copy.log,
			episodes: this.episodes,
			running: !["Ended", "Canceled"].includes(show.status),
			seasonScores: this.episodes.length
				? Object.fromEntries(
						grid.seasons.flatMap((season) =>
							season.scores.imdb
								? [[String(season.number), season.scores.imdb.score]]
								: [],
						),
					)
				: {},
			notes: this.episodes.length
				? Object.fromEntries(
						[...this.ratings.notes].map(([season, note]) => [
							String(season),
							note,
						]),
					)
				: {},
		}
	}

	private userData() {
		const key = `show-${this.options.show.id}`
		const entry = watchStateEntryOf(this.copy)
		const at = (ms: number) => new Date(ms).toISOString()
		return {
			scores: this.score
				? {
						[key]: {
							score: this.score.score,
							review: null,
							updatedAt: this.score.updatedAt,
						},
					}
				: {},
			wishlist:
				this.wishlistAt === null
					? {}
					: {
							[key]: {
								createdAt: at(this.wishlistAt),
								updatedAt: at(this.wishlistAt),
							},
						},
			watchState: entry ? { [key]: entry } : {},
			favorites: {},
			skipped: {},
			notInterested: this.notInterested
				? { [key]: { updatedAt: at(this.now()) } }
				: {},
		}
	}

	/** One action of the show page, as server/show-tracking.server.ts answers it. */
	private act(body: {
		event: PageAction
		actionId?: string
		restore?: Restore
	}): ActionAnswer {
		const { event } = body
		const before = this.copy
		const wished = this.wishlistAt
		const hidden = this.notInterested
		let refused: string | null = null
		if (event.type === "editWatchDate" || event.type === "setGroupDate") {
			const local = applyLocally(before, event, undefined, {
				showId: this.options.show.id,
				episodes: this.listed,
				today: this.options.today,
				now: this.now(),
			})
			refused = local.refused
			this.copy = local.copy
		} else {
			const applied = this.apply(event, body.actionId)
			refused = applied.refused
			if (!applied.refused) {
				if (applied.changes.clear.wantToSee) this.wishlistAt = null
				if (applied.changes.clear.notInterested) this.notInterested = false
			}
		}
		const cleared = {
			wantToSeeAddedAt:
				wished !== null && this.wishlistAt === null
					? new Date(wished).toISOString()
					: null,
			notInterested: hidden && !this.notInterested,
		}
		if (refused)
			return {
				status: "refused",
				refused,
				state: this.copy.state,
				rows: [],
				deleted: [],
				cleared,
			}
		const notStarted =
			(this.copy.state?.state ?? "not_started") === "not_started"
		if (event.type === "wantToSee" && notStarted) this.wishlistAt = this.now()
		if (body.restore && notStarted) {
			if (body.restore.wantToSeeAddedAt)
				this.wishlistAt = Date.parse(body.restore.wantToSeeAddedAt)
			else if (body.restore.notInterested) this.notInterested = true
		}
		const had = new Map(before.log.map((row) => [row.watch_id, row]))
		const kept = new Set(this.copy.log.map((row) => row.watch_id))
		return {
			status: "applied",
			refused: null,
			state: this.copy.state,
			rows: this.copy.log.filter((row) => had.get(row.watch_id) !== row),
			deleted: before.log
				.filter((row) => !kept.has(row.watch_id))
				.map((row) => row.watch_id),
			cleared,
		}
	}

	private route(method: string, path: string, body: unknown): Response | null {
		const data = (body ?? {}) as Record<string, unknown>
		if (path === "/api/tracking/show") {
			if (this.failNext !== null) {
				const status = this.failNext
				this.failNext = null
				return json({ error: "The harness failed this request" }, status)
			}
			if (method === "GET") return json(this.page())
			return json(
				this.act(
					data as { event: PageAction; actionId?: string; restore?: Restore },
				),
			)
		}
		if (path === "/api/user-data") return json(this.userData())
		if (path === "/api/update-scores") {
			const score = data.score as number | null
			this.score =
				score === null
					? null
					: { score, updatedAt: new Date(this.now()).toISOString() }
			if (score !== null) this.notInterested = false
			this.apply({ type: "rate", score, byHand: data.by_hand !== false })
			return json({ status: "success" })
		}
		if (path === "/api/update-wishlist") {
			this.wishlistAt = data.action === "add" ? this.now() : null
			if (data.action === "add") this.notInterested = false
			return json({ status: "success" })
		}
		if (path === "/api/update-not-interested") {
			this.notInterested = data.action === "add"
			if (this.notInterested) this.wishlistAt = null
			return json({ status: "success" })
		}
		if (path === "/api/update-watch-history") {
			// Today's Seen button, which a show without an episode list keeps.
			const applied =
				data.action === "add"
					? this.apply(
							{ type: "pressSeen" },
							String(data.action_id ?? this.id()),
						)
					: this.apply({ type: "undoSeen" })
			if (!applied.refused && applied.changes.clear.wantToSee)
				this.wishlistAt = null
			return json({ status: applied.refused ? "failed" : "success" })
		}
		return null
	}

	/** `fetch`, with the requests of tracking and of the title actions answered from memory. */
	fetch = (original: typeof fetch): typeof fetch => {
		return async (input, init) => {
			const url = new URL(
				typeof input === "string" || input instanceof URL
					? String(input)
					: input.url,
				window.location.href,
			)
			const method = (init?.method ?? "GET").toUpperCase()
			let body: unknown = null
			if (typeof init?.body === "string") {
				try {
					body = JSON.parse(init.body)
				} catch {}
			}
			const known = [
				"/api/tracking/show",
				"/api/user-data",
				"/api/update-scores",
				"/api/update-wishlist",
				"/api/update-not-interested",
				"/api/update-watch-history",
			]
			if (
				url.origin !== window.location.origin ||
				!known.includes(url.pathname)
			)
				return original(input, init)
			const record: RequestRecord = {
				method,
				path: url.pathname,
				body,
				startedAt: performance.now(),
				endedAt: null,
				status: null,
			}
			this.requests.push(record)
			await new Promise((resolve) => setTimeout(resolve, this.options.latency))
			const response =
				this.route(method, url.pathname, body) ??
				json({ error: "Not found" }, 404)
			record.endedAt = performance.now()
			record.status = response.status
			return response
		}
	}

	/** What is stored, for the checks and for the panel. */
	stored() {
		return {
			state: this.copy.state,
			log: this.copy.log,
			score: this.score?.score ?? null,
			wantToSee: this.wishlistAt !== null,
			wishlistAt:
				this.wishlistAt === null
					? null
					: new Date(this.wishlistAt).toISOString(),
			notInterested: this.notInterested,
		}
	}
}
