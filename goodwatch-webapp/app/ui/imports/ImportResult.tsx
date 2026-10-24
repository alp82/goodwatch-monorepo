// What a finished or undone import changed, for every source, from the import's items API grouped by title: the
// result itself, the rest of a long section, and the buttons that put a list choice back.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import type {
	ImportResult as ImportResultData,
	ImportResultPage,
	ImportResultRow,
	ImportResultSection,
} from "~/domain/import-result"
import {
	useNotInterestedMutation,
	useWishlistMutation,
} from "~/hooks/useUserDataMutations"
import { useUserData } from "~/routes/api.user-data"
import { createMediaKey } from "~/types/user-data"
import { Spinner } from "~/ui/wait/Spinner"
import {
	LIST_LABEL,
	type PutBack,
	ResultRows,
	plural,
	resultList,
} from "./ImportResultView"
import { request } from "./api"
import { errorBox, textLink } from "./shared"

/** The import routes whose items API serves `?by=title`. */
export type ImportResultApi = "/api/imports" | "/api/imdb-import"
const PAGE = 100

const itemsUrl = (api: ImportResultApi, id: string) =>
	`${api}/${encodeURIComponent(id)}/items?by=title`

/** The status is part of the key: Undo turns the import's result into the Undo result. */
export const resultKey = (api: ImportResultApi, id: string, status: string) =>
	["import-result", api, id, status] as const

/** What the import changed, or what its Undo changed back, with the first titles of each section. */
export function useImportResult(
	api: ImportResultApi,
	id: string,
	status: string,
) {
	return useQuery({
		queryKey: resultKey(api, id, status),
		queryFn: () => request<ImportResultData>(itemsUrl(api, id)),
	})
}

const sectionPage = (
	api: ImportResultApi,
	id: string,
	section: ImportResultSection,
	offset: number,
) =>
	request<ImportResultPage>(
		`${itemsUrl(api, id)}&section=${section.key}&offset=${offset}&limit=${PAGE}`,
	)

/**
 * Every row of one section, for what the Done step counts and puts back: the rows the result brought, then the rest a
 * page at a time until none are left. Null while pages are still loading.
 */
export function useWholeSection(
	api: ImportResultApi,
	id: string,
	status: string,
	section: ImportResultSection | undefined,
): ImportResultRow[] | null {
	const more = !!section && section.total > section.rows.length
	const query = useInfiniteQuery({
		queryKey: [...resultKey(api, id, status), section?.key, "all"],
		enabled: more,
		initialPageParam: section?.rows.length ?? 0,
		queryFn: ({ pageParam }) =>
			section
				? sectionPage(api, id, section, pageParam)
				: Promise.resolve({ rows: [], total: 0 }),
		getNextPageParam: (last, pages) => {
			const loaded =
				(section?.rows.length ?? 0) +
				pages.reduce((n, page) => n + page.rows.length, 0)
			return last.rows.length > 0 && loaded < last.total ? loaded : undefined
		},
	})
	const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
	useEffect(() => {
		if (more && hasNextPage && !isFetchingNextPage) void fetchNextPage()
	}, [more, hasNextPage, isFetchingNextPage, fetchNextPage])
	if (!section) return []
	if (!more) return section.rows
	if (!query.data || query.hasNextPage || query.isError) return null
	return [...section.rows, ...query.data.pages.flatMap((page) => page.rows)]
}

