// PROTOTYPE - throwaway. Shared controls for /prototype/rec-filter-bar variants.
// The three first-class controls, the "More filters" content, the result grid, and the
// "hidden by your filters" recovery. Variants arrange these; they don't share a layout.
import {
	AdjustmentsHorizontalIcon,
	CheckIcon,
	ChevronDownIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	PlusIcon,
	TvIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react"
import type { ProtoTitle } from "~/server/prototype-rec-filter-bar.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import {
	type Bar,
	type FilterKey,
	PEOPLE,
	RELEASES,
	SCORES,
	SORTS,
	TYPES,
	VIBES,
	allGenres,
	allServices,
} from "~/ui/prototype-rec-filter-bar/model"
import { goodwatchVibeIndex } from "~/utils/ratings"

// One height per size so the first-class controls line up.
const H = { sm: "h-9", md: "h-11", lg: "h-14" } as const

export const LOGO = "https://www.themoviedb.org/t/p/original"

// The Discover filter colors, so secondary filters keep the colors people already know.
export const FILTER_COLOR: Record<string, string> = {
	type: "teal",
	notSeen: "blue",
	mine: "emerald",
	providers: "emerald",
	minScore: "slate",
	similar: "rose",
	vibes: "indigo",
	genres: "amber",
	release: "cyan",
	people: "purple",
}

export function useMyServiceNames(bar: Bar) {
	const services = allServices(bar.catalog).filter((s) => bar.mine.includes(s.id))
	const names = services.slice(0, 3).map((s) => s.name)
	return { services, text: names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and ") || "your services" }
}

// ---------------------------------------------------------------- first-class controls

export function ServicesSwitch({ bar, full = false, size = "md" }: { bar: Bar; full?: boolean; size?: "sm" | "md" | "lg" }) {
	const on = bar.filters.mine
	const noServices = bar.viewer !== "member" && !on
	const pad = size === "lg" ? "px-4 text-base" : size === "sm" ? "px-2.5 text-xs" : "px-3 text-sm"
	const seg = (active: boolean) =>
		`relative h-full flex items-center justify-center gap-1.5 ${pad} font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
			active ? "text-white" : "text-gray-400 hover:text-gray-200"
		} ${full ? "flex-1" : ""}`
	return (
		<div role="radiogroup" aria-label="Where to watch" className={`relative flex ${H[size]} p-0.5 rounded-lg bg-gray-900 border-2 border-gray-800 ${full ? "w-full" : ""}`}>
			<button type="button" role="radio" aria-checked={on} className={seg(on)} onClick={() => bar.set({ mine: true, providers: [] })}>
				{on && <motion.span layoutId={`svc-${bar.viewer}`} className="absolute inset-0 rounded-md bg-linear-to-br from-emerald-700 via-emerald-900 to-emerald-800 border-2 border-white/20" />}
				<span className="relative flex items-center gap-1.5">
					{noServices ? <PlusIcon className="h-4 w-4" /> : <TvIcon className="h-4 w-4" />}
					{noServices ? "Add my services" : "On my services"}
				</span>
			</button>
			<button type="button" role="radio" aria-checked={!on} className={seg(!on)} onClick={() => bar.set({ mine: false })}>
				{!on && <motion.span layoutId={`svc-${bar.viewer}`} className="absolute inset-0 rounded-md bg-gray-700 border-2 border-white/10" />}
				<span className="relative flex items-center gap-1.5">
					<GlobeAltIcon className="h-4 w-4" />
					Everywhere
				</span>
			</button>
		</div>
	)
}

export function NotSeenToggle({ bar, size = "md", className = "" }: { bar: Bar; size?: "sm" | "md" | "lg"; className?: string }) {
	const on = bar.filters.notSeen
	const pad = `${H[size]} ${size === "lg" ? "px-4 text-base" : size === "sm" ? "px-2.5 text-xs" : "px-3 text-sm"}`
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => bar.set({ notSeen: !on })}
			className={`flex items-center justify-center gap-1.5 ${pad} font-bold rounded-lg border-2 transition-colors cursor-pointer whitespace-nowrap ${
				on ? "bg-linear-to-br from-blue-700 via-blue-900 to-blue-800 border-white/20 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200"
			} ${className}`}
		>
			<EyeSlashIcon className="h-4 w-4" />
			Not seen yet
		</button>
	)
}

