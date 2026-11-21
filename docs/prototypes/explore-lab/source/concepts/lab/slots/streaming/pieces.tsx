// PROTOTYPE - throwaway (prototype/explore-r7, slot "streaming"). What both streaming variants share: the head with
// its country picker, the control row (what it costs, find, sort), the state behind them, and the small parts every
// service shows (logo, poster fan, how much changed this month).
import { getVibeColorValue } from "~/utils/ratings"
import { count } from "../../../../kit/count"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { type Address, type Kind, familyPage, ing, kindNoun, place } from "../../../../kit/address"
import { FOCUS, WRAP, poster } from "../../../../kit/ui"
import { EASE, QUICK_T } from "../../../../kit/ui/motion"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import type { Model, Region, StreamCountry, StreamDir, StreamService } from "./shared.server"

/** Counts as people read them (Discover's buckets: 25,412 reads 25k). */
export const fmt = count
type To = (address: Address, extra?: Record<string, string>) => string

/** Where a service's own page is: a brand's page here, else Discover filtered to it. */
export const hrefOf = (s: StreamService, kind: Kind, country: string, to: To) =>
	s.slug ? to(place(kind, [ing("service", s.slug)], country.toLowerCase())) : (s.discover ?? "#")

// ---------------------------------------------------------------------------------------------------------
// Small parts

export function Logo({
	s,
	size = 48,
	className = "",
}: {
	s: StreamService
	size?: number
	className?: string
}) {
	return s.logo ? (
		<img
			src={poster(s.logo, "w154")}
			alt=""
			loading="lazy"
			decoding="async"
			width={size}
			height={size}
			className={`shrink-0 rounded-[22%] ring-1 ring-white/10 ${className}`}
			style={{ width: size, height: size }}
		/>
	) : (
		<span
			aria-hidden
			className={`grid shrink-0 place-items-center rounded-[22%] bg-white/10 font-bold text-gray-200 ring-1 ring-white/10 ${className}`}
			style={{ width: size, height: size, fontSize: size * 0.4 }}
		>
			{s.name.charAt(0)}
		</span>
	)
}

export const MODEL: Record<Model, string> = {
	plan: "Subscription",
	ads: "Free with ads",
	free: "Free",
}