/** The rest of a section that shows only its first rows, loaded when the member asks. */
export function MoreRows({
	api,
	id,
	status,
	section,
}: {
	api: ImportResultApi
	id: string
	status: string
	section: ImportResultSection
}) {
	const [open, setOpen] = useState(false)
	const query = useInfiniteQuery({
		queryKey: [...resultKey(api, id, status), section.key],
		enabled: open,
		initialPageParam: section.rows.length,
		queryFn: ({ pageParam }) => sectionPage(api, id, section, pageParam),
		getNextPageParam: (last, pages) => {
			const loaded =
				section.rows.length + pages.reduce((n, page) => n + page.rows.length, 0)
			return last.rows.length > 0 && loaded < last.total ? loaded : undefined
		},
	})
	const rows = query.data?.pages.flatMap((page) => page.rows) ?? []
	const left = section.total - section.rows.length - rows.length
	return (
		<>
			{rows.length > 0 && (
				<ul
					aria-label={`More of ${section.key.replace(/_/g, " ")}`}
					className={`${resultList} mt-2 border-slate-700`}
				>
					<ResultRows rows={rows} />
				</ul>
			)}
			{query.isError && (
				<p className={`${errorBox} mt-2`}>{query.error.message}</p>
			)}
			{left > 0 && (
				<button
					type="button"
					className={`${textLink} mt-2 inline-flex min-h-11 items-center gap-2`}
					disabled={query.isFetching}
					onClick={() => (open ? query.fetchNextPage() : setOpen(true))}
				>
					{query.isFetching && <Spinner size="small" />}
					{open
						? `Show ${plural(Math.min(left, PAGE), "more title", "more titles")}`
						: `Show all ${section.total.toLocaleString()}`}
				</button>
			)}
		</>
	)
}

/**
 * Puts a title back on Want to See or Not interested, now, without the date it had before the import. A title the
 * member's data already has on that list, put back from here before or elsewhere, needs no button.
 */
export function PutBackButton({ title, list }: PutBack) {
	const wishlist = useWishlistMutation()
	const notInterested = useNotInterestedMutation()
	const { data } = useUserData()
	const mutation = list === "want_to_see" ? wishlist : notInterested
	const key = createMediaKey(title.mediaType, title.tmdbId)
	const onList = Boolean(
		(list === "want_to_see" ? data?.wishlist : data?.notInterested)?.[key],
	)
	const done =
		(mutation.isSuccess && mutation.data?.status === "success") ||
		(mutation.isIdle && onList)
	const failed =
		mutation.isError ||
		(mutation.isSuccess && mutation.data?.status !== "success")
	if (done && mutation.isIdle)
		return (
			<p className="text-sm font-semibold text-emerald-200">
				Back on {LIST_LABEL[list]}
			</p>
		)
	return (
		<div className="flex flex-col items-start gap-1">
			<button
				type="button"
				disabled={mutation.isPending || done}
				onClick={() =>
					mutation.mutate({
						mediaType: title.mediaType,
						tmdbId: title.tmdbId,
						action: "add",
					})
				}
				className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-1 text-sm font-semibold disabled:cursor-default ${done ? "border-emerald-700 bg-emerald-950 text-emerald-200" : "border-slate-600 bg-slate-800 text-gray-200 hover:bg-slate-700"}`}
			>
				{mutation.isPending && <Spinner size="small" />}
				{done
					? `Back on ${LIST_LABEL[list]}`
					: list === "want_to_see"
						? "Add back to Want to See"
						: "Mark Not interested again"}
			</button>
			{failed && (
				<p className="text-sm text-red-200" role="alert">
					That didn't work. Try again.
				</p>
			)}
		</div>
	)
}

/**
 * Puts every title this import took off Want to See or Not interested back on that list, one after another. Titles
 * the member's data already has on the list are skipped. Returns how many didn't go back.
 */
export function usePutAllBack() {
	const wishlist = useWishlistMutation()
	const notInterested = useNotInterestedMutation()
	const { data } = useUserData()
	const [state, setState] = useState<
		{ at: "idle" } | { at: "running" } | { at: "done"; failed: number }
	>({ at: "idle" })
	const run = async (rows: readonly ImportResultRow[]) => {
		setState({ at: "running" })
		let failed = 0
		for (const row of rows) {
			if (!row.title) continue
			for (const change of row.changes) {
				if (change.type !== "list-cleared") continue
				const key = createMediaKey(row.title.mediaType, row.title.tmdbId)
				const lists =
					change.list === "want_to_see" ? data?.wishlist : data?.notInterested
				if (lists?.[key]) continue
				const mutation =
					change.list === "want_to_see" ? wishlist : notInterested
				try {
					const result = await mutation.mutateAsync({
						mediaType: row.title.mediaType,
						tmdbId: row.title.tmdbId,
						action: "add",
					})
					if (result?.status !== "success") failed++
				} catch {
					failed++
				}
			}
		}
		setState({ at: "done", failed })
		return failed
	}
	return { state, run }
}
