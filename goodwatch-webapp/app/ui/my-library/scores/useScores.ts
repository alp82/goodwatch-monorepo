// Your scores' state: the scores as they stand now, what changed on this page, and where rows sit.
// - A press on a score saves it at once, through the app's score mutation, as on the title page.
// - Many titles at once go to /api/update-scores-batch, MAX_ITEMS a request.
// - Undo writes the score back that the last change replaced.
// - A rescored row stays where it was until the view changes (search, filters, sort, groups), so it doesn't jump
//   away under the pointer: rows sit by `placeOf`, and `settle` moves them to where they now belong.
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useRef, useState } from "react"
import { SCORE_BATCH_MAX as MAX_ITEMS, type ScoredTitle, type Standing } from "~/domain/my-scores"
import { useScoreMutation } from "~/hooks/useUserDataMutations"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import { useUser } from "~/utils/auth"
import { libraryQueryKey } from "../MyLibraryPage"

export interface Change {
	/** The titles and the scores they had before. */
	items: { title: ScoredTitle; from: number }[]
	to: number | "step"
	/** One title: its name; many: how many. */
	label: string
}

export type SaveState = { kind: "idle" } | { kind: "saving"; done: number; of: number } | { kind: "failed"; label: string }

export function useScores(titles: readonly ScoredTitle[]) {
	const client = useQueryClient()
	const { user } = useUser()
	const { mutate: rate } = useScoreMutation()
	const [scores, setScores] = useState<Record<string, number>>({})
	const [placed, setPlaced] = useState<Record<string, number>>({})
	const [changes, setChanges] = useState<Change[]>([])
	const [save, setSave] = useState<SaveState>({ kind: "idle" })
	// Rows are memoized: the callbacks stay the same functions and read the scores from a ref.
	const live = useRef(scores)
	live.current = scores

	const original = useMemo(() => new Map(titles.map((t) => [t.key, t.score])), [titles])
	const scoreOf = useCallback((t: ScoredTitle) => scores[t.key] ?? t.score, [scores])
	const placeOf = useCallback((t: ScoredTitle) => placed[t.key] ?? t.score, [placed])
	const changed = useCallback(
		(t: ScoredTitle) => t.key in scores && scores[t.key] !== original.get(t.key),
		[scores, original],
	)
	/** How a row stands for the filters and the order: where it sits, and whether it changed. */
	const standingOf = useCallback(
		(t: ScoredTitle): Standing => ({ score: placeOf(t), changed: changed(t) }),
		[placeOf, changed],
	)
	const settle = useCallback(() => setPlaced(live.current), [])

	const apply = useCallback((next: { key: string; score: number }[]) => {
		live.current = { ...live.current }
		for (const { key, score } of next) live.current[key] = score
		setScores(live.current)
	}, [])
	const refresh = useCallback(() => {
		client.invalidateQueries({ queryKey: getQueryKeyUserData(user?.id) })
		client.invalidateQueries({ queryKey: libraryQueryKey })
	}, [client, user?.id])

	/** Saves one title's score; puts the old one back when the save fails, and drops the change it came from. */
	const writeOne = useCallback(
		(title: ScoredTitle, to: number, from: number, change: Change | null) => {
			apply([{ key: title.key, score: to }])
			rate(
				{ mediaType: title.mediaType, tmdbId: title.tmdbId, score: to as Score },
				{
					onSettled: (result, error) => {
						if (!error && result?.status !== "failed") {
							client.invalidateQueries({ queryKey: libraryQueryKey })
							return
						}
						apply([{ key: title.key, score: from }])
						if (change) setChanges((c) => c.filter((other) => other !== change))
						setSave({ kind: "failed", label: title.title })
					},
				},
			)
		},
		[apply, rate, client],
	)

	/** Saves many titles, MAX_ITEMS a request; the ones that failed get their old scores back. */
	const writeMany = useCallback(
		async (items: { title: ScoredTitle; to: number; from: number }[], change: Change | null) => {
			apply(items.map((i) => ({ key: i.title.key, score: i.to })))
			setSave({ kind: "saving", done: 0, of: items.length })
			const failed: typeof items = []
			for (let i = 0; i < items.length; i += MAX_ITEMS) {
				const chunk = items.slice(i, i + MAX_ITEMS)
				try {
					const response = await fetch("/api/update-scores-batch", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							items: chunk.map((c) => ({ tmdb_id: c.title.tmdbId, media_type: c.title.mediaType, score: c.to })),
						}),
					})
					if (!response.ok) throw new Error(`Batch answered ${response.status}`)
					const { results } = (await response.json()) as { results: { status: string }[] }
					results.forEach((r, n) => r.status !== "success" && failed.push(chunk[n]))
				} catch {
					failed.push(...chunk)
				}
				setSave({ kind: "saving", done: Math.min(items.length, i + MAX_ITEMS), of: items.length })
			}
			if (failed.length) {
				apply(failed.map((f) => ({ key: f.title.key, score: f.from })))
				// Undo takes back only what was saved.
				if (change)
					setChanges((c) =>
						failed.length === items.length
							? c.filter((other) => other !== change)
							: c.map((other) =>
									other === change
										? { ...other, items: other.items.filter((i) => !failed.some((f) => f.title.key === i.title.key)) }
										: other,
								),
					)
				setSave({ kind: "failed", label: failed.length === 1 ? failed[0].title.title : `${failed.length} titles` })
			} else setSave({ kind: "idle" })
			refresh()
		},
		[apply, refresh],
	)

	const rescore = useCallback(
		(title: ScoredTitle, to: number) => {
			const from = live.current[title.key] ?? title.score
			if (from === to) return
			setSave((now) => (now.kind === "saving" ? now : { kind: "idle" }))
			const change: Change = { items: [{ title, from }], to, label: title.title }
			setChanges((c) => [change, ...c])
			writeOne(title, to, from, change)
		},
		[writeOne],
	)

	/** Many titles to one score, or each one up or down a step. */
	const rescoreMany = useCallback(
		(picked: ScoredTitle[], to: number | ((now: number) => number)) => {
			const items = picked
				.map((title) => {
					const from = live.current[title.key] ?? title.score
					const next = Math.min(10, Math.max(1, typeof to === "number" ? to : to(from)))
					return { title, from, to: next }
				})
				.filter((i) => i.to !== i.from)
			if (!items.length) return
			const label = items.length === 1 ? items[0].title.title : `${items.length} titles`
			const change: Change = {
				items: items.map(({ title, from }) => ({ title, from })),
				to: typeof to === "number" ? to : "step",
				label,
			}
			setChanges((c) => [change, ...c])
			if (items.length === 1) writeOne(items[0].title, items[0].to, items[0].from, change)
			else void writeMany(items, change)
		},
		[writeOne, writeMany],
	)

	/** Takes the last change back: its titles get the scores they had before it. */
	const undo = useCallback(() => {
		const [last, ...rest] = changes
		if (!last) return
		setChanges(rest)
		setSave({ kind: "idle" })
		const items = last.items
			.map(({ title, from }) => ({ title, to: from, from: live.current[title.key] ?? title.score }))
			.filter((i) => i.to !== i.from)
		if (items.length === 1) writeOne(items[0].title, items[0].to, items[0].from, null)
		else if (items.length) void writeMany(items, null)
	}, [changes, writeOne, writeMany])

	return { scoreOf, placeOf, standingOf, changed, settle, rescore, rescoreMany, undo, changes, save, original }
}
