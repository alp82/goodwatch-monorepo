// PROTOTYPE - throwaway. Round 4 variant 10 (copy of variant 6's): the Search segment's panel body. Idle: the current search (with its Read
// as) and one example of each kind the search understands (a mood, a title, "like" a title). Typing: "Search: <text>",
// up to four titles from the site's quick title search, each with "Like this" (sets Similar to), and a quiet link that
// looks the words up among the filters.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { FilmIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { type TitleKey, titleKey } from "~/utils/title-key"
import type { ProtoDiscover } from "../kit"
import { PRIVATE } from "./R4-10-parts"

const LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const POSTER = "https://image.tmdb.org/t/p/w92"

function useDebounced<T>(value: T, ms = 200): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

export interface FoundTitle {
	key: TitleKey
	title: string
	year: string
	poster: string | null
}

/** The site's quick title search (the header typeahead and the title pickers use it). */
export function useQuickTitles(text: string) {
	const term = useDebounced(text.trim())
	const { locale } = useLocale()
	const q = useQuery<{
		searchResults: {
			id: number
			media_type: "movie" | "show" | "person"
			title?: string
			name?: string
			release_date?: string
			first_air_date?: string
			poster_path?: string | null
		}[]
	}>({
		queryKey: ["filter-title-search", term, locale.language],
		queryFn: async () => (await fetch(mediaLanguageUrl(`/api/search?query=${encodeURIComponent(term)}`, locale.language))).json(),
		enabled: term.length >= 2,
		staleTime: 60_000,
	})
	const found: FoundTitle[] = (term.length >= 2 ? (q.data?.searchResults ?? []) : [])
		.filter((r) => r.media_type === "movie" || r.media_type === "show")
		.slice(0, 4)
		.map((r) => ({
			key: titleKey(r.media_type as "movie" | "show", r.id),
			title: r.title ?? r.name ?? "",
			year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
			poster: r.poster_path ?? null,
		}))
	return { found, loading: text.trim().length >= 2 && (q.isFetching || term !== text.trim()) }
}

/** Adds a title to Similar to. */
export const likeTitle = (d: ProtoDiscover, key: TitleKey) =>
	d.filters.set({ similarTo: [...new Set([...(d.filters.state.similarTo ?? []), key])] })

const SEVERANCE = titleKey("show", 95396)

type Example = { kind: string; text: string; icon: "mood" | "title" | "like"; like?: TitleKey }
const EXAMPLES: Example[] = [
	{ kind: "Mood", text: "cozy rainy day mystery", icon: "mood" },
	{ kind: "Title", text: "The Bear", icon: "title" },
	{ kind: "Similar", text: "like Severance", icon: "like", like: SEVERANCE },
]

function KindIcon({ icon }: { icon: Example["icon"] }) {
	if (icon === "title") return <FilmIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
	if (icon === "like") return <SparklesIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
	return <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
}

const ROW =
	"flex min-w-0 items-center gap-3 rounded-xl px-3 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"

export function SearchExamples({ onRun, onLike }: { onRun: (t: string) => void; onLike: (k: TitleKey) => void }) {
	return (
		<div>
			<h3 className={`${LABEL} mb-1 px-3 text-gray-500`}>Try</h3>
			{EXAMPLES.map((e) => (
				<button key={e.text} type="button" onClick={() => (e.like ? onLike(e.like) : onRun(e.text))} className={`${ROW} h-11 w-full`}>
					<KindIcon icon={e.icon} />
					<span className="min-w-0 flex-1 truncate text-[15px] text-gray-200">{e.text}</span>
					<span className="shrink-0 text-[12px] text-gray-500">{e.kind}</span>
				</button>
			))}
		</div>
	)
}

