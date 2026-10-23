import type { UserData } from "../../types/user-data"
import {
	EpisodeScoreTargetError,
	EpisodeScoresUnavailable,
	getEpisodeScore,
	setEpisodeScore,
} from "../episode-scores.server"
import { updateNotInterested } from "../not-interested.server"
import { type Score, updateScores } from "../scores.server"
import {
	type ShowAction,
	applyShowTrackingAction,
} from "../show-tracking.server"
import {
	getEpisodeList,
	getMovieTracking,
	getShowTracking,
} from "../tracking.server"
import { getUserData } from "../userData.server"
import { applyWatchLogAction } from "../watch-log.server"
import { updateWishList } from "../wishList.server"
import { type CatalogTitle, readMemberTool } from "./data.server.ts"
import type { WriteToolName } from "./write-names.ts"
import type { WriteArgs } from "./write-tools.server.ts"

/**
 * A season, or an episode of it, that rate_title scores instead of the whole show (#759): numbers in TMDB's
 * numbering, as log_watch takes them. These scores live apart from the title's score and never change its taste,
 * status or watches.
 */
export interface PartTarget {
	season: number
	episode?: number
}
/** The part a rate_title call names; null for every other call, and for a rating of the whole title. */
export const partOf = (
	name: WriteToolName,
	args: Pick<WriteArgs, "season" | "episode">,
): PartTarget | null =>
	name === "rate_title" && args.season !== undefined
		? {
				season: args.season,
				...(args.episode !== undefined ? { episode: args.episode } : {}),
			}
		: null
/** "Season 2", or "S2 E5". */
export const partLabel = (part: PartTarget) =>
	part.episode === undefined
		? `Season ${part.season}`
		: `S${part.season} E${part.episode}`

/** What a part score reads and writes; tests pass their own. */
export interface PartDeps {
	episodes(showId: number): Promise<
		{
			tmdb_id: number
			season_number: number
			episode_number: number
			air_date: number | null
		}[]
	>
	/** One score by its whole key, which sees a write made just before it. */
	score: typeof getEpisodeScore
	set: typeof setEpisodeScore
	now(): number
}
const livePartDeps: PartDeps = {
	episodes: getEpisodeList,
	score: getEpisodeScore,
	set: setEpisodeScore,
	now: () => Date.now(),
}

type ShowRef = Pick<CatalogTitle, "media_type" | "tmdb_id">

/** The member's score for one part of a show; null when there is none or the episode isn't in the list. */
export async function readPartScore(
	userId: string,
	title: ShowRef,
	part: PartTarget,
	deps: PartDeps = livePartDeps,
): Promise<number | null> {
	let key = `s${part.season}`
	if (part.episode !== undefined) {
		const episode = (await deps.episodes(title.tmdb_id)).find(
			(row) =>
				row.season_number === part.season &&
				row.episode_number === part.episode,
		)
		if (!episode) return null
		key = `e${episode.tmdb_id}`
	}
	return (await deps.score(userId, title.tmdb_id, key))?.score ?? null
}

/** Sets or clears a part score; answers with a refusal, or null once written. */
export async function writePartScore(
	userId: string,
	title: ShowRef,
	part: PartTarget,
	score: number | null,
	deps: PartDeps = livePartDeps,
): Promise<{ refused: string } | null> {
	if (title.media_type !== "show")
		return {
			refused:
				"A movie has no seasons or episodes. Leave out season and episode to rate the movie.",
		}
	const inSeason = (await deps.episodes(title.tmdb_id)).filter(
		(row) => row.season_number === part.season,
	)
	const aired = (row: { air_date: number | null }) =>
		row.air_date !== null && row.air_date <= deps.now()
	let target:
		| { scope: "season"; season: number }
		| { scope: "episode"; episodeTmdbId: number }
	if (part.episode === undefined) {
		if (!inSeason.some(aired))
			return { refused: "This season has no aired episodes yet." }
		target = { scope: "season", season: part.season }
	} else {
		const episode = inSeason.find((row) => row.episode_number === part.episode)
		if (!episode)
			return { refused: "This show's episode list has no such episode." }
		if (!aired(episode)) return { refused: "This episode hasn't aired yet." }
		target = { scope: "episode", episodeTmdbId: episode.tmdb_id }
	}
	try {
		await deps.set(userId, title.tmdb_id, target, score)
	} catch (error) {
		if (error instanceof EpisodeScoresUnavailable)
			return { refused: "Season and episode scores aren't available yet." }
		if (error instanceof EpisodeScoreTargetError)
			return { refused: error.message }
		throw error
	}
	return null
}

/**
 * The member's marks and watch log for one title. `preloaded` reuses member data a batch read once for many titles.
 * With a part, it also reads that part's score as `part_score`.
 */