// Fixed-width trigger and menu: picking an option never changes the size of either.
export function SortMenu({ bar, size = "md", align = "right", className = "" }: { bar: Bar; size?: "sm" | "md" | "lg"; align?: "left" | "right"; className?: string }) {
	const current = SORTS.find((s) => s.key === bar.filters.sort)!
	const pad = `${H[size]} ${size === "lg" ? "px-4 text-base w-52" : size === "sm" ? "px-2.5 text-xs w-36" : "px-3 text-sm w-44"}`
	return (
		<Popover
			align={align}
			width="w-60"
			className={className}
			trigger={(open) => (
				<span className={`flex items-center justify-between gap-2 ${pad} font-bold rounded-lg border-2 bg-gray-900 border-gray-800 hover:border-gray-600 text-gray-200 ${open ? "border-gray-500" : ""}`}>
					<span className="truncate">
						<span className="text-gray-400 font-normal">Sort:</span> {current.label}
					</span>
					<ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
				</span>
			)}
		>
			{(close) => (
				<div className="p-1.5">
					{SORTS.map((s) => (
						<button
							key={s.key}
							type="button"
							onClick={() => {
								bar.set({ sort: s.key })
								close()
							}}
							className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-left cursor-pointer ${s.key === bar.filters.sort ? "bg-gray-800" : "hover:bg-gray-800/60"}`}
						>
							<span>
								<span className="block text-sm font-bold text-white">{s.label}</span>
								<span className="block text-xs text-gray-400">{s.hint}</span>
							</span>
							{s.key === bar.filters.sort && <CheckIcon className="h-4 w-4 text-amber-400" />}
						</button>
					))}
				</div>
			)}
		</Popover>
	)
}

export function MoreButton({ bar, onClick, label = "More filters", size = "md", className = "" }: { bar: Bar; onClick: () => void; label?: string; size?: "sm" | "md" | "lg"; className?: string }) {
	const pad = `${H[size]} ${size === "lg" ? "px-4 text-base" : size === "sm" ? "px-2.5 text-xs" : "px-3 text-sm"}`
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-center justify-center gap-1.5 ${pad} font-bold rounded-lg border-2 bg-gray-900 border-gray-800 hover:border-amber-700/60 text-gray-200 cursor-pointer whitespace-nowrap ${className}`}
		>
			<AdjustmentsHorizontalIcon className="h-4 w-4" />
			{label}
			<span className={`min-w-5 h-5 px-1 grid place-items-center rounded-full text-xs ${bar.moreCount ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-500"}`}>{bar.moreCount}</span>
		</button>
	)
}

// ---------------------------------------------------------------- popover and sheet

export function Popover({
	trigger,
	children,
	width = "w-72",
	align = "left",
	className = "",
}: {
	trigger: (open: boolean) => ReactNode
	children: (close: () => void) => ReactNode
	width?: string
	align?: "left" | "right"
	className?: string
}) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("mousedown", onDown)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [open])
	return (
		<div ref={ref} className={`relative ${className}`}>
			<button type="button" aria-expanded={open} className="block text-left cursor-pointer" onClick={() => setOpen((o) => !o)}>
				{trigger(open)}
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.14 }}
						className={`absolute z-40 mt-2 ${width} max-w-[calc(100vw-2rem)] ${align === "right" ? "right-0" : "left-0"} rounded-xl bg-gray-900 border-2 border-gray-700 shadow-2xl shadow-black/60 text-gray-200`}
					>
						{children(() => setOpen(false))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export function Sheet({ open, onClose, bar, title = "More filters", from = "auto" }: { open: boolean; onClose: () => void; bar: Bar; title?: string; from?: "auto" | "bottom" }) {
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [open, onClose])
	const side = from === "auto" ? "lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:w-[440px] lg:rounded-none lg:border-l-2 lg:border-t-0" : "lg:left-1/2 lg:-translate-x-1/2 lg:w-[760px] lg:bottom-4 lg:rounded-2xl"
	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div className="fixed inset-0 z-[1001] bg-black/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
					<motion.div
						role="dialog"
						aria-label={title}
						initial={{ y: 40, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 40, opacity: 0 }}
						transition={{ type: "tween", duration: 0.2 }}
						className={`fixed z-[1002] inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-2xl bg-gray-950 border-t-2 border-gray-800 ${side}`}
					>
						<div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
							<h2 className="text-lg font-bold text-white">{title}</h2>
							<button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-gray-800 cursor-pointer">
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto px-5 py-4">
							<MoreFilters bar={bar} />
						</div>
						<div className="flex items-center gap-3 px-5 py-4 border-t border-gray-800">
							<button type="button" className="px-3 py-2.5 text-sm text-gray-400 hover:text-white cursor-pointer" onClick={() => bar.set({ type: "all", genres: [], minScore: 0, release: "any", providers: [], similar: null, vibes: [], people: [] })}>
								Clear more filters
							</button>
							<button type="button" onClick={onClose} className="ml-auto px-5 py-2.5 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer tabular-nums">
								Show {bar.results.length} titles
							</button>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------- secondary filters

export function Section({ label, color, children, note }: { label: string; color: string; children: ReactNode; note?: string }) {
	const bare = useContext(Bare)
	if (bare) return <div className="flex flex-wrap gap-1.5">{children}</div>
	return (
		<section className={`pl-3 border-l-4 border-${color}-700`}>
			<h3 className="text-sm font-extrabold text-white">{label}</h3>
			{note && <p className="text-xs text-gray-400">{note}</p>}
			<div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
		</section>
	)
}

export function Chip({ active, color, onClick, children, className = "" }: { active: boolean; color: string; onClick: () => void; children: ReactNode; className?: string }) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md border-2 cursor-pointer transition-colors whitespace-nowrap ${
				active ? `bg-linear-to-br from-${color}-700 via-${color}-900 to-${color}-800 border-white/30 text-white font-bold` : "bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-600"
			} ${className}`}
		>
			{children}
		</button>
	)
}

const Bare = createContext(false)

export function MoreFilters({ bar, only }: { bar: Bar; only?: string[] }) {
	// A single section inside someone else's heading (the side rail folds) drops its own heading.
	if (only?.length === 1) return <Bare.Provider value={true}><MoreFiltersInner bar={bar} only={only} /></Bare.Provider>
	return <MoreFiltersInner bar={bar} only={only} />
}

function MoreFiltersInner({ bar, only }: { bar: Bar; only?: string[] }) {
	const f = bar.filters
	const genres = allGenres(bar.catalog).slice(0, 14)
	const services = allServices(bar.catalog).slice(0, 12)
	const similarPicks = bar.catalog.slice(0, 8)
	const show = (k: string) => !only || only.includes(k)
	return (
		<div className="flex flex-col gap-6">
			{show("type") && (
				<Section label="Type" color="teal">
					{TYPES.map((t) => (
						<Chip key={t.key} color="teal" active={f.type === t.key} onClick={() => bar.set({ type: t.key })}>
							{t.label}
						</Chip>
					))}
				</Section>
			)}
			{show("genres") && (
				<Section label="Genre" color="amber">
					{genres.map((g) => (
						<Chip key={g} color="amber" active={f.genres.includes(g)} onClick={() => bar.toggle("genres", g)}>
							{g}
						</Chip>
					))}
				</Section>
			)}
			{show("vibes") && (
				<Section label="Vibes" color="indigo" note="From each title's analysis">
					{VIBES.map((v) => (
						<Chip key={v.key} color="indigo" active={f.vibes.includes(v.key)} onClick={() => bar.toggle("vibes", v.key)}>
							<span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />
							{v.label}
						</Chip>
					))}
				</Section>
			)}
			{show("minScore") && (
				<Section label="Score" color="slate">
					{SCORES.map((s) => (
						<Chip key={s} color="slate" active={f.minScore === s} onClick={() => bar.set({ minScore: s })}>
							{s ? <ScoreDot score={s} /> : null}
							{s ? `${s}+` : "Any score"}
						</Chip>
					))}
				</Section>
			)}
			{show("release") && (
				<Section label="Release" color="cyan">
					{RELEASES.map((r) => (
						<Chip key={r.key} color="cyan" active={f.release === r.key} onClick={() => bar.set({ release: r.key })}>
							{r.label}
						</Chip>
					))}
				</Section>
			)}
			{show("providers") && (
				<Section label="Streaming services" color="emerald" note={f.mine ? "Showing your services. Pick others to look elsewhere." : "Only these services"}>
					{services.map((s) => {
						const active = f.mine ? bar.mine.includes(s.id) : f.providers.includes(s.id)
						return (
							<button
								key={s.id}
								type="button"
								aria-pressed={active}
								title={s.name}
								onClick={() => (f.mine ? bar.set({ mine: false, providers: [s.id] }) : bar.toggle("providers", s.id))}
								className={`relative h-11 w-11 rounded-lg overflow-hidden border-2 cursor-pointer transition ${active ? "border-emerald-400" : "border-gray-800 opacity-50 grayscale hover:opacity-100 hover:grayscale-0"}`}
							>
								<img src={`${LOGO}${s.logo}`} alt={s.name} className="h-full w-full object-cover" />
							</button>
						)
					})}
				</Section>
			)}
			{show("similar") && (
				<Section label="Similar to" color="rose">
					{similarPicks.map((t) => (
						<button
							key={t.key}
							type="button"
							aria-pressed={f.similar === t.key}
							onClick={() => bar.set({ similar: f.similar === t.key ? null : t.key })}
							className={`w-12 rounded-md overflow-hidden border-2 cursor-pointer ${f.similar === t.key ? "border-rose-400" : "border-gray-800 opacity-70 hover:opacity-100"}`}
							title={t.title}
						>
							<img src={`https://image.tmdb.org/t/p/w92${t.poster_path}`} alt={t.title} className="w-full aspect-[2/3] object-cover" />
						</button>
					))}
				</Section>
			)}
			{show("people") && (
				<Section label="Cast and crew" color="purple">
					{PEOPLE.map((p) => (
						<Chip key={p} color="purple" active={f.people.includes(p)} onClick={() => bar.toggle("people", p)}>
							{p}
						</Chip>
					))}
				</Section>
			)}
		</div>
	)
}