export function CurrentSearch({ d }: { d: ProtoDiscover }) {
	if (!d.q) return null
	return (
		<div className="rounded-2xl bg-amber-500/[0.07] px-4 py-3 ring-1 ring-inset ring-amber-400/25">
			<div className="flex items-center gap-3">
				<span className={`${LABEL} shrink-0 text-amber-300/90`}>Searching</span>
				<span className={`brand-header min-w-0 flex-1 truncate text-[19px] text-white ${PRIVATE}`}>{d.q}</span>
				<button
					type="button"
					onClick={() => d.setQ(null)}
					className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-4 w-4" aria-hidden />
					Clear
				</button>
			</div>
			{d.reading.length > 0 && (
				<div className="mt-2 flex max-h-7 flex-wrap items-center gap-2 overflow-hidden">
					<span className="text-[12px] text-gray-400">Read as</span>
					<ReadAsChips reading={d.reading} />
				</div>
			)}
		</div>
	)
}

export function SearchRun({ text, onRun }: { text: string; onRun: (t: string) => void }) {
	return (
		<button
			type="button"
			onClick={() => onRun(text)}
			className="flex h-14 w-full min-w-0 items-center gap-3 rounded-2xl bg-amber-400/[0.12] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<MagnifyingGlassIcon className="h-4.5 w-4.5 shrink-0 text-amber-300" aria-hidden />
			<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
			<span className={`brand-header min-w-0 flex-1 truncate text-[19px] text-white ${PRIVATE}`}>{text}</span>
			<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
				<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
				Enter
			</kbd>
		</button>
	)
}

/** Up to four titles named like the words; the rows keep their height while results arrive. */
export function TitleMatches({
	d,
	text,
	onRun,
	onLike,
}: { d: ProtoDiscover; text: string; onRun: (t: string) => void; onLike: (k: TitleKey) => void }) {
	const { found, loading } = useQuickTitles(text)
	const liked = new Set(d.filters.state.similarTo ?? [])
	return (
		<div>
			<h3 className={`${LABEL} mb-1 flex h-5 items-center gap-2 px-3 text-gray-500`}>Titles</h3>
			<div className="flex h-[224px] flex-col">
				{found.map((t) => (
					<div key={t.key} className="flex h-14 min-w-0 items-center gap-1 rounded-xl hover:bg-white/[0.04]">
						<button type="button" onClick={() => onRun(t.title)} className={`${ROW} h-full min-w-0 flex-1 hover:bg-transparent`}>
							<span className="block h-11 w-[30px] shrink-0 overflow-hidden rounded-[5px] bg-white/[0.06]">
								{t.poster && <img src={`${POSTER}${t.poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[15px] font-semibold text-gray-100">{t.title}</span>
								<span className="block text-[12px] text-gray-500">{t.year || " "}</span>
							</span>
						</button>
						<button
							type="button"
							onClick={() => onLike(t.key)}
							disabled={liked.has(t.key)}
							className="mr-2 h-8 shrink-0 rounded-full bg-white/[0.07] px-3 text-[13px] font-semibold text-gray-100 cursor-pointer outline-none hover:bg-white/[0.13] focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:bg-transparent disabled:text-amber-300/80"
						>
							{liked.has(t.key) ? "In Similar to" : "Like this"}
						</button>
					</div>
				))}
				{loading && found.length === 0 &&
					[0, 1, 2].map((i) => (
						<div key={i} className="flex h-14 items-center gap-3 px-3">
							<span className="h-11 w-[30px] rounded-[5px] bg-white/[0.05]" />
							<span className="h-3 w-40 rounded bg-white/[0.05]" />
						</div>
					))}
				{!loading && found.length === 0 && <p className="px-3 py-3 text-[13px] text-gray-500">No titles by that name</p>}
			</div>
		</div>
	)
}

export function FindInFilters({ text, onFind }: { text: string; onFind: (t: string) => void }) {
	return (
		<button
			type="button"
			onClick={() => onFind(text)}
			className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-3 text-[13px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
			<span className="truncate">
				Find “<span className={PRIVATE}>{text}</span>” in filters
			</span>
		</button>
	)
}
