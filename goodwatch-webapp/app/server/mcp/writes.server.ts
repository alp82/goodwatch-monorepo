import { createHash } from "node:crypto"
import { updateNotInterested } from "../not-interested.server"
import { type Score, updateScores } from "../scores.server"
import {
	type ShowAction,
	applyShowTrackingAction,
} from "../show-tracking.server"
import { markTasteChanged } from "../taste/index.server"
import { getMovieTracking, getShowTracking } from "../tracking.server"
import { getUserData, resetUserDataCache } from "../userData.server"
import { applyWatchLogAction } from "../watch-log.server"
import { updateWishList } from "../wishList.server"
import { actionHash, readAction, runAction } from "./actions.server"
import {
	type CatalogTitle,
	readMemberTool,
	resolve,
	summary,
} from "./data.server.ts"
import {
	prepareServices,
	savedServices,
	writeServices,
} from "./services.server"
import type { WriteToolName } from "./write-names.ts"
import type { WriteArgs } from "./write-tools.server.ts"

async function snapshot(userId: string, title: CatalogTitle) {
	const [tracking, user] = await Promise.all([
		title.media_type === "movie"
			? getMovieTracking(userId, title.tmdb_id)
			: getShowTracking(userId, title.tmdb_id),
		getUserData({ user_id: userId }),
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
export async function writeMemberTool(
	userId: string,
	origin: string,
	name: WriteToolName,
	args: WriteArgs,
): Promise<Record<string, unknown>> {
	const hash = actionHash(name, args)
	const prior = await readAction(userId, args.action_id, hash)
	if (prior) return prior
	if (name === "set_my_services") {
		const prepared = await prepareServices(args)
		if ("result" in prepared) return prepared.result
		return runAction(
			userId,
			args.action_id,
			hash,
			async () => {
				const before = await savedServices(userId)
				await writeServices(userId, prepared.country, prepared.ids)
				await resetUserDataCache({ user_id: userId })
				await markTasteChanged(userId)
				const after = await savedServices(userId)
				return {
					outcome:
						JSON.stringify(before) === JSON.stringify(after)
							? "unchanged"
							: "applied",
					action_id: args.action_id,
					before,
					after,
				}
			},
			{
				tool: name,
				requested: { country: prepared.country, service_ids: prepared.ids },
			},
		)
	}
	const resolved = await resolve(args, origin)
	if ("result" in resolved) return { ...resolved.result, outcome: "unresolved" }
	const title = resolved.title
	return runAction(
		userId,
		args.action_id,
		hash,
		async () => {
			const before = await snapshot(userId, title)
			const actionId = `mcp-${createHash("sha256").update(`${userId}:${args.action_id}`).digest("hex")}`
			let removedWatchId: string | null = null
			if (name === "rate_title") {
				if (args.score === undefined)
					return {
						outcome: "refused",
						message: "A rating requires a score or null",
					}
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
					return {
						outcome: "refused",
						message: "Choose whether to add or remove Want to See",
					}
				if (title.media_type === "show" && args.want_to_see) {
					const accepted = await applyShowTrackingAction(userId, {
						id: title.tmdb_id,
						event: { type: "wantToSee", on: true },
					})
					if (accepted.status !== "applied")
						return { outcome: "refused", message: accepted.refused }
				}
				await updateWishList({
					user_id: userId,
					tmdb_id: title.tmdb_id,
					media_type: title.media_type,
					action: args.want_to_see ? "add" : "remove",
				})
			} else if (name === "set_not_interested") {
				if (args.not_interested === undefined)
					return {
						outcome: "refused",
						message: "Choose whether to set or clear Not interested",
					}
				if (
					args.not_interested &&
					(before.score !== null ||
						before.watches.length > 0 ||
						(title.media_type === "show" && before.status !== "not_started"))
				)
					return {
						outcome: "refused",
						message:
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
					return {
						outcome: "refused",
						message: "Only shows have a show status",
					}
				if (!args.status)
					return { outcome: "refused", message: "Choose a show status" }
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
								outcome: "refused",
								message:
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
					if (applied.status !== "applied")
						return { outcome: "refused", message: applied.refused }
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
					return {
						outcome: "refused",
						message: "No matching watch in your log for this title",
					}
				if (watch.origin === "score")
					return {
						outcome: "refused",
						message:
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
				if (applied.status !== "applied")
					return { outcome: "refused", message: applied.refused }
			} else if (name === "log_watch") {
				const when = args.date
					? { precision: "day" as const, day: args.date }
					: { precision: "unknown" as const }
				let applied: { status: string; refused: string | null }
				if (title.media_type === "movie") {
					if (args.season !== undefined || args.episode !== undefined)
						return {
							outcome: "refused",
							message: "A movie watch has no season or episode number",
						}
					applied = await applyWatchLogAction(userId, title.tmdb_id, {
						type: "watch",
						watchId: actionId,
						when,
					})
				} else {
					const { season, episode } = args
					if (season === undefined || episode === undefined)
						return {
							outcome: "refused",
							message: "An episode watch needs a season and episode number",
						}
					applied = await applyShowTrackingAction(userId, {
						id: title.tmdb_id,
						actionId,
						event: { type: "watch", season, number: episode, when },
					})
				}
				if (applied.status !== "applied")
					return { outcome: "refused", message: applied.refused }
			} else return { outcome: "refused", message: "Unsupported write tool" }
			await resetUserDataCache({ user_id: userId })
			await markTasteChanged(userId)
			const after = await snapshot(userId, title)
			return {
				outcome:
					JSON.stringify(before) === JSON.stringify(after)
						? "unchanged"
						: "applied",
				action_id: args.action_id,
				title: summary(title, origin),
				before: {
					...before,
					watch_count: before.watches.length,
					watches: before.watches.slice(0, 20),
				},
				after: {
					...after,
					watch_count: after.watches.length,
					watches: after.watches.slice(0, 20),
				},
				changes: {
					watches_added: after.watches.filter(
						(watch) =>
							!before.watches.some((old) => old.id === watch.id) &&
							(name === "log_watch"
								? watch.id === actionId
								: name === "set_show_status"
									? watch.group_id === actionId
									: (name === "rate_title" || name === "undo_watch") &&
										watch.origin === "score"),
					),
					watches_removed: before.watches.filter(
						(watch) =>
							!after.watches.some((next) => next.id === watch.id) &&
							(name === "undo_watch"
								? watch.id === removedWatchId
								: (name === "log_watch" || name === "rate_title") &&
									watch.origin === "score"),
					),
				},
			}
		},
		{ tool: name, title: summary(title, origin) },
	)
}