export function ScoreDot({ score }: { score: number }) {
	return <span className={`h-2.5 w-2.5 rounded-full bg-vibe-${goodwatchVibeIndex(score)}`} />
}

// Chips for active secondary filters, each removable in one tap.
export function activeChips(bar: Bar) {
	const f = bar.filters
	const chips: { key: string; label: string; color: string; remove: () => void }[] = []
	if (f.type !== "all") chips.push({ key: "type", label: TYPES.find((t) => t.key === f.type)!.label, color: "teal", remove: () => bar.set({ type: "all" }) })
	for (const g of f.genres) chips.push({ key: `g-${g}`, label: g, color: "amber", remove: () => bar.toggle("genres", g) })
	for (const v of f.vibes) chips.push({ key: `v-${v}`, label: VIBES.find((x) => x.key === v)!.label, color: "indigo", remove: () => bar.toggle("vibes", v) })
	if (f.minScore) chips.push({ key: "score", label: `Score ${f.minScore}+`, color: "slate", remove: () => bar.set({ minScore: 0 }) })
	if (f.release !== "any") chips.push({ key: "release", label: RELEASES.find((r) => r.key === f.release)!.label, color: "cyan", remove: () => bar.set({ release: "any" }) })
	if (!f.mine && f.providers.length)
		chips.push({ key: "providers", label: `${f.providers.length} service${f.providers.length > 1 ? "s" : ""}`, color: "emerald", remove: () => bar.set({ providers: [] }) })
	if (f.similar) chips.push({ key: "similar", label: `Like ${bar.catalog.find((t) => t.key === f.similar)?.title}`, color: "rose", remove: () => bar.set({ similar: null }) })
	for (const p of f.people) chips.push({ key: `p-${p}`, label: p, color: "purple", remove: () => bar.toggle("people", p) })
	return chips
}