export async function snapshot(
	userId: string,
	title: CatalogTitle,
	preloaded?: UserData,
	part?: PartTarget | null,
) {
	const [tracking, user, partScore] = await Promise.all([
		title.media_type === "movie"
			? getMovieTracking(userId, title.tmdb_id)
			: getShowTracking(userId, title.tmdb_id),
		preloaded ?? getUserData({ user_id: userId }),
		part && title.media_type === "show"
			? readPartScore(userId, title, part)
			: undefined,
	])
	const key = `${title.media_type}-${title.tmdb_id}` as const
	const watches = [...tracking.log]
		.sort(
			(a, b) =>
				b.created_at - a.created_at || a.watch_id.localeCompare(b.watch_id),
		)
		.map((watch) => ({
			id: watch.watch_id,
			record_created_at: new Date(watch.created_at).toISOString(),
			watched_at:
				watch.watched_at === null
					? null
					: new Date(watch.watched_at).toISOString(),
			episode_id: watch.episode_tmdb_id,
			group_id: watch.group_id,
			import_id: watch.import_id,
			season: watch.season_number,
			episode: watch.episode_number,
			date:
				watch.watched_at === null
					? null
					: new Date(watch.watched_at).toISOString().slice(0, 10),
			date_precision: watch.watched_at_precision,
			date_note:
				watch.watched_at === null ? "No date recorded" : "Recorded watch date",
			pass: watch.pass,
			origin: watch.origin,
		}))
	return {
		...(partScore !== undefined ? { part_score: partScore } : {}),
		status:
			tracking.state?.state ??
			(title.media_type === "show" ? "not_started" : null),
		pass: tracking.state?.pass ?? (title.media_type === "show" ? 1 : null),
		score: user.scores[key]?.score ?? null,
		review: user.scores[key]?.review ?? null,
		want_to_see: key in user.wishlist,
		want_to_see_added_at: user.wishlist[key]?.createdAt ?? null,
		not_interested: key in user.notInterested,
		watches,
	}
}

export type Snapshot = Awaited<ReturnType<typeof snapshot>>

/** What a title write did: nothing and why, or the watch it removed and the show event it applied. */
export type TitleWrite =
	| { refused: string | null }
	| { removedWatchId: string | null; event: ShowAction["event"]["type"] | null }

/**
 * One title's write through the site's own writers, as a single MCP call and every item of a batch make it.
 * `actionId` names the watches and groups it makes, so the same action sent again writes nothing twice. A refusal
 * writes nothing. It leaves the member data reset, taste and the result to the caller.
 */
