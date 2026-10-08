// My library (#385): every title a member has marked, one status at a time.
//
// The status choice is what the owner asked for after round 3 of the prototypes ("use the library but everything
// except the main 2 in a drop-down"): Want to see and Seen are a two-way switch that is always shown, each with its
// count; Watching, On hold, Dropped and Not rated are in the drop-down beside it, with theirs. While one of those
// four is chosen, the drop-down's button carries its name and count and neither half of the switch is lit.
//
// Under it: a movies/shows filter, a search over the list, and a sort. A list is drawn in steps of 60, also with
// 1,500 Seen titles. The choice lives in the URL (`?status=seen&sort=score&type=movie&q=alien`), and each step is
// one read of /api/my-library.
import {
	CheckIcon,
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
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	type LibraryChoice,
	type LibraryKind,
	type LibrarySort,
	type LibraryStatus,
	MAIN_STATUSES,
	MORE_STATUSES,
	SORT_LABEL,
	STATUS_LABEL,
	addedWords,
	libraryChoiceOf,
	libraryParams,
	sortsFor,
	watchedWords,
} from "~/domain/my-library"
import { useScoreMutation } from "~/hooks/useUserDataMutations"
import type { LibraryItem, LibraryPage } from "~/server/my-library.server"
import type { Score } from "~/server/scores.server"
import {
	Empty,
	MY_MOVIES,
	MY_SHOWS,
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
): Promise<LibraryPage> {
	const params = libraryParams(choice)
	if (offset) params.set("offset", String(offset))
	const response = await fetch(`/api/my-library?${params}`)
	if (!response.ok) throw new Error(`My library answered ${response.status}`)
	return (await response.json()) as LibraryPage
}

export const libraryQueryKey = ["my-library"] as const

const count = (n: number) => n.toLocaleString("en-US")
const titleHref = (item: LibraryItem) =>
	`/${item.mediaType}/${item.tmdbId}-${titleToDashed(item.title)}`

const MORE_HINT: Partial<Record<LibraryStatus, string>> = {
	unrated: "Seen, without a score",
}

// ---------------------------------------------------------------------------------------------------------
// The status choice: two shown, four in a drop-down

