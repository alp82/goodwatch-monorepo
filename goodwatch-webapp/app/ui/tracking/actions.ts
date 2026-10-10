// What a member can do to a show's tracking, as the hero box and the episode list offer it (#384): each action is
// applied through the show's store, answers with a toast, and offers the Undo that takes exactly it back.
import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import {
	type State,
	type WatchedWhen,
	episodeLabel,
} from "~/domain/tracking/machine"
import type {
	ActionAnswer,
	PageAction,
	PageEpisode,
} from "~/domain/tracking/show-page"
import { seenPressRestore } from "~/domain/tracking/storage"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import { type UserData, createMediaKey } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import {
	type ShowStore,
	type ToastAction,
	deviceClock,
	newActionId,
} from "./store"

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`
const watches = (count: number) =>
	`${count} ${count === 1 ? "watch" : "watches"}`

const stateOf = (store: ShowStore): State =>
	store.snapshot.copy?.state?.state ?? "not_started"

/** A watch that was made within this long is put back as "now" by an Undo; an older one keeps its day. */
const JUST_NOW_MS = 10 * 60 * 1000
const two = (value: number) => String(value).padStart(2, "0")
const localDay = (at: number) => {
	const date = new Date(at)
	return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}

export type TrackingActions = ReturnType<typeof useTrackingActions>

export function useTrackingActions(store: ShowStore, title: string) {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userId = user?.id
	return useMemo(() => {
		const key = createMediaKey("show", store.showId)
		const today = () => deviceClock.today()

		/** The member data map gets back what a first watch took off it. */
		const putBack = (cleared: ActionAnswer["cleared"]) =>
			queryClient.setQueryData<UserData>(getQueryKeyUserData(userId), (old) => {
				if (!old) return old
				if (cleared.wantToSeeAddedAt) {
					const createdAt = new Date(cleared.wantToSeeAddedAt)
					return {
						...old,
						wishlist: {
							...old.wishlist,
							[key]: { createdAt, updatedAt: createdAt },
						},
					}
				}
				if (cleared.notInterested)
					return {
						...old,
						notInterested: {
							...old.notInterested,
							[key]: { updatedAt: new Date(deviceClock.now()) },
						},
					}
				return old
			})

		/**
		 * The Undo of an action that made watches. It removes what the action made, and when that was the member's
		 * first watch of the show it puts the show back on the Wishlist, or back to Not interested.
		 */
		const undoOf =
			(undo: PageAction, done: Promise<ActionAnswer | null>) => async () => {
				store.dismissToast()
				const answer = await done
				if (!answer) return
				const taken = store.act(undo, { restore: answer.cleared })
				const result = await taken.done
				if (result && (result.state?.state ?? "not_started") === "not_started")
					putBack(answer.cleared)
			}

		const setDate = (group: string, count: number): ToastAction => ({
			label: "Set a date",
			run: () => {
				store.dismissToast()
				store.askDate({ group, count })
			},
		})

		/** A group action: applied at once with no date; the toast offers the date and the Undo. */
		const group = (action: PageAction, text: (count: number) => string) => {
			const id = newActionId()
			const before = store.snapshot.copy?.log.length ?? 0
			const acted = store.act(action, { actionId: id })
			if (!acted.ok) return
			const count = (store.snapshot.copy?.log.length ?? 0) - before
			store.say(text(count), [
				...(count > 0 ? [setDate(id, count)] : []),
				{
					label: "Undo",
					run: undoOf(
						action.type === "pressSeen"
							? { type: "undoSeen" }
							: { type: "undoGroup", group: id },
						acted.done,
					),
				},
			])
		}

		return {
			/** One press on an episode's tick, or a date chosen for an episode that is not watched yet. */
			watch(episode: PageEpisode, when?: WatchedWhen) {
				const id = newActionId()
				const from = stateOf(store)
				const acted = store.act(
					{
						type: "watch",
						season: episode.season,
						number: episode.number,
						...(when ? { when } : {}),
					},
					{ actionId: id },
				)
				if (!acted.ok) return
				const to = stateOf(store)
				const label = episodeLabel(episode)
				store.say(
					episode.season === 0
						? `${episode.name ?? label} watched. Specials don't count toward your progress.`
						: to === "seen" && from !== "seen"
							? `You've watched every episode of ${title}.`
							: `${label} marked as watched`,
					[
						{
							label: "Undo",
							run: undoOf({ type: "deleteWatch", watchId: id }, acted.done),
						},
					],
				)
			},

			/** Removes the episode's watches of the current pass. Undo records the episode again, on the same day. */
			unwatch(episode: PageEpisode) {
				const copy = store.snapshot.copy
				const pass = copy?.state?.pass ?? 1
				const [latest] = (copy?.log ?? [])
					.filter(
						(row) =>
							row.pass === pass &&
							row.season_number === episode.season &&
							row.episode_number === episode.number,
					)
					.sort((a, b) => (b.watched_at ?? 0) - (a.watched_at ?? 0))
				const acted = store.act({
					type: "unwatch",
					season: episode.season,
					number: episode.number,
				})
				if (!acted.ok) return
				const when: WatchedWhen =
					!latest || latest.watched_at === null
						? { precision: "unknown" }
						: latest.watched_at_precision === "moment" &&
								deviceClock.now() - latest.watched_at < JUST_NOW_MS
							? { precision: "moment" }
							: {
									precision: "day",
									day:
										latest.watched_at_precision === "day"
											? new Date(latest.watched_at).toISOString().slice(0, 10)
											: localDay(latest.watched_at),
								}
				store.say(`${episodeLabel(episode)} is unwatched again`, [
					{
						label: "Undo",
						run: () => {
							store.dismissToast()
							store.act(
								{
									type: "watch",
									season: episode.season,
									number: episode.number,
									when,
								},
								{ actionId: newActionId() },
							)
						},
					},
				])
			},

			markSeason(season: number) {
				group(
					{ type: "markSeason", season, today: today() },
					(count) => `${plural(count, "episode")} marked, date unknown`,
				)
			},

			watchUpTo(episode: PageEpisode) {
				group(
					{
						type: "watchUpTo",
						season: episode.season,
						number: episode.number,
						today: today(),
					},
					(count) => `${plural(count, "episode")} marked, date unknown`,
				)
			},

			/** The Seen button's press: marks every aired episode that is not watched yet, as one group. */
			pressSeen() {
				group({ type: "pressSeen", today: today() }, (count) =>
					count > 0
						? `Seen: ${plural(count, "episode")} marked, date unknown`
						: `${title} is marked as Seen`,
				)
			},

			/**
			 * Takes the standing Seen press back: the Seen button's second press, and Take back after its question.
			 * Undo puts the press back as it was stored: its watches with their ids and dates, and the day it was made.
			 */
			undoSeen() {
				const copy = store.snapshot.copy
				const before = copy?.log.length ?? 0
				// Read before the press goes: afterwards nothing stored says what it was.
				const press = copy ? seenPressRestore(copy.state, copy.log) : null
				if (!store.act({ type: "undoSeen" }).ok) return
				const kept = store.snapshot.copy?.log.length ?? 0
				const removed = before - kept
				store.say(
					`Seen taken back${removed ? `: ${watches(removed)} removed` : ""}${kept ? `. ${watches(kept)} you marked yourself ${kept === 1 ? "stays" : "stay"}.` : ""}`,
					press
						? [
								{
									label: "Undo",
									run: () => {
										store.dismissToast()
										if (store.act(press).ok)
											store.say("Seen is back, as it was before.")
									},
								},
							]
						: [],
				)
			},

			hold() {
				const from = stateOf(store)
				if (!store.act({ type: "hold", today: today() }).ok) return
				// From Seen (row 28) there is no way back to Seen but the episodes: Resume leads to Watching.
				if (from === "seen")
					return store.say(
						`${title} is on hold. Resume brings it back as Watching.`,
					)
				store.say(`${title} is on hold`, [
					{
						label: "Undo",
						run: () => {
							store.dismissToast()
							store.act({ type: "resume" })
						},
					},
				])
			},

			drop() {
				const from = stateOf(store)
				if (!store.act({ type: "drop", today: today() }).ok) return
				const said = `${title} is dropped and hidden from your recommendations`
				// From Seen (row 29), as for On hold above.
				if (from === "seen")
					return store.say(`${said}. Resume brings it back as Watching.`)
				store.say(said, [
					{
						label: "Undo",
						run: () => {
							store.dismissToast()
							store.act({ type: "resume" })
							if (from === "on_hold") store.act({ type: "hold" })
						},
					},
				])
			},

			resume() {
				if (!store.act({ type: "resume" }).ok) return
				store.say(
					stateOf(store) === "watching"
						? `You're watching ${title} again`
						: `${title} is no longer dropped`,
				)
			},

			watchAgain() {
				if (!store.act({ type: "watchAgain" }).ok) return
				const pass = store.snapshot.copy?.state?.pass ?? 2
				store.say(
					`Pass ${pass} of ${title} started. Your earlier watches stay in each episode's log.`,
				)
			},

			/** Want to See on a Dropped show with nothing watched: Not started again, and on the Wishlist. */
			async wantToSee() {
				const acted = store.act({ type: "wantToSee", on: true })
				if (!acted.ok) return
				if (await acted.done)
					putBack({
						wantToSeeAddedAt: new Date(deviceClock.now()).toISOString(),
						notInterested: false,
					})
			},

			dismissRatePrompt() {
				store.act({ type: "dismissRatePrompt" })
			},

			answerSeenQuestion(answer: "partway" | "just_rating") {
				store.act({ type: "answerSeenQuestion", answer })
			},

			/** A day or "don't know when" for one watch. */
			setWatchDate(
				watchId: string,
				when: Exclude<WatchedWhen, { precision: "moment" }>,
			) {
				store.act({ type: "editWatchDate", watchId, when })
			},

			/** Removes one watch from an episode's log, in any pass. */
			deleteWatch(watchId: string) {
				if (!store.act({ type: "deleteWatch", watchId }).ok) return
				store.say("Watch removed")
			},

			/** Opens the dialog that gives the watches of a group one day: the toast's "Set a date", and the menu's. */
			askGroupDate(group: string, count: number) {
				store.dismissToast()
				store.askDate({ group, count })
			},

			setGroupDate(group: string, day: string) {
				store.act({ type: "setGroupDate", group, day })
			},
		}
	}, [store, title, queryClient, userId])
}
