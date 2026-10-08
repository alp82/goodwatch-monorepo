// A movie's watch log in the browser: the read under its own key per movie, and one function that does an action in
// the log. The browser shows what it expects at once (the log, and the movie's entry in the member data); the
// server's answer replaces the log, and the refetched member data replaces the entry. On an error both go back to
// what they were, and a message says so (docs/implementation/tracking/data-model.md, "The browser").
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "react-toastify"
import { afterWatchLog } from "~/domain/member-data-updates-watch-log"
import type { WatchLogEntry } from "~/domain/watch-log"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import type {
	WatchLogAction,
	WatchLogAnswer,
} from "~/server/watch-log.server"
import type {
	ActionTimestamp,
	UserData,
	WishlistEntry,
} from "~/types/user-data"
import { useUser } from "~/utils/auth"

export const watchLogKey = (userId: string | undefined, movieId: number) =>
	["watch-log", userId ?? "", movieId] as const

/** An id for a watch, made here so that a request sent twice records once. */
export const newWatchId = () =>
	globalThis.crypto?.randomUUID?.() ??
	`w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

const NOT_SAVED = "Couldn't save that. Your watches are as they were."

async function request(init?: RequestInit, query = ""): Promise<Response> {
	const response = await fetch(`/api/watch-log${query}`, init)
	if (!response.ok) throw new Error(`The watch log answered ${response.status}`)
	return response
}

/** The member's watches of one movie, read when the log first opens. */
export function useWatchLog(movieId: number) {
	const { user } = useUser()
	return useQuery<WatchLogEntry[]>({
		queryKey: watchLogKey(user?.id, movieId),
		queryFn: async () =>
			((await (await request(undefined, `?tmdb_id=${movieId}`)).json()) as {
				watches: WatchLogEntry[]
			}).watches,
		enabled: Boolean(user?.id),
	})
}

export interface LogChange {
	/** The action logs a watch, which takes the movie off the Wishlist and off Not interested. */
	watched?: boolean
	/** Undo of the first watch: what that watch took the movie off. */
	back?: { wishlist?: WishlistEntry; notInterested?: ActionTimestamp }
}

/**
 * `act(movieId, action, expect, change)` does one action in a movie's log. `expect` says what the log is right
 * after it. Answers whether it was saved; when not, everything is as it was and the member has been told.
 */
export function useWatchLogAction() {
	const client = useQueryClient()
	const { user } = useUser()
	const userId = user?.id
	// Sent as a mutation, like every other mark a member makes: a page that reloads its list after a mark (Watch
	// next) hears of it through the mutation cache.
	const { mutateAsync: send } = useMutation({
		mutationFn: async (body: { tmdb_id: number; action: WatchLogAction }) =>
			(await (
				await request({
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				})
			).json()) as WatchLogAnswer,
	})
	return useCallback(
		async (
			movieId: number,
			action: WatchLogAction,
			expect: (log: WatchLogEntry[]) => WatchLogEntry[],
			change: LogChange = {},
		): Promise<boolean> => {
			const dataKey = getQueryKeyUserData(userId)
			const logKey = watchLogKey(userId, movieId)
			await Promise.all([
				client.cancelQueries({ queryKey: dataKey }),
				client.cancelQueries({ queryKey: logKey }),
			])
			const dataBefore = client.getQueryData<UserData>(dataKey)
			const logBefore = client.getQueryData<WatchLogEntry[]>(logKey)
			// A movie that is not Seen has no watch, so its log is known without a read.
			const known =
				logBefore ??
				(dataBefore && !dataBefore.watchState[`movie-${movieId}`]
					? []
					: undefined)
			if (known) {
				const expected = expect(known)
				client.setQueryData(logKey, expected)
				client.setQueryData<UserData>(dataKey, (data) =>
					afterWatchLog(data, movieId, expected, change),
				)
			}
			const settle = (log: WatchLogEntry[], applied: LogChange) => {
				client.setQueryData(logKey, log)
				client.setQueryData<UserData>(dataKey, (data) =>
					afterWatchLog(data && dataBefore, movieId, log, applied),
				)
				// The entry is a guess from the log; the member data says what the server stored.
				void client.invalidateQueries({ queryKey: dataKey })
			}
			try {
				const answer = await send({ tmdb_id: movieId, action })
				if (answer.status === "applied") {
					settle(answer.watches, change)
					return true
				}
				settle(answer.watches, {})
				toast.error(answer.refused || NOT_SAVED)
				return false
			} catch {
				if (dataBefore) client.setQueryData(dataKey, dataBefore)
				if (logBefore) client.setQueryData(logKey, logBefore)
				else client.removeQueries({ queryKey: logKey, exact: true })
				void client.invalidateQueries({ queryKey: dataKey })
				toast.error(NOT_SAVED)
				return false
			}
		},
		[client, userId, send],
	)
}
