// A decade's "close to it" on a time line.. Every decade of the kind sits in order on one
// line; this one is lit amber, the ones that feel most like it are cards with the word for how each differs and a small
// fan of their posters, and the rest stay quiet stops you can still open. On a phone the line scrolls sideways and
// opens centered on this decade.
import { Link } from "@remix-run/react"
import { useEffect, useRef } from "react"
import type { Neighbor, PlaceRef } from "~/domain/browse/types"
import { poster } from "~/ui/browse/index"
import { QUICK_T } from "~/ui/browse/motion"
import { cap } from "~/ui/browse/place-parts"

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
const yearOf = (slug: string) => Number.parseInt(slug, 10) || 0
/** "1990s" -> "’90s"; the 2000s keep their four digits so they don't read as the 1900s. */
const short = (label: string) => {
	const y = yearOf(label)
	return y >= 2000 ? label : `’${String(y).slice(2)}s`
}

export function DecadeLine({
	here,
	decades,
	alike,
	hrefOf,
}: {
	here: PlaceRef
	decades: PlaceRef[]
	alike: Neighbor[]
	hrefOf: (p: PlaceRef) => string
}) {
	const scroller = useRef<HTMLDivElement>(null)
	const hereRef = useRef<HTMLLIElement>(null)
	// Centered on this decade where the line is wider than the screen; the page itself doesn't move.
	useEffect(() => {
		const box = scroller.current
		const el = hereRef.current
		if (!box || !el || box.scrollWidth <= box.clientWidth) return
		box.scrollLeft = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2
	}, [])
	const near = new Map(alike.map((n, i) => [n.place.slug, { n, rank: i + 1 }]))
	const line = [...decades]
		.filter((d) => d.slug === here.slug || yearOf(d.slug) > 0)
		.sort((a, b) => yearOf(a.slug) - yearOf(b.slug))
	if (!line.some((d) => d.slug === here.slug)) line.push(here)
	return (
		<div
			ref={scroller}
			className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0"
		>
			<ol
				className="relative grid min-w-[56rem] items-end gap-2"
				style={{ gridTemplateColumns: `repeat(${line.length}, minmax(0, 1fr))` }}
			>
				{/* The time line itself, behind the stops. */}
				<span
					aria-hidden
					className="pointer-events-none absolute right-0 bottom-[1.1rem] left-0 h-px bg-gradient-to-r from-white/5 via-white/20 to-white/5"
				/>
				{line.map((d) => {
					const isHere = d.slug === here.slug
					const hit = near.get(d.slug)
					if (isHere)
						return (
							<li key={d.slug} ref={hereRef} className="relative flex flex-col items-stretch gap-3">
								<div className="rounded-2xl bg-amber-300/[0.12] px-3 py-3 ring-1 ring-amber-300/50">
									<span className="block font-display text-2xl leading-none font-bold tracking-tight text-amber-200">
										{d.label}
									</span>
									<span className="mt-1.5 block text-xs font-semibold text-amber-200/70">
										You're here
									</span>
								</div>
								<Stop label={short(d.label)} state="here" />
							</li>
						)
					if (hit) {
						const color = hit.n.trait?.color ?? "#e5e7eb"
						return (
							<li key={d.slug} className="relative flex flex-col items-stretch gap-3">
								<Link
									to={hrefOf(d)}
									prefetch="intent"
									className={`group flex flex-col rounded-2xl bg-white/[0.04] px-3 pt-3 pb-2.5 ring-1 ring-white/10 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:ring-white/25 motion-reduce:hover:translate-y-0 ${QUICK_T} ${FOCUS}`}
								>
									<span className="flex items-baseline justify-between gap-2">
										<span className="font-display text-xl leading-none font-bold tracking-tight text-white">
											{d.label}
										</span>
										{hit.rank === 1 && (
											<span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
												Closest
											</span>
										)}
									</span>
									<span
										className="mt-1.5 line-clamp-2 text-sm leading-snug font-semibold"
										style={{ color }}
									>
										{cap(hit.n.differs)}
									</span>
									<Fan titles={hit.n.titles} />
								</Link>
								<Stop label={short(d.label)} state="alike" color={color} />
							</li>
						)
					}
					return (
						<li key={d.slug} className="relative flex flex-col items-stretch gap-3">
							<Link
								to={hrefOf(d)}
								prefetch="intent"
								aria-label={d.label}
								className={`group flex flex-col items-center rounded-xl py-2 text-sm font-semibold text-gray-500 hover:text-gray-200 ${QUICK_T} ${FOCUS}`}
							>
								<span aria-hidden className="h-6" />
								<Stop label={short(d.label)} state="quiet" />
							</Link>
						</li>
					)
				})}
			</ol>
		</div>
	)
}

function Stop({
	label,
	state,
	color,
}: {
	label: string
	state: "here" | "alike" | "quiet"
	color?: string
}) {
	return (
		<span className="flex flex-col items-center gap-1.5">
			<span
				aria-hidden
				className={`block rounded-full ${state === "here" ? "h-3 w-3 bg-amber-300 shadow-[0_0_0_4px_rgba(252,211,77,0.18)]" : state === "alike" ? "h-2.5 w-2.5" : "h-1.5 w-1.5 bg-white/25"}`}
				style={state === "alike" ? { background: color } : undefined}
			/>
			<span
				className={`text-xs font-bold tabular-nums ${state === "here" ? "text-amber-200" : state === "alike" ? "text-gray-300" : ""}`}
			>
				{label}
			</span>
		</span>
	)
}

/** Three posters as a small fan: support for the decade, never a click target of their own. */
function Fan({ titles }: { titles: Neighbor["titles"] }) {
	const shown = titles.filter((t) => t.card.poster_path).slice(0, 3)
	if (!shown.length) return null
	return (
		<span aria-hidden className="relative mt-3 block h-16">
			{shown.map((t, i) => (
				<img
					key={t.card.key}
					src={poster(t.card.poster_path ?? "", "w92")}
					alt=""
					loading="lazy"
					decoding="async"
					className={`absolute bottom-0 h-16 w-11 rounded-[5px] object-cover shadow-lg ring-1 shadow-black/50 ring-black/40 ${QUICK_T}`}
					style={{
						left: `${i * 22}px`,
						zIndex: 3 - i,
						transform: `rotate(${(i - 1) * 6}deg)`,
						transformOrigin: "bottom center",
					}}
				/>
			))}
		</span>
	)
}