export async function applyTitleWrite(
	userId: string,
	origin: string,
	name: WriteToolName,
	args: WriteArgs,
	title: CatalogTitle,
	before: Snapshot,
	actionId: string,
): Promise<TitleWrite> {
	let removedWatchId: string | null = null
	let appliedEvent: ShowAction["event"]["type"] | null = null
	const part = partOf(name, args)
	if (part) {
		if (args.score === undefined)
			return { refused: "A rating requires a score or null" }
		const refused = await writePartScore(userId, title, part, args.score)
		if (refused) return refused
	} else if (name === "rate_title") {
		if (args.score === undefined)
			return { refused: "A rating requires a score or null" }
		const updated = await updateScores({
			user_id: userId,
			tmdb_id: title.tmdb_id,
			media_type: title.media_type,
			score: args.score as Score | null,
			review: before.review ?? undefined,
		})
		// Clearing an already absent score has a zero-row delete, but its native settlement still repairs tracking.
		if (updated.status !== "success" && args.score !== null)
			throw new Error("Rating write failed")
	} else if (name === "set_want_to_see") {
		if (args.want_to_see === undefined)
			return { refused: "Choose whether to add or remove Want to See" }
		if (title.media_type === "show" && args.want_to_see) {
			const accepted = await applyShowTrackingAction(userId, {
				id: title.tmdb_id,
				event: { type: "wantToSee", on: true },
			})
			if (accepted.status !== "applied") return { refused: accepted.refused }
		}
		await updateWishList({
			user_id: userId,
			tmdb_id: title.tmdb_id,
			media_type: title.media_type,
			action: args.want_to_see ? "add" : "remove",
		})
	} else if (name === "set_not_interested") {
		if (args.not_interested === undefined)
			return { refused: "Choose whether to set or clear Not interested" }
		if (
			args.not_interested &&
			(before.score !== null ||
				before.watches.length > 0 ||
				(title.media_type === "show" && before.status !== "not_started"))
		)
			return {
				refused:
					"Not interested is only available before watching or rating this title. Use Dropped for a started show.",
			}
		const updated = await updateNotInterested({
			user_id: userId,
			tmdb_id: title.tmdb_id,
			media_type: title.media_type,
			action: args.not_interested ? "add" : "remove",
		})
		if (updated.status !== "success")
			throw new Error("Not interested write failed")
	} else if (name === "set_show_status") {
		if (title.media_type !== "show")
			return { refused: "Only shows have a show status" }
		if (!args.status) return { refused: "Choose a show status" }
		const target = {
			"Not started": "not_started",
			Watching: "watching",
			"On hold": "on_hold",
			Dropped: "dropped",
			Seen: "seen",
		}[args.status]
		let event: ShowAction["event"] | null = null
		if (target === "seen") {
			const progress =
				before.status === "seen"
					? await readMemberTool(userId, origin, "get_show_progress", {
							title_id: `show:${title.tmdb_id}`,
						})
					: null
			if (
				!progress ||
				Number(progress.episodes_watched) < Number(progress.aired_episodes)
			)
				event = { type: "pressSeen" }
		} else if (target !== before.status) {
			if (target === "watching" || target === "not_started") {
				const progress = await readMemberTool(
					userId,
					origin,
					"get_show_progress",
					{ title_id: `show:${title.tmdb_id}` },
				)
				if (
					target === "watching" &&
					Number(progress.episodes_watched) > 0 &&
					before.status === "seen"
				)
					event = { type: "watchAgain" }
				else if (
					["on_hold", "dropped"].includes(String(before.status)) &&
					(target === "watching"
						? Number(progress.episodes_watched) > 0
						: Number(progress.episodes_watched) === 0)
				)
					event = { type: "resume" }
				else
					return {
						refused:
							"Log an episode to start Watching. Not started cannot clear your watch history.",
					}
			} else event = { type: target === "on_hold" ? "hold" : "drop" }
		}
		if (event) {
			const applied = await applyShowTrackingAction(userId, {
				id: title.tmdb_id,
				actionId,
				event,
			})
			if (applied.status !== "applied") return { refused: applied.refused }
			appliedEvent = event.type
		}
	} else if (name === "undo_watch") {
		const watch = args.watch_id
			? before.watches.find((watch) => watch.id === args.watch_id)
			: before.watches.find(
					(watch) =>
						watch.origin === "single" &&
						(title.media_type === "movie" || watch.pass === before.pass),
				)
		if (!watch)
			return { refused: "No matching watch in your log for this title" }
		if (watch.origin === "score")
			return {
				refused:
					"This watch comes from your score. Clear the score to remove it.",
			}
		removedWatchId = watch.id
		const applied =
			title.media_type === "movie"
				? await applyWatchLogAction(userId, title.tmdb_id, {
						type: "delete",
						watchId: watch.id,
					})
				: await applyShowTrackingAction(userId, {
						id: title.tmdb_id,
						event: { type: "deleteWatch", watchId: watch.id },
					})
		if (applied.status !== "applied") return { refused: applied.refused }
	} else if (name === "log_watch") {
		if (args.date && args.date > new Date().toISOString().slice(0, 10))
			return { refused: "A recorded watch date cannot be in the future" }
		const when = args.date
			? { precision: "day" as const, day: args.date }
			: { precision: "unknown" as const }
		let applied: { status: string; refused: string | null }
		if (title.media_type === "movie") {
			if (
				args.season !== undefined ||
				args.episode !== undefined ||
				args.episode_end !== undefined ||
				args.whole_season
			)
				return { refused: "A movie watch has no season or episode number" }
			applied = await applyWatchLogAction(userId, title.tmdb_id, {
				type: "watch",
				watchId: actionId,
				when,
			})
		} else {
			const { season, episode } = args
			if (args.whole_season || args.episode_end !== undefined) {
				const episodes = (await getEpisodeList(title.tmdb_id)).filter(
					(row) =>
						row.season_number === season &&
						row.season_number > 0 &&
						(args.whole_season ||
							(row.episode_number >= episode! &&
								row.episode_number <= args.episode_end!)),
				)
				if (
					!episodes.some(
						(row) =>
							row.air_date !== null &&
							new Date(row.air_date).getTime() <= Date.now(),
					)
				)
					return {
						refused: "No aired regular episodes in this season or range",
					}
				const result = await applyShowTrackingAction(userId, {
					id: title.tmdb_id,
					actionId,
					event: args.whole_season
						? { type: "markSeason", season: season! }
						: {
								type: "markRange",
								season: season!,
								from: episode!,
								to: args.episode_end!,
							},
				})
				if (
					result.status !== "applied" &&
					result.refused !==
						"Every aired episode of it is watched in this pass."
				)
					return { refused: result.refused }
				if (args.date && result.status === "applied" && result.rows.length) {
					const dated = await applyShowTrackingAction(userId, {
						id: title.tmdb_id,
						event: {
							type: "setGroupDate",
							group: actionId,
							day: args.date,
						},
					})
					if (dated.status !== "applied")
						throw new Error("Could not set range watch date")
				}
				applied = { status: "applied", refused: null }
			} else {
				if (season === undefined || episode === undefined)
					return {
						refused: "An episode watch needs a season and episode number",
					}
				applied = await applyShowTrackingAction(userId, {
					id: title.tmdb_id,
					actionId,
					event: { type: "watch", season, number: episode, when },
				})
			}
		}
		if (applied.status !== "applied") return { refused: applied.refused }
	} else return { refused: "Unsupported write tool" }
	return { removedWatchId, event: appliedEvent }
}
