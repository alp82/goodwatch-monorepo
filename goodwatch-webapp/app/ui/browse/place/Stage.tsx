// The list and everything that tailors it, as one block of
// exactly one screen's height: the steering beside (the steer rows), the grid and its own controls on the
// other side. The grid holds as many whole rows as fit that height at any width, and Prev and Next step on by that
// many. On a phone the steering is a strip of chips over the grid and a page is four rows.
import { Link, useNavigate } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { SortControl } from "~/ui/filter-bar/controls"
import { DISCOVER_SORTS, compactCount } from "~/ui/filter-bar/labels"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { SizeRule } from "~/utils/tmdb-image"
import type { ShowTitle, Sort } from "~/domain/browse/types"
import { FOCUS, PANEL, ShowMark, isMixed } from "~/ui/browse/index"
import { EASE, GLIDE_T, QUICK_T } from "~/ui/browse/motion"
import { useSteps } from "~/ui/browse/dials/Tuner"
import { rank } from "~/domain/browse/tune"
import { SteerRows } from "~/ui/browse/place/SteerRows"
import { WINDOW } from "~/domain/browse/window"
import { type Props, useMoodTuner } from "~/ui/browse/place/shared"
import { type SteerModel, type SteerRow, Token, useSteer } from "~/ui/browse/place/Steer"

const STAGE_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "155px"],
	["(min-width: 640px)", "calc((100vw - 84px) / 4)"],
	[null, "calc((100vw - 48px) / 3)"],
]

const GAP = 14
/** The block's height from `lg`: one screen under the sticky bars, never tiny, never a wall. */
const BLOCK_H = "max(560px, min(1100px, calc(100svh - var(--browse-head-top, 4rem) - 1.5rem)))"
const PHONE_PAGE = 12
const SORTS = [DISCOVER_SORTS.popular, DISCOVER_SORTS.top, DISCOVER_SORTS.newest]

// ---------------------------------------------------------------------------------------------------------
// The grid that fills its box

interface Fit {
	cols: number
	rows: number
	w: number
	h: number
}

/**
 * The rows and columns whose posters cover the box best at a size close to the target, both gaps the same. What little
 * is left over spreads evenly between the rows and the columns.
 */
function fitOf(W: number, H: number): Fit {
	const target = W > 820 ? 210 : 200
	let best: (Fit & { score: number }) | null = null
	for (let cols = 3; cols <= 9; cols++)
		for (let rows = 1; rows <= 6; rows++) {
			if (cols * rows > WINDOW) continue
			const h = Math.min((H - (rows - 1) * GAP) / rows, (1.5 * (W - (cols - 1) * GAP)) / cols)
			if (h < 165) continue
			const cover = (cols * rows * h * (h / 1.5)) / (W * H)
			const score = cover * (1 - Math.abs(h - target) / 400)
			if (!best || score > best.score) best = { cols, rows, w: h / 1.5, h, score }
		}
	if (!best) {
		const h = Math.max(120, H)
		return { cols: 3, rows: 1, w: h / 1.5, h }
	}
	return { cols: best.cols, rows: best.rows, w: best.w, h: best.h }
}

function useFit() {
	const box = useRef<HTMLDivElement>(null)
	const [fit, setFit] = useState<Fit | null>(null)
	useEffect(() => {
		const el = box.current
		if (!el) return
		const wide = window.matchMedia("(min-width: 1024px)")
		const read = () => {
			if (!wide.matches) return setFit(null)
			const r = el.getBoundingClientRect()
			if (r.width < 200 || r.height < 200) return
			const next = fitOf(r.width, r.height)
			setFit((f) =>
				f && f.cols === next.cols && f.rows === next.rows && Math.abs(f.h - next.h) < 0.5
					? f
					: next,
			)
		}
		read()
		const watch = new ResizeObserver(read)
		watch.observe(el)
		wide.addEventListener("change", read)
		return () => {
			watch.disconnect()
			wide.removeEventListener("change", read)
		}
	}, [])
	return { box, fit, per: fit ? fit.cols * fit.rows : null }
}

