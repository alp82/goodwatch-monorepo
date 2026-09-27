// PROTOTYPE - throwaway. Variants F-H: bolder takes on the same shared filter bar.
import { AdjustmentsHorizontalIcon, ArrowsUpDownIcon, EyeIcon, EyeSlashIcon, GlobeAltIcon, TvIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import type { ProtoTitle } from "~/server/prototype-rec-filter-bar.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { ActiveChips, GRID, Grid, MoreButton, NotSeenToggle, Popover, ServicesSwitch, Sheet, SortMenu, recoveryText, toCard, useMyServiceNames } from "~/ui/prototype-rec-filter-bar/kit"
import { type Bar, type FilterKey, RECOVERY_LABEL, SORTS, TYPES, phrases, sorters, testers } from "~/ui/prototype-rec-filter-bar/model"
import { PageTitle } from "~/ui/prototype-rec-filter-bar/variants-existing"

const DISPLAY = { fontFamily: "Gabarito, sans-serif" }
const BACKDROP = "https://image.tmdb.org/t/p/w1280"

// ------------------------------------------------------------------ F: marquee sentence

function Clause({ children, open }: { children: string; open: boolean }) {
	return (
		<span className={`underline decoration-4 underline-offset-[0.18em] transition-colors ${open ? "decoration-amber-400 text-white" : "decoration-white/25 hover:decoration-amber-500"}`}>
			{children}
		</span>
	)
}

function Choices<T>({ options, value, onPick }: { options: { key: T; label: string; hint?: string }[]; value: T; onPick: (k: T) => void }) {
	return (
		<div className="p-1.5 text-base leading-normal tracking-normal font-normal font-sans">
			{options.map((o) => (
				<button
					key={String(o.key)}
					type="button"
					onClick={() => onPick(o.key)}
					className={`w-full px-3 py-2 rounded-md text-left cursor-pointer ${o.key === value ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800/60"}`}
				>
					<span className="block font-bold">{o.label}</span>
					{o.hint && <span className="block text-xs text-gray-400">{o.hint}</span>}
				</button>
			))}
		</div>
	)
}

export function VariantMarquee({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	const f = bar.filters
	const names = useMyServiceNames(bar)
	const hero = bar.results[0] ?? bar.catalog[0]
	const extra = phrases(bar, names.text).filter((p) => !["type", "mine", "notSeen", "sort"].includes(p.key))
	const sortWord: Record<string, string> = { "for-you": "picked for you", popular: "most popular first", top: "best rated first", newest: "newest first" }
	const pop = "inline-block align-baseline"
	return (
		<div className="pb-32">
			<section className="relative isolate">
				<div className="absolute inset-0 -z-10 overflow-hidden">
				<AnimatePresence mode="popLayout">
					<motion.img
						key={hero.key}
						src={`${BACKDROP}${hero.backdrop_path}`}
						alt=""
						initial={{ opacity: 0, scale: 1.04 }}
						animate={{ opacity: 0.45, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8 }}
						className="absolute inset-0 h-full w-full object-cover object-top"
					/>
				</AnimatePresence>
				<div className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/70 to-gray-950/20" />
				<div className="absolute inset-0 bg-linear-to-r from-gray-950/90 via-gray-950/30 to-transparent" />
				</div>
				<div className="max-w-7xl mx-auto px-4 pt-14 sm:pt-24 pb-10">
					<h1 className="max-w-5xl text-[2rem] leading-[1.15] sm:text-6xl sm:leading-[1.08] font-bold text-gray-300 tracking-tight" style={DISPLAY}>
						<Popover className={pop} width="w-64" trigger={(o) => <Clause open={o}>{TYPES.find((t) => t.key === f.type)!.plural}</Clause>}>
							{(close) => <Choices options={TYPES} value={f.type} onPick={(k) => (bar.set({ type: k }), close())} />}
						</Popover>{" "}
						<Popover className={pop} width="w-72" trigger={(o) => <Clause open={o}>{f.mine ? `on ${names.text}` : "on any service"}</Clause>}>
							{(close) => (
								<Choices
									options={[
										{ key: true, label: "On my services", hint: bar.viewer === "member" ? names.text : "Pick your services once" },
										{ key: false, label: "On any service", hint: "Every service, rent and buy too" },
									]}
									value={f.mine}
									onPick={(k) => (bar.set({ mine: k, providers: [] }), close())}
								/>
							)}
						</Popover>{" "}
						<Popover className={pop} width="w-72" trigger={(o) => <Clause open={o}>{f.notSeen ? "you haven't seen" : "seen or not"}</Clause>}>
							{(close) => (
								<Choices
									options={[
										{ key: true, label: "You haven't seen", hint: "Hides titles you watched or rated" },
										{ key: false, label: "Seen or not", hint: "Include watched and rated titles" },
									]}
									value={f.notSeen}
									onPick={(k) => (bar.set({ notSeen: k }), close())}
								/>
							)}
						</Popover>
						{extra.map((p) => (
							<span key={p.key}>
								{", "}
								<button type="button" onClick={() => bar.drop(p.key as FilterKey)} className="text-white hover:line-through decoration-rose-500 cursor-pointer" title="Remove">
									{p.text}
								</button>
							</span>
						))}
						{", "}
						<Popover className={pop} width="w-64" align="right" trigger={(o) => <Clause open={o}>{sortWord[f.sort]}</Clause>}>
							{(close) => <Choices options={SORTS} value={f.sort} onPick={(k) => (bar.set({ sort: k }), close())} />}
						</Popover>
						.
					</h1>
					<div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
						<span className="text-gray-300">
							<span className="text-2xl font-bold text-white tabular-nums" style={DISPLAY}>
								{bar.results.length}
							</span>{" "}
							titles
						</span>
						{bar.recoveries.slice(0, 2).map((r) => (
							<button key={r.key} type="button" onClick={() => bar.drop(r.key)} className="text-gray-300 hover:text-white cursor-pointer">
								<span className="text-amber-400 font-bold">+{r.count}</span> {RECOVERY_LABEL[r.key]}
							</button>
						))}
						<button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 font-bold text-white px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur cursor-pointer">
							<AdjustmentsHorizontalIcon className="h-4 w-4" />
							Refine
							{bar.moreCount > 0 && <span className="px-1.5 rounded-full bg-amber-600 text-xs">{bar.moreCount}</span>}
						</button>
					</div>
				</div>
			</section>
			<div className="max-w-7xl mx-auto px-4">
				<Grid bar={bar} className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6" />
			</div>
			<Sheet open={open} onClose={() => setOpen(false)} bar={bar} title="Refine" from="bottom" />
		</div>
	)
}

// ------------------------------------------------------------------ G: thumb dock

function DockButton({ active, onClick, icon: Icon, label, sub }: { active: boolean; onClick: () => void; icon: typeof TvIcon; label: string; sub?: string }) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={`relative flex flex-col items-center justify-center gap-0.5 w-[4.6rem] sm:w-28 h-14 rounded-xl cursor-pointer transition-colors ${active ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
		>
			{active && <motion.span layoutId={`dock-${label}`} className="absolute inset-0 rounded-xl bg-white/10 border border-white/15" />}
			<Icon className={`relative h-5 w-5 ${active ? "text-amber-400" : ""}`} />
			<span className="relative text-[11px] sm:text-xs font-bold leading-tight whitespace-nowrap">{label}</span>
			{sub && <span className="relative hidden sm:block text-[10px] text-gray-400 leading-tight">{sub}</span>}
		</button>
	)
}

export function VariantDock({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	const f = bar.filters
	const sortIdx = SORTS.findIndex((s) => s.key === f.sort)
	const top = bar.recoveries[0]
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-48">
			<PageTitle sub={<span className="text-sm text-gray-400 tabular-nums">{bar.results.length} titles</span>} />
			<ActiveChips bar={bar} className="mt-3" />
			<Grid bar={bar} className={`mt-5 ${GRID}`} />
			<div className="fixed inset-x-0 bottom-24 lg:bottom-6 z-40 flex flex-col items-center gap-2 px-3 pointer-events-none">
				<AnimatePresence>
					{top && (
						<motion.button
							key={top.key}
							type="button"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							onClick={() => bar.drop(top.key)}
							className="pointer-events-auto px-3 py-1.5 rounded-full text-xs font-bold bg-gray-900/90 border border-gray-700 text-gray-200 backdrop-blur shadow-lg cursor-pointer hover:border-amber-600"
						>
							{bar.hidden} hidden <span className="text-gray-500 mx-1">|</span>
							<span className="text-amber-400">{recoveryText(top)}</span>
						</motion.button>
					)}
				</AnimatePresence>
				<div className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-2xl bg-gray-900/85 border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/70">
					<DockButton active={f.mine} onClick={() => bar.set({ mine: !f.mine, providers: [] })} icon={f.mine ? TvIcon : GlobeAltIcon} label={f.mine ? "My services" : "Everywhere"} sub="tap to switch" />
					<DockButton active={f.notSeen} onClick={() => bar.set({ notSeen: !f.notSeen })} icon={f.notSeen ? EyeSlashIcon : EyeIcon} label={f.notSeen ? "Not seen" : "Seen too"} sub="watched or rated" />
					<DockButton active onClick={() => bar.set({ sort: SORTS[(sortIdx + 1) % SORTS.length].key })} icon={ArrowsUpDownIcon} label={SORTS[sortIdx].label} sub="tap to cycle" />
					<div className="w-px h-9 bg-white/10 mx-0.5" />
					<DockButton active={bar.moreCount > 0} onClick={() => setOpen(true)} icon={AdjustmentsHorizontalIcon} label={bar.moreCount ? `More · ${bar.moreCount}` : "More"} />
				</div>
			</div>
			<Sheet open={open} onClose={() => setOpen(false)} bar={bar} from="bottom" />
		</div>
	)
}

// ------------------------------------------------------------------ H: ghosts

const REASON: Record<FilterKey, string> = {
	mine: "Other services",
	notSeen: "Watched or rated",
	type: "Other type",
	genres: "Other genre",
	minScore: "Below your score",
	release: "Other years",
	providers: "Not on picked services",
	similar: "Not similar",
	vibes: "Other vibe",
	people: "Other people",
}

function Ghost({ t, bar, reasons }: { t: ProtoTitle; bar: Bar; reasons: FilterKey[] }) {
	return (
		<div className="relative group">
			<div className="grayscale opacity-35 group-hover:opacity-60 transition">
				<MovieTvCard details={toCard(t, bar.mine)} mediaType={t.media_type} />
			</div>
			<div className="absolute left-3 right-14 top-4 flex flex-col items-start gap-1.5 pointer-events-none">
				{reasons.slice(0, 2).map((r) => (
					<span key={r} className="px-2 py-0.5 rounded bg-black/80 text-[11px] font-bold text-gray-200">
						{REASON[r]}
					</span>
				))}
				<button type="button" onClick={() => bar.drop(reasons[0])} className="pointer-events-auto px-2 py-1 rounded bg-amber-600 text-white text-xs font-bold opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer">
					{reasons[0] === "mine" ? "Show everywhere" : reasons[0] === "notSeen" ? "Include seen" : "Remove filter"}
				</button>
			</div>
		</div>
	)
}

const METER: Partial<Record<FilterKey, string>> = { mine: "bg-emerald-700", notSeen: "bg-blue-700", providers: "bg-emerald-700" }

export function VariantGhosts({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	const [showHidden, setShowHidden] = useState(true)
	const { wall, byReason } = useMemo(() => {
		const tests = Object.entries(testers(bar.filters, bar.mine, bar.catalog)) as [FilterKey, (t: ProtoTitle) => boolean][]
		const wall = [...bar.catalog].sort(sorters[bar.filters.sort]).map((t) => ({ t, reasons: tests.filter(([, fn]) => !fn(t)).map(([k]) => k) }))
		// Each hidden title counts once, under the first filter that hides it.
		const byReason = new Map<FilterKey, number>()
		for (const w of wall) if (w.reasons.length) byReason.set(w.reasons[0], (byReason.get(w.reasons[0]) ?? 0) + 1)
		return { wall, byReason: [...byReason.entries()] }
	}, [bar.filters, bar.catalog, bar.mine])
	const total = bar.catalog.length
	const items = showHidden ? wall : wall.filter((w) => !w.reasons.length)
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-32">
			<PageTitle />
			<div className="sticky top-16 z-30 -mx-4 px-4 pt-3 pb-3 mt-3 bg-gray-950/85 backdrop-blur-md border-b border-white/5">
				<div className="flex flex-wrap items-center gap-2">
					<ServicesSwitch bar={bar} size="sm" />
					<NotSeenToggle bar={bar} size="sm" />
					<SortMenu bar={bar} size="sm" align="left" />
					<MoreButton bar={bar} onClick={() => setOpen(true)} label="More" size="sm" />
				</div>
				{/* At a glance: how much of the catalog each filter hides. Tap a segment to let it back in. */}
				<div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-gray-800" aria-hidden>
					<motion.div layout className="h-full bg-amber-500" style={{ width: `${(bar.results.length / total) * 100}%` }} />
					{byReason.map(([k, n]) => (
						<motion.div layout key={k} className={`h-full border-l-2 border-gray-950 ${METER[k] ?? "bg-gray-600"}`} style={{ width: `${(n / total) * 100}%` }} />
					))}
				</div>
				<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
					<span className="text-white font-bold tabular-nums">
						<span className="inline-block h-2 w-2 mr-1.5 rounded-full bg-amber-500" />
						{bar.results.length} showing
					</span>
					{byReason.map(([k, n]) => (
						<button key={k} type="button" onClick={() => bar.drop(k)} className="text-gray-400 hover:text-white cursor-pointer tabular-nums" title="Let these back in">
							<span className={`inline-block h-2 w-2 mr-1.5 rounded-full ${METER[k] ?? "bg-gray-600"}`} />
							{n} {RECOVERY_LABEL[k]}
						</button>
					))}
					<button type="button" aria-pressed={showHidden} onClick={() => setShowHidden((s) => !s)} className="ml-auto flex items-center gap-1.5 font-bold text-gray-300 hover:text-white cursor-pointer">
						{showHidden ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
						{showHidden ? "Hide filtered out" : "Show filtered out"}
					</button>
				</div>
			</div>
			<ActiveChips bar={bar} className="mt-3" />
			<div className={`mt-4 ${GRID}`}>
				<AnimatePresence initial={false} mode="popLayout">
					{items.slice(0, 48).map(({ t, reasons }) =>
						<motion.div key={t.key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
							{reasons.length ? <Ghost t={t} bar={bar} reasons={reasons} /> : <MovieTvCard details={toCard(t, bar.mine)} mediaType={t.media_type} />}
						</motion.div>,
					)}
				</AnimatePresence>
			</div>
			<Sheet open={open} onClose={() => setOpen(false)} bar={bar} />
		</div>
	)
}
