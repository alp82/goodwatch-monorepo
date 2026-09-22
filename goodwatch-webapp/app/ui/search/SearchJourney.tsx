// Production search journey: accepted inline-filter variant, isolated from taste storage.
import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	Link,
	useLocation,
	useNavigate,
	useNavigationType,
} from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import {
	MagnifyingGlassIcon,
	ArrowPathIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid";
import { Highlight, type Row } from "./search-model";
import type { SearchBatch } from "~/server/combined-search/search.server";
import type { ReadingChip } from "~/server/combined-search/d4.server";
import { useGenres } from "~/routes/api.genres.all";
import {
	type SearchFilters,
	matchesRow,
	searchFiltersKey,
} from "~/server/combined-search/search-filters";
import SectionGenre from "~/ui/filter/sections/SectionGenre";
import SectionStreaming from "~/ui/filter/sections/SectionStreaming";
import type { StreamingPreset } from "~/server/discover.server";
import { useUserSettings } from "~/routes/api.user-settings.get";
import SectionRelease from "~/ui/filter/sections/SectionRelease";
import SectionType, { type TitleType } from "~/ui/filter/sections/SectionType";
import AddFilterMenu from "~/ui/filter/AddFilterMenu";
import { discoverFilters } from "~/server/types/discover-types";
import placeholder from "~/img/placeholder-poster.png";
// PROTOTYPE — grid variants on /search, gated by ?variant=. Remove with the prototype.
import { VariantB, VariantC, VariantD, VariantE, VariantF } from "~/ui/prototype/SearchGridVariants";
import { VariantSwitcher, useVariant } from "~/ui/prototype/VariantSwitcher";
const GRID_VARIANTS = ["A", "B", "C", "D", "E", "F"] as const;
const GRID_NAMES = { A: "List (current)", B: "Overlay", C: "Caption", D: "DNA tags", E: "Footer", F: "Backdrop" };

// --- Tunables ----------------------------------------------------------------------------

// Wait this long after the last keystroke before sending the query to the server.
const QUERY_DEBOUNCE_MS = 500;
// Wait this long after the last filter change before refetching. Filter changes narrow the
// shown batch at once; only the request waits, so dragging the year slider sends one request.
const FILTER_DEBOUNCE_MS = 100;
// A query shorter than this is not searched. Longer than this can't be typed.
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 512;
// Result batches kept in sessionStorage. Descriptive batches reach about 220 KB, and each
// filter set adds one, so six stays well under the quota.
const CACHED_BATCHES = 6;
// Give up restoring the scroll position after this long, when the page never reaches it.
const SCROLL_RESTORE_MS = 3000;
// How many reason chips a result row shows, in the full and the compact layout.
const RESULT_CHIPS = 5;
const RESULT_CHIPS_COMPACT = 3;

type Batch = SearchBatch & { cacheKey: string };
const path = "/search";
const storage = "goodwatch_search_journey_v1";
const control =
	"rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus-visible:outline focus-visible:outline-cyan-300 disabled:opacity-40";
const refinements = [
	"type",
	"lesserKnown",
	"genre",
	"minYear",
	"maxYear",
	"availability",
	"streamingPreset",
	"country",
	"services",
	"paid",
];
function useController() {
	const location = useLocation(),
		navigate = useNavigate();
	const params = new URLSearchParams(location.search);
	const active =
		location.pathname === path || params.get("searchJourney") === "1";
	const q = active ? (params.get("q") ?? "") : "";
	const [draft, setDraft] = useState(q);
	const [requested, setRequested] = useState(q);
	const editing = useRef<string | null>(null);
	const navigationType = useNavigationType();
	const [open, setOpen] = useState(false);
	const [focused, setFocused] = useState(-1);
	const [ready, setReady] = useState(false);
	const [batches, setBatches] = useState<Record<string, Batch>>({});
	const [previous, setPrevious] = useState<Batch | null>(null);
	// The interpretation arrives before the results, so it is kept apart from the batch.
	const [reading, setReading] = useState<{
		q: string;
		chips: ReadingChip[];
	} | null>(null);
	const [revision, setRevision] = useState(0);
	const positions = useRef<Record<string, number>>({});
	const input = useRef<HTMLInputElement>(null);
	const scrollParams = new URLSearchParams(location.search);
 scrollParams.delete("searchJourney");
 scrollParams.delete("variant");
 if (scrollParams.get("page") === "1") scrollParams.delete("page");
 scrollParams.set("country", scrollParams.get("country") || "DE");
 scrollParams.sort();
 const url = `${location.pathname}?${scrollParams}`;
	const setting = (key: string, fallback = "") => params.get(key) ?? fallback;
	// The controller runs on every page, so read the saved services from user
	// settings and don't load the full provider list here.
	const userSettingsQuery = useUserSettings();
	const userSettings = userSettingsQuery.data;
	const userCountry = userSettings?.country_default;
	const country =
		(setting("streamingPreset") === "mine" && userCountry) ||
		setting("country", "DE");
	const makeParams = (changes: Record<string, string | null> = {}) => {
		const next = new URLSearchParams(location.search);
		next.set("searchJourney", "1");
		// PROTOTYPE: keep ?variant= across navigation.
		next.set("country", country);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === "") next.delete(key);
			else next.set(key, value);
		}
		next.delete("s");
		next.delete("adult");
		return next;
	};
	const resultsHref = (changes: Record<string, string | null> = {}) =>
		`${path}?${makeParams(changes)}`;
	const changeQuery = (value: string) => {
		editing.current = value;
		setDraft(value);
		setFocused(-1);
		navigate(resultsHref({ q: value, page: null }), {
			replace: true,
			preventScrollReset: location.pathname === path,
		});
	};
	const commit = (value: string) => {
		changeQuery(value);
		setRequested(value);
	};

	useEffect(() => {
		try {
			const saved = JSON.parse(sessionStorage.getItem(storage) ?? "{}");
			setBatches(saved.batches ?? {});
			positions.current = saved.positions ?? {};
			setPrevious(null);
		} catch {}
		setReady(true);
	}, []);
	useEffect(() => {
		if (
			navigationType === "POP" ||
			editing.current === null ||
			editing.current === q
		) {
			setDraft(q);
			editing.current = null;
		}
		setFocused(-1);
	}, [q, navigationType, location.search]);
	useEffect(() => {
		if (!active || !ready) return;
		const timer = setTimeout(() => setRequested(q), QUERY_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [q, active, ready]);

	const config = useQuery<{ version: string }>({
		queryKey: ["search-policy"],
		queryFn: async ({ signal }) => {
			const response = await fetch("/api/search-config", {
				signal,
				cache: "no-store",
			});
			if (!response.ok) throw new Error("Search configuration unavailable");
			return response.json();
		},
		retry: false,
		refetchOnMount: "always",
		refetchOnWindowFocus: "always",
	});
	const streamingPreset = setting("streamingPreset");
	const serviceIds = (
		streamingPreset === "mine"
			? (userSettings?.streaming_providers_default ?? "")
			: setting("services")
	)
		.split(",")
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0);
	// A streaming filter shows only matching titles; "availability" keeps old links working.
	const mode = streamingPreset ? "only" : setting("availability", "all");
	// The server applies the streaming filter during retrieval, so a filtered
	// search still returns a full set of candidates.
	const streaming =
		streamingPreset && serviceIds.length
			? { country, providerIds: serviceIds }
			: null;
	const yearSetting = (key: "minYear" | "maxYear") =>
		/^\d{4}$/.test(setting(key)) ? Number(setting(key)) : undefined;
	const genreSetting = setting("genre").split(",").filter(Boolean);
	const filters: SearchFilters = {
		...(setting("type") === "movie" || setting("type") === "show"
			? { type: setting("type") as "movie" | "show" }
			: {}),
		...(genreSetting.length ? { genres: genreSetting } : {}),
		...(yearSetting("minYear") ? { minYear: yearSetting("minYear") } : {}),
		...(yearSetting("maxYear") ? { maxYear: yearSetting("maxYear") } : {}),
		...(streaming ? { streaming } : {}),
	};
	const filtersKey = searchFiltersKey(filters);
	const policyKey = `${config.data?.version ?? "pending"}:false:${setting("lesserKnown") === "1"}${filtersKey ? `:${filtersKey}` : ""}`;
	const batchKey = `${policyKey}:${q}`;
	// Filter changes narrow the shown batch at once; the refetch waits until the
	// filters stop changing, so dragging the year slider sends one request.
	const [settledFilters, setSettledFilters] = useState(filtersKey);
	useEffect(() => {
		const timer = setTimeout(() => setSettledFilters(filtersKey), FILTER_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [filtersKey]);
	const search = useQuery({
		queryKey: ["combined-search", requested, policyKey, revision],
		enabled:
			active &&
			ready &&
			!!config.data &&
			requested === q &&
			// "Mine" needs the saved services; searching before they load is wasted.
			!(streamingPreset === "mine" && userSettingsQuery.isLoading) &&
			requested.trim().length >= MIN_QUERY_LENGTH &&
			settledFilters === filtersKey &&
			!batches[batchKey],
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		queryFn: async ({ signal }): Promise<Batch & { cacheKey: string }> => {
			const response = await fetch("/api/combined-search", {
				method: "POST",
				signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					q: requested,
					includeAdult: false,
					lesserKnown: setting("lesserKnown") === "1",
					filters,
				}),
			});
			const unavailable =
				"Search is unavailable. Your previous results are kept.";
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error ?? unavailable);
			}
			// The route streams newline-delimited JSON: the reading first, the batch last.
			const reader = response.body?.getReader();
			if (!reader) throw new Error(unavailable);
			const decoder = new TextDecoder();
			let buffered = "";
			let batch: SearchBatch | undefined;
			const handle = (line: string) => {
				if (!line.trim()) return;
				const message = JSON.parse(line);
				if (message.kind === "reading")
					setReading({ q: requested, chips: message.reading });
				else if (message.kind === "batch") batch = message.batch;
				else if (message.kind === "error")
					throw new Error(message.error ?? unavailable);
			};
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffered += decoder.decode(value, { stream: true });
				const lines = buffered.split("\n");
				buffered = lines.pop() ?? "";
				for (const line of lines) handle(line);
			}
			handle(buffered + decoder.decode());
			if (!batch) throw new Error(unavailable);
			return { ...batch, q: requested, cacheKey: batchKey };
		},
	});
	useEffect(() => {
		if (search.data) {
			setBatches((old) => ({
				...Object.fromEntries(
					Object.entries(old).slice(-(CACHED_BATCHES - 1)),
				),
				[search.data.cacheKey]: search.data,
			}));
			setPrevious(search.data);
		}
	}, [search.data]);
	// While a filtered fetch is pending, narrow the unfiltered batch of this query
	// when it is cached: it holds more matches than another filtered batch.
	const unfilteredKey = `${config.data?.version ?? "pending"}:false:${setting("lesserKnown") === "1"}:${q}`;
	const batch = q
		? (batches[batchKey] ??
			batches[unfilteredKey] ??
			(previous?.cacheKey.startsWith(`${config.data?.version}:`)
				? previous
				: null))
		: null;
	useEffect(() => {
		if (batches[batchKey]) setPrevious(batches[batchKey]);
	}, [batchKey, batches[batchKey]]);
	useEffect(() => {
		if (ready)
			try {
				sessionStorage.setItem(
					storage,
					JSON.stringify({ batches, previous, positions: positions.current }),
				);
			} catch {}
	}, [batches, previous, ready]);
	// Search owns scroll restoration only inside a marked search journey.
	useEffect(() => {
		if (!active) return;
		document.documentElement.setAttribute(
			"data-custom-scroll",
			"search-journey",
		);
		return () => document.documentElement.removeAttribute("data-custom-scroll");
	}, [active]);
	useEffect(() => {
		if (!active || !ready) return;
		const target = positions.current[url] ?? 0;
		let frame = 0,
			restoring = true;
		const started = performance.now();
		const restore = () => {
			window.scrollTo({ top: target, behavior: "instant" });
			if (Math.abs(scrollY - target) < 2 || performance.now() - started > SCROLL_RESTORE_MS)
				restoring = false;
			else frame = requestAnimationFrame(restore);
		};
		frame = requestAnimationFrame(restore);
		const save = () => {
			if (!restoring) {
				positions.current[url] = scrollY;
				try {
					sessionStorage.setItem(
						storage,
						JSON.stringify({
							...JSON.parse(sessionStorage.getItem(storage) ?? "{}"),
							positions: positions.current,
						}),
					);
				} catch {}
			}
		};
		const cancel = () => {
			restoring = false;
			cancelAnimationFrame(frame);
		};
		window.addEventListener("scroll", save, { passive: true });
		window.addEventListener("wheel", cancel, { passive: true });
		window.addEventListener("touchstart", cancel, { passive: true });
		window.addEventListener("pagehide", save);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", save);
			window.removeEventListener("wheel", cancel);
			window.removeEventListener("touchstart", cancel);
			window.removeEventListener("pagehide", save);
		};
	}, [url, active, ready]);
	const metadata = new Map(
		batch?.metadata.map((m) => [`${m.media_type}:${m.tmdb_id}`, m]) ?? [],
	);
	const dedupe = (source: Batch | null | undefined, meta = metadata) => {
		const identities = new Set<string>();
		return (source?.rows ?? []).filter((r) => {
			if (r.type !== "movie" && r.type !== "show") return true;
			const m = meta.get(r.key);
			if (m?.adult === true || r.adult === true) return false;
			const key = m?.imdb_id ? `imdb:${m.imdb_id}` : r.key;
			if (identities.has(key)) return false;
			identities.add(key);
			return true;
		});
	};
	const candidates = dedupe(batch);
	// Chips describe the current request only: the streamed reading while its results
	// are on their way, then the reading stored with the batch. Batches saved before
	// readings existed have none.
	const chips: ReadingChip[] =
		batch?.q === q
			? (batch.reading ?? [])
			: reading?.q === q
				? reading.chips
				: [];
	const watch = useQuery<{
		results: { key: string; result: { state: string } }[];
	}>({
		queryKey: [
			"search-watchability",
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
			});
			if (!response.ok) throw new Error("Availability check failed");
			return response.json();
		},
	});
	const watchState = (row: Row) =>
		watch.data?.results.find((x) => x.key === row.key.replace(":", "-"))?.result
			.state;
	const watchable = (row: Row) => watchState(row) === "watchable";
	const rows = candidates.filter(
		(r) =>
			// Retrieval applied these already; title matches still need the check.
			matchesRow(filters, {
				type: r.type,
				year: r.year,
				genres: metadata.get(r.key)?.genres ?? r.discovery?.genres,
			}) &&
			(mode !== "only" ||
				serviceIds.length === 0 ||
				watch.isFetching ||
				!watch.data ||
				// Retrieval already applied the streaming filter, so keep titles with
				// unknown availability and drop only confirmed mismatches.
				(streaming ? watchState(r) !== "no_match" : watchable(r))),
	);
	if (mode === "prefer" && watch.data)
		rows.sort((a, b) => Number(watchable(b)) - Number(watchable(a)));
	const sequence = rows.filter((r) => r.type === "movie" || r.type === "show");
	const current = location.pathname.match(/^\/(movie|show)\/(\d+)/);
	const currentKey = current ? `${current[1]}:${Number(current[2])}` : null;
	const index = sequence.findIndex((r) => r.key === currentKey);
	const pageCount = Math.max(1, Math.ceil(rows.length / 20));
	const parsedPage = Number(setting("page", "1"));
	const page = Math.min(
		pageCount,
		Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
	);
	const pageRows = rows.slice((page - 1) * 20, page * 20);
	const detailHref = (row: Row) =>
		`/${row.type}/${Number(row.key.split(":")[1])}?${makeParams({
			q: batch?.q ?? q,
			page: String(
				Math.floor(
					Math.max(
						0,
						rows.findIndex((r) => r.key === row.key),
					) / 20,
				) + 1,
			),
		})}`;
	const update = (changes: Record<string, string | null>) =>
		navigate(`${location.pathname}?${makeParams({ page: null, ...changes })}`, {
			preventScrollReset: true,
		});
	// The server filters during retrieval, so a filtered and an unfiltered search are
	// different result sets. Offer the unfiltered search without claiming a count.
	const filtersActive =
		!!filtersKey || (mode === "only" && serviceIds.length > 0);
	// The shown batch was fetched with other filters and is only narrowed locally.
	const refining =
		active &&
		ready &&
		!!config.data &&
		requested === q &&
		q.trim().length >= MIN_QUERY_LENGTH &&
		!batches[batchKey] &&
		!search.error;
	const loading =
		refining ||
		active &&
		draft.trim().length >= MIN_QUERY_LENGTH &&
		(search.isFetching ||
			requested !== q ||
			draft !== q ||
			!ready ||
			config.isLoading);
	const status = loading
		? refining && draft === q && batch?.q === q
			? `Refining results for “${q}”… ${rows.length} matching so far.`
			: `Searching for “${draft}”…${batch ? ` Showing “${batch.q}” until ready.` : ""}`
		: search.error || config.error
			? (search.error || config.error)!.message
			: batch
				? `${rows.length} results in this search for “${batch.q}”${batch.errors.length ? ` · ${batch.errors.join("; ")}` : ""}`
				: "Search for a title, a person, or describe what you want to watch.";
	return {
		active,
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
		filtersActive,
		clearFiltersHref: `${location.pathname}?${makeParams({ ...Object.fromEntries(refinements.filter((key) => key !== "country").map((key) => [key, null])), page: null })}`,
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
		chips,
		watch,
		mode,
		serviceIds,
		watchable,
		openRow: (row: Row) => {
			positions.current[url] = scrollY;
			setOpen(false);
			navigate(detailHref(row));
		},
		retry: () => {
			setBatches((old) => {
				const next = { ...old };
				delete next[batchKey];
				return next;
			});
			setRevision((n) => n + 1);
		},
		remember: () => {
			positions.current[url] = scrollY;
			setOpen(false);
		},
	};
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export const useSearchJourney = () => useContext(Context);
export function SearchJourneyProvider({ children }: { children: ReactNode }) {
	const value = useController();
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

const chipStyle: Record<ReadingChip["kind"], string> = {
	attribute: "bg-cyan-400/10 text-cyan-200",
	want: "bg-cyan-400/10 text-cyan-200",
	excluded: "bg-rose-400/10 text-rose-200",
	avoid: "bg-rose-400/10 text-rose-200",
	phrase: "bg-amber-400/10 text-amber-200",
};
// What the search understood, shown inside the open search box as soon as the
// interpretation arrives. The row keeps one chip line of height even when empty,
// so the box doesn't jump when chips come and go.
function ReadingChips() {
	const j = useSearchJourney()!;
	const row = "flex flex-wrap items-center gap-1 pt-2 min-h-8 text-xs";
	if (!j.chips.length) {
		const query = j.draft.trim();
		const empty =
			query.length < MIN_QUERY_LENGTH
				? "Describe a mood, a story, or a title. The search shows what it understood here."
				: j.loading
					? "Reading your request…"
					: j.batch?.q === j.q
						? "Title and name matches only for this search."
						: "Waiting for the search to start…";
		return (
			<p
				className={`${row} text-gray-500 ${j.loading && query.length >= MIN_QUERY_LENGTH ? "animate-pulse motion-reduce:animate-none" : ""}`}
			>
				{empty}
			</p>
		);
	}
	return (
		<ul aria-label="How the search read your request" className={row}>
			<li className="text-gray-500 mr-1">Looking for</li>
			{j.chips.map((chip) => (
				<li
					key={`${chip.kind}:${chip.text}`}
					className={`rounded px-2 py-0.5 ${chipStyle[chip.kind]}`}
				>
					{chip.text}
				</li>
			))}
		</ul>
	);
}
export function JourneyHeader() {
	const j = useSearchJourney()!;
	const container = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const outside = (e: PointerEvent) => {
			if (!container.current?.contains(e.target as Node)) j.setOpen(false);
		};
		document.addEventListener("pointerdown", outside);
		return () => document.removeEventListener("pointerdown", outside);
	}, []);
	const dismiss = () => {
		j.setOpen(false);
		j.input.current?.blur();
	};
	return (
		<div ref={container} className="search-private ph-no-capture sentry-mask">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (j.focused >= 0 && j.sequence[j.focused]) {
						j.openRow(j.sequence[j.focused]);
						return;
					}
					j.commit(j.draft);
					j.setOpen(true);
				}}
			>
				{/* Open, the box grows downward and shows the reading chips under the input. */}
				<div
					className={`rounded-md border-2 border-slate-700 bg-gray-800 px-3 py-2 text-gray-200 ${j.open ? "absolute top-2 left-0 w-full z-10 min-h-12 bg-slate-800" : "h-9 min-w-24 max-w-52"}`}
				>
					<div className={`flex items-center gap-2 ${j.open ? "min-h-8" : "h-full"}`}>
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
						maxLength={MAX_QUERY_LENGTH}
						data-ph-no-capture
						placeholder={j.open ? "A title, a person, or a story…" : "Search…"}
						className="w-full min-w-0 bg-transparent border-0 outline-none text-sm sm:text-base"
						value={j.draft}
						onFocus={() => j.setOpen(true)}
						onChange={(e) => {
							j.changeQuery(e.target.value);
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault();
								dismiss();
							}
							if (e.key === "ArrowDown" || e.key === "ArrowUp") {
								e.preventDefault();
								const indices = j.pageRows
									.filter((r) => r.type !== "person")
									.map((r) =>
										j.sequence.findIndex((item) => item.key === r.key),
									);
								j.setFocused((n) => {
									if (!indices.length) return -1;
									const current = indices.indexOf(n);
									const next =
										current < 0
											? e.key === "ArrowDown"
												? 0
												: indices.length - 1
											: (current +
													(e.key === "ArrowDown" ? 1 : -1) +
													indices.length) %
												indices.length;
									return indices[next];
								});
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
					{j.open && <ReadingChips />}
				</div>
			</form>
		</div>
	);
}
function HiddenResultsLink({ titlesOnly = false }: { titlesOnly?: boolean }) {
	const j = useSearchJourney()!;
	if (!j.filtersActive || j.loading || j.batch?.q !== j.q) return null;
	return (
		<Link
			prefetch={titlesOnly ? "render" : "intent"}
			to={j.clearFiltersHref}
			preventScrollReset
			className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
			onClick={() => j.setOpen(false)}
		>
			Search without filters
		</Link>
	);
}
function JourneyList({ compact = false }: { compact?: boolean }) {
	const j = useSearchJourney()!;
	const variant = useVariant(GRID_VARIANTS);
	return (
		<section aria-label="Search results" className="min-w-0">
			<div
				role="status"
				className={`flex flex-wrap items-center gap-2 px-4 py-3 min-h-14 text-sm ${j.loading ? "text-cyan-200 bg-cyan-400/10" : "text-gray-400"}`}
			>
				{j.loading && (
					<ArrowPathIcon
						aria-hidden="true"
						className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none"
					/>
				)}
				<span>{j.status}</span>
				<HiddenResultsLink />
				{j.batch?.errors.length ||
				j.status.startsWith("Search is unavailable") ? (
					<button onClick={j.retry} className="ml-2 underline text-cyan-300">
						Retry
					</button>
				) : null}
			</div>
			{variant === "B" && <VariantB />}
			{variant === "C" && <VariantC />}
			{variant === "D" && <VariantD />}
			{variant === "E" && <VariantE />}
			{variant === "F" && <VariantF />}
			{variant === "A" && (
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
									{/* The highlight already shows title matches; only a match on the
									    original name, which is not displayed, needs a chip. */}
									{r.lexical > 0 && r.match.endsWith("(original name)") && (
										<span className="rounded bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">
											Matches original name
										</span>
									)}
									{r.discovery?.reasons
										.filter((x) => x.kind !== "mismatch")
										.slice(0, compact ? RESULT_CHIPS_COMPACT : RESULT_CHIPS)
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
								{/* Rows without offer evidence stay quiet: retrieval already
								    matched them to the selected services. */}
								{!compact && j.mode !== "all" && j.watchable(r) && (
									<p className="text-xs text-gray-400 mt-2">
										Current matching offer
									</p>
								)}
							</div>
						</>
					);
					return (
						<li key={r.key}>
							{r.type === "person" ? (
								<div className="flex gap-3 p-4">{body}</div>
							) : (
								<Link
									prefetch="intent"
									data-result={r.key}
									to={j.detailHref(r)}
									onClick={j.remember}
									className={`flex gap-3 p-4 hover:bg-gray-800 focus-visible:outline focus-visible:outline-cyan-300 ${j.currentKey === r.key || j.focused === j.sequence.findIndex((item) => item.key === r.key) ? "bg-gray-800" : ""}`}
								>
									{body}
								</Link>
							)}
						</li>
					);
				})}
			</ul>
			)}
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
								prefetch="intent"
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
								prefetch="intent"
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
						? j.filtersActive
							? "No titles match these filters. Use the link above to see the results without filters."
							: "No results for this search. Try a different request."
						: "Try Heat, a favorite actor, or a description such as ‘tense but not bleak’."}
				</div>
			)}
		</section>
	);
}
type FilterKey = "type" | "streaming" | "genre" | "release"
const filterKeys: FilterKey[] = ["type", "streaming", "genre", "release"]
// Every search filter renders the matching Discover section, so both pages
// share one look. Only the URL parameters differ.
export function JourneyFilters() {
	const j = useSearchJourney()!
	const [added, setAdded] = useState<FilterKey[]>([])
	const [editing, setEditing] = useState<FilterKey | null>(null)
	const { data: genres = [] } = useGenres()
	const hasValue: Record<FilterKey, boolean> = {
		type: j.setting("type", "all") !== "all",
		streaming: Boolean(j.setting("streamingPreset")),
		genre: Boolean(j.setting("genre")),
		release: Boolean(j.setting("minYear") || j.setting("maxYear")),
	}
	const visible = filterKeys.filter((k) => added.includes(k) || hasValue[k])
	const reset = () => {
		j.update(
			Object.fromEntries(
				refinements.filter((k) => k !== "country").map((k) => [k, null]),
			),
		)
		setAdded([])
		setEditing(null)
	}
	// Closing the editor keeps the chip only when the filter has a value.
	const close = (field: FilterKey) => {
		setAdded((a) => a.filter((k) => k !== field))
		setEditing(null)
	}
	const section = (field: FilterKey) => ({
		editing: editing === field,
		onEdit: () => setEditing(field),
		onClose: () => close(field),
	})
	return (
		<div aria-label="Search filters" className="relative">
			<div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-300">
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={j.setting("lesserKnown") === "1"}
						onChange={(e) =>
							j.update({ lesserKnown: e.target.checked ? "1" : null })
						}
					/>
					Include lesser-known titles
				</label>
			</div>
			<div className="flex flex-wrap items-stretch gap-1 mb-3 text-sm">
				{visible.includes("type") && (
					<SectionType
						value={hasValue.type ? (j.setting("type") as TitleType) : undefined}
						onChange={(type) => j.update({ type: type ?? null })}
						{...section("type")}
					/>
				)}
				{visible.includes("streaming") && (
					<SectionStreaming
						params={{
							streamingPreset:
								(j.setting("streamingPreset") as StreamingPreset) || undefined,
							withStreamingProviders: j.setting("services"),
							country: j.setting("country"),
						}}
						presets={["mine", "custom"]}
						defaultPreset="custom"
						onChange={(changes) =>
							j.update({
								...("streamingPreset" in changes
									? { streamingPreset: changes.streamingPreset ?? null }
									: {}),
								...("withStreamingProviders" in changes
									? { services: changes.withStreamingProviders || null }
									: {}),
								...(changes.country ? { country: changes.country } : {}),
							})
						}
						{...section("streaming")}
					/>
				)}
				{visible.includes("genre") && (
					<SectionGenre
						params={{
							withGenres: genres
								.filter((g) => j.setting("genre").split(",").includes(g.name))
								.map((g) => g.id)
								.join(","),
						}}
						onChange={({ withGenres }) =>
							j.update({
								genre:
									genres
										.filter((g) => withGenres.split(",").includes(String(g.id)))
										.map((g) => g.name)
										.join(",") || null,
							})
						}
						{...section("genre")}
					/>
				)}
				{visible.includes("release") && (
					<SectionRelease
						params={{
							minYear: j.setting("minYear") || undefined,
							maxYear: j.setting("maxYear") || undefined,
						}}
						initializeOnEdit={false}
						onChange={(years) =>
							j.update({
								minYear: years.minYear || null,
								maxYear: years.maxYear || null,
							})
						}
						{...section("release")}
					/>
				)}
				<AddFilterMenu
					options={filterKeys
						.filter((k) => !visible.includes(k))
						.map((k) => ({
							key: k,
							label: discoverFilters[k].label,
							color: discoverFilters[k].color,
						}))}
					onSelect={(field) => {
						setAdded((a) => [...a, field])
						setEditing(field)
					}}
				/>
				{visible.length > 0 && (
					<button
						type="button"
						className="text-xs text-gray-400 px-2 cursor-pointer hover:text-white"
						onClick={reset}
					>
						Reset
					</button>
				)}
			</div>
			{j.watch.isError && (
				<p className="mb-3 text-xs text-amber-200">
					Availability could not be checked; results remain visible.
				</p>
			)}
		</div>
	)
}
export function JourneyNavigation({
	current,
}: { current: { tmdb_id: number; media_type: string; title: string } }) {
	const j = useSearchJourney()!;
	const [expanded, setExpanded] = useState(false);
	if (!j.batch || !j.q || (!j.sequence.length && !j.filtersActive)) return null;
	return (
		<nav
			aria-label="Search result navigation"
			data-ph-no-capture
			className="search-private ph-no-capture sentry-mask border-b border-cyan-400/20 bg-gray-900"
		>
			<div className="mx-auto max-w-7xl px-4 py-3 text-sm">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Link
						prefetch="render"
						to={j.resultsHref({ q: j.batch.q })}
						onClick={() => j.setOpen(false)}
						className="text-cyan-300 max-w-full truncate"
					>
						← Results for “{j.batch.q}”
					</Link>
					<div className="flex items-center gap-3">
						{j.index > 0 ? (
							<Link
								prefetch="render"
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
								: j.sequence.length
									? "Outside filters"
									: j.loading
									? "Refining results…"
									: "No titles match these filters"}
						</span>
						{j.index >= 0 && j.index < j.sequence.length - 1 ? (
							<Link
								prefetch="render"
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
					<HiddenResultsLink titlesOnly />
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
						<JourneyFilters />
					</div>
				)}
			</div>
		</nav>
	);
}
export function JourneyResultsPage() {
	return (
		<div className="search-private ph-no-capture sentry-mask mx-auto max-w-7xl p-4 sm:p-6 pb-36">
			<h1 className="text-3xl text-white mt-2 mb-5">Find your next watch</h1>
			<div className="mb-4">
				<JourneyFilters />
			</div>
			<div className="min-w-0 rounded-xl border border-gray-700 bg-gray-950/30">
				<JourneyList />
			</div>
			<VariantSwitcher variants={GRID_VARIANTS} names={GRID_NAMES} />
		</div>
	);
}
