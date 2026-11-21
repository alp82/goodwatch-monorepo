// PROTOTYPE - throwaway (prototype/explore-r4, concept "dials"). "Nearby": a family laid out on the two directions
// people steer by. Left is lighter and right is darker; up is calmer and down is more intense. Every place has one
// cell, so nothing overlaps; the page's own place is the white one, and the more alike a place is, the brighter its
// name. Each cell is a link; hovering or focusing one shows its posters and the word that sets it apart.
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { CAPTION } from "~/ui/eyebrow"
import { SELECTED_SOLID } from "~/ui/selection/selected"
import { PlaceMark, PosterTrio } from "../../kit/ui"
import type { FieldPlace } from "./loader.server"

/**
 * One cell per place, and no empty cells: the family is cut into columns from the lightest to the darkest, and each
 * column runs from its calmest place at the top to its most intense at the bottom.
 */
export function lattice(places: FieldPlace[], cols: number) {
	const n = places.length
	const rows = Math.max(1, Math.ceil(n / cols))
	const byTone = [...places].sort((a, b) => a.tone - b.tone || a.pace - b.pace)
	const cells: { place: FieldPlace; row: number; col: number }[] = []
	for (let c = 0; c < cols; c++) {
		const from = Math.round((c * n) / cols)
		const to = Math.round(((c + 1) * n) / cols)
		byTone
			.slice(from, to)
			.sort((a, b) => a.pace - b.pace)
			.forEach((p, r) => cells.push({ place: p, row: r, col: c }))
	}
	return { rows, cells }
}

const CARD_W = 248

function Grid({
	places,
	cols,
	onHot,
}: {
	places: FieldPlace[]
	cols: number
	onHot: (p: FieldPlace | null, el: HTMLElement | null) => void
}) {
	const { rows, cells } = lattice(places, cols)
	return (
		<div
			className="grid gap-1.5"
			style={{
				gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
				gridTemplateRows: `repeat(${rows}, 2.4rem)`,
			}}
		>
			{cells.map(({ place: p, row, col }) => {
				const near = p.near ?? 0.5
				return (
					<Link
						key={p.place.slug}
						to={p.to}
						prefetch="intent"
						aria-current={p.here ? "page" : undefined}
						onMouseEnter={(e) => onHot(p, e.currentTarget)}
						onMouseLeave={() => onHot(null, null)}
						onFocus={(e) => onHot(p, e.currentTarget)}
						onBlur={() => onHot(null, null)}
						style={{
							gridRow: row + 1,
							gridColumn: col + 1,
							color: p.here ? undefined : `rgba(255,255,255,${0.42 + near * 0.58})`,
						}}
						className={`flex min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] leading-none font-bold sm:text-[13px] outline-none transition-[background-color,transform,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none ${
							p.here
								? `${SELECTED_SOLID} shadow-[0_0_0_4px_rgba(255,255,255,.12)]`
								: "bg-white/[0.05] ring-1 ring-white/10 hover:-translate-y-0.5 hover:bg-white/[0.14] hover:!text-white hover:ring-white/30"
						}`}
					>
						<PlaceMark place={p.place} size={13} />
						<span className="truncate">{p.place.label}</span>
					</Link>
				)
			})}
		</div>
	)
}

export function Field({
	places,
	here,
	familyNoun,
	className = "",
}: {
	places: FieldPlace[]
	/** The page's place, as it reads in a sentence: "Cozy". */
	here: string
	/** "moods", "genres" */
	familyNoun: string
	className?: string
}) {
	const [hot, setHot] = useState<{
		p: FieldPlace
		left: number
		top: number
		below: boolean
	} | null>(null)
	const [shown, setShown] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const onHot = (p: FieldPlace | null, el: HTMLElement | null) => {
		clearTimeout(timer.current)
		if (!p || !el || p.here || !p.titles.length) {
			timer.current = setTimeout(() => setShown(false), 60)
			return
		}
		const r = el.getBoundingClientRect()
		const left = Math.min(
			Math.max(8, r.left + r.width / 2 - CARD_W / 2),
			window.innerWidth - CARD_W - 8,
		)
		const below = r.top < 300
		setHot({ p, left, top: below ? r.bottom + 10 : r.top - 10, below })
		setShown(true)
	}
	useEffect(() => {
		if (!shown) return
		const away = () => setShown(false)
		window.addEventListener("scroll", away, { passive: true })
		return () => window.removeEventListener("scroll", away)
	}, [shown])

	return (
		<div className={className}>
			<p className={CAPTION}>
				Where {here} sits among the {familyNoun}
			</p>
			<div className="mt-3 grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2.5 gap-y-2">
				<span />
				<div className={`flex items-center gap-2.5 ${CAPTION} !tracking-[0.1em]`}>
					<span>Lighter</span>
					<span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/30 to-white/10" />
					<span aria-hidden className="-ml-3 text-white/30">
						›
					</span>
					<span>Darker</span>
				</div>
				<div className={`relative ${CAPTION} !tracking-[0.1em]`}>
					<div className="absolute inset-0 flex items-center gap-2.5 [writing-mode:vertical-rl]">
						<span>Calmer</span>
						<span aria-hidden className="w-px flex-1 bg-gradient-to-b from-white/30 to-white/10" />
						<span>Intense</span>
					</div>
				</div>
				<div>
					<div className="hidden sm:block">
						<Grid places={places} cols={4} onHot={onHot} />
					</div>
					<div className="sm:hidden">
						<Grid places={places} cols={3} onHot={onHot} />
					</div>
				</div>
			</div>
			{hot && (
				<div
					aria-hidden
					className={`pointer-events-none fixed z-50 rounded-xl bg-gray-900 p-3 shadow-2xl shadow-black/60 ring-1 ring-white/15 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
						shown ? "opacity-100" : "opacity-0"
					}`}
					style={{
						width: CARD_W,
						left: hot.left,
						top: hot.top,
						transform: `translateY(${hot.below ? (shown ? "0" : "-4px") : shown ? "-100%" : "calc(-100% + 4px)"})`,
					}}
				>
					<p className="flex items-center gap-1.5 text-sm font-bold text-white">
						<PlaceMark place={hot.p.place} size={13} />
						{hot.p.place.label}
						{hot.p.differs && <span className="font-medium text-gray-400">· {hot.p.differs}</span>}
					</p>
					{hot.p.line && (
						<p className="mt-1 text-[13px] leading-snug text-gray-300">{hot.p.line}</p>
					)}
					<PosterTrio titles={hot.p.titles} className="mt-2.5" />
				</div>
			)}
		</div>
	)
}
