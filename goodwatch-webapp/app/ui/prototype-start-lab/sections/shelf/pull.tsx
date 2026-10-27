// PROTOTYPE (start page lab): d "Pull from the shelf": tapping a poster takes it out of its slot. It flies from the
// slot's quad (morphing corner by corner, so it leaves in the scene's perspective) to a flat poster card with its
// details in front of the room. A tap outside, Esc, or "Put back" returns it.
import { Link } from "@remix-run/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { titleHref, tmdbImage } from "../../lab/kit"
import type { LabCard, SlotProps } from "../../lab/types"
import { quadTransform } from "../../scene/homography"
import type { SceneLayout } from "../../scene/SceneStage"
import { LitPoster, TapTargets } from "./lit"
import { getShelf, setShelf, useRoomEl, useShelf } from "./store"

type Point = [number, number]
type Quad = [Point, Point, Point, Point]

const OUT_MS = 560
const BACK_MS = 420

export function PullSlot({ card, slot, index }: SlotProps) {
	const ref = useRef<HTMLAnchorElement>(null)
	const room = useRoomEl(ref)
	const state = useShelf(room)
	if (!card?.poster_path) return null
	const away = state.pulled === index
	return (
		<Link
			ref={ref}
			to={titleHref(card)}
			prefetch="none"
			data-shelf-slot=""
			aria-label={card.title}
			draggable={false}
			className="block h-full w-full outline-none [-webkit-tap-highlight-color:transparent]"
			style={{ opacity: away ? 0 : 1 }}
			onPointerEnter={(e) => e.pointerType === "mouse" && getShelf(room).pulled == null && setShelf(room, { lift: index })}
			onPointerLeave={(e) => e.pointerType === "mouse" && getShelf(room).lift === index && setShelf(room, { lift: null })}
			onFocus={() => setShelf(room, { lift: index })}
			onBlur={() => getShelf(room).lift === index && setShelf(room, { lift: null })}
			onClick={(e) => {
				const s = getShelf(room)
				// Without this variant's overlay in the room (noOverlay), the slot is a plain link.
				if (!s.overlay || s.pulled != null) return
				e.preventDefault()
				setShelf(room, { pulled: index, phase: "out", lift: null })
			}}
		>
			<LitPoster card={card} kind={slot.kind} lifted={state.lift === index && !away} />
		</Link>
	)
}

const ease = {
	outBack: (t: number) => {
		const c = 1.15
		return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
	},
	inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
}

const lerpQuad = (a: Quad, b: Quad, t: number) =>
	a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]) as Quad

/** Where the flat card and its details go in the room box. */
function place(cw: number, ch: number) {
	const pad = 16
	const narrow = cw < 560
	const w = Math.round(
		narrow
			? Math.max(90, Math.min(cw * 0.42, (ch - 2 * pad) / 1.5, 180))
			: Math.max(100, Math.min((ch - 2 * pad) / 1.5, 220)),
	)
	const h = Math.round(w * 1.5)
	const detailsW = Math.round(narrow ? cw - 3 * pad - w : Math.min(320, cw - 3 * pad - w))
	const groupW = w + pad + detailsW
	const left = Math.round((cw - groupW) / 2)
	const top = Math.round((ch - h) / 2)
	return { left, top, w, h, detailsLeft: left + w + pad, detailsW, narrow }
}