export function ActiveChips({ bar, className = "" }: { bar: Bar; className?: string }) {
	const chips = activeChips(bar)
	if (!chips.length) return null
	return (
		<div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
			<AnimatePresence initial={false}>
				{chips.map((c) => (
					<motion.button
						layout
						key={c.key}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						type="button"
						onClick={c.remove}
						aria-label={`Remove ${c.label}`}
						className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-bold rounded-md border-2 border-white/15 bg-linear-to-br from-${c.color}-700/80 via-${c.color}-900/80 to-${c.color}-800/80 text-white hover:brightness-125 cursor-pointer`}
					>
						{c.label}
						<XMarkIcon className="h-4 w-4 opacity-70" />
					</motion.button>
				))}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------- recovery

export function recoveryText(r: { key: FilterKey; count: number; label: string }) {
	if (r.key === "mine") return `Show ${r.count} on other services`
	if (r.key === "notSeen") return `Include ${r.count} you've seen`
	return `${r.count} more ${r.label}`
}

export function HiddenLine({ bar, className = "" }: { bar: Bar; className?: string }) {
	if (!bar.hidden) return null
	const top = bar.recoveries.slice(0, 2)
	return (
		<p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 ${className}`}>
			<span>
				<span className="tabular-nums font-bold text-gray-200">{bar.results.length}</span> titles,{" "}
				<span className="tabular-nums">{bar.hidden}</span> hidden by your filters
			</span>
			{top.map((r) => (
				<button key={r.key} type="button" onClick={() => bar.drop(r.key)} className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer">
					{recoveryText(r)}
				</button>
			))}
		</p>
	)
}

// Appears as the last grid cell, or as the whole grid when nothing matches.
export function RecoveryTile({ bar }: { bar: Bar }) {
	if (!bar.recoveries.length) return null
	const empty = !bar.results.length
	return (
		<div className={`${empty ? "col-span-full py-16" : "aspect-[2/3]"} flex flex-col justify-center gap-3 p-4 rounded-lg border-4 border-dashed border-gray-800 bg-gray-900/40 scale-95`}>
			<p className="text-base font-bold text-white">{empty ? "Nothing matches all your filters" : `${bar.hidden} more are hidden by your filters`}</p>
			<div className="flex flex-col items-start gap-2">
				{bar.recoveries.slice(0, 3).map((r) => (
					<button key={r.key} type="button" onClick={() => bar.drop(r.key)} className="text-left text-sm font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
						{recoveryText(r)}
					</button>
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------- grid

export const toCard = (t: ProtoTitle, mine: number[]) =>
	({
		...t,
		streaming_links: [...t.offers]
			.sort((a, b) => Number(mine.includes(b.id)) - Number(mine.includes(a.id)))
			.map((o) => ({ provider_id: o.id, provider_name: o.name, provider_logo_path: o.logo.replace(/^\//, "") })),
	}) as never

export const GRID = "grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"

export function Grid({ bar, limit = 36, className = GRID, tile = true }: { bar: Bar; limit?: number; className?: string; tile?: boolean }) {
	const items = bar.results.slice(0, limit)
	return (
		<div className={className}>
			<AnimatePresence initial={false} mode="popLayout">
				{items.map((t) => (
					<motion.div key={t.key} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, type: "tween" }}>
						<MovieTvCard details={toCard(t, bar.mine)} mediaType={t.media_type} />
					</motion.div>
				))}
			</AnimatePresence>
			{tile && <RecoveryTile bar={bar} />}
		</div>
	)
}