export function ModelTag({ model }: { model: Model }) {
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ring-1 ${
				model === "plan"
					? "bg-white/[0.04] text-gray-300 ring-white/10"
					: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25"
			}`}
		>
			{MODEL[model]}
		</span>
	)
}

/**
 * What came and went in 30 days, as plain numbers under a fixed label (round 8: the owner found "Some turnover" and
 * "Changing fast" hard to read, and a steady catalog isn't a virtue in itself).
 */
export function Month({ s, compact = false }: { s: StreamService; compact?: boolean }) {
	return (
		<div className="min-w-0">
			<p className="text-sm font-bold text-white">This month</p>
			<p className={`mt-0.5 text-sm text-gray-400 ${compact ? "" : "whitespace-nowrap"}`}>
				{s.arrived || s.left ? (
					<>
						<span className="font-bold text-emerald-300 tabular-nums">+{fmt(s.arrived)}</span> new
						<span className="text-gray-600"> · </span>
						<span className="font-bold text-rose-300 tabular-nums">−{fmt(s.left)}</span> gone
					</>
				) : (
					"Nothing came or went"
				)}
			</p>
		</div>
	)
}

/** "80+" in the GoodWatch score's own color (the color of an 80 on every poster), then how many. */
export function Great({ n }: { n: number | null }) {
	if (n === null) return <span className="text-gray-500">Scores load…</span>
	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				className="rounded-md px-1.5 py-0.5 text-[11px] font-black text-white tabular-nums"
				style={{ background: getVibeColorValue(8) }}
			>
				G 80+
			</span>
			<span className="font-bold text-white tabular-nums">{fmt(n)}</span>
		</span>
	)
}

/** A few of the service's best titles as a fanned stack; the whole stack is the link to the service. */
export function Fan({ s, href, size = 54 }: { s: StreamService; href: string; size?: number }) {
	const picks = s.picks.filter((p) => p.card.poster_path).slice(0, 3)
	// Keeps its column (an inline span would ignore the width and shift the row's columns).
	if (!picks.length) return <span aria-hidden className="block" style={{ width: size * 1.9 }} />
	const tilt = [-9, 0, 9]
	const shift = [-0.42, 0, 0.42]
	return (
		<Link
			to={href}
			prefetch="intent"
			aria-label={`${s.name}: ${picks.map((p) => p.card.title).join(", ")}`}
			className={`group/fan relative block shrink-0 ${FOCUS} rounded-lg`}
			style={{ width: size * 1.9, height: size * 1.5 }}
		>
			{picks.map((p, i) => {
				const at = picks.length === 1 ? 1 : picks.length === 2 ? [0, 2][i] : i
				return (
					<img
						key={p.card.key}
						src={poster(p.card.poster_path, "w154")}
						alt=""
						loading="lazy"
						decoding="async"
						className={`absolute top-0 left-1/2 rounded-md shadow-lg ring-1 ring-black/40 [transform:translateX(calc(-50%_+_var(--x)))_rotate(var(--r))] ${QUICK_T} motion-safe:group-hover/fan:[transform:translateX(calc(-50%_+_var(--x)_*_1.4))_rotate(calc(var(--r)_*_1.35))_translateY(-3px)]`}
						style={
							{
								width: size,
								height: size * 1.5,
								zIndex: at === 1 ? 3 : 1,
								transformOrigin: "50% 90%",
								"--x": `${shift[at] * size}px`,
								"--r": `${tilt[at]}deg`,
							} as React.CSSProperties
						}
					/>
				)
			})}
		</Link>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The country picker: a button with the flag-filled shape; a panel under it with a search field, the countries
// with the most offers, and every country by region.

const REGIONS: { id: Region; name: string }[] = [
	{ id: "americas", name: "Americas" },
	{ id: "europe", name: "Europe" },
	{ id: "asia", name: "Asia & Pacific" },
	{ id: "africa", name: "Africa" },
	{ id: "other", name: "Elsewhere" },
]
const fold = (s: string) =>
	s
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()

export function CountryPicker({ data, to }: { data: StreamDir; to: To }) {
	const [open, setOpen] = useState(false)
	const [find, setFind] = useState("")
	const box = useRef<HTMLDivElement>(null)
	const field = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (!open) return
		const away = (e: PointerEvent) => {
			if (!box.current?.contains(e.target as Node)) setOpen(false)
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("pointerdown", away)
		document.addEventListener("keydown", esc)
		const t = window.setTimeout(() => field.current?.focus(), 30)
		return () => {
			document.removeEventListener("pointerdown", away)
			document.removeEventListener("keydown", esc)
			window.clearTimeout(t)
		}
	}, [open])
	const hrefFor = (c: StreamCountry) => to(familyPage(data.kind, "service", c.code.toLowerCase()))
	const q = fold(find.trim())
	const matches = q
		? data.countries.filter((c) => fold(c.name).includes(q) || c.code.toLowerCase() === q)
		: null
	const top = data.countries.slice(0, 8)
	const item = (c: StreamCountry) => (
		<Link
			key={c.code}
			to={hrefFor(c)}
			prefetch="intent"
			onClick={() => setOpen(false)}
			aria-current={c.code === data.country.code ? "page" : undefined}
			className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${QUICK_T} ${FOCUS} ${
				c.code === data.country.code
					? "bg-amber-300/10 font-bold text-amber-200"
					: "text-gray-200 hover:bg-white/[0.06] hover:text-white"
			}`}
		>
			{/* A fixed box, so every name starts at the same place whatever the shape (round 8). */}
			<span aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center">
				<FlagShape code={c.code} size={22} />
			</span>
			<span className="truncate">{c.name}</span>
		</Link>
	)
	return (
		<div ref={box} className="relative inline-block">
			<button
				type="button"
				aria-expanded={open}
				aria-haspopup="dialog"
				onClick={() => setOpen((o) => !o)}
				className={`group inline-flex items-center gap-3 rounded-2xl py-1 pr-3 pl-2 align-middle ${QUICK_T} ${FOCUS} ${
					open ? "bg-white/[0.09]" : "hover:bg-white/[0.06]"
				}`}
			>
				<span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center">
					<FlagShape code={data.country.code} size={44} />
				</span>
				<span className="border-b-2 border-dashed border-white/25 group-hover:border-amber-300/70">
					{data.country.name}
				</span>
				<span
					aria-hidden
					className={`text-[0.5em] text-gray-400 ${QUICK_T} ${open ? "rotate-180" : ""}`}
				>
					▾
				</span>
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						role="dialog"
						aria-label="Pick a country"
						initial={{ opacity: 0, scale: 0.97, y: -4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: EASE } }}
						transition={{ duration: 0.18, ease: EASE }}
						style={{ transformOrigin: "0% 0%" }}
						className="absolute top-full left-0 z-40 mt-2 w-[min(calc(100vw-2rem),44rem)] rounded-2xl bg-[#171e2d] p-3 font-sans text-base font-normal tracking-normal shadow-2xl ring-1 ring-white/15"
					>
						<input
							ref={field}
							type="search"
							value={find}
							onChange={(e) => setFind(e.target.value)}
							placeholder={`Find one of ${data.countries.length} countries`}
							aria-label="Find a country"
							className="w-full rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-amber-300/60 focus:outline-none"
						/>
						<div className="mt-3 max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain pr-1">
							{matches ? (
								matches.length ? (
									<div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">{matches.map(item)}</div>
								) : (
									<p className="px-2 py-6 text-sm text-gray-400">
										No country by that name has offers yet.
									</p>
								)
							) : (
								<>
									<p className="px-2 text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
										Most to stream
									</p>
									<div className="mt-1 grid grid-cols-2 gap-0.5 sm:grid-cols-4">
										{top.map(item)}
									</div>
									{REGIONS.map((r) => {
										const list = data.countries
											.filter((c) => c.region === r.id)
											.sort((a, b) => a.name.localeCompare(b.name))
										if (!list.length) return null
										return (
											<section key={r.id} className="mt-4">
												<p className="px-2 text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
													{r.name}
												</p>
												<div className="mt-1 grid grid-cols-2 gap-0.5 sm:grid-cols-3">
													{list.map(item)}
												</div>
											</section>
										)
									})}
								</>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export function StreamHead({ data, to }: { data: StreamDir; to: To }) {
	const subs = data.services.filter((s) => s.model === "plan").length
	return (
		<header className={`${WRAP} pt-8 pb-6 sm:pt-10`}>
			<p className="text-xs font-bold tracking-[0.18em] text-amber-300 uppercase">Streaming</p>
			<h1 className="font-display mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-4xl leading-tight font-bold tracking-tight text-white sm:text-5xl">
				<span>Streaming in</span>
				<CountryPicker data={data} to={to} />
			</h1>
			<p className="mt-3 max-w-2xl text-lg text-gray-300">
				{data.services.length
					? `${data.services.length} services carry ${kindNoun(data.kind)} here: ${subs} with a subscription, ${data.services.length - subs} free.`
					: `No service carries enough ${kindNoun(data.kind)} here yet.`}
			</p>
		</header>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The control row and its state

// Round 10: most popular first by default (how many of the country's most popular titles a service carries).
export type Sort = "popular" | "titles" | "great" | "new" | "name"
const SORTS: { id: Sort; label: string }[] = [
	{ id: "popular", label: "Most popular" },
	{ id: "titles", label: "Most titles" },
	{ id: "great", label: "Most scored 80+" },
	{ id: "new", label: "Most new this month" },
	{ id: "name", label: "A to Z" },
]
type Cost = "all" | "plan" | "free"
const COSTS: { id: Cost; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "plan", label: "Subscription" },
	{ id: "free", label: "Free" },
]

export function useDirectory(services: StreamService[], first: number) {
	const [sort, setSort] = useState<Sort>("popular")
	const [cost, setCost] = useState<Cost>("all")
	const [find, setFind] = useState("")
	const [more, setMore] = useState(false)
	const list = useMemo(() => {
		const q = fold(find.trim())
		const kept = services.filter(
			(s) =>
				(cost === "all" || (cost === "plan" ? s.model === "plan" : s.model !== "plan")) &&
				(!q || fold(s.name).includes(q)),
		)
		const by: Record<Sort, (a: StreamService, b: StreamService) => number> = {
			popular: (a, b) => (b.popular ?? 0) - (a.popular ?? 0) || b.titles - a.titles,
			titles: (a, b) => b.titles - a.titles,
			name: (a, b) => a.name.localeCompare(b.name),
			great: (a, b) => (b.great ?? 0) - (a.great ?? 0) || b.titles - a.titles,
			new: (a, b) => b.arrived - a.arrived || b.titles - a.titles,
		}
		return [...kept].sort(by[sort])
	}, [services, sort, cost, find])
	const shown = more || find ? list : list.slice(0, first)
	return {
		sort,
		setSort,
		cost,
		setCost,
		find,
		setFind,
		list,
		shown,
		more,
		setMore,
		hidden: list.length - shown.length,
	}
}
export type Directory = ReturnType<typeof useDirectory>

export function Controls({ d, ready }: { d: Directory; ready: boolean }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div
				role="radiogroup"
				aria-label="What it costs"
				className="flex rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10"
			>
				{COSTS.map((c) => {
					const on = d.cost === c.id
					return (
						<button
							key={c.id}
							type="button"
							// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA radio pattern on styled buttons
							role="radio"
							aria-checked={on}
							onClick={() => d.setCost(c.id)}
							className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${QUICK_T} ${FOCUS} ${
								on ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"
							}`}
						>
							{c.label}
						</button>
					)
				})}
			</div>
			<label className="relative min-w-0 flex-1 sm:max-w-xs">
				<span className="sr-only">Find a service</span>
				<span
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-500"
				>
					⌕
				</span>
				<input
					type="search"
					value={d.find}
					onChange={(e) => d.setFind(e.target.value)}
					placeholder="Find a service"
					className="w-full rounded-full bg-white/[0.05] py-2 pr-4 pl-9 text-sm text-white ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-amber-300/60 focus:outline-none"
				/>
			</label>
			<label className="ml-auto flex items-center gap-2 rounded-full bg-white/[0.05] py-1 pr-1 pl-3.5 text-sm text-gray-400 ring-1 ring-white/10">
				Sort
				<select
					value={d.sort}
					onChange={(e) => d.setSort(e.target.value as Sort)}
					className={`cursor-pointer rounded-full bg-transparent py-1 pr-2 pl-1 font-bold text-white ${FOCUS}`}
				>
					{SORTS.filter((s) => ready || s.id !== "great").map((s) => (
						<option key={s.id} value={s.id} className="bg-[#171e2d]">
							{s.label}
						</option>
					))}
				</select>
			</label>
		</div>
	)
}

export function MoreButton({ d, noun }: { d: Directory; noun: string }): ReactNode {
	if (d.find || (!d.hidden && !d.more)) return null
	return (
		<div className="mt-6 flex justify-center">
			<button
				type="button"
				onClick={() => d.setMore(!d.more)}
				className={`rounded-full bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/[0.1] ${QUICK_T} ${FOCUS}`}
			>
				{d.more ? "Show fewer" : `Show ${d.hidden} smaller ${noun}`}
			</button>
		</div>
	)
}

export function Empty({ d }: { d: Directory }) {
	return d.list.length ? null : (
		<p className="py-12 text-center text-gray-400">
			{d.find ? `No service here matches "${d.find}".` : "No service of this kind here."}
		</p>
	)
}
