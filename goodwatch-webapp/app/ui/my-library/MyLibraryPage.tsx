import { getScoreLabelText, selectedScoreStyle } from "~/utils/ratings"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
// A list of My library (#385): every title a member has marked under one status, on that status's page under the
// hub (/my-library/want, /seen, /not-rated, /watching, /on-hold, /dropped). The hub leads to the pages, so a page has
// no status choice of its own, only the way back; the three show statuses share a small switch.
//
// Under the head: a movies/shows filter, a search over the list, and a sort. A list is drawn in steps of 60, also
// with 1,500 Seen titles. The choice lives in the URL (`/my-library/seen?sort=score&type=movie&q=alien`), and each
// step is one read of /api/my-library.
import {
	ChevronDownIcon,
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
	LIBRARY_HUB,
	SHOW_STATUSES,
	SORT_LABEL,
	STATUS_LABEL,
	addedWords,
	libraryChoiceOf,
	libraryParams,
	sortsFor,
	statusPage,
	watchedWords,
} from "~/domain/my-library"
import { useScoreMutation } from "~/hooks/useUserDataMutations"
import type { LibraryItem, LibraryPage } from "~/server/my-library.server"
import type { Score } from "~/server/scores.server"
import { NewOnWords } from "~/ui/my-pages/LandedRow"
import {
	Empty,
	PageHead,
	Poster,
	WRAP,
} from "~/ui/my-pages/bits"
import { titleToDashed } from "~/utils/helpers"
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
	const response = await fetch(mediaLanguageUrl(`/api/my-library?${params}`, language))
	if (!response.ok) throw new Error(`My library answered ${response.status}`)
	return (await response.json()) as LibraryPage
}

export const libraryQueryKey = ["my-library"] as const

const count = (n: number) => n.toLocaleString("en-US")
const titleHref = (item: LibraryItem) =>
	`/${item.mediaType}/${item.tmdbId}-${titleToDashed(canonicalMediaTitle(item))}`

// ---------------------------------------------------------------------------------------------------------
// The show statuses' switch: Watching, On hold and Dropped are three pages of one kind

