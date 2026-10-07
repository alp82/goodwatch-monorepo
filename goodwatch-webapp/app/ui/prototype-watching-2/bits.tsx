// PROTOTYPE - throwaway. Pieces the pages of /prototype/watching-2 share: the service tile, tags, the segmented
// control, mood chips, the facts of a show to start, and the page head with its way to the Wishlist.
import { CheckIcon, ChevronRightIcon, PlayIcon } from "@heroicons/react/24/solid"
import type { ReactNode } from "react"
import { MOODS, MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { type Store, type Title, img } from "~/ui/prototype-watching/model"
import { DISPLAY, WRAP } from "~/ui/watch-next/style"
import { type Choice, type Facts, type Go, plural } from "./model"

export const moodName = (key: string) => MOOD_BY_KEY[key as MoodKey]?.name ?? key
export const moodHue = (key: string) => MOOD_BY_KEY[key as MoodKey]?.hue ?? "#9ca3af"

export function ServiceTile({ title, mine = true }: { title: Title; mine?: boolean }) {
	if (!title.service) return <p className="text-sm text-gray-400">Not streaming on a subscription</p>
	return (
		<span className={`relative inline-flex h-11 items-center gap-2 rounded-lg border-2 bg-white/10 pr-2.5 ${mine ? "border-green-500" : "border-white/15"}`}>
			{title.service.logo && <img src={img(title.service.logo, "w92")} alt="" className="aspect-square h-full rounded-md" />}
			<span className="truncate text-sm font-medium text-white">{title.service.name}</span>
			{mine && (
				<span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
					<CheckIcon className="h-3 w-3" aria-hidden />
				</span>
			)}
		</span>
	)
}

/** A small logo and name: where a title streams, in a row of facts. */
export function ServiceLine({ title, mine = true, className = "" }: { title: Title; mine?: boolean; className?: string }) {
	if (!title.service) return <span className={`text-gray-500 ${className}`}>Not streaming</span>
	return (
		<span className={`inline-flex min-w-0 items-center gap-1.5 ${mine ? "text-gray-200" : "text-gray-500"} ${className}`}>
			{title.service.logo && <img src={img(title.service.logo, "w92")} alt="" className={`h-5 w-5 shrink-0 rounded ${mine ? "" : "opacity-50 grayscale"}`} />}
			<span className="truncate">{title.service.name}</span>
		</span>
	)
}

/** The white key that leaves for the service. Drawn only. */
export function WatchOn({ title, className = "" }: { title: Title; className?: string }) {
	return (
		<span className={`inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40 ${className}`}>
			{title.service?.logo && <img src={img(title.service.logo, "w92")} alt="" className="h-8 w-8 rounded-md" />}
			<PlayIcon className="h-5 w-5" aria-hidden />
			{title.service ? `Watch on ${title.service.name}` : "Where to watch"}
		</span>
	)
}

const TAG = {
	next: "bg-amber-400 text-black",
	seen: "bg-sky-400 text-black",
	start: "bg-emerald-400 text-black",
	film: "bg-fuchsia-300 text-black",
	quiet: "bg-white/10 text-gray-300",
} as const
export const Tag = ({ kind, children, className = "" }: { kind: keyof typeof TAG; children: ReactNode; className?: string }) => (
	<span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${TAG[kind]} ${className}`}>{children}</span>
)

export function Segmented<K extends string>({
	value,
	onChange,
	options,
	label,
	size = "md",
}: { value: K; onChange: (key: K) => void; options: { key: K; label: ReactNode; count?: number }[]; label: string; size?: "md" | "lg" }) {
	return (
		<div role="tablist" aria-label={label} className="inline-flex max-w-full gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
			{options.map((o) => (
				<button
					key={o.key}
					type="button"
					role="tab"
					aria-selected={value === o.key}
					data-seg={o.key}
					onClick={() => onChange(o.key)}
					className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full font-bold transition-colors ${size === "lg" ? "h-12 px-4 text-base md:px-7 md:text-lg" : "h-9 px-3.5 text-sm"} ${value === o.key ? "bg-amber-400 text-black" : "text-gray-300 hover:bg-white/10"}`}
				>
					{o.label}
					{o.count != null && <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${value === o.key ? "bg-black/15" : "bg-white/10"}`}>{o.count}</span>}
				</button>
			))}
		</div>
	)
}

/** The moods some title in `counts` belongs to, as chips that toggle. Up to three. */
export function MoodChips({ picked, toggle, counts, className = "" }: { picked: string[]; toggle: (mood: string) => void; counts: Record<string, number>; className?: string }) {
	return (
		<div className={`flex gap-1.5 overflow-x-auto [scrollbar-width:none] ${className}`} data-moods>
			{MOODS.filter((m) => counts[m.key]).map((m) => {
				const on = picked.includes(m.key)
				return (
					<button
						key={m.key}
						type="button"
						aria-pressed={on}
						data-mood={m.key}
						onClick={() => toggle(m.key)}
						className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold ring-1 transition-colors ${on ? "bg-white text-black ring-white" : "bg-white/[0.06] text-gray-200 ring-white/10 hover:bg-white/15"}`}
					>
						<span className="h-2.5 w-2.5 rounded-full" style={{ background: m.hue }} />
						{m.name}
						<span className={`text-xs tabular-nums ${on ? "text-black/60" : "text-gray-400"}`}>{counts[m.key]}</span>
					</button>
				)
			})}
		</div>
	)
}

