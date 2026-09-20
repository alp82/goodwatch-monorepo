// THROWAWAY integration: shared by the real Header, search route, and real Details.
import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react"
import { Link, useLocation, useNavigate } from "@remix-run/react"
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
import placeholder from "~/img/placeholder-poster.png"

const path = "/prototype/search-journey"
const storage = "goodwatch_prototype_search_journey_v2"
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
const names = { A: "Compact header", B: "Expanded header", C: "Search rail" }
const refinements = [
	"type",
	"genre",
	"minYear",
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
	const commit = (value: string) => {
		const next = value.trim()
		if (next === q) return
		navigate(resultsHref({ q: next }), { preventScrollReset: false })
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
		setDraft(q)
		setFocused(-1)
	}, [q])
	useEffect(() => {
		if (!active || !ready || draft.trim() === q) return
		const timer = setTimeout(() => commit(draft), 1000)
		return () => clearTimeout(timer)
	}, [draft, q, active, ready])
	const search = useQuery({
		queryKey: ["prototype-connected-search", q, revision],
		enabled: active && ready && q.length >= 2 && !batches[q],
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
			if (keys.length)
				try {
					const response = await fetch(
						`${path}?metadata=${encodeURIComponent(keys.join(","))}&_data=routes%2Fprototype.search-journey`,
						{ signal },
					)
					if (!response.ok) throw new Error("Metadata unavailable")
					metadata = (await response.json()).titles
				} catch (error) {
					if (signal.aborted) throw error
					errors.push("Additional title metadata unavailable")
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
				(metadata.get(r.key)?.genres ?? r.discovery?.genres ?? []).includes(
					setting("genre"),
				)) &&
			(!setting("minYear") || Number(r.year) >= Number(setting("minYear"))) &&
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
	const detailHref = (row: Row) =>
		`/${row.type}/${canonicalTitleId(row.type, Number(row.key.split(":")[1]))}?${makeParams({ q: batch?.q ?? q })}`
	const update = (changes: Record<string, string | null>) =>
		navigate(`${location.pathname}?${makeParams(changes)}`, {
			preventScrollReset: true,
		})
	const loading =
		active &&
		draft.trim().length >= 2 &&
		(search.isFetching || draft.trim() !== q || !ready)
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
		sequence,
		index,
		currentKey,
		metadata,
		setting,
		update,
		resultsHref,
		detailHref,
		commit,
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
						aria-controls={j.open ? "journey-header-results" : undefined}
						autoComplete="off"
						placeholder={j.open ? "A title, a person, or a story…" : "Search…"}
						className="w-full min-w-0 bg-transparent border-0 outline-none text-sm sm:text-base"
						value={j.draft}
						onFocus={() => j.setOpen(true)}
						onChange={(e) => {
							j.setDraft(e.target.value)
							j.setFocused(-1)
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault()
								dismiss()
							}
							if (e.key === "ArrowDown" || e.key === "ArrowUp") {
								e.preventDefault()
								const count = Math.min(
									j.sequence.length,
									j.variant === "A" ? 4 : 8,
								)
								j.setFocused((n) =>
									count
										? (n + (e.key === "ArrowDown" ? 1 : -1) + count) % count
										: -1,
								)
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
			{j.open && (
				<div
					id="journey-header-results"
					className={`absolute top-full mt-1 right-0 left-0 z-20 max-h-[calc(100dvh-90px)] overflow-y-auto rounded-xl border border-gray-700 bg-gray-950 text-white shadow-2xl ${j.variant === "A" ? "lg:left-auto lg:w-[620px]" : "w-full"}`}
				>
					{j.variant === "B" ? (
						<div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
							<div className="p-4 border-b lg:border-r border-gray-700">
								<details>
									<summary className="cursor-pointer text-sm text-cyan-300">
										Refine results
									</summary>
									<div className="mt-4">
										<JourneyFilters />
									</div>
								</details>
							</div>
							<JourneyList compact />
						</div>
					) : (
						<JourneyList compact />
					)}
					<Link
						to={j.resultsHref({ q: j.batch?.q ?? j.q })}
						onClick={() => j.setOpen(false)}
						className="block border-t border-gray-700 p-4 text-center text-cyan-300 hover:bg-gray-800"
					>
						View all results and filters →
					</Link>
				</div>
			)}
		</div>
	)
}
function JourneyList({ compact = false }: { compact?: boolean }) {
	const j = useSearchJourney()!
	const limit = compact ? (j.variant === "A" ? 4 : 8) : undefined
	return (
		<section
			aria-label={compact ? "Header suggestions" : "Search results"}
			aria-busy={j.loading}
			className="min-w-0"
		>
			<div role="status" className="px-4 py-3 min-h-14 text-sm text-gray-400">
				{j.status}
				{j.batch?.errors.length ||
				j.status.startsWith("Search is unavailable") ? (
					<button onClick={j.retry} className="ml-2 underline text-cyan-300">
						Retry
					</button>
				) : null}
			</div>
			<ul className="divide-y divide-gray-700/60">
				{j.rows.slice(0, limit).map((r, i) => {
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
export function JourneyFilters() {
	const j = useSearchJourney()!
	const { data: providers = [] } = useStreamingProviders()
	const genres = [
		...new Set(
			j.batch?.rows.flatMap(
				(r) => j.metadata.get(r.key)?.genres ?? r.discovery?.genres ?? [],
			) ?? [],
		),
	].sort()
	const select = (
		label: string,
		key: string,
		options: [string, string][],
		fallback = "",
	) => (
		<label className="flex flex-col gap-1 text-xs text-gray-400">
			{label}
			<select
				aria-label={label}
				className={control}
				value={j.setting(key, fallback)}
				onChange={(e) => j.update({ [key]: e.target.value })}
			>
				{options.map(([v, l]) => (
					<option key={v} value={v}>
						{l}
					</option>
				))}
			</select>
		</label>
	)
	return (
		<div className="space-y-4">
			<div className="flex justify-between gap-2">
				<strong className="text-sm">Refine results</strong>
				<button
					className="text-xs text-cyan-300"
					onClick={() =>
						j.update(
							Object.fromEntries(
								refinements
									.filter((k) => k !== "country")
									.map((k) => [k, null]),
							),
						)
					}
				>
					Reset
				</button>
			</div>
			<p className="text-xs text-gray-400">
				Refine the loaded results. Your original search order is preserved
				unless you prefer streaming matches.
			</p>
			<div className="grid grid-cols-2 gap-3">
				{select(
					"Titles",
					"type",
					[
						["all", "Movies & shows"],
						["movie", "Movies"],
						["show", "Shows"],
					],
					"all",
				)}
				{select("Genre", "genre", [
					["", "Any genre"],
					...genres.map((g) => [g, g] as [string, string]),
				])}
			</div>
			{select("Released since", "minYear", [
				["", "Any year"],
				["1990", "1990"],
				["2000", "2000"],
				["2010", "2010"],
				["2020", "2020"],
			])}
			{select(
				"Country",
				"country",
				[
					["DE", "Germany"],
					["US", "United States"],
					["GB", "United Kingdom"],
					["FR", "France"],
					["ES", "Spain"],
					["TR", "Türkiye"],
				],
				"DE",
			)}
			{select(
				"Availability",
				"availability",
				[
					["all", "Explore everything"],
					["prefer", "Prefer my services"],
					["only", "Only on my services"],
				],
				"all",
			)}
			{j.mode !== "all" && (
				<>
					<label className="flex flex-col gap-1 text-xs text-gray-400">
						Streaming services
						<select
							multiple
							aria-label="Streaming services"
							className={`${control} h-28`}
							value={j.serviceIds.map(String)}
							onChange={(e) =>
								j.update({
									services: Array.from(e.target.selectedOptions)
										.map((o) => o.value)
										.join(","),
								})
							}
						>
							{providers.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</label>
					<label className="flex gap-2 text-sm">
						<input
							type="checkbox"
							checked={j.setting("paid") === "1"}
							onChange={(e) =>
								j.update({ paid: e.target.checked ? "1" : null })
							}
						/>
						Include rent and buy offers
					</label>
					{!j.serviceIds.length && (
						<p className="text-xs text-amber-200">
							Choose at least one service to check availability.
						</p>
					)}
					{j.watch.isError && (
						<p className="text-xs text-amber-200">
							Availability could not be checked; results remain visible.
						</p>
					)}
				</>
			)}
			<p className="text-xs text-gray-400">
				These search preferences do not change your account settings.
			</p>
		</div>
	)
}
export function JourneyNavigation({
	current,
}: { current: { tmdb_id: number; media_type: string; title: string } }) {
	const j = useSearchJourney()!
	const [expanded, setExpanded] = useState(false)
	if (!j.batch || !j.q)
		return (
			<div className="px-4 py-2 text-xs text-gray-400">
				No saved search sequence. Use the header to start a search.
			</div>
		)
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
					<div className="max-w-lg mt-4">
						<JourneyFilters />
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
			<JourneyList />
		</aside>
	)
}
export function JourneyResultsPage() {
	const j = useSearchJourney()!
	const [filters, setFilters] = useState(false)
	return (
		<div className="mx-auto max-w-7xl p-4 sm:p-6 pb-36">
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
				<button
					className={control}
					onClick={() => {
						j.setOpen(true)
						j.input.current?.focus()
					}}
				>
					Focus header search ↑
				</button>
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
						j.variant === "B"
							? "self-start border border-gray-700 rounded-xl p-4"
							: "mb-4"
					}
				>
					{j.variant !== "B" && (
						<button className={control} onClick={() => setFilters((x) => !x)}>
							Filters {filters ? "−" : "+"}
						</button>
					)}
					{(filters || j.variant === "B") && (
						<div
							className={
								j.variant === "B"
									? ""
									: "mt-4 max-w-lg border border-gray-700 p-4 rounded-xl"
							}
						>
							<JourneyFilters />
						</div>
					)}
				</aside>
				<div className="min-w-0 rounded-xl border border-gray-700 bg-gray-950/30">
					<JourneyList />
				</div>
			</div>
			<details className="mt-8 text-xs text-gray-400">
				<summary>Review scope and current state</summary>
				<p className="mt-3">
					A: compact header suggestions, separate search navigation below the
					real detail header. B: expanded header suggestions and search in the
					existing Taste navigation slot. C: compact header with a desktop rail
					beside the real detail page. All use the same real search results and
					detail routes.
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