function StatusChoice({
	status,
	counts,
	onPick,
}: {
	status: LibraryStatus
	counts: LibraryPage["counts"]
	onPick: (status: LibraryStatus) => void
}) {
	const [open, setOpen] = useState(false)
	const wrap = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const menu = useRef<HTMLDivElement>(null)
	const menuId = useId()
	const inMore = (MORE_STATUSES as readonly LibraryStatus[]).includes(status)

	const close = useCallback((refocus: boolean) => {
		setOpen(false)
		if (refocus) button.current?.focus()
	}, [])
	// Open: focus the chosen entry, or the first. A press outside or Escape closes.
	useEffect(() => {
		if (!open) return
		const items = menu.current?.querySelectorAll<HTMLButtonElement>("button")
		const checked = menu.current?.querySelector<HTMLButtonElement>(
			"[aria-checked=true]",
		)
		;(checked ?? items?.[0])?.focus()
		const onDown = (event: PointerEvent) => {
			if (!wrap.current?.contains(event.target as Node)) close(false)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close(true)
		}
		document.addEventListener("pointerdown", onDown)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", onDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [open, close])
	const onMenuKey = (event: React.KeyboardEvent) => {
		const items = [
			...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
		]
		const at = items.indexOf(document.activeElement as HTMLButtonElement)
		const to =
			event.key === "ArrowDown"
				? (at + 1) % items.length
				: event.key === "ArrowUp"
					? (at - 1 + items.length) % items.length
					: event.key === "Home"
						? 0
						: event.key === "End"
							? items.length - 1
							: -1
		if (to < 0) return
		event.preventDefault()
		items[to]?.focus()
	}

	return (
		<div className="flex items-center gap-2" data-status-choice>
			<div
				role="tablist"
				aria-label="Want to see or Seen"
				className="flex min-w-0 flex-1 gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 sm:flex-none"
			>
				{MAIN_STATUSES.map((key) => {
					const on = status === key
					return (
						<button
							key={key}
							type="button"
							role="tab"
							aria-selected={on}
							data-status={key}
							onClick={() => onPick(key)}
							className={`flex h-11 min-w-0 flex-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:flex-none sm:px-5 sm:text-base ${on ? "bg-amber-400 text-black" : "text-gray-300 hover:bg-white/10"}`}
						>
							<span className="truncate">{STATUS_LABEL[key]}</span>
							<span
								className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${on ? "bg-black/15" : "bg-white/10"}`}
								data-count
							>
								{count(counts[key])}
							</span>
						</button>
					)
				})}
			</div>
			<div ref={wrap} className="relative shrink-0">
				<button
					ref={button}
					type="button"
					aria-haspopup="menu"
					aria-expanded={open}
					aria-controls={open ? menuId : undefined}
					data-status-more
					onClick={() => setOpen(!open)}
					className={`flex h-[52px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-bold outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:px-4 sm:text-base ${inMore ? "bg-amber-400 text-black ring-amber-400" : "bg-white/[0.06] text-gray-200 ring-white/10 hover:bg-white/10"}`}
				>
					{inMore ? (
						<>
							{STATUS_LABEL[status]}
							<span
								className="hidden rounded-full bg-black/15 px-1.5 py-0.5 text-xs tabular-nums sm:inline"
								data-count
							>
								{count(counts[status])}
							</span>
						</>
					) : (
						"More"
					)}
					<ChevronDownIcon
						className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
				{open && (
					<div
						ref={menu}
						id={menuId}
						role="menu"
						aria-label="More statuses"
						data-status-menu
						onKeyDown={onMenuKey}
						className="absolute right-0 top-full z-30 mt-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col rounded-2xl bg-gray-900 p-1.5 shadow-2xl shadow-black/60 ring-1 ring-white/15 sm:left-0 sm:right-auto"
					>
						{MORE_STATUSES.map((key) => {
							const on = status === key
							return (
								<button
									key={key}
									type="button"
									role="menuitemradio"
									aria-checked={on}
									data-status={key}
									onClick={() => {
										onPick(key)
										close(true)
									}}
									className={`flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
										// Not rated is a view of Seen, not a status of its own: a rule sets it apart.
										key === "unrated"
											? "relative mt-3 before:absolute before:inset-x-2 before:-top-1.5 before:h-px before:bg-white/10"
											: ""
									} ${on ? "bg-white/10 text-white" : "text-gray-200 hover:bg-white/[0.07]"}`}
								>
									<CheckIcon
										className={`h-4 w-4 shrink-0 text-amber-400 ${on ? "" : "invisible"}`}
										aria-hidden
									/>
									<span className="min-w-0 flex-1">
										<span className="block">{STATUS_LABEL[key]}</span>
										{MORE_HINT[key] && (
											<span className="block text-xs font-medium text-gray-400">
												{MORE_HINT[key]}
											</span>
										)}
									</span>
									<span
										className="text-xs tabular-nums text-gray-400"
										data-count
									>
										{count(counts[key])}
									</span>
								</button>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
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
			aria-label={`Your score for ${item.title}: ${score}. Change it`}
			className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-base font-black tabular-nums text-amber-300 ring-1 ring-amber-400/40 hover:bg-amber-400 hover:text-black"
		>
			{score}
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
			? item.addedAt
				? addedWords(item.addedAt, now)
				: ""
			: // A show in progress says that the day is its last watch's.
				inProgress && item.watchedAt
				? `Last watched ${/^(Today|Yesterday)$/.test(watchedOn) ? watchedOn.toLowerCase() : watchedOn}`
				: watchedOn
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
						{item.title}
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
						{fact}
					</span>
				</span>
				<span className="hidden w-56 shrink-0 truncate text-xs text-gray-300 sm:block">
					{fact}
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
	initial,
	now,
	viewer,
}: {
	/** The first step, computed by the loader for the choice in the URL. */
	initial: LibraryPage
	/** The server's time when it answered, so a row says "Yesterday" the same on both sides. */
	now: number
	/** The member's id, for the cache of their lists. */
	viewer: string
}) {
	const [params, setParams] = useSearchParams()
	const choice = useMemo(() => libraryChoiceOf(params), [params])
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
		queryKey: [...libraryQueryKey, viewer, query],
		queryFn: ({ pageParam }) => fetchLibrary(choice, pageParam),
		initialPageParam: 0,
		getNextPageParam: (last) => last.next ?? undefined,
		initialData:
			query === initialQuery
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
					const merged = { ...libraryChoiceOf(current), ...next }
					// Another status has its own sorts, and the three show statuses hold no movie.
					if (next.status) {
						merged.sort = null
						if (!["want", "seen", "unrated"].includes(next.status))
							merged.kind = "all"
					}
					// Parameters that are not the library's stay.
					const kept = new URLSearchParams(current)
					for (const key of ["status", "sort", "type", "q"]) kept.delete(key)
					for (const [key, value] of libraryParams(merged)) kept.set(key, value)
					return kept
				},
				{ replace: true, preventScrollReset: true },
			),
		[setParams],
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
					onSettled: () =>
						client.invalidateQueries({ queryKey: libraryQueryKey }),
				},
			)
		},
		[client, rate],
	)
	const closeBar = useCallback(() => setAsked(null), [])

	const { status } = first
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
				name="My library"
				line="Every title you have marked, by where you stand with it. Picking one for tonight happens in My shows and My movies."
				links={[
					{ label: "My shows", to: MY_SHOWS },
					{ label: "My movies", to: MY_MOVIES },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-3`}>
				<StatusChoice
					status={choice.status}
					counts={first.counts}
					onPick={(next) => setChoice({ status: next })}
				/>
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
						<button
							type="button"
							data-to-unrated
							onClick={() => setChoice({ status: "unrated" })}
							className="min-h-8 cursor-pointer text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-white"
						>
							{count(first.counts.unrated)} not rated
						</button>
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
