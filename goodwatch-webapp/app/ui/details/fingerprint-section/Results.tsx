// The titles that share the selection, as quiet as possible: one row with "Movies with" and the selection's chips (each
// with x) on the left, and one overlapped stack of ten mini posters on the right that is also the Show more button.
// Show more grows the stack in place into a grid (8 a row on desktop, 6 mid, 4 on phones), two rows per press; the
// stacked posters fly to their grid places (FLIP: transform only), the rest fade in. A new selection crossfades the
// posters (opacity), and the row keeps its height while stacked. The grid's code loads on the first Show more.
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid"
import {
	Suspense,
	lazy,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { EffectReading } from "~/domain/fingerprint-effects/effects"
import { TmdbImage } from "~/ui/TmdbImage"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { type SharedTitle, useSharedTitles } from "./population"
import { effectColor, shortName } from "./reading"

const SharedGrid = lazy(
	reloadOnStaleChunk(() =>
		import("./SharedGrid").then((module) => ({ default: module.SharedGrid })),
	),
)

const DISPLAY = '"Gabarito", ui-sans-serif, system-ui, sans-serif'
const STACK = 10
/** Mini poster width (--mini) and how much of it shows past the next one (--step): container-sized, no JS. */
const SIZES =
	"[--mini:34px] [--step:22px] @min-[520px]/fp:[--mini:40px] @min-[520px]/fp:[--step:26px]"
/** One image size for both states, so the grid never reloads what the stack already showed. */
const IMG_W = 120
const NONE: SharedTitle[] = []

interface Layer {
	key: string
	list: SharedTitle[]
	leaving: boolean
}

/** The posters of the newest selection, plus the last one's while it fades out. */
function useCrossfade(key: string, list: SharedTitle[]) {
	const [layers, setLayers] = useState<Layer[]>([{ key, list, leaving: false }])
	useEffect(() => {
		setLayers((ls) => {
			const top = ls[ls.length - 1]
			if (top.key === key)
				return top.list === list
					? ls
					: ls.map((l) => (l === top ? { ...l, list } : l))
			return [
				...ls
					.filter((l) => !l.leaving && l.list.length)
					.map((l) => ({ ...l, leaving: true })),
				{ key, list, leaving: false },
			]
		})
	}, [key, list])
	const leaving = layers.some((l) => l.leaving)
	useEffect(() => {
		if (!leaving) return
		const t = setTimeout(
			() => setLayers((ls) => ls.filter((l) => !l.leaving)),
			220,
		)
		return () => clearTimeout(t)
	}, [leaving])
	return layers
}

export function Results({
	effects,
	ready,
	type,
	selfId,
	onRemove,
}: {
	effects: EffectReading[]
	/** The starting selection is known: an empty selection now means the viewer took everything out. */
	ready: boolean
	type: "movie" | "show"
	selfId: number
	onRemove: (id: string) => void
}) {
	const ids = effects.map((r) => r.effect.id)
	const shared = useSharedTitles(type, ids, selfId)
	// The answer the posters show: the newest one that has arrived (a new selection keeps the last until its own does).
	const answer = ids.length ? shared.data : undefined
	const layers = useCrossfade(answer?.key ?? "", answer?.titles ?? NONE)

	// 0 = stacked; otherwise how many posters the grid shows.
	const [open, setOpen] = useState(0)
	const root = useRef<HTMLDivElement>(null)
	const [cols, setCols] = useState(8)
	useEffect(() => {
		const el = root.current
		if (!el) return
		const ro = new ResizeObserver(() => {
			const w = el.clientWidth
			setCols(w < 520 ? 4 : w < 760 ? 6 : 8)
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	// FLIP between the stack and the grid: where each poster was, measured just before the switch.
	const first = useRef<Map<string, DOMRect> | null>(null)
	const measure = () => {
		const m = new Map<string, DOMRect>()
		for (const el of root.current?.querySelectorAll<HTMLElement>(
			"[data-shared-live] [data-p]",
		) ?? [])
			m.set(el.dataset.p as string, el.getBoundingClientRect())
		first.current = m
	}
	const flip = () => {
		const m = first.current
		first.current = null
		if (!m || !root.current) return
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		for (const el of root.current.querySelectorAll<HTMLElement>(
			"[data-shared-live] [data-p]",
		)) {
			const a = m.get(el.dataset.p as string)
			if (!a) continue
			const b = el.getBoundingClientRect()
			if (!b.width) continue
			el.style.transition = "none"
			el.style.transformOrigin = "0 0"
			el.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})`
			el.getBoundingClientRect()
			requestAnimationFrame(() => {
				el.style.transition = "transform .42s cubic-bezier(.2,.8,.2,1)"
				el.style.transform = ""
			})
		}
	}
	// Back to the stack: its posters are in the page right after the switch. Into the grid: once the grid has loaded.
	useLayoutEffect(() => {
		if (open === 0) flip()
	}, [open === 0])

	const live = layers[layers.length - 1]
	const total = live.list.length
	const step = cols * 2
	// The selection the stack/grid switch happened on: its posters fly, they don't fade in again.
	const [switched, setSwitched] = useState<string | null>(null)
	const fades = (l: Layer) => l.key !== switched
	const more = () => {
		if (open === 0) {
			measure()
			setSwitched(live.key)
		}
		setOpen((n) => Math.min(total, n + step))
	}
	const less = () => {
		const top = root.current?.getBoundingClientRect().top ?? 0
		if (top < 90) window.scrollBy(0, top - 140)
		measure()
		setSwitched(live.key)
		setOpen(0)
	}
	// A new selection with fewer titles keeps the grid within them.
	const shown = Math.min(open, total)
	const noun = type === "movie" ? "Movies" : "Shows"

	return (
		<section
			ref={root}
			aria-label={`${noun} that do it too`}
			className="min-w-0"
		>
			<div className="flex flex-col gap-y-2.5 @min-[640px]/fp:min-h-[3.5rem] @min-[640px]/fp:flex-row @min-[640px]/fp:items-center @min-[640px]/fp:justify-between @min-[640px]/fp:gap-x-6">
				<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
					{ready && !effects.length ? (
						<span
							className="text-[15px] leading-[30px] font-medium text-gray-500"
							style={{ fontFamily: DISPLAY }}
						>
							Pick a row or an area of the drawing
						</span>
					) : (
						<>
							<span
								className="shrink-0 text-[15px] leading-[30px] font-semibold text-gray-300"
								style={{ fontFamily: DISPLAY }}
							>
								{noun} with
							</span>
							<Chips effects={effects} onRemove={onRemove} />
						</>
					)}
				</div>
				{/* The stack and its Show more are one button: any of it opens the grid. While the grid is open the posters
				    live in it, below. */}
				{shown === 0 && (
					<button
						type="button"
						onClick={more}
						disabled={total === 0}
						aria-description={`Show ${total} ${noun.toLowerCase()}`}
						className={`group/stack flex h-[calc(var(--mini)*1.5)] shrink-0 cursor-pointer items-center gap-3 self-start rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 disabled:cursor-default @min-[640px]/fp:self-auto ${SIZES}`}
					>
						<div aria-hidden className="relative h-[calc(var(--mini)*1.5)] w-[calc(var(--mini)+9*var(--step))]">
							{layers.map((l) => (
								<div
									key={l.key}
									data-shared-live={l.leaving ? undefined : ""}
									className={`absolute inset-0 ${l.leaving ? "fp-xout pointer-events-none" : fades(l) ? "fp-xin" : ""}`}
								>
									{l.list.slice(0, STACK).map((p, i) => (
										<span
											key={p.tmdbId}
											data-p={p.tmdbId}
											className="absolute top-0 block rounded-[5px]"
											style={{
												left: `calc(var(--step) * ${i})`,
												width: "var(--mini)",
												zIndex: STACK - i,
											}}
										>
											<span
												className="fp-fan block overflow-hidden rounded-[5px] bg-gray-900 ring-2 ring-stone-950"
												style={{ ["--i" as string]: i }}
											>
												<TmdbImage
													kind="poster"
													path={p.poster}
													width={IMG_W}
													alt={p.title}
													className="block aspect-[2/3] w-full object-cover"
													draggable={false}
												/>
											</span>
										</span>
									))}
								</div>
							))}
						</div>
						<span className="flex w-[5.5rem] shrink-0 items-center gap-1 text-[13px] font-semibold whitespace-nowrap text-gray-400 group-hover/stack:text-gray-100 group-disabled/stack:opacity-0">
							Show more
							<ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
						</span>
					</button>
				)}
			</div>

			{shown > 0 && (
				<div className="relative mt-4">
					<Suspense fallback={null}>
						{layers.map((l) => (
							<div
								key={l.key}
								data-shared-live={l.leaving ? undefined : ""}
								className={
									l.leaving
										? "fp-xout pointer-events-none absolute inset-x-0 top-0"
										: ""
								}
							>
								<SharedGrid
									list={l.list.slice(0, shown)}
									type={type}
									effects={effects}
									fades={!l.leaving && fades(l) ? "fp-xin" : ""}
									late={STACK}
									onMount={flip}
								/>
							</div>
						))}
					</Suspense>
					<div className="mt-3 flex items-center gap-5">
						{shown < total && (
							<button
								type="button"
								onClick={more}
								className="flex w-[5.5rem] shrink-0 cursor-pointer items-center gap-1 rounded text-[13px] font-semibold whitespace-nowrap text-gray-400 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-amber-300"
							>
								Show more
								<ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
							</button>
						)}
						<button
							type="button"
							onClick={less}
							className="flex cursor-pointer items-center gap-1 rounded text-[13px] font-semibold text-gray-500 hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-amber-300"
						>
							Show less
							<ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
						</button>
					</div>
				</div>
			)}
		</section>
	)
}

/** One small line of chips, each with x. */
function Chips({
	effects,
	onRemove,
}: { effects: EffectReading[]; onRemove: (id: string) => void }) {
	return (
		<div className="flex min-h-[30px] min-w-0 flex-wrap items-center gap-1.5">
			{effects.map((r, i) => {
				const color = effectColor(r)
				return (
					<span
						key={r.effect.id}
						className="fp-xin flex shrink-0 items-center gap-1.5"
					>
						{i > 0 && (
							<span className="text-[13px] font-semibold text-gray-600">+</span>
						)}
						<button
							type="button"
							onClick={() => onRemove(r.effect.id)}
							aria-description={`Take ${r.effect.name.toLowerCase()} out`}
							className="group/chip flex h-[28px] cursor-pointer items-center gap-1.5 rounded-full pr-1 pl-2.5 text-[13px] font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-300"
							style={{
								color,
								background: `color-mix(in srgb, ${color} 12%, transparent)`,
								border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
							}}
						>
							{shortName(r)}
							<span
								className="grid h-[18px] w-[18px] place-items-center rounded-full text-gray-500 group-hover/chip:bg-white/10 group-hover/chip:text-gray-100"
								aria-hidden="true"
							>
								<svg
									viewBox="0 0 12 12"
									className="h-2.5 w-2.5"
									aria-hidden="true"
								>
									<path
										d="M3 3l6 6M9 3l-6 6"
										stroke="currentColor"
										strokeWidth="1.6"
										strokeLinecap="round"
									/>
								</svg>
							</span>
						</button>
					</span>
				)
			})}
		</div>
	)
}