export function PullOverlay({ cards, layout }: { cards: LabCard[]; layout: SceneLayout | null }) {
	const ref = useRef<HTMLDivElement>(null)
	const flyer = useRef<HTMLDivElement>(null)
	const room = useRoomEl(ref)
	const state = useShelf(room)
	// "flying" while the poster moves; "landed" when the flat card shows.
	const [landed, setLanded] = useState(false)

	useEffect(() => {
		if (!room) return
		setShelf(room, { overlay: true })
		return () => setShelf(room, { overlay: false, pulled: null, phase: null })
	}, [room])

	const index = state.pulled
	const card = index != null ? cards[index] : null
	const slotPoints = index != null ? layout?.slots[index]?.points : undefined
	const at = layout ? place(layout.cover.cw, layout.cover.ch) : null

	// The flight: corner by corner from the slot's quad to the flat card's rectangle, written straight to the style.
	useLayoutEffect(() => {
		const el = flyer.current
		if (!el || !slotPoints || !at || !state.phase) return
		const flat: Quad = [
			[at.left, at.top],
			[at.left + at.w, at.top],
			[at.left + at.w, at.top + at.h],
			[at.left, at.top + at.h],
		]
		const out = state.phase === "out"
		const [from, to] = out ? [slotPoints as Quad, flat] : [flat, slotPoints as Quad]
		const ms = out ? OUT_MS : BACK_MS
		const curve = out ? ease.outBack : ease.inOut
		if (!out) setLanded(false)
		let raf = 0
		const t0 = performance.now()
		const step = (now: number) => {
			const t = Math.min(1, (now - t0) / ms)
			el.style.transform = quadTransform(lerpQuad(from, to, curve(t)), at.w, at.h)
			if (t < 1) raf = requestAnimationFrame(step)
			else if (out) setLanded(true)
			else setShelf(room, { pulled: null, phase: null })
		}
		el.style.transform = quadTransform(from, at.w, at.h)
		raf = requestAnimationFrame(step)
		return () => cancelAnimationFrame(raf)
		// at is derived from layout; re-run only on a new flight or a new layout.
		// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	}, [state.phase, index, layout])

	const putBack = () => {
		if (getShelf(room).phase === "out") setShelf(room, { phase: "back" })
	}

	useEffect(() => {
		if (index == null) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && putBack()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})

	const open = index != null && !!card && !!at
	const showDetails = open && landed && state.phase === "out"
	return (
		<div ref={ref} className="pointer-events-none absolute inset-0" style={{ zIndex: index != null ? 30 : undefined }}>
			{layout && index == null ? (
				<TapTargets
					layout={layout}
					cards={cards}
					onTap={(i) => getShelf(room).pulled == null && setShelf(room, { pulled: i, phase: "out", lift: null })}
				/>
			) : null}
			{/* The room dims behind the card; a tap on it puts the card back. */}
			<button
				type="button"
				aria-label="Put back"
				tabIndex={-1}
				onClick={putBack}
				className="absolute inset-0 bg-gray-950/65 transition-opacity duration-300"
				style={{ opacity: open && state.phase === "out" ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
			/>
			{open && card && at ? (
				<>
					<div
						ref={flyer}
						className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-lg shadow-2xl shadow-black/70 will-change-transform"
						style={{ width: at.w, height: at.h, opacity: landed ? 0 : 1 }}
					>
						<img
							src={tmdbImage(card.poster_path, "w342")}
							alt=""
							draggable={false}
							className="h-full w-full object-cover"
						/>
					</div>
					<div
						className="pointer-events-auto absolute transition-opacity duration-150"
						style={{ left: at.left, top: at.top, width: at.w, opacity: landed ? 1 : 0, pointerEvents: landed ? "auto" : "none" }}
					>
						<TitlePosterCard card={card} actions={false} />
					</div>
					<div
						className="pointer-events-auto absolute flex flex-col justify-center gap-2 transition-[opacity,transform] duration-300 ease-out"
						style={{
							left: at.detailsLeft,
							top: at.top,
							width: at.detailsW,
							height: at.h,
							opacity: showDetails ? 1 : 0,
							transform: showDetails ? "translateX(0)" : "translateX(-12px)",
							pointerEvents: showDetails ? "auto" : "none",
						}}
					>
						<h3 className={`${at.narrow ? "text-lg" : "text-2xl"} line-clamp-3 font-bold leading-tight text-white`}>{card.title}</h3>
						<div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
							<ScorePill goodwatch={card.goodwatch_overall_score_normalized_percent} score={null} mark={null} size={at.narrow ? "M" : "L"} />
							{card.release_year ? <span>{card.release_year}</span> : null}
							{card.media_type === "movie" && card.runtime ? <span>{card.runtime} min</span> : null}
							{card.media_type === "show" ? <span>Show</span> : null}
						</div>
						{card.tagline ? (
							<p className={`${at.narrow ? "line-clamp-3 text-xs" : "line-clamp-4 text-sm"} text-gray-300`}>{card.tagline}</p>
						) : null}
						<div className="mt-1 flex flex-wrap items-center gap-2">
							<Link
								to={titleHref(card)}
								prefetch="intent"
								className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-gray-950 hover:bg-amber-400"
							>
								Open
							</Link>
							<button
								type="button"
								onClick={putBack}
								className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:border-gray-400"
							>
								Put back
							</button>
						</div>
					</div>
				</>
			) : null}
		</div>
	)
}
