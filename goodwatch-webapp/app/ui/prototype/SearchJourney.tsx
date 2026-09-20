// THROWAWAY integration: shared by the real Header, search route, and real Details.
import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react"
import {
	Link,
	useLocation,
	useNavigate,
	useNavigationType,
} from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import {
	MagnifyingGlassIcon,
	ArrowPathIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import {
	blend,
	get,
	Highlight,
	type Title,
	type Description,
	type Row,
} from "./search-model"
import { canonicalTitleId } from "~/utils/title-identity"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { useGenres } from "~/routes/api.genres.all"
import SectionGenre from "~/ui/filter/sections/SectionGenre"
import SectionRelease from "~/ui/filter/sections/SectionRelease"
import FilterCountries from "~/ui/filter/FilterCountries"
import { Tag } from "~/ui/tags/Tag"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import Select from "~/ui/form/Select"
import Checkbox from "~/ui/form/Checkbox"
import placeholder from "~/img/placeholder-poster.png"

const path = "/prototype/search-journey"
const storage = "goodwatch_prototype_search_journey_v3"
const control =
	"rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus-visible:outline focus-visible:outline-cyan-300 disabled:opacity-40"
type Metadata = {
	tmdb_id: number
	media_type: string
	genres: string[] | null
	adult: boolean | null
	imdb_id: string | null
	goodwatch_overall_score_voting_count: number | null
}
type Batch = { q: string; rows: Row[]; errors: string[]; metadata: Metadata[] }
type Variant = "A" | "B" | "C"
const names = {
	A: "Inline filters",
	B: "Filter sidebar",
	C: "Compact results",
}
const refinements = [
	"type",
	"genre",
	"minYear",
	"maxYear",
	"availability",
	"country",
	"services",
	"paid",
]
function useController() {
	const location = useLocation(),
		navigate = useNavigate()
	const params = new URLSearchParams(location.search)
	const active =
		import.meta.env.DEV &&
		(location.pathname === path || params.get("searchJourney") === "1")
	const variant: Variant =
		params.get("variant") === "B"
			? "B"
			: params.get("variant") === "C"
				? "C"
				: "A"
	const q = params.get("q") ?? ""
	const [draft, setDraft] = useState(q)
	const [requested, setRequested] = useState(q)
	const editing = useRef<string | null>(null)
	const navigationType = useNavigationType()
	const [open, setOpen] = useState(false)
	const [focused, setFocused] = useState(-1)
	const [ready, setReady] = useState(false)
	const [batches, setBatches] = useState<Record<string, Batch>>({})
	const [previous, setPrevious] = useState<Batch | null>(null)
	const [revision, setRevision] = useState(0)
	const positions = useRef<Record<string, number>>({})
	const input = useRef<HTMLInputElement>(null)
	const url = location.pathname + location.search
	const setting = (key: string, fallback = "") => params.get(key) ?? fallback
	const country = setting("country", "DE")
	const makeParams = (changes: Record<string, string | null> = {}) => {
		const next = new URLSearchParams(location.search)
		next.set("searchJourney", "1")
		next.set("variant", variant)
		next.set("country", country)
		for (const [key, value] of Object.entries(changes))
			if (value === null || value === "") next.delete(key)
			else next.set(key, value)
		return next
	}
	const resultsHref = (changes: Record<string, string | null> = {}) =>
		`${path}?${makeParams(changes)}`
	const changeQuery = (value: string) => {
		editing.current = value
		setDraft(value)
		setFocused(-1)
		navigate(resultsHref({ q: value, page: null }), {
			replace: true,
			preventScrollReset: location.pathname === path,
		})
	}
	const commit = (value: string) => {
		changeQuery(value)
		setRequested(value)
	}

	useEffect(() => {
		try {
			const saved = JSON.parse(sessionStorage.getItem(storage) ?? "{}")
			setBatches(saved.batches ?? {})
			positions.current = saved.positions ?? {}
			setPrevious(saved.previous ?? null)
		} catch {}
		setReady(true)
	}, [])
	useEffect(() => {
		if (
			navigationType === "POP" ||
			editing.current === null ||
			editing.current === q
		) {
			setDraft(q)
			editing.current = null
		}
		setFocused(-1)
	}, [q, navigationType, location.search])
	useEffect(() => {
		if (!active || !ready) return
		const timer = setTimeout(() => setRequested(q), 1000)
		return () => clearTimeout(timer)
	}, [q, active, ready])

	const search = useQuery({
		queryKey: ["prototype-connected-search-paged", requested, revision],
		enabled:
			active &&
			ready &&
			requested === q &&
			requested.trim().length >= 2 &&
			!batches[requested],
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		queryFn: async ({ signal }): Promise<Batch> => {
			const [title, description] = await Promise.allSettled([
				get<{ results: Title[] }>(q, "titles", signal),
				get<Description>(q, "description", signal),
			])
			if (signal.aborted) throw new DOMException("Canceled", "AbortError")
			if (title.status === "rejected" && description.status === "rejected")
				throw new Error(
					"Search is unavailable. Your previous results are kept.",
				)
			const rows = blend(
				title.status === "fulfilled" ? title.value.results : [],
				description.status === "fulfilled" ? description.value : null,
				q,
				"balanced",
			)
			const errors = [
				...(title.status === "rejected" ? ["Title lookup unavailable"] : []),
				...(description.status === "rejected"
					? ["Description search unavailable"]
					: []),
			]
			let metadata: Metadata[] = []
			const keys = rows
				.filter((r) => r.type === "movie" || r.type === "show")
				.map((r) => r.key)
			if (keys.length) {
				try {
					const chunks = Array.from(
						{ length: Math.ceil(keys.length / 40) },
						(_, i) => keys.slice(i * 40, (i + 1) * 40),
					)
					metadata = (
						await Promise.all(
							chunks.map(async (chunk) => {
								const response = await fetch(
									`${path}?metadata=${encodeURIComponent(chunk.join(","))}&_data=routes%2Fprototype.search-journey`,
									{ signal },
								)
								if (!response.ok) throw new Error("Metadata unavailable")
								return (await response.json()).titles as Metadata[]
							}),
						)
					).flat()
				} catch (error) {
					if (signal.aborted) throw error
					errors.push("Additional title metadata unavailable")
				}
			}
			return { q, rows, errors, metadata }
		},
	})
	useEffect(() => {
		if (search.data) {
			setBatches((old) => ({
				...Object.fromEntries(Object.entries(old).slice(-9)),
				[search.data.q]: search.data,
			}))
			setPrevious(search.data)
		}
	}, [search.data])
	const batch = q ? (batches[q] ?? previous) : null
	useEffect(() => {
		if (batches[q]) setPrevious(batches[q])
	}, [q, batches[q]])
	useEffect(() => {
		if (ready)
			try {
				sessionStorage.setItem(
					storage,
					JSON.stringify({ batches, previous, positions: positions.current }),
				)
			} catch {}
	}, [batches, previous, ready])
	// Search owns restoration only inside explicitly marked prototype journeys.
	useEffect(() => {
		if (!active) return
		document.documentElement.setAttribute(
			"data-custom-scroll",
			"search-journey",
		)
		return () => document.documentElement.removeAttribute("data-custom-scroll")
	}, [active])
	useEffect(() => {
		if (!active || !ready) return
		const target = positions.current[url] ?? 0
		let frame = 0,
			restoring = true
		const started = performance.now()
		const restore = () => {
			window.scrollTo({ top: target, behavior: "instant" })
			if (Math.abs(scrollY - target) < 2 || performance.now() - started > 3000)
				restoring = false
			else frame = requestAnimationFrame(restore)
		}
		frame = requestAnimationFrame(restore)
		const save = () => {
			if (!restoring) {
				positions.current[url] = scrollY
				try {
					sessionStorage.setItem(
						storage,
						JSON.stringify({
							...JSON.parse(sessionStorage.getItem(storage) ?? "{}"),
							positions: positions.current,
						}),
					)
				} catch {}
			}
		}
		const cancel = () => {
			restoring = false
			cancelAnimationFrame(frame)
		}
		window.addEventListener("scroll", save, { passive: true })
		window.addEventListener("wheel", cancel, { passive: true })
		window.addEventListener("touchstart", cancel, { passive: true })
		window.addEventListener("pagehide", save)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("scroll", save)
			window.removeEventListener("wheel", cancel)
			window.removeEventListener("touchstart", cancel)
			window.removeEventListener("pagehide", save)
		}
	}, [url, active, ready])
	const metadata = new Map(
		batch?.metadata.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]) ?? [],
	)
	const identities = new Set<string>()
	const candidates = (batch?.rows ?? []).filter((r) => {
		if (r.type !== "movie" && r.type !== "show") return true
		const m = metadata.get(r.key)
		if (m?.adult === true) return false
		const key = m?.imdb_id
			? `imdb:${m.imdb_id}`
			: `${r.type}:${canonicalTitleId(r.type, Number(r.key.split(":")[1]))}`
		if (identities.has(key)) return false
		identities.add(key)
		return true
	})
	const serviceIds = setting("services")
		.split(",")
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0)
	const mode = setting("availability", "all")
	const watch = useQuery<{
		results: { key: string; result: { state: string } }[]
	}>({
		queryKey: [
			"prototype-search-watchability",
			batch?.q,
			candidates.map((r) => r.key),
			country,
			serviceIds,
			setting("paid"),
		],
		enabled:
			active &&
			mode !== "all" &&
			serviceIds.length > 0 &&
			candidates.length > 0,
		retry: false,
		queryFn: async ({ signal }) => {
			const response = await fetch("/api/watchability", {
				method: "POST",
				signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					country,
					serviceIds,
					includePaid: setting("paid") === "1",
					titles: candidates
						.filter((r) => r.type === "movie" || r.type === "show")
						.map((r) => ({
							mediaType: r.type,
							tmdbId: Number(r.key.split(":")[1]),
						})),
				}),
			})
			if (!response.ok) throw new Error("Availability check failed")
			return response.json()
		},
	})
	const watchable = (row: Row) =>
		watch.data?.results.find((x) => x.key === row.key.replace(":", "-"))?.result
			.state === "watchable"
	const rows = candidates.filter(
		(r) =>
			(setting("type", "all") === "all" || r.type === setting("type")) &&
			(!setting("genre") ||
				setting("genre")
					.split(",")
					.every((genre) =>
						(metadata.get(r.key)?.genres ?? r.discovery?.genres ?? []).includes(
							genre,
						),
					)) &&
			(!setting("minYear") || Number(r.year) >= Number(setting("minYear"))) &&
			(!setting("maxYear") || Number(r.year) <= Number(setting("maxYear"))) &&
			(mode !== "only" ||
				serviceIds.length === 0 ||
				watch.isFetching ||
				!watch.data ||
				watchable(r)),
	)
	if (mode === "prefer" && watch.data)
		rows.sort((a, b) => Number(watchable(b)) - Number(watchable(a)))
	const sequence = rows.filter((r) => r.type === "movie" || r.type === "show")
	const current = location.pathname.match(/^\/(movie|show)\/(\d+)/)
	const currentKey = current
		? `${current[1]}:${canonicalTitleId(current[1], Number(current[2]))}`
		: null
	const index = sequence.findIndex(
		(r) =>
			`${r.type}:${canonicalTitleId(r.type, Number(r.key.split(":")[1]))}` ===
			currentKey,
	)
	const pageCount = Math.max(1, Math.ceil(rows.length / 20))
	const parsedPage = Number(setting("page", "1"))
	const page = Math.min(
		pageCount,
		Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
	)
	const pageRows = rows.slice((page - 1) * 20, page * 20)
	const detailHref = (row: Row) =>
		`/${row.type}/${canonicalTitleId(row.type, Number(row.key.split(":")[1]))}?${makeParams(
			{
				q: batch?.q ?? q,
				page: String(
					Math.floor(
						Math.max(
							0,
							rows.findIndex((r) => r.key === row.key),
						) / 20,
					) + 1,
				),
			},
		)}`
	const update = (changes: Record<string, string | null>) =>
		navigate(`${location.pathname}?${makeParams({ page: null, ...changes })}`, {
			preventScrollReset: true,
		})
	const loading =
		active &&
		draft.trim().length >= 2 &&
		(search.isFetching || requested !== q || draft !== q || !ready)
	const status = loading
		? `Searching for “${draft}”…${batch ? ` Showing “${batch.q}” until ready.` : ""}`
		: search.error
			? search.error.message
			: batch
				? `${rows.length} results for “${batch.q}”${batch.errors.length ? ` · ${batch.errors.join("; ")}` : ""}`
				: "Search for a title, a person, or describe what you want to watch."
	return {
		active,
		variant,
		q,
		draft,
		setDraft,
		open,
		setOpen,
		focused,
		setFocused,
		input,
		ready,
		batch,
		rows,
		pageRows,
		page,
		pageCount,
		sequence,
		index,
		currentKey,
		metadata,
		setting,
		update,
		resultsHref,
		detailHref,
		commit,
		changeQuery,
		loading,
		status,
		watch,
		mode,
		serviceIds,
		watchable,
		openRow: (row: Row) => {
			positions.current[url] = scrollY
			setOpen(false)
			navigate(detailHref(row))
		},
		retry: () => {
			setBatches((old) => {
				const next = { ...old }
				delete next[q]
				return next
			})
			setRevision((n) => n + 1)
		},
		remember: () => {
			positions.current[url] = scrollY
			setOpen(false)
		},
		switchVariant: (step: number) => {
			const all: Variant[] = ["A", "B", "C"]
			update({ variant: all[(all.indexOf(variant) + step + 3) % 3] })
		},
	}
}
const Context = createContext<ReturnType<typeof useController> | null>(null)
export const useSearchJourney = () => useContext(Context)
export function SearchJourneyProvider({ children }: { children: ReactNode }) {
	const value = useController()
	useEffect(() => {
		if (!value.active) return
		const listener = (e: KeyboardEvent) => {
			if (
				(e.target as HTMLElement).closest(
					"input,textarea,select,button,[contenteditable]",
				)
			)
				return
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.preventDefault()
				value.switchVariant(e.key === "ArrowLeft" ? -1 : 1)
			}
		}
		window.addEventListener("keydown", listener)
		return () => window.removeEventListener("keydown", listener)
	}, [value])
	return (
		<Context.Provider value={value}>
			{children}
			{value.active && (
				<nav
					aria-label="Prototype variants"
					className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-[1050] flex items-center gap-2 rounded-full border border-amber-400 bg-gray-950 px-3 py-1 text-sm text-white shadow-xl whitespace-nowrap"
				>
					<button
						className="p-2"
						aria-label="Previous variant"
						onClick={() => value.switchVariant(-1)}
					>
						←
					</button>
					<span>
						{value.variant} · {names[value.variant]}
					</span>
					<button
						className="p-2"
						aria-label="Next variant"
						onClick={() => value.switchVariant(1)}
					>
						→
					</button>
				</nav>
			)}
		</Context.Provider>
	)
}