function Grid({
	titles,
	fit,
	dir,
}: {
	titles: ShowTitle[]
	fit: Fit | null
	/** Which way the last step went, so a new page slides in from that side. */
	dir: 1 | -1
}) {
	const reduce = useReducedMotion()
	const mixed = isMixed(titles)
	return (
		<div
			data-fit-grid=""
			className={
				fit
					? "grid"
					: "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 lg:gap-[14px] max-lg:[&>*:nth-child(n+13)]:hidden"
			}
			style={
				fit
					? {
							gridTemplateColumns: `repeat(${fit.cols}, ${fit.w}px)`,
							gridAutoRows: `${fit.h}px`,
							justifyContent: "space-between",
							// A short list (a narrow blend) keeps its rows together at the top instead of spreading them apart.
							alignContent: titles.length > fit.cols * (fit.rows - 1) ? "space-between" : "start",
							height: "100%",
							rowGap: GAP,
							columnGap: GAP,
						}
					: undefined
			}
		>
			<AnimatePresence initial={false} mode="popLayout" custom={dir}>
				{titles.map((t, i) => (
					<motion.div
						key={t.card.key}
						layout={reduce ? false : "position"}
						custom={dir}
						initial={reduce ? false : { opacity: 0, x: 18 * dir }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, transition: { duration: 0.12 } }}
						transition={{
							layout: { duration: 0.38, ease: EASE },
							x: { duration: 0.32, ease: EASE, delay: Math.min(i, 14) * 0.012 },
							opacity: { duration: 0.24, delay: Math.min(i, 14) * 0.012 },
						}}
						className="relative min-w-0"
					>
						<ShowMark title={t} mixed={mixed} />
						<TitlePosterCard
							card={t.card}
							posterSizes={fit ? [[null, `${Math.round(fit.w)}px`]] : STAGE_SIZES}
							posterPriority={i === 0 ? "high" : i < 3 ? "eager" : "lazy"}
							posterPaintBeforeScripts={i === 0}
							skipOffscreen={i > 17}
						/>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Prev and Next

const STEP = `flex h-10 items-center gap-1 rounded-full px-3.5 text-sm font-bold ring-1 ${QUICK_T} ${FOCUS}`
const STEP_ON = "bg-white/[0.06] text-white ring-white/15 hover:bg-white/[0.12] active:scale-[0.97]"
const STEP_OFF = "pointer-events-none text-gray-600 ring-white/[0.06]"

function Step({
	dir,
	to,
	onClick,
	off,
}: {
	dir: -1 | 1
	to?: string
	onClick?: () => void
	off: boolean
}) {
	const label = dir < 0 ? "Prev" : "Next"
	const body = (
		<>
			{dir < 0 && <ChevronLeftIcon aria-hidden className="h-4 w-4" />}
			{label}
			{dir > 0 && <ChevronRightIcon aria-hidden className="h-4 w-4" />}
		</>
	)
	const cls = `${STEP} ${off ? STEP_OFF : STEP_ON}`
	if (off)
		return (
			<span aria-disabled="true" className={cls}>
				{body}
			</span>
		)
	return to ? (
		<Link
			to={to}
			replace
			preventScrollReset
			prefetch="intent"
			onClick={onClick}
			data-step={label}
			className={cls}
		>
			{body}
		</Link>
	) : (
		<button type="button" onClick={onClick} data-step={label} className={cls}>
			{body}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The phone's steering: a strip of chips, the picked one's control under it

function PhoneSteer({ model }: { model: SteerModel }) {
	const [open, setOpen] = useState<string | null>(null)
	const row = model.rows.find((r) => r.id === open)
	return (
		<div className="lg:hidden">
			<div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
				{[...model.on, ...model.rows.filter((r) => r.value == null)].map((r) => (
					<button
						key={r.id}
						type="button"
						aria-expanded={open === r.id}
						onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
						className={`flex h-10 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-2.5 text-[13px] font-bold whitespace-nowrap ring-1 ${QUICK_T} ${FOCUS} ${
							open === r.id
								? "bg-white text-gray-950 ring-white"
								: r.value
									? "bg-white/[0.1] text-white ring-white/30"
									: "border border-dashed border-white/20 text-gray-400 ring-transparent"
						}`}
					>
						<span
							className={open === r.id ? "text-gray-950" : r.value ? "text-white" : "text-gray-500"}
						>
							{r.glyph}
						</span>
						{r.value ? (
							<span style={open === r.id || !r.color ? undefined : { color: r.color }}>
								{r.value}
							</span>
						) : (
							r.question
						)}
					</button>
				))}
			</div>
			<AnimatePresence initial={false} mode="wait">
				{row && (
					<motion.div
						key={row.id}
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
						transition={{ duration: 0.24, ease: EASE }}
						className={`${PANEL} mt-2 px-4 pt-3 pb-3`}
					>
						<p className="mb-2 text-[15px] font-bold text-white">{row.question}</p>
						{row.control}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The block

export function Stage({
	data,
	address,
	to,
	viewer,
}: Pick<Props, "data" | "address" | "to" | "viewer">) {
	const { dz, pool, list, steer } = data
	const tuner = useMoodTuner(dz.dials)
	const model = useSteer({ data, address, to, viewer }, tuner)
	const steps = useSteps(tuner.settings)
	const { box, fit, per: measured } = useFit()
	const navigate = useNavigate()
	const [dir, setDir] = useState<1 | -1>(1)

	// Tuned: the dials rank the pool in the browser and Prev and Next step through it here.
	const ranked = tuner.tuned ? rank(pool, dz.dials, steps, 72).map((i) => i.t) : null
	const stepsKey = JSON.stringify(steps)
	const [local, setLocal] = useState(0)
	// oxlint-disable-next-line react-hooks/exhaustive-deps -- a new tuning starts at the top
	useEffect(() => setLocal(0), [stepsKey])

	const wide = fit !== null
	const per = Math.min(WINDOW, measured ?? (wide ? 15 : PHONE_PAGE))
	const at = ranked ? local : steer.at
	const total = ranked ? ranked.length : list.total
	const shown = ranked ? ranked.slice(at, at + per) : list.titles.slice(0, measured ?? WINDOW)
	const reach = ranked ? total : Math.min(total, 25 * WINDOW)
	const prevAt = Math.max(0, at - per)
	const nextAt = at + per
	const hasPrev = at > 0
	const hasNext = nextAt < reach
	const atTo = (n: number) => model.link(address, { at: n > 0 ? String(n) : undefined })
	const range =
		total === 0
			? ""
			: `${(at + 1).toLocaleString("en-US")}–${Math.min(total, at + per).toLocaleString("en-US")} of ${compactCount(total)}`

	const result = (
		<div
			data-result=""
			className="flex min-h-8 flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[15px] font-semibold text-gray-200"
		>
			<AnimatePresence initial={false} mode="popLayout">
				{model.on.length === 0 && (
					<motion.span
						key="all"
						layout="position"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.1 } }}
						className="mr-1"
					>
						{model.listName}
					</motion.span>
				)}
				{model.on.map((r: SteerRow) => (
					<Token
						key={r.id}
						onRemove={r.clear && !r.clearTo ? r.clear : undefined}
						removeTo={r.clearTo}
						label={`Take off ${r.value}`}
						color={r.color}
					>
						{r.value}
					</Token>
				))}
				{model.on.length > 1 && (
					<motion.button
						key="clear"
						layout="position"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.1 } }}
						type="button"
						onClick={model.clearAll}
						className={`h-8 rounded-full px-2.5 text-sm font-bold text-gray-300 hover:text-white ${FOCUS}`}
					>
						Clear
					</motion.button>
				)}
			</AnimatePresence>
		</div>
	)

	// Over the grid only what names and orders it: the pills of what is set on the left, the sort on the right (where
	// every other list keeps it). Discover is not a filter here but a way out, so it reads as a link that leaves: quiet
	// text with an arrow pointing away, set apart from the controls.
	const out = list.discoverHref ? (
		<Link
			to={list.discoverHref}
			prefetch="intent"
			data-discover-out=""
			className={`group/out inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-1.5 text-sm font-semibold text-gray-400 ${QUICK_T} hover:text-white ${FOCUS}`}
		>
			<span className="underline decoration-white/20 underline-offset-4 group-hover/out:decoration-white/60">
				More filters in Discover
			</span>
			<ArrowUpRightIcon
				aria-hidden
				className={`h-4 w-4 ${QUICK_T} group-hover/out:translate-x-0.5 group-hover/out:-translate-y-0.5`}
			/>
		</Link>
	) : null
	const controls: ReactNode = (
		<div className="flex flex-wrap items-center gap-2">
			<div className="min-w-0 flex-1 max-sm:basis-full">{result}</div>
			<div className="flex shrink-0 items-center gap-1 max-sm:ml-auto">
				<span className="max-lg:hidden">{out}</span>
				<SortControl<Sort>
					size="sm"
					options={SORTS as never}
					value={address.sort ?? "popular"}
					onChange={(sort) =>
						navigate(model.link({ ...address, sort: sort === "popular" ? undefined : sort }), {
							replace: true,
							preventScrollReset: true,
						})
					}
				/>
			</div>
		</div>
	)
	// At the end of what the page steps through, Discover is where the list goes on: there it is the main way forward.
	const atEnd = !hasNext && total > 0

	return (
		<section id="titles" className="scroll-mt-36">
			<div
				className="grid gap-5 lg:h-[var(--block-h)] lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[21.5rem_minmax(0,1fr)]"
				style={{ ["--block-h" as string]: BLOCK_H }}
			>
				<aside aria-label="Steer the list" className="min-h-0 max-lg:hidden">
					<SteerRows model={model} />
				</aside>
				<div className="flex min-h-0 min-w-0 flex-col gap-4">
					<PhoneSteer model={model} />
					{controls}
					<div ref={box} className="min-h-0 flex-1 lg:overflow-hidden">
						{shown.length > 0 ? (
							<Grid titles={shown} fit={fit} dir={dir} />
						) : (
							<p className={`${PANEL} p-6 text-gray-300`}>
								Nothing fits all of that at once. Take one off and it opens up again.
							</p>
						)}
					</div>
					<div className={`flex flex-wrap items-center gap-x-2 gap-y-2 ${GLIDE_T}`}>
						<p className="min-w-0 flex-1 truncate text-sm text-gray-400 tabular-nums max-sm:basis-full">
							{range}
							{ranked && <span className="text-gray-500"> · closest to your dials first</span>}
						</p>
						{list.discoverHref &&
							(atEnd ? (
								<Link
									to={list.discoverHref}
									prefetch="intent"
									className={`group/end flex h-10 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-bold text-gray-950 ${QUICK_T} hover:bg-amber-300 active:scale-[0.97] ${FOCUS}`}
								>
									Keep going in Discover
									<ArrowUpRightIcon
										aria-hidden
										className={`h-4 w-4 ${QUICK_T} group-hover/end:translate-x-0.5 group-hover/end:-translate-y-0.5`}
									/>
								</Link>
							) : (
								out
							))}
						{ranked ? (
							<>
								<Step dir={-1} off={!hasPrev} onClick={() => (setDir(-1), setLocal(prevAt))} />
								<Step dir={1} off={!hasNext} onClick={() => (setDir(1), setLocal(nextAt))} />
							</>
						) : (
							<>
								<Step dir={-1} off={!hasPrev} to={atTo(prevAt)} onClick={() => setDir(-1)} />
								<Step dir={1} off={!hasNext} to={atTo(nextAt)} onClick={() => setDir(1)} />
							</>
						)}
					</div>
				</div>
			</div>
		</section>
	)
}
