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
import { type Row } from "./search-model";
import { foundSoFar, selectReading, showsNoResults } from "./search-partial";
import {
	SEARCH_PAGE_UNAVAILABLE,
	preloadSearchRequest,
	requestSearch,
} from "./search-client";
import type { SearchBatch } from "~/server/combined-search/search.server";
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server";
import {
	type SearchFilters,
	matchesRow,
	searchFiltersKey,
} from "~/server/combined-search/search-filters";
import { useUserSettings } from "~/routes/api.user-settings.get";
import { titlePath } from "~/utils/helpers";

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

type Batch = SearchBatch & { cacheKey: string };
const path = "/search";
const storage = "goodwatch_search_journey_v1";
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
	// The result under the keyboard highlight, by its key: the list reorders when the completed answer replaces a
	// partial one, and an index would then point at another title.
	const [focusedKey, setFocusedKey] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [batches, setBatches] = useState<Record<string, Batch>>({});
	const [previous, setPrevious] = useState<Batch | null>(null);
	// Partial packets are ephemeral: only a completed answer enters batches/storage. Kept by batch key, so the
	// partial list stays through a retry of the same search.
	const [provisional, setProvisional] = useState<{ key: string; batch: Batch } | null>(null);
	const requestGeneration = useRef(0);
	const liveSearch = useRef("");
	// The interpretation arrives before the results, so it is kept apart from the batch, under the batch key of the
	// search it was streamed for: the same query with other filters is another search.
	const [reading, setReading] = useState<{
		key: string;
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
		next.delete("variant");
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
	// Search is Discover's search mode: the header's box only holds the text until Enter, which opens Discover with
	// the query.
	const changeQuery = (value: string) => {
		editing.current = value;
		setDraft(value);
		setFocusedKey(null);
	};
	const commit = (value: string) => {
		const text = value.trim();
		setOpen(false);
		input.current?.blur();
		navigate(text ? `/discover?q=${encodeURIComponent(text)}` : "/discover");
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
		setFocusedKey(null);
	}, [q, navigationType, location.search]);
	useEffect(() => {
		if (!active || !ready) return;
		const timer = setTimeout(() => setRequested(q), QUERY_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [q, active, ready]);
	// The code for the search request isn't in the app shell. It loads while the search configuration does.
	useEffect(() => {
		if (active) preloadSearchRequest();
	}, [active]);

	// The version only keys search batches, so it loads with the search page. The controller runs on every page,
	// and without this condition every page load and every tab focus asked for it.
	const config = useQuery<{ version: string }>({
		queryKey: ["search-policy"],
		enabled: active,
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
	// Search all titles even when the query names people inside a longer phrase.
	const allTitles = setting("allTitles") === "1";
	const basePolicyKey = `${config.data?.version ?? "pending"}:false:${setting("lesserKnown") === "1"}${allTitles ? ":allTitles" : ""}`;
	const policyKey = `${basePolicyKey}${filtersKey ? `:${filtersKey}` : ""}`;
	const batchKey = `${policyKey}:${q}`;
	const requestIdentity = `${batchKey}:${revision}`;
	liveSearch.current = active ? requestIdentity : "";
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
			const generation = ++requestGeneration.current;
			// Another search's partial list goes; this search's own stays until its next packet or its completed answer.
			setProvisional((old) => (old?.key === batchKey ? old : null));
			const current = () => !signal.aborted && liveSearch.current === requestIdentity && requestGeneration.current === generation;
			const batch = await requestSearch({
				body: {
					q: requested,
					includeAdult: false,
					lesserKnown: setting("lesserKnown") === "1",
					filters,
					allTitles,
				},
				signal,
				onReading: (chips) => {
					if (current()) setReading({ key: batchKey, chips });
				},
				onProgress: (batch) => {
					if (current()) setProvisional({
						key: batchKey,
						batch: { ...batch, q: requested, cacheKey: batchKey },
					});
				},
				unavailable: SEARCH_PAGE_UNAVAILABLE,
			});
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
			// The completed answer replaces its partial list for good.
			setProvisional((old) =>
				old?.key === search.data.cacheKey ? null : old,
			);
		}
	}, [search.data]);
	// While a filtered fetch is pending, narrow the unfiltered batch of this query
	// when it is cached: it holds more matches than another filtered batch.
	const unfilteredKey = `${basePolicyKey}:${q}`;
	const partial =
		provisional?.key === batchKey && !batches[batchKey]
			? provisional.batch
			: null;
	const batch = q
		? (batches[batchKey] ??
			partial ??
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
	// Chips describe the current request only, filters and allTitles included: the streamed
	// reading while its results are on their way, then the reading stored with the batch.
	// Batches saved before readings existed have none. A partial list sent ahead of the
	// ranking has no reading of its own, so the streamed one stays. A batch of this query
	// that is only narrowed locally shows no reading: it was read for another request.
	const pendingRanking = Boolean(partial?.pendingRanking) && batch === partial;
	const chips: ReadingChip[] =
		selectReading(
			batchKey,
			batch
				? { key: batch.cacheKey, reading: batch.reading, pendingRanking }
				: null,
			reading,
		) ?? [];
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
	// Nothing is focused once the title has left the shown page.
	const focusedRow =
		(focusedKey !== null &&
			pageRows.find(
				(r) =>
					r.key === focusedKey && (r.type === "movie" || r.type === "show"),
			)) ||
		null;
	const detailHref = (row: Row) =>
		`${titlePath(row.type, Number(row.key.split(":")[1]), row.title)}?${makeParams({
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
	const pendingTitleLookup = Boolean(partial);
	// The search failed after its partial list arrived, and nothing is on its way.
	const lateFailure = pendingTitleLookup && !loading && Boolean(search.error);
	// A partial list can name people without a title row yet: the count says so, with the people shown above the titles.
	const partialPeople =
		partial && batch === partial ? (partial.people?.length ?? 0) : 0;
	const soFar = foundSoFar(rows.length, partialPeople);
	// The people stay on screen when the search fails after them, so the empty list does not say it found nothing.
	const noResults = showsNoResults(rows.length, Boolean(loading), partialPeople);
	const status = pendingRanking
		? lateFailure
			? `The search could not finish. Showing the ${soFar} found so far.`
			: `Still ranking${partial?.pendingTitleLookup ? " and checking title matches" : " results"}. ${soFar} so far.`
		: pendingTitleLookup
		? lateFailure
			? `Title matches could not finish. Showing the ${soFar} found so far.`
			: `Still checking title matches. ${soFar} so far.`
		: loading
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
		focusedRow,
		setFocusedKey,
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
		lateFailure,
		noResults,
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
		return (
			<p className={`${row} text-gray-500`}>
				Describe a mood, a story, or a title, then press Enter.
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
					if (j.focusedRow) {
						j.openRow(j.focusedRow);
						return;
					}
					j.commit(j.draft);
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
								const keys = j.pageRows
									.filter((r) => r.type === "movie" || r.type === "show")
									.map((r) => r.key);
								j.setFocusedKey((key) => {
									if (!keys.length) return null;
									const current = key === null ? -1 : keys.indexOf(key);
									const next =
										current < 0
											? e.key === "ArrowDown"
												? 0
												: keys.length - 1
											: (current +
													(e.key === "ArrowDown" ? 1 : -1) +
													keys.length) %
												keys.length;
									return keys[next];
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
export function JourneyNavigation({
	current,
}: { current: { tmdb_id: number; media_type: string; title: string } }) {
	const j = useSearchJourney()!;
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
				</div>
				{j.index < 0 && (
					<p className="text-xs text-gray-400 mt-2">
						{current.title} stays open. Return to results to choose a matching
						title.
					</p>
				)}
			</div>
		</nav>
	);
}
