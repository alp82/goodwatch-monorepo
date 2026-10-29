// PROTOTYPE (Discover lab, section "titles"): what every titles variant shares.
// - useTitleUses: the three ways a found title narrows the list (Similar to, Loved, Disliked), read from and written to
//   d.filters. Loved and Disliked exclude each other (as in the sheet's pickers); Similar to is independent.
// - useKnown: names and posters for picked titles (what a pick told us, else the names lookup).
// - useSearchPreview: what "Search: <text>" would return, before running it. The same request and query keys as
//   kit.tsx, so running the search afterwards is instant and the preview is exactly what the grid will show.
import {
	ArrowTopRightOnSquareIcon,
	ArrowTurnDownLeftIcon,
	HandThumbDownIcon,
	HeartIcon,
	MagnifyingGlassIcon,
	Square2StackIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { searchEligibility, searchText } from "~/domain/discover-search"
import type { DiscoverResults } from "~/server/discover-results.server"
import { runDiscoverSearch } from "~/ui/discover/discover-search-request"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { TAP } from "~/ui/filter-bar/motion"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { type ProtoDiscover, short } from "../../../kit"
import { type FoundTitle, POSTER_SM, PRIVATE, liveTitleUrl } from "../../shell-parts"

export const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

// ---------------------------------------------------------------------------------------------------------------
// Ways to use a title

export type Use = "similarTo" | "loved" | "disliked"
export const USE_ORDER: Use[] = ["similarTo", "loved", "disliked"]
export const USE: Record<Use, { label: string; icon: ReactNode; on: string; ring: string; badge: string }> = {
	similarTo: {
		label: "Similar to",
		icon: <Square2StackIcon />,
		on: "bg-rose-400/20 text-rose-100 ring-rose-300/70",
		ring: "ring-rose-300/80",
		badge: "bg-rose-400 text-gray-950",
	},
	loved: {
		label: "Loved",
		icon: <HeartIcon />,
		on: "bg-emerald-400/20 text-emerald-100 ring-emerald-300/70",
		ring: "ring-emerald-300/80",
		badge: "bg-emerald-300 text-gray-950",
	},
	disliked: {
		label: "Disliked",
		icon: <HandThumbDownIcon />,
		on: "bg-red-500/20 text-red-100 ring-red-400/70",
		ring: "ring-red-400/80",
		badge: "bg-red-400 text-gray-950",
	},
}

export function useTitleUses(d: ProtoDiscover) {
	const s = d.filters.state
	const listOf = (u: Use): TitleKey[] => s[u] ?? []
	const has = (u: Use, k: TitleKey) => listOf(u).includes(k)
	const usesOf = (k: TitleKey) => USE_ORDER.filter((u) => has(u, k))
	const toggle = (u: Use, k: TitleKey) =>
		d.filters.update((st) => {
			const list = st[u] ?? []
			const on = list.includes(k)
			const next = on ? list.filter((x) => x !== k) : [...list, k]
			const out = { ...st, [u]: next.length ? next : undefined }
			if (!on && u !== "similarTo") {
				const other = u === "loved" ? "disliked" : "loved"
				const rest = (st[other] ?? []).filter((x) => x !== k)
				out[other] = rest.length ? rest : undefined
			}
			return out
		})
	const picked = USE_ORDER.flatMap((u) => listOf(u).map((k) => ({ use: u, key: k })))
	return { has, usesOf, toggle, picked, listOf }
}
export type TitleUses = ReturnType<typeof useTitleUses>

/** Names and posters for picked titles: what a pick told us first, the names lookup after. */
export function useKnown(keys: TitleKey[]) {
	const names = useTitleNames(keys, "")
	const [seen, setSeen] = useState(() => new Map<TitleKey, FoundTitle>())
	const remember = (t: FoundTitle) => setSeen((m) => (m.has(t.key) ? m : new Map(m).set(t.key, t)))
	const known = (k: TitleKey): { title: string; year: string; poster: string | null } | undefined => {
		const s = seen.get(k)
		if (s) return s
		const n = names.byKey.get(k)
		return n ? { title: n.title, year: String(n.year ?? ""), poster: n.poster ?? null } : undefined
	}
	return { known, remember }
}

/** A few well-known titles as examples (their posters come from the names lookup). */
export const EXAMPLE_KEYS: { key: TitleKey; title: string }[] = [
	{ key: titleKey("show", 95396), title: "Severance" },
	{ key: titleKey("show", 136315), title: "The Bear" },
	{ key: titleKey("movie", 438631), title: "Dune" },
	{ key: titleKey("movie", 666277), title: "Past Lives" },
	{ key: titleKey("show", 67070), title: "Fleabag" },
	{ key: titleKey("movie", 329865), title: "Arrival" },
	{ key: titleKey("show", 70523), title: "Dark" },
	{ key: titleKey("movie", 545611), title: "Everything Everywhere All at Once" },
]
export const TITLE_EXAMPLES = ["Severance", "The Bear", "Dune"]

// ---------------------------------------------------------------------------------------------------------------
// The search preview

function useDebounced<T>(value: T, ms: number): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

/**
 * What running `text` as the search would show with the current filters: its first posters, the count, and how the
 * search reads it. Starts 0.6 s after typing stops, three letters or more.
 */
export function useSearchPreview(d: ProtoDiscover, text: string) {
	const now = searchText(text)
	const term = useDebounced(now, 600)
	const active = term !== null && term.length >= 3 && term !== d.q
	const eligibility = useMemo(() => searchEligibility(d.filters.state, { country: "US", services: [] }), [d.filters.state])
	const search = useQuery({
		queryKey: ["proto-discover-search", term, JSON.stringify(eligibility)],
		enabled: active,
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) => runDiscoverSearch(term ?? "", eligibility, true, signal, () => {}),
	})
	const ranked = active ? search.data?.ranked : undefined
	const fq = d.filters.query
	const baseQuery = ranked ? `${fq}${fq ? "&" : ""}ranked=${ranked.join(",")}` : null
	const results = useQuery<DiscoverResults[]>({
		queryKey: ["proto-discover-results", baseQuery ?? "", 1],
		enabled: baseQuery !== null,
		staleTime: 60_000,
		queryFn: async ({ signal }) => {
			const response = await fetch(`/api/discover/results?${baseQuery}${baseQuery ? "&" : ""}page=1`, { signal })
			if (!response.ok) throw new Error(`Results ${response.status}`)
			return [(await response.json()) as DiscoverResults]
		},
	})
	const first = baseQuery !== null ? results.data?.[0] : undefined
	const fresh = now !== null && now === term
	return {
		/** True while the preview isn't for the text as typed yet. */
		busy: now !== null && now.length >= 3 && (!fresh || search.isFetching || results.isFetching || (!!ranked && !first)),
		ready: fresh && active && !!first,
		failed: fresh && active && !!(search.error || results.error),
		cards: first?.cards ?? [],
		total: first?.total ?? null,
		reading: (fresh && active && search.data?.reading) || [],
	}
}
export type SearchPreview = ReturnType<typeof useSearchPreview>