export function JourneyHeader() {
	const j = useSearchJourney()!
	const container = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const outside = (e: PointerEvent) => {
			if (!container.current?.contains(e.target as Node)) j.setOpen(false)
		}
		document.addEventListener("pointerdown", outside)
		return () => document.removeEventListener("pointerdown", outside)
	}, [])
	const dismiss = () => {
		j.setOpen(false)
		j.input.current?.blur()
	}
	return (
		<div ref={container}>
			<form
				onSubmit={(e) => {
					e.preventDefault()
					if (j.focused >= 0 && j.sequence[j.focused]) {
						j.openRow(j.sequence[j.focused])
						return
					}
					j.commit(j.draft)
					j.setOpen(true)
				}}
			>
				<div
					className={`flex items-center gap-2 rounded-md border-2 border-slate-700 bg-gray-800 px-3 py-2 text-gray-200 ${j.open ? "absolute top-2 left-0 w-full z-10 h-12 bg-slate-800" : "h-9 min-w-24 max-w-52"}`}
				>
					{j.loading ? (
						<ArrowPathIcon className="w-5 shrink-0 animate-spin" />
					) : (
						<MagnifyingGlassIcon className="w-5 shrink-0" />
					)}
					<input
						ref={j.input}
						type="search"
						aria-label="Search titles, people, or descriptions"
						autoComplete="off"
						placeholder={j.open ? "A title, a person, or a story…" : "Search…"}
						className="w-full min-w-0 bg-transparent border-0 outline-none text-sm sm:text-base"
						value={j.draft}
						onFocus={() => j.setOpen(true)}
						onChange={(e) => {
							j.changeQuery(e.target.value)
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault()
								dismiss()
							}
							if (e.key === "ArrowDown" || e.key === "ArrowUp") {
								e.preventDefault()
								const indices = j.pageRows
									.filter((r) => r.type !== "person")
									.map((r) =>
										j.sequence.findIndex((item) => item.key === r.key),
									)
								j.setFocused((n) => {
									if (!indices.length) return -1
									const current = indices.indexOf(n)
									const next =
										current < 0
											? e.key === "ArrowDown"
												? 0
												: indices.length - 1
											: (current +
													(e.key === "ArrowDown" ? 1 : -1) +
													indices.length) %
												indices.length
									return indices[next]
								})
							}
						}}
					/>
					{j.open && (
						<>
							<button
								className="hidden sm:block text-sm text-cyan-300 px-2"
								type="submit"
							>
								Search
							</button>
							<button aria-label="Close search" type="button" onClick={dismiss}>
								<XMarkIcon className="w-6" />
							</button>
						</>
					)}
				</div>
			</form>
		</div>
	)
}
function JourneyList({ compact = false }: { compact?: boolean }) {
	const j = useSearchJourney()!
	return (
		<section aria-label="Search results" className="min-w-0">
			<div
				role="status"
				className={`flex items-center gap-2 px-4 py-3 min-h-14 text-sm ${j.loading ? "text-cyan-200 bg-cyan-400/10" : "text-gray-400"}`}
			>
				{j.loading && (
					<ArrowPathIcon
						aria-hidden="true"
						className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none"
					/>
				)}
				<span>{j.status}</span>
				{j.batch?.errors.length ||
				j.status.startsWith("Search is unavailable") ? (
					<button onClick={j.retry} className="ml-2 underline text-cyan-300">
						Retry
					</button>
				) : null}
			</div>
			<ul aria-busy={j.loading} className="divide-y divide-gray-700/60">
				{j.pageRows.map((r, i) => {
					const body = (
						<>
							<img
								src={
									r.poster
										? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${r.poster}`
										: placeholder
								}
								alt=""
								width={48}
								height={72}
								className={`${compact ? "w-10 h-16" : "w-14 h-20"} rounded object-cover bg-gray-800 shrink-0`}
							/>
							<div className="min-w-0">
								<h3 className="font-semibold text-base">
									<Highlight text={r.title} query={j.batch?.q ?? ""} />
								</h3>
								<p className="text-xs text-gray-400 mt-1">
									{r.year} · {r.type}
								</p>
								<div className="flex flex-wrap gap-1 mt-2">
									{r.lexical > 0 && (
										<span className="rounded bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">
											{r.match}
										</span>
									)}
									{r.discovery?.reasons
										.filter((x) => x.kind !== "mismatch")
										.slice(0, compact ? 2 : 3)
										.map((x) => (
											<span
												key={x.text}
												className="rounded bg-cyan-400/10 text-xs text-cyan-200 px-2 py-0.5"
											>
												{x.text}
											</span>
										))}
								</div>
								{r.type === "person" && (
									<p className="text-xs text-gray-400 mt-1">
										Known for: {r.knownFor}
									</p>
								)}
								{!compact && j.mode !== "all" && (
									<p className="text-xs text-gray-400 mt-2">
										{j.watch.isFetching
											? "Checking current offers…"
											: j.watchable(r)
												? "Current matching offer"
												: "No confirmed matching offer"}
									</p>
								)}
							</div>
						</>
					)
					return (
						<li key={r.key}>
							{r.type === "person" ? (
								<div className="flex gap-3 p-4">{body}</div>
							) : (
								<Link
									data-result={r.key}
									to={j.detailHref(r)}
									onClick={j.remember}
									className={`flex gap-3 p-4 hover:bg-gray-800 focus-visible:outline focus-visible:outline-cyan-300 ${j.currentKey === r.key || j.focused === j.sequence.findIndex((item) => item.key === r.key) ? "bg-gray-800" : ""}`}
								>
									{body}
								</Link>
							)}
						</li>
					)
				})}
			</ul>
			{j.rows.length > 0 && (
				<nav
					aria-label="Search pages"
					className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 p-4 text-sm"
				>
					<span className="text-gray-400">
						{(j.page - 1) * 20 + 1}–{Math.min(j.page * 20, j.rows.length)} of{" "}
						{j.rows.length}
					</span>
					<div className="flex items-center gap-3">
						{j.page > 1 && (
							<Link
								className={control}
								to={j.resultsHref({
									q: j.batch?.q ?? j.q,
									page: String(j.page - 1),
								})}
							>
								Previous page
							</Link>
						)}
						<span>
							Page {j.page} of {j.pageCount}
						</span>
						{j.page < j.pageCount && (
							<Link
								className={control}
								to={j.resultsHref({
									q: j.batch?.q ?? j.q,
									page: String(j.page + 1),
								})}
							>
								Next page
							</Link>
						)}
					</div>
				</nav>
			)}
			{!j.rows.length && !j.loading && (
				<div className="p-6 text-gray-400">
					{j.batch
						? "No titles match these filters. Broaden your selection or change the request."
						: "Try Heat, a favorite actor, or a description such as ‘tense but not bleak’."}
				</div>
			)}
		</section>
	)
}
type FilterKey = "type" | "genre" | "minYear" | "country" | "availability"
const filterNames: Record<FilterKey, string> = {
	type: "Titles",
	genre: "Genre",
	minYear: "Release year",
	country: "Country",
	availability: "Availability",
}
const filterColors = {
	type: "amber",
	genre: "purple",
	minYear: "blue",
	country: "sky",
	availability: "green",
} as const
function FilterField({
	field,
	inline = false,
}: { field: FilterKey; inline?: boolean }) {
	const j = useSearchJourney()!
	const genres = [
		...new Set(
			j.batch?.rows.flatMap(
				(r) => j.metadata.get(r.key)?.genres ?? r.discovery?.genres ?? [],
			) ?? [],
		),
	].sort()
	const options: Record<FilterKey, [string, string][]> = {
		type: [
			["all", "Movies & shows"],
			["movie", "Movies"],
			["show", "Shows"],
		],
		genre: [
			["", "Any genre"],
			...genres.map((g) => [g, g] as [string, string]),
		],
		minYear: [
			["", "Any year"],
			["1990", "1990"],
			["2000", "2000"],
			["2010", "2010"],
			["2020", "2020"],
		],
		country: [
			["DE", "Germany"],
			["US", "United States"],
			["GB", "United Kingdom"],
			["FR", "France"],
			["ES", "Spain"],
			["TR", "Türkiye"],
		],
		availability: [
			["all", "Explore everything"],
			["prefer", "Prefer my services"],
			["only", "Only on my services"],
		],
	}
	const fallback =
		field === "type" || field === "availability"
			? "all"
			: field === "country"
				? "DE"
				: ""
	if (field === "country")
		return (
			<FilterCountries
				mediaType="movie"
				selectedCountry={j.setting("country", "DE")}
				onChange={(country) => j.update({ country })}
			/>
		)
	return (
		<label
			className={
				inline
					? "flex items-center gap-2 text-xs whitespace-nowrap"
					: "flex flex-col gap-2 text-xs text-gray-300 w-full"
			}
		>
			<span>{filterNames[field]}</span>
			<select
				aria-label={filterNames[field]}
				className={
					inline
						? "min-w-0 bg-gray-900/80 border border-white/15 rounded px-2 py-1.5 text-sm max-w-44"
						: `${control} w-full`
				}
				value={j.setting(field, fallback)}
				onChange={(e) => j.update({ [field]: e.target.value })}
			>
				{options[field].map(([v, l]) => (
					<option key={v} value={v}>
						{l}
					</option>
				))}
			</select>
		</label>
	)
}
function ServiceSelection() {
	const j = useSearchJourney()!
	const { data: providers = [] } = useStreamingProviders()
	const items = providers.map((p) => ({
		key: String(p.id),
		label: p.name,
		icon: p.logo_path
			? `https://image.tmdb.org/t/p/w92${p.logo_path}`
			: undefined,
	}))
	return (
		<div className="space-y-3" role="group" aria-label="Streaming services">
			<Select
				selectItems={items}
				selectedItems={items.filter((i) =>
					j.serviceIds.includes(Number(i.key)),
				)}
				withMultiSelection
				withSearch
				onSelect={(items) =>
					j.update({ services: items.map((i) => i.key).join(",") })
				}
			/>
			<Checkbox
				key={j.setting("paid")}
				option={{ name: "search-include-paid", label: "Include rent and buy" }}
				defaultChecked={j.setting("paid") === "1"}
				onChange={(yes) => j.update({ paid: yes ? "1" : null })}
			/>
			{!j.serviceIds.length && (
				<p className="text-xs text-amber-200">
					Choose services to check availability.
				</p>
			)}
			{j.watch.isError && (
				<p className="text-xs text-amber-200">
					Availability could not be checked; results remain visible.
				</p>
			)}
		</div>
	)
}
export function JourneyFilters({ inline = false }: { inline?: boolean }) {
	const j = useSearchJourney()!
	const [added, setAdded] = useState<FilterKey[]>([])
	const [editing, setEditing] = useState<FilterKey | null>(null)
	const { data: genres = [] } = useGenres()
	const all = Object.keys(filterNames) as FilterKey[]
	const visible = all.filter(
		(k) =>
			k === "type" ||
			added.includes(k) ||
			(k === "minYear" && Boolean(j.setting("maxYear"))) ||
			(k === "country"
				? j.setting(k, "DE") !== "DE"
				: j.setting(k) && j.setting(k) !== "all"),
	)
	const reset = () =>
		j.update(
			Object.fromEntries(
				refinements.filter((k) => k !== "country").map((k) => [k, null]),
			),
		)
	if (inline) {
		const remove = (field: FilterKey) => {
			j.update({
				[field]: null,
				...(field === "minYear" ? { maxYear: null } : {}),
				...(field === "availability" ? { services: null, paid: null } : {}),
			})
			setAdded((a) => a.filter((k) => k !== field))
			setEditing(null)
		}
		const summaries: Record<FilterKey, string> = {
			type: j.setting("type", "all"),
			genre:
				j.setting("genre").split(",").filter(Boolean).join(" + ") ||
				"Any genre",
			minYear:
				j.setting("minYear") || j.setting("maxYear")
					? `${j.setting("minYear", "Any")} – ${j.setting("maxYear", "today")}`
					: "Any year",
			country: j.setting("country", "DE"),
			availability:
				j.mode === "all"
					? "Explore everything"
					: `${j.mode === "only" ? "Only" : "Prefer"} my services (${j.serviceIds.length})`,
		}
		return (
			<div aria-label="Inline search filters" className="relative">
				<div className="flex items-stretch gap-2 overflow-x-auto pb-2 whitespace-nowrap">
					{visible.map((field) => (
						<div key={field} className="shrink-0">
							<FilterBarSection
								color={filterColors[field]}
								isCompact
								isActive={editing === field}
							>
								{field === "type" ? (
									<div className="p-1">
										<FilterField field={field} inline />
									</div>
								) : (
									<div className="flex items-center gap-1">
										<button
											type="button"
											aria-expanded={editing === field}
											className="flex items-center gap-2 p-1.5 text-sm"
											onClick={() =>
												setEditing(editing === field ? null : field)
											}
										>
											<span className="font-semibold">
												{filterNames[field]}
											</span>
											<Tag>{summaries[field]}</Tag>
										</button>
										<button
											type="button"
											aria-label={`Remove ${filterNames[field]} filter`}
											className="p-1 text-gray-400 hover:text-white"
											onClick={() => remove(field)}
										>
											<XMarkIcon className="w-4" />
										</button>
									</div>
								)}
							</FilterBarSection>
						</div>
					))}
					{all.some((k) => !visible.includes(k)) && (
						<select
							aria-label="Add filter"
							value=""
							onChange={(e) => {
								const field = e.target.value as FilterKey
								setAdded((a) => [...a, field])
								setEditing(field)
							}}
							className={`${control} shrink-0`}
						>
							<option value="">＋ Add filter</option>
							{all
								.filter((k) => !visible.includes(k))
								.map((k) => (
									<option key={k} value={k}>
										{filterNames[k]}
									</option>
								))}
						</select>
					)}
					{visible.length > 1 && (
						<button
							type="button"
							className="text-xs text-gray-400 px-2"
							onClick={() => {
								reset()
								setAdded([])
								setEditing(null)
							}}
						>
							Reset
						</button>
					)}
				</div>
				{editing && (
					<div
						className="max-w-2xl mb-4"
						role="region"
						aria-label={`${filterNames[editing]} editor`}
					>
						{editing === "genre" ? (
							<SectionGenre
								params={{
									withGenres: genres
										.filter((g) =>
											j.setting("genre").split(",").includes(g.name),
										)
										.map((g) => g.id)
										.join(","),
								}}
								editing
								onEdit={() => setEditing("genre")}
								onClose={() => setEditing(null)}
								onChange={({ withGenres }) =>
									j.update({
										genre:
											genres
												.filter((g) =>
													withGenres.split(",").includes(String(g.id)),
												)
												.map((g) => g.name)
												.join(",") || null,
									})
								}
							/>
						) : editing === "minYear" ? (
							<SectionRelease
								params={{
									minYear: j.setting("minYear") || undefined,
									maxYear: j.setting("maxYear") || undefined,
								}}
								editing
								initializeOnEdit={false}
								onEdit={() => setEditing("minYear")}
								onClose={() => setEditing(null)}
								onChange={(years) =>
									j.update({
										minYear: years.minYear || null,
										maxYear: years.maxYear || null,
									})
								}
							/>
						) : (
							<FilterBarSection
								label={filterNames[editing]}
								color={filterColors[editing]}
								isActive
								onClick={() => setEditing(null)}
								onRemove={() => remove(editing)}
							>
								<div className="w-full max-w-sm space-y-3">
									<FilterField field={editing} />
									{editing === "availability" && j.mode !== "all" && (
										<ServiceSelection />
									)}
								</div>
							</FilterBarSection>
						)}
					</div>
				)}
			</div>
		)
	}

	return (
		<div aria-label="Search filter sidebar" className="space-y-3">
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-gray-100">Filters</h2>
				<button
					className="text-xs text-gray-400 hover:text-white"
					onClick={reset}
				>
					Reset
				</button>
			</div>
			{all.map((field) => (
				<FilterBarSection
					key={field}
					color={filterColors[field]}
					isActive={false}
				>
					<FilterField field={field} />
				</FilterBarSection>
			))}
			{j.mode !== "all" && (
				<FilterBarSection color="green" isActive={false}>
					<div className="w-full">
						<ServiceSelection />
					</div>
				</FilterBarSection>
			)}
			<p className="text-xs text-gray-500">
				Filters apply to these search results.
			</p>
		</div>
	)
}
export function JourneyNavigation({
	current,
}: { current: { tmdb_id: number; media_type: string; title: string } }) {
	const j = useSearchJourney()!
	const [expanded, setExpanded] = useState(false)
	if (!j.batch || !j.q || !j.sequence.length) return null
	return (
		<nav
			aria-label="Search result navigation"
			className="border-b border-cyan-400/20 bg-gray-900"
		>
			<div className="mx-auto max-w-7xl px-4 py-3 text-sm">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Link
						to={j.resultsHref({ q: j.batch.q })}
						onClick={() => j.setOpen(false)}
						className="text-cyan-300 max-w-full truncate"
					>
						← Results for “{j.batch.q}”
					</Link>
					<div className="flex items-center gap-3">
						{j.index > 0 ? (
							<Link
								to={j.detailHref(j.sequence[j.index - 1])}
								onClick={j.remember}
								className="text-cyan-300"
							>
								← Previous
							</Link>
						) : (
							<span className="text-gray-500">← Previous</span>
						)}
						<span className="text-xs text-gray-300">
							{j.index >= 0
								? `${j.index + 1} of ${j.sequence.length}`
								: "Outside filters"}
						</span>
						{j.index >= 0 && j.index < j.sequence.length - 1 ? (
							<Link
								to={j.detailHref(j.sequence[j.index + 1])}
								onClick={j.remember}
								className="text-cyan-300"
							>
								Next →
							</Link>
						) : (
							<span className="text-gray-500">Next →</span>
						)}
					</div>
					<button
						onClick={() => setExpanded((x) => !x)}
						className="text-gray-300"
					>
						Refine {expanded ? "−" : "+"}
					</button>
				</div>
				{j.index < 0 && (
					<p className="text-xs text-gray-400 mt-2">
						{current.title} stays open. Return to results to choose a matching
						title.
					</p>
				)}
				{expanded && (
					<div className="mt-4">
						<JourneyFilters inline />
					</div>
				)}
			</div>
		</nav>
	)
}
export function JourneyDetailRail() {
	const j = useSearchJourney()
	if (!j?.active || j.variant !== "C") return null
	return (
		<aside
			aria-label="Search rail"
			className="hidden xl:block fixed left-0 top-16 bottom-0 w-72 overflow-y-auto border-r border-gray-700 bg-gray-950 z-50 pb-28"
		>
			<Link to={j.resultsHref()} className="block p-4 text-cyan-300 text-sm">
				← All search results
			</Link>
			<JourneyList compact />
		</aside>
	)
}
export function JourneyResultsPage() {
	const j = useSearchJourney()!
	return (
		<div
			className={`mx-auto ${j.variant === "C" ? "max-w-4xl" : "max-w-7xl"} p-4 sm:p-6 pb-36`}
		>
			<div className="flex flex-wrap justify-between items-start gap-3 mb-5">
				<div>
					<p className="text-xs uppercase tracking-widest text-amber-400">
						Connected search prototype
					</p>
					<h1 className="text-3xl text-white mt-2">Find your next watch</h1>
					<p className="text-gray-400 mt-2">
						Search in the header. Open any result to explore its full details.
					</p>
				</div>
			</div>
			<p className="text-xs text-gray-400 mb-6">
				Live search and real title pages. Rating, Want to See, and Skip on
				details use your normal library.
			</p>
			<div
				className={
					j.variant === "B"
						? "grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]"
						: ""
				}
			>
				<aside
					className={
						j.variant === "B" ? "self-start lg:sticky lg:top-20" : "mb-4"
					}
				>
					<JourneyFilters inline={j.variant !== "B"} />
				</aside>
				<div className="min-w-0 rounded-xl border border-gray-700 bg-gray-950/30">
					<JourneyList compact={j.variant === "C"} />
				</div>
			</div>
			<details className="mt-8 text-xs text-gray-400">
				<summary>Review scope and current state</summary>
				<p className="mt-3">
					Typing in the header moves directly to this page. Query edits replace
					history; filter edits add history. A uses an inline add-filter row, B
					the existing filter design in a sidebar, and C a compact list with a
					rail on detail pages. All use the same real search results and detail
					routes.
				</p>
				<p className="mt-3">
					Genre, type, year and streaming refine the loaded list. D4+ still uses
					its accepted 2,000-vote discovery minimum; broadening retrieval and
					adult opt-in remain backend integration work. This prototype does not
					invent results for those controls.
				</p>
				<pre className="whitespace-pre-wrap break-all mt-3">
					{JSON.stringify(
						{
							variant: j.variant,
							query: j.q,
							displayedQuery: j.batch?.q,
							order: j.sequence.map((r) => r.key),
							errors: j.batch?.errors,
						},
						null,
						2,
					)}
				</pre>
			</details>
		</div>
	)
}