function ShowStatusSwitch({
	status,
	counts,
}: {
	status: LibraryStatus
	counts: LibraryPage["counts"]
}) {
	return (
		<nav
			aria-label="Shows you started"
			className="flex w-full gap-1 self-start rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 sm:w-auto"
			data-show-statuses
		>
			{SHOW_STATUSES.map((key) => {
				const on = status === key
				return (
					<Link
						key={key}
						to={statusPage({ status: key })}
						prefetch="intent"
						replace
						preventScrollReset
						aria-current={on ? "page" : undefined}
						data-status={key}
						className={`flex h-11 min-w-0 flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:flex-none sm:px-5 ${on ? "bg-amber-400 text-black" : "text-gray-300 hover:bg-white/10"}`}
					>
						<span className="truncate">{STATUS_LABEL[key]}</span>
						<span
							className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${on ? "bg-black/15" : "bg-white/10"}`}
							data-count
						>
							{count(counts[key])}
						</span>
					</Link>
				)
			})}
		</nav>
	)
}

/** Each page's head: its name and what it holds. */
const PAGE_LINE: Record<LibraryStatus, string> = {
	want: "Titles you saved for later.",
	seen: "Movies you watched and shows you finished.",
	unrated: "Titles you have seen and not given a score.",
	watching: "Shows you are in the middle of.",
	on_hold: "Shows you set aside for now.",
	dropped: "Shows you gave up on. They stay out of your recommendations.",
}

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
		<label className="relative flex h-11 shrink-0 items-center rounded-xl bg-white/[0.06] pl-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 focus-within:ring-amber-300">
			<span className="sr-only">Sort</span>
			<select
				value={sort}
				onChange={(event) => onPick(event.target.value as LibrarySort)}
				data-sort
				className="h-full cursor-pointer appearance-none bg-transparent pr-8 font-bold text-gray-100 outline-none"
			>
				{sorts.map((key) => (
					<option key={key} value={key} className="bg-gray-900">
						{SORT_LABEL[key]}
					</option>
				))}
			</select>
			<ChevronDownIcon
				className="pointer-events-none absolute right-2 h-4 w-4 text-gray-400"
				aria-hidden
			/>
		</label>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Rows

/** The member's score, or a quiet key to give one. Either opens the rating bar. */
function ScoreKey({
	item,
	score,
	onAsk,
}: {
	item: LibraryItem
	score: number | null
	onAsk: (item: LibraryItem) => void
}) {
	return score !== null ? (
		<button
			type="button"
			data-score={item.key}
			onClick={() => onAsk(item)}
			onPointerEnter={() => void loadRateBar().catch(() => {})}
			aria-label={`Your score for ${item.title}: ${getScoreLabelText(score as Score)}. Change it`}
			style={selectedScoreStyle(score as Score)}
			className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-bold tabular-nums text-white hover:brightness-110"
		>
			{getScoreLabelText(score as Score)}
		</button>
	) : (
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
	now,
	onAsk,
}: {
	item: LibraryItem
	status: LibraryStatus
	score: number | null
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
	// The service a Want to See title is new on (#489). The poster here is too small for the logo, so the words
	// carry it, with the logo beside them.
	const fresh = item.newOn && <NewOnWords service={item.newOn} />
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
					<span className="block truncate text-xs text-gray-500">
						{inProgress && episodes ? `${kind} · ${episodes}` : kind}
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
					<ChevronRightIcon
						className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
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
	initial,
	now,
	viewer,
}: {
	/** The page's status: its list is the only one it shows. */
	status: LibraryStatus
	/** The first step, computed by the loader for the choice in the URL. */
	initial: LibraryPage
	/** The server's time when it answered, so a row says "Yesterday" the same on both sides. */
	now: number
	/** The member's id, for the cache of their lists. */
	viewer: string
}) {
	const [params, setParams] = useSearchParams()
	const choice = useMemo(
		() => ({ ...libraryChoiceOf(params), status: pageStatus }),
		[params, pageStatus],
	)
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
		queryFn: ({ pageParam }) => fetchLibrary(choice, pageParam, locale.language),
		initialPageParam: 0,
		getNextPageParam: (last) => last.next ?? undefined,
		initialData:
			query === initialQuery && (!initial.items[0]?.presentation || initial.items[0].presentation.language === locale.language)
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
					// Parameters that are not the library's stay; the status is the page's, not the URL's.
					const kept = new URLSearchParams(current)
					for (const key of ["status", "sort", "type", "q"]) kept.delete(key)
					for (const [key, value] of libraryParams(merged))
						if (key !== "status") kept.set(key, value)
					return kept
				},
				{ replace: true, preventScrollReset: true },
			),
		[setParams, pageStatus],
	)
	const setQuery = useCallback((q: string) => setChoice({ q }), [setChoice])

	// A score given here shows on its row at once; the lists and the counts are read again after it is stored.
	const [asked, setAsked] = useState<LibraryItem | null>(null)
	const [given, setGiven] = useState<Record<string, number | null>>({})
	const scoreOf = (item: LibraryItem) =>
		item.key in given ? given[item.key] : item.score
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
						setGiven((current) => { if (current[item.key] !== score) return current; const next = { ...current }; delete next[item.key]; return next })
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
	return (
		<div
			className="overflow-x-clip pb-24"
			data-my-library
			data-status={status}
			aria-busy={result.isFetching}
		>
			<PageHead
				name={STATUS_LABEL[status]}
				line={PAGE_LINE[status]}
				back={{ label: "My library", to: LIBRARY_HUB }}
			/>
			<div className={`${WRAP} flex flex-col gap-3`}>
				{showsOnly && <ShowStatusSwitch status={status} counts={first.counts} />}
				<div className="flex flex-wrap items-center gap-2" data-controls>
					{!showsOnly && (
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
								: `Search ${STATUS_LABEL[status].toLowerCase()}`
						}
						onChange={setQuery}
					/>
					<span className="hidden grow sm:block" />
					<SortSelect
						sort={first.sort}
						sorts={sortsFor(status)}
						onPick={(sort) => setChoice({ sort })}
					/>
				</div>
				<p className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
					<span data-result aria-live="polite">
						{count(first.total)} {first.total === 1 ? "title" : "titles"}
						{first.q.trim() ? ` for "${first.q.trim()}"` : ""}
					</span>
					{status === "seen" && first.counts.unrated > 0 && !first.q.trim() && (
						<Link
							to={statusPage({ status: "unrated" })}
							prefetch="intent"
							data-to-unrated
							className="inline-flex min-h-8 items-center text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-white"
						>
							{count(first.counts.unrated)} not rated
						</Link>
					)}
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
								now={now}
								onAsk={setAsked}
							/>
						))}
					</ul>
				) : first.q.trim() || choice.kind !== "all" ? (
					<p className="py-6 text-sm text-gray-400" data-no-match>
						Nothing under {STATUS_LABEL[status]} matches.
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