export const MoodDots = ({ moods, className = "" }: { moods: string[]; className?: string }) => (
	<span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
		{moods.map((m) => (
			<span key={m} className="inline-flex items-center gap-1 whitespace-nowrap">
				<span className="h-2 w-2 rounded-full" style={{ background: moodHue(m) }} />
				{moodName(m)}
			</span>
		))}
	</span>
)

/** On my services, with Everywhere one tap away, drawn after the filter bar's control. */
export function ServicesToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
	const half = (mine: boolean, label: string) => (
		<button
			type="button"
			aria-pressed={on === mine}
			data-services={mine ? "mine" : "all"}
			onClick={() => onChange(mine)}
			className={`h-full cursor-pointer whitespace-nowrap rounded-[10px] px-3 text-sm font-bold transition-colors ${on === mine ? (mine ? "bg-green-500/20 text-green-300 ring-1 ring-green-500/50" : "bg-white/15 text-white ring-1 ring-white/20") : "text-gray-400 hover:text-white"}`}
		>
			{label}
		</button>
	)
	return (
		<div data-services-toggle className="flex h-9 shrink-0 gap-0.5 rounded-xl bg-white/[0.06] p-0.5 ring-1 ring-white/10">
			{half(true, "On my services")}
			{half(false, "Everywhere")}
		</div>
	)
}

export function SortSelect<K extends string>({ value, onChange, options }: { value: K; onChange: (key: K) => void; options: Record<K, string> }) {
	return (
		<label className="relative flex h-9 shrink-0 items-center rounded-xl bg-white/[0.06] pl-3 text-sm font-bold text-gray-200 ring-1 ring-white/10">
			<span className="sr-only">Sort</span>
			<select value={value} onChange={(e) => onChange(e.target.value as K)} data-sort className="h-full cursor-pointer appearance-none bg-transparent pr-8 font-bold text-gray-100 outline-none">
				{(Object.keys(options) as K[]).map((k) => (
					<option key={k} value={k} className="bg-gray-900">
						{options[k]}
					</option>
				))}
			</select>
			<ChevronRightIcon className="pointer-events-none absolute right-2.5 h-4 w-4 rotate-90 text-gray-400" aria-hidden />
		</label>
	)
}

/** What starting a show costs, as three figures and whether it has ended. */
export function Cost({ facts, runtime, size = "md" }: { facts: Facts | undefined; runtime: number | null; size?: "md" | "lg" }) {
	if (!facts) return null
	const cell = (n: ReactNode, word: string) => (
		<span className="flex flex-col">
			<b className={`${DISPLAY} leading-none text-white ${size === "lg" ? "text-4xl md:text-5xl" : "text-2xl"}`}>{n}</b>
			<span className={`text-gray-400 ${size === "lg" ? "text-sm" : "text-xs"}`}>{word}</span>
		</span>
	)
	return (
		<div className={`flex flex-wrap items-end ${size === "lg" ? "gap-x-8 gap-y-3" : "gap-x-5 gap-y-2"}`} data-cost>
			{cell(facts.seasons, facts.seasons === 1 ? "season" : "seasons")}
			{cell(facts.episodes, "episodes")}
			{facts.hours != null && cell(`${facts.hours} h`, runtime ? `in all, ${runtime} min each` : "in all")}
			<Ended facts={facts} className={size === "lg" ? "mb-1" : "mb-0.5"} />
		</div>
	)
}

export const Ended = ({ facts, className = "" }: { facts: Facts; className?: string }) => (
	<span
		className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${facts.ended ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-amber-500/10 text-amber-300 ring-amber-500/30"} ${className}`}
	>
		<span className={`h-1.5 w-1.5 rounded-full ${facts.ended ? "bg-emerald-400" : "bg-amber-400"}`} />
		{facts.ended ? "Has ended" : "Still running"}
	</span>
)

/**
 * The head of a page: its name, one line, and on the right the way to the Wishlist while the Wishlist is a page of
 * its own. Where the Wishlist has dissolved, the line says that this page is the whole list.
 */
export function PageHead({
	name,
	line,
	whole,
	store,
	choice,
	go,
	children,
}: { name: string; line: string; whole: string; store: Store; choice: Choice; go: Go; children?: ReactNode }) {
	return (
		<header className={`${WRAP} flex flex-wrap items-end gap-x-6 gap-y-3 pb-4 pt-6`} data-page-head>
			<div className="min-w-0">
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{name}</h1>
				<p className="mt-1 text-sm text-gray-400">{choice.wishlist === "dissolved" ? whole : line}</p>
			</div>
			<span className="grow" />
			{children}
			{choice.wishlist === "behind" && (
				<button
					type="button"
					data-to-wishlist
					onClick={() => go("wishlist")}
					className="inline-flex h-9 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
				>
					Wishlist · {plural(store.wishlist.length, "title")}
					<ChevronRightIcon className="h-4 w-4" aria-hidden />
				</button>
			)}
		</header>
	)
}

export const Empty = ({ title, children }: { title: string; children: ReactNode }) => (
	<div className="rounded-2xl border border-dashed border-white/15 p-6" data-empty>
		<h2 className={`${DISPLAY} text-2xl text-white`}>{title}</h2>
		<div className="mt-1 max-w-xl text-sm text-gray-400">{children}</div>
	</div>
)