// ---------------------------------------------------------------------------------------------------------------
// Pieces

export function LaneHead({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
	return (
		<h3 className={`${SECTION_LABEL} mb-3 flex h-5 items-center gap-1.5 px-1 text-gray-400`}>
			{icon && <span className="text-gray-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
			{children}
			{right && <span className="ml-auto normal-case tracking-normal font-normal">{right}</span>}
		</h3>
	)
}

export function ExampleRow({ icon, text, onClick }: { icon: ReactNode; text: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-gray-300 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span className="shrink-0 text-amber-400/70 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
			<span className="truncate">{text}</span>
		</button>
	)
}

/** The amber "Search: <text>" button that runs the text as the search. */
export function RunButton({ text, onRun, big = true }: { text: string; onRun: () => void; big?: boolean }) {
	return (
		<button
			type="button"
			onClick={onRun}
			className={`flex w-full min-w-0 items-center gap-3 rounded-2xl bg-amber-400/[0.12] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400 ${big ? "h-16" : "h-12"}`}
		>
			<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
			<span className={`brand-header min-w-0 flex-1 truncate text-white ${big ? "text-[21px]" : "text-[17px]"} ${PRIVATE}`}>{text}</span>
			<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
				<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
				Enter
			</kbd>
		</button>
	)
}

/** The search that's running now: its text, how it was read, and Clear. */
export function CurrentSearch({ d }: { d: ProtoDiscover }) {
	if (!d.q) return null
	return (
		<div className="rounded-2xl bg-amber-500/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
			<div className="flex items-center gap-3">
				<span className={`brand-header min-w-0 flex-1 truncate text-[21px] text-white ${PRIVATE}`}>{d.q}</span>
				<button
					type="button"
					onClick={() => d.setQ(null)}
					className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-4 w-4" aria-hidden />
					Clear
				</button>
			</div>
			<div className="mt-2.5 flex h-6 flex-wrap items-center gap-2 overflow-hidden">
				{d.reading.length > 0 ? (
					<>
						<span className="text-[12px] text-gray-400">Read as</span>
						<ReadAsChips reading={d.reading} />
					</>
				) : (
					<span className="text-[12px] text-gray-500">{d.searchBusy ? "Reading…" : d.total != null ? `${short(d.total)} titles` : ""}</span>
				)}
			</div>
		</div>
	)
}

/** The preview's posters, a fixed-height strip: placeholders while it loads. */
export function PreviewPosters({ p, n, w = 46 }: { p: SearchPreview; n: number; w?: number }) {
	const h = Math.round(w * 1.5)
	const cards = p.ready ? p.cards.slice(0, n) : []
	return (
		<div className="flex items-center gap-2 overflow-hidden" style={{ height: h }}>
			{p.ready && cards.length === 0 && <span className="px-1 text-[13px] text-gray-500">Nothing fits the current filters</span>}
			{p.failed && !p.ready && <span className="px-1 text-[13px] text-gray-500">No preview right now</span>}
			{cards.map((c) => (
				<a
					key={c.key}
					href={liveTitleUrl({ mediaType: c.media_type === "movie" ? "movie" : "show", tmdbId: c.tmdb_id, title: c.title })}
					target="_blank"
					rel="noreferrer"
					title={c.title}
					className="block shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					style={{ width: w, height: h }}
				>
					{c.poster_path ? (
						<img src={`${POSTER_SM}${c.poster_path}`} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
					) : (
						<span className="grid h-full place-items-center p-0.5 text-center text-[8px] leading-tight text-gray-500">{c.title}</span>
					)}
				</a>
			))}
			{!p.ready &&
				!p.failed &&
				Array.from({ length: n }, (_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
						key={i}
						className={`shrink-0 rounded-md bg-white/[0.05] ${p.busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
						style={{ width: w, height: h }}
					/>
				))}
		</div>
	)
}

/** One line: how the preview reads the text, or its count. Fixed height. */
export function PreviewLine({ p }: { p: SearchPreview }) {
	return (
		<div className="flex h-6 min-w-0 items-center gap-2 overflow-hidden">
			{p.ready && p.total != null && <span className="shrink-0 text-[12px] tabular-nums text-gray-400">{short(p.total)} titles</span>}
			{p.reading.length > 0 && (
				<>
					<span className="shrink-0 text-[12px] text-gray-500">Read as</span>
					<span className="flex min-w-0 flex-nowrap gap-1.5 overflow-hidden">
						<ReadAsChips reading={p.reading} />
					</span>
				</>
			)}
			{!p.ready && p.busy && <span className="text-[12px] text-gray-500">Looking…</span>}
		</div>
	)
}

/** The three ways to use a title, as toggles, and its page. */
export function UseButtons({
	k,
	uses,
	onUse,
	open,
	size = "md",
}: {
	k: TitleKey
	uses: TitleUses
	onUse?: () => void
	open?: string
	size?: "md" | "sm" | "icon"
}) {
	const h = size === "md" ? "h-8 px-3 text-[13px]" : size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 w-8 justify-center"
	return (
		<div className="flex shrink-0 items-center gap-1.5">
			{USE_ORDER.map((u) => {
				const on = uses.has(u, k)
				return (
					<motion.button
						key={u}
						type="button"
						whileTap={TAP}
						aria-pressed={on}
						aria-label={size === "icon" ? USE[u].label : undefined}
						title={size === "icon" ? USE[u].label : undefined}
						onClick={() => {
							onUse?.()
							uses.toggle(u, k)
						}}
						className={`flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${h} ${
							on ? USE[u].on : "bg-white/[0.06] text-gray-300 ring-white/10 hover:bg-white/[0.12] hover:text-white"
						}`}
					>
						{USE[u].icon}
						{size !== "icon" && USE[u].label}
					</motion.button>
				)
			})}
			{open && (
				<a
					href={open}
					target="_blank"
					rel="noreferrer"
					aria-label="Open page"
					title="Open page"
					className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-500 outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
				</a>
			)}
		</div>
	)
}

/** A picked title: poster with its use as a badge, tap to take it off. */
export function PickedPoster({
	t,
	use,
	onRemove,
	w = 56,
}: {
	t: { title: string; poster: string | null } | undefined
	use: Use
	onRemove: () => void
	w?: number
}) {
	return (
		<motion.button
			type="button"
			layout="position"
			whileTap={TAP}
			onClick={onRemove}
			aria-label={t ? `Remove ${t.title} (${USE[use].label})` : "Remove"}
			title={t ? `${USE[use].label} ${t.title}` : undefined}
			className="group relative shrink-0 rounded-lg cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			style={{ width: w }}
		>
			<span className={`block aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.06] ring-2 ring-offset-2 ring-offset-[#0b1120] ${USE[use].ring}`}>
				{t?.poster ? (
					<img src={`${POSTER_SM}${t.poster}`} alt="" className="h-full w-full object-cover" />
				) : (
					<span className="grid h-full place-items-center p-1 text-center text-[9px] leading-tight text-gray-400">{t?.title ?? "…"}</span>
				)}
			</span>
			<span className={`absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full ring-2 ring-[#0b1120] [&>svg]:h-3 [&>svg]:w-3 ${USE[use].badge}`}>
				{USE[use].icon}
			</span>
			<span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-950 text-gray-300 ring-1 ring-white/20 group-hover:text-white">
				<XMarkIcon className="h-3 w-3" />
			</span>
		</motion.button>
	)
}

/** Every picked title, grouped by how it's used. Nothing when none. */
export function PickedGroups({
	uses,
	known,
	w = 52,
	row = false,
	showEmpty = false,
}: {
	uses: TitleUses
	known: ReturnType<typeof useKnown>["known"]
	w?: number
	row?: boolean
	/** Also list the uses with nothing picked, as quiet labels (no empty slots). */
	showEmpty?: boolean
}) {
	const groups = USE_ORDER.map((u) => ({ u, keys: uses.listOf(u) })).filter((g) => showEmpty || g.keys.length)
	if (!groups.length) return null
	return (
		<div className={row ? "flex items-start gap-6" : "flex flex-col gap-4"}>
			{groups.map((g) => (
				<div key={g.u} className="min-w-0">
					<div className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-gray-300 [&>svg]:h-3.5 [&>svg]:w-3.5">
						{USE[g.u].icon}
						{USE[g.u].label}
						{g.keys.length > 0 && <span className="font-normal text-gray-500">{g.keys.length}</span>}
					</div>
					<div className="flex flex-wrap gap-3 px-1 pt-1">
						{g.keys.map((k) => (
							<PickedPoster key={k} t={known(k)} use={g.u} w={w} onRemove={() => uses.toggle(g.u, k)} />
						))}
					</div>
				</div>
			))}
		</div>
	)
}

export const searchIcon = <MagnifyingGlassIcon />
