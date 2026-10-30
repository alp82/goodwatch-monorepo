// A library list (#385): every title a member has marked under one status, on a page of its own (Watch's chips and
// Seen pages, Taste's Not rated). The page's tabs and chips choose the list, so the body has no head and no status
// choice of its own. A page can fix the kind (Seen shows, Start, Want to Watch) and the sort.
//
// The controls: a movies/shows filter (unless the page fixes the kind), a search over the list, and a sort. A list is
// drawn in steps of 60, also with 1,500 Seen titles. The choice lives in the URL (`/watch/seen?sort=score&q=alien`),
// and each step is one read of /api/my-library.
import {
	ChevronRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { Link, useSearchParams } from "@remix-run/react"
import {
	keepPreviousData,
	useInfiniteQuery,
	useQueryClient,
} from "@tanstack/react-query"
import {
	type ReactNode,
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	type LibraryChoice,
	type LibraryKind,
	type LibrarySort,
	type LibraryStatus,
	SORT_HINT,
	SORT_LABEL,
	STATUS_LABEL,
	addedWords,
	libraryChoiceOf,
	libraryParams,
	sortsFor,
	watchedWords,
} from "~/domain/my-library"
import { newOn } from "~/domain/newly-available-words"
import { useScoreMutation } from "~/hooks/useUserDataMutations"
import type { LibraryListLoaded } from "~/server/library-list-route.server"
import type { LibraryItem, LibraryPage } from "~/server/my-library.server"
import type { Score } from "~/server/scores.server"
import { SortControl } from "~/ui/filter-bar/controls"
import {
	RowLogos,
	RowScores,
	rowMark,
	useRowMarks,
} from "~/ui/list-row/RowScores"
import { Empty, Poster, WRAP } from "~/ui/my-pages/bits"
import type { PillMark } from "~/ui/poster-card/pill-mark"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import type { SignUpMessage } from "~/ui/sign-up-prompt/messages"
import { titleToDashed } from "~/utils/helpers"
import useLocale from "~/utils/locale"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { getScoreLabelText } from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadRateBar = reloadOnStaleChunk(() => import("./RateBar"))
const RateBar = lazy(loadRateBar)

/** One step of a list from /api/my-library. */
async function fetchLibrary(
	choice: LibraryChoice,
	offset: number,
	language = "en",
): Promise<LibraryPage> {
	const params = libraryParams(choice)
	if (offset) params.set("offset", String(offset))
	const response = await fetch(
		mediaLanguageUrl(`/api/my-library?${params}`, language),
	)
	if (!response.ok) throw new Error(`My library answered ${response.status}`)
	return (await response.json()) as LibraryPage
}

export const libraryQueryKey = ["my-library"] as const

const count = (n: number) => n.toLocaleString("en-US")
const titleHref = (item: LibraryItem) =>
	`/${item.mediaType}/${item.tmdbId}-${titleToDashed(canonicalMediaTitle(item))}`

// ---------------------------------------------------------------------------------------------------------
// The list's controls

function KindFilter({
	kind,
	kinds,
	onPick,
}: {
	kind: LibraryKind
	kinds: LibraryPage["kinds"]
	onPick: (kind: LibraryKind) => void
}) {
	const options: [LibraryKind, string][] = [
		["all", "All"],
		["movie", "Movies"],
		["show", "Shows"],
	]
	return (
		<div
			role="tablist"
			aria-label="Movies or shows"
			className="inline-flex max-w-full gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
			data-kind-filter
		>
			{options.map(([key, label]) => (
				<button
					key={key}
					type="button"
					role="tab"
					aria-selected={kind === key}
					data-kind={key}
					onClick={() => onPick(key)}
					className={`flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${kind === key ? "bg-white text-black" : "text-gray-300 hover:bg-white/10"}`}
				>
					{label}
					<span
						className={`text-xs tabular-nums ${kind === key ? "text-black/60" : "text-gray-400"}`}
					>
						{count(kinds[key])}
					</span>
				</button>
			))}
		</div>
	)
}

function SearchField({
	q,
	placeholder,
	onChange,
}: { q: string; placeholder: string; onChange: (q: string) => void }) {
	const [text, setText] = useState(q)
	// The URL follows a moment after the typing, so each key doesn't ask the server.
	useEffect(() => {
		if (text.trim() === q.trim()) return
		const timer = setTimeout(() => onChange(text), 250)
		return () => clearTimeout(timer)
	}, [text, q, onChange])
	// A change from elsewhere (Back, a link) reaches the field.
	const seen = useRef(q)
	useEffect(() => {
		if (seen.current === q) return
		seen.current = q
		setText((current) => (current.trim() === q.trim() ? current : q))
	}, [q])
	return (
		<label className="relative flex h-11 min-w-0 flex-1 basis-44 items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10 focus-within:ring-amber-300 sm:max-w-xs">
			<MagnifyingGlassIcon
				className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray-400"
				aria-hidden
			/>
			<span className="sr-only">{placeholder}</span>
			<input
				value={text}
				onChange={(event) => setText(event.target.value)}
				placeholder={placeholder}
				enterKeyHint="search"
				data-search
				className="h-full w-full min-w-0 bg-transparent pl-8 pr-9 text-base text-white placeholder:text-gray-500 focus:outline-none sm:text-sm"
			/>
			{text && (
				<button
					type="button"
					aria-label="Clear the search"
					onClick={() => {
						setText("")
						onChange("")
					}}
					className="absolute right-0 flex h-11 w-9 cursor-pointer items-center justify-center text-gray-400 hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" aria-hidden />
				</button>
			)}
		</label>
	)
}

function SortSelect({
	sort,
	sorts,
	onPick,
}: {
	sort: LibrarySort
	sorts: LibrarySort[]
	onPick: (sort: LibrarySort) => void
}) {
	return (
		<SortControl
			align="right"
			portal
			menuClassName="w-64"
			options={sorts.map((key) => ({
				key,
				label: SORT_LABEL[key],
				hint: SORT_HINT[key],
			}))}
			value={sort}
			onChange={onPick}
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Rows

/**
 * A Seen row's end: the score pill, which opens the rating bar to change the member's score, or the pill (GoodWatch's
 * score alone) and a quiet key to give one.
 */
function ScoreKey({
	item,
	score,
	onAsk,
}: {
	item: LibraryItem
	score: number | null
	onAsk: (item: LibraryItem) => void
}) {
	const pill = (
		<RowScores
			goodwatch={item.goodwatch}
			score={score as Score | null}
			mark={null}
		/>
	)
	return score !== null ? (
		<button
			type="button"
			data-score={item.key}
			onClick={() => onAsk(item)}
			onPointerEnter={() => void loadRateBar().catch(() => {})}
			aria-label={`Your score for ${item.title}: ${getScoreLabelText(score as Score)}. Change it`}
			className="flex min-h-11 shrink-0 cursor-pointer items-center rounded-lg hover:brightness-125"
		>
			{pill}
		</button>
	) : (
		<span className="flex shrink-0 items-center gap-1.5">
			{pill}
			<button
				type="button"
				data-rate={item.key}
				onClick={() => onAsk(item)}
				onPointerEnter={() => void loadRateBar().catch(() => {})}
				aria-label={`Rate ${item.title}`}
				className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/25 text-xs font-semibold text-gray-300 hover:border-amber-300 hover:text-amber-200"
			>
				Rate
			</button>
		</span>
	)
}

const Progress = ({ item }: { item: LibraryItem }) =>
	item.airedEpisodes ? (
		<span
			className="block h-1.5 overflow-hidden rounded-full bg-white/10"
			aria-hidden
		>
			<span
				className="block h-full rounded-full bg-sky-400"
				style={{
					width: `${Math.round(((item.episodesWatched ?? 0) / item.airedEpisodes) * 100)}%`,
				}}
			/>
		</span>
	) : null

function Row({
	item,
	status,
	score,
	mark,
	now,
	onAsk,
}: {
	item: LibraryItem
	status: LibraryStatus
	score: number | null
	/** The pill's state icon. */
	mark: PillMark | null
	now: number
	onAsk: (item: LibraryItem) => void
}) {
	const show = item.mediaType === "show"
	const inProgress =
		status === "watching" || status === "on_hold" || status === "dropped"
	const seen = status === "seen" || status === "unrated"
	const kind = [show ? "Show" : "Movie", item.release_year]
		.filter(Boolean)
		.join(" · ")
	const episodes =
		item.episodesWatched === null
			? null
			: item.airedEpisodes === null
				? `${item.episodesWatched} episodes watched`
				: `${item.episodesWatched} of ${item.airedEpisodes} episodes`
	// The fact the list's order goes by.
	const watchedOn = item.state
		? // A show's log rows are its episodes: only a movie says how often it was watched.
			watchedWords(
				{ watchedAt: item.watchedAt, count: show ? 1 : item.watches },
				now,
			)
		: watchedWords(null, now)
	const fact =
		status === "want"
			? // A Seen title on the Wishlist is Want to rewatch: the list says so before when it was added.
				[
					item.state === "seen" ? "Rewatch" : "",
					item.addedAt ? addedWords(item.addedAt, now) : "",
				]
					.filter(Boolean)
					.join(" · ")
			: // A show in progress says that the day is its last watch's.
				inProgress && item.watchedAt
				? `Last watched ${/^(Today|Yesterday)$/.test(watchedOn) ? watchedOn.toLowerCase() : watchedOn}`
				: watchedOn
	// The service a Want to See title is new on (#489): its logo leads the member's services in the row's words,
	// ringed in sky blue, and the fact says it.
	const fresh = item.newOn && (
		<span className="font-semibold text-sky-200">{newOn(item.newOn.name)}</span>
	)
	const logos =
		item.newOn &&
		!item.services?.some((service) => service.id === item.newOn?.id)
			? [
					{
						id: item.newOn.id,
						name: item.newOn.name,
						logoPath: item.newOn.logo_path,
					},
					...(item.services ?? []),
				]
			: item.services
	return (
		<li
			className="flex items-center gap-2 border-b border-white/5"
			data-item={item.key}
		>
			<Link
				to={titleHref(item)}
				prefetch="intent"
				className="group flex min-w-0 flex-1 items-center gap-3 py-2 hover:bg-white/[0.03]"
			>
				<Poster
					path={item.poster_path}
					className="h-[60px] w-10 shrink-0 rounded"
				/>
				<span className="min-w-0 flex-1">
					<b className="block truncate text-sm text-white group-hover:text-amber-200 md:text-base">
						<span lang={mediaFieldLanguage(item)}>{item.title}</span>
					</b>
					<span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
						<RowLogos services={logos} newOn={item.newOn?.id} max={1} />
						<span className="truncate">
							{inProgress && episodes ? `${kind} · ${episodes}` : kind}
						</span>
					</span>
					{inProgress && (
						<span className="mt-1 block max-w-40">
							<Progress item={item} />
						</span>
					)}
					<span
						className="block truncate text-xs text-gray-400 sm:hidden"
						data-fact
					>
						{fresh}
						{fresh && fact && " · "}
						{fact}
					</span>
				</span>
				<span className="hidden w-56 shrink-0 text-xs text-gray-300 sm:block">
					{fresh && <span className="block truncate">{fresh}</span>}
					<span className="block truncate">{fact}</span>
				</span>
				{!seen && (
					<RowScores
						goodwatch={item.goodwatch}
						score={score as Score | null}
						mark={mark}
					/>
				)}
				{!seen && (
					<ChevronRightIcon
						className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300 max-sm:hidden"
						aria-hidden
					/>
				)}
			</Link>
			{seen && <ScoreKey item={item} score={score} onAsk={onAsk} />}
		</li>
	)
}

const EMPTY: Record<LibraryStatus, [title: string, text: string]> = {
	want: ["Nothing here yet", "Want to See on a title puts it here."],
	seen: [
		"Nothing Seen yet",
		"A movie you mark as watched, a show you watch through, and every title you rate appears here.",
	],
	watching: [
		"No show is Watching",
		"The first episode you mark watched puts its show here.",
	],
	on_hold: ["No show is On hold", "A show you set aside waits here."],
	dropped: [
		"No show is Dropped",
		"A show you gave up on stays here and out of your recommendations.",
	],
	unrated: [
		"Everything Seen has a score",
		"A title you have Seen and not rated appears here.",
	],
}

// ---------------------------------------------------------------------------------------------------------

export function MyLibraryPage({
	status: pageStatus,
	lockKind = null,
	lockSort = null,
	name,
	initial,
	now,
	viewer,
	kindControl = true,
	filter = null,
}: {
	/** The page's status: its list is the only one it shows. */
	status: LibraryStatus
	/** False where the page's navigation picks the kind (the Seen tab's SubNav): `type` in the URL still counts. */
	kindControl?: boolean
	/** A control first in the row, before the search (All shows' status filter). */
	filter?: ReactNode
	/** The kind the page fixes (Seen shows, Start, Want to Watch): no kind control, and a `type` in the URL doesn't count. */
	lockKind?: "movie" | "show" | null
	/** The sort the page fixes: no sort control. */
	lockSort?: LibrarySort | null
	/** The list's name in the search field and the no-match line; the status's label by default. */
	name?: string
	/** The first step, computed by the loader for the choice in the URL. */
	initial: LibraryPage
	/** The server's time when it answered, so a row says "Yesterday" the same on both sides. */
	now: number
	/** The member's id, for the cache of their lists. */
	viewer: string
}) {
	const [params, setParams] = useSearchParams()
	const choice = useMemo(() => {
		const picked = libraryChoiceOf(params)
		return {
			...picked,
			status: pageStatus,
			kind: lockKind ?? picked.kind,
			sort: lockSort ?? picked.sort,
		}
	}, [params, pageStatus, lockKind, lockSort])
	const { locale } = useLocale()
	const query = libraryParams(choice).toString()
	const initialQuery = useRef(
		libraryParams({
			status: initial.status,
			sort: initial.sort,
			kind: initial.kind,
			q: initial.q,
		}).toString(),
	).current
	const client = useQueryClient()

	const result = useInfiniteQuery({
		queryKey: [...libraryQueryKey, viewer, query, locale.language],
		queryFn: ({ pageParam }) =>
			fetchLibrary(choice, pageParam, locale.language),
		initialPageParam: 0,
		getNextPageParam: (last) => last.next ?? undefined,
		initialData:
			query === initialQuery &&
			(!initial.items[0]?.presentation ||
				initial.items[0].presentation.language === locale.language)
				? { pages: [initial], pageParams: [0] }
				: undefined,
		placeholderData: keepPreviousData,
	})
	const pages = result.data?.pages ?? [initial]
	const first = pages[0]
	const last = pages[pages.length - 1]
	const items = pages.flatMap((page) => page.items)

	const setChoice = useCallback(
		(next: Partial<LibraryChoice>) =>
			setParams(
				(current) => {
					const merged = {
						...libraryChoiceOf(current),
						...next,
						status: pageStatus,
					}
					// Parameters that are not the library's stay; what the page fixes is the page's, not the URL's.
					const kept = new URLSearchParams(current)
					for (const key of ["status", "sort", "type", "q"]) kept.delete(key)
					for (const [key, value] of libraryParams(merged))
						if (
							key !== "status" &&
							!(key === "type" && lockKind) &&
							!(key === "sort" && lockSort)
						)
							kept.set(key, value)
					return kept
				},
				{ replace: true, preventScrollReset: true },
			),
		[setParams, pageStatus, lockKind, lockSort],
	)
	const setQuery = useCallback((q: string) => setChoice({ q }), [setChoice])

	// A score given here shows on its row at once; the lists and the counts are read again after it is stored.
	const [asked, setAsked] = useState<LibraryItem | null>(null)
	const [given, setGiven] = useState<Record<string, number | null>>({})
	const scoreOf = (item: LibraryItem) =>
		item.key in given ? given[item.key] : item.score
	// The list's own status would be every row's icon: only a Want to See show says how far it got.
	const marksOf = useRowMarks()
	const markOf = (item: LibraryItem) =>
		pageStatus === "want"
			? rowMark(marksOf(item.mediaType, item.tmdbId), { want: true })
			: null
	// The app's score mutation, as from every other page.
	const { mutate: rate } = useScoreMutation()
	const onRated = useCallback(
		(item: LibraryItem, score: Score | null) => {
			setGiven((current) => ({ ...current, [item.key]: score }))
			rate(
				{ mediaType: item.mediaType, tmdbId: item.tmdbId, score },
				{
					onSettled: async () => {
						await client.invalidateQueries({ queryKey: libraryQueryKey })
						setGiven((current) => {
							if (current[item.key] !== score) return current
							const next = { ...current }
							delete next[item.key]
							return next
						})
					},
				},
			)
		},
		[client, rate],
	)
	const closeBar = useCallback(() => setAsked(null), [])

	const status = pageStatus
	const showsOnly =
		status === "watching" || status === "on_hold" || status === "dropped"
	const waiting =
		result.isPlaceholderData || (result.isFetching && !items.length)
	const [emptyTitle, emptyText] = EMPTY[status]
	const listName = name ?? STATUS_LABEL[status]
	return (
		<div
			className="overflow-x-clip pb-24"
			data-my-library
			data-status={status}
			aria-busy={result.isFetching}
		>
			<div className={`${WRAP} flex flex-col gap-3`}>
				<div className="flex flex-wrap items-center gap-2" data-controls>
					{filter}
					{kindControl && !showsOnly && !lockKind && (
						<KindFilter
							kind={choice.kind}
							kinds={first.kinds}
							onPick={(kind) => setChoice({ kind })}
						/>
					)}
					<SearchField
						q={choice.q}
						placeholder={
							status === "seen"
								? "Have I seen…?"
								: `Search ${listName.toLowerCase()}`
						}
						onChange={setQuery}
					/>
					<span className="hidden grow sm:block" />
					{!lockSort && (
						<SortSelect
							sort={first.sort}
							sorts={sortsFor(status)}
							onPick={(sort) => setChoice({ sort })}
						/>
					)}
				</div>
				<p className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
					<span data-result aria-live="polite">
						{count(first.total)} {first.total === 1 ? "title" : "titles"}
						{first.q.trim() ? ` for "${first.q.trim()}"` : ""}
					</span>
					{status === "unrated" && (
						<span>A score takes a title off this list.</span>
					)}
				</p>
				{result.isError && !result.data ? (
					<p role="alert" className="text-sm text-gray-300">
						My library couldn't load.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							onClick={() => result.refetch()}
						>
							Try again
						</button>
					</p>
				) : items.length ? (
					<ul
						data-rows={status}
						className={`transition-opacity ${waiting ? "opacity-60" : ""}`}
					>
						{items.map((item) => (
							<Row
								key={item.key}
								item={item}
								status={status}
								score={scoreOf(item)}
								mark={markOf(item)}
								now={now}
								onAsk={setAsked}
							/>
						))}
					</ul>
				) : first.q.trim() || (!lockKind && choice.kind !== "all") ? (
					<p className="py-6 text-sm text-gray-400" data-no-match>
						Nothing under {listName} matches.
					</p>
				) : (
					<Empty title={emptyTitle}>{emptyText}</Empty>
				)}
				{last.next !== null && (
					<button
						type="button"
						data-more
						disabled={result.isFetchingNextPage}
						onClick={() => result.fetchNextPage()}
						className="mt-2 h-11 cursor-pointer self-start rounded-lg bg-white/5 px-4 text-sm font-bold text-gray-300 hover:bg-white/10 disabled:opacity-60"
					>
						Show {count(Math.min(last.left, 60))} more{" "}
						<span className="font-medium text-gray-500">
							· {count(last.left)} left
						</span>
					</button>
				)}
			</div>
			{asked && (
				<Suspense fallback={null}>
					<RateBar
						item={asked}
						score={scoreOf(asked)}
						onRated={onRated}
						onClose={closeBar}
					/>
				</Suspense>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A list page's body, from libraryListLoader: the list for a member, a sign-up card for a guest.

export function LibraryListBody({
	loaded,
	name,
	guest,
	kindControl,
	filter,
}: {
	/** See MyLibraryPage. */
	kindControl?: boolean
	filter?: ReactNode
	loaded: LibraryListLoaded
	/** The list's name, as its chip or page says it. */
	name: string
	/** What a guest is told an account adds. */
	guest: SignUpMessage
}) {
	if (!loaded.page || !loaded.viewer)
		return (
			<div className={`${WRAP} pb-24`} data-guest-page>
				<SignUpPrompt
					feature="watchNext"
					words={guest}
					size="card"
					className="max-w-xl"
				/>
			</div>
		)
	return (
		<MyLibraryPage
			// A page of its own per list: going from Watching to On hold starts the list over.
			key={`${loaded.status}-${loaded.kind}-${loaded.sort}`}
			status={loaded.status}
			lockKind={loaded.kind}
			lockSort={loaded.sort}
			name={name}
			initial={loaded.page}
			now={loaded.now}
			viewer={loaded.viewer}
			kindControl={kindControl}
			filter={filter}
		/>
	)
}
