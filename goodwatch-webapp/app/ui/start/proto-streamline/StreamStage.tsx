// PROTOTYPE (start-streamline): one start stage for guests and members. The search block always sits at the top (as
// a member's does today). The room starts a bit dim and framed wide enough to show the window above the sofa. At its
// foot a thin element says what's in focus (StripModel); opening it brings in the big card, the room lights up and
// the camera moves down from the window to the sofa.
//
// Flows (`?flow=`, ProtoSwitcher.tsx):
// - a, Sheet: a full-width band on the room's lower edge; it rises with the card as the sheet's top edge.
// - b, Island: a floating pill; it sinks away as the card rises into its place.
// - c, Scroll: the room stays pinned while the page scrolls; the scroll lifts the card. A tap or a search scrolls.
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid"
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ShelfTitle } from "../room/ShelfCovers"
import { StartRoom } from "../room/StartRoom"
import { START_ROOM, START_ROOM_PHONE } from "../room/scene"
import { sceneStyle } from "../stage/placement"
import { START_HEADING } from "../stage/StartStage"
import type { Flow } from "./ProtoSwitcher"
import type { StripModel } from "./strip-models"

/** The wide framing: from the top of the window's curtains to the sofa's foot (x, y, w, h, 0..1 of the picture). */
const WIDE = {
	landscape: [0.24, 0.29, 0.52, 0.55],
	phone: [0.2, 0.285, 0.58, 0.46],
} as const

const frameVars = () => {
	const out: Record<string, string> = sceneStyle(START_ROOM, START_ROOM_PHONE)
	for (const [name, scene, wide] of [
		["landscape", START_ROOM, WIDE.landscape],
		["phone", START_ROOM_PHONE, WIDE.phone],
	] as const) {
		const hw = scene.height / scene.width
		const [, fy, , fh] = scene.focus
		out[`--pst-${name}-b1`] = (wide[3] * hw).toFixed(5)
		out[`--pst-${name}-y1`] = (wide[1] * hw).toFixed(5)
		out[`--pst-${name}-c2`] = ((fy + fh / 2) * hw).toFixed(5)
	}
	return out
}
const FRAME_STYLE = frameVars() as CSSProperties

export type RoomLight = { night: number; camera: number }

const HEADER = 64

export function useDock(flow: Flow, startOpen: boolean) {
	const [open, setOpen] = useState(startOpen)
	const stage = useRef<HTMLElement | null>(null)
	const rise = () => {
		const el = stage.current
		const frame = el?.querySelector<HTMLElement>(".pst-frame")
		return el && frame ? el.offsetHeight - frame.offsetHeight : 0
	}
	const request = useCallback(
		(next: boolean) => {
			if (flow !== "c") return setOpen(next)
			const el = stage.current
			if (!el) return
			const top = el.getBoundingClientRect().top + window.scrollY - HEADER
			window.scrollTo({ top: next ? top + rise() : top, behavior: "smooth" })
		},
		[flow],
	)
	// Scroll: the scroll's progress over the stage's extra height is the card's rise (--pst-p, 0..1).
	useEffect(() => {
		if (flow !== "c") return
		const el = stage.current
		if (!el) return
		let raf = 0
		const measure = () => {
			cancelAnimationFrame(raf)
			raf = requestAnimationFrame(() => {
				const r = rise()
				const p = r
					? Math.min(1, Math.max(0, (HEADER - el.getBoundingClientRect().top) / r))
					: 0
				el.style.setProperty("--pst-p", p.toFixed(4))
				setOpen(p > 0.5)
			})
		}
		measure()
		if (startOpen) setTimeout(() => request(true), 400)
		window.addEventListener("scroll", measure, { passive: true })
		window.addEventListener("resize", measure)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener("scroll", measure)
			window.removeEventListener("resize", measure)
			el.style.removeProperty("--pst-p")
		}
		// startOpen only counts on the first run.
	}, [flow, request])
	// Escape closes the card when the focus isn't in a field.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || !open) return
			if ((e.target as HTMLElement | null)?.closest("input, textarea")) return
			request(false)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, request])
	return { open, request, stage }
}

export type Dock = ReturnType<typeof useDock>

const mix = (a: number, b: number) =>
	`calc(${a} + ${(b - a).toFixed(4)} * var(--pst-p, 0))`

export function StreamStage({
	flow,
	dock,
	light,
	shelf,
	strip,
	search,
	moods,
	card,
	grade,
	opening,
}: {
	flow: Exclude<Flow, "old">
	dock: Dock
	/** The room's light and framing with the card closed and open. */
	light: { closed: RoomLight; open: RoomLight }
	shelf: readonly ShelfTitle[]
	strip: StripModel
	search: ReactNode
	moods: ReactNode
	card: ReactNode
	grade?: ReactNode
	opening?: ReactNode
}) {
	const { open, request } = dock
	const now = open ? light.open : light.closed
	// Scroll mixes the two lights by the scroll's progress; the others switch and ease.
	const night = (flow === "c" ? mix(light.closed.night, light.open.night) : now.night) as unknown as number
	const camera = (flow === "c" ? mix(light.closed.camera, light.open.camera) : now.camera) as unknown as number
	return (
		<section
			ref={dock.stage as RefObject<HTMLElement>}
			aria-labelledby="start-heading"
			className="start-stage pst-stage"
			style={FRAME_STYLE}
			data-flow={flow}
			{...(open ? { "data-open": "" } : {})}
		>
			{opening}
			<div className="pst-frame">
				<StartRoom night={night} camera={camera} titles={shelf}>
					{grade}
				</StartRoom>
				<div aria-hidden className="start-veil" />
				<div className="pst-content">
					<div className="start-top">
						<div className="start-block">
							<div aria-hidden className="start-pool" />
							<h1 id="start-heading" className="start-heading" data-start-obstacle="">
								{START_HEADING}
							</h1>
							<div className="start-search" data-start-obstacle="">
								{search}
							</div>
							<div className="start-moods">
								<div className="mx-auto w-fit max-w-full" data-start-obstacle="">
									{moods}
								</div>
							</div>
						</div>
					</div>
					<div className="pst-dock">
						{flow === "a" ? (
							<div className="pst-head">
								<div className="pst-edge" aria-hidden />
								<StripButton
									strip={strip}
									open={open}
									onOpen={() => request(true)}
								/>
								<button
									type="button"
									className="pst-head-hide"
									tabIndex={open ? undefined : -1}
									aria-label="Hide"
									onClick={() => request(false)}
								>
									<span className="pst-grabber" aria-hidden />
								</button>
							</div>
						) : null}
						<div className="start-card-wrap pst-card-wrap">
							<div
								id="start-card"
								className="start-card"
								data-start-obstacle=""
								{...(open ? {} : { inert: "" })}
							>
								{flow !== "a" ? (
									<button
										type="button"
										className="pst-tab"
										aria-label="Hide"
										tabIndex={open ? undefined : -1}
										onClick={() => request(false)}
									>
										<ChevronDownIcon className="h-4 w-4" />
									</button>
								) : null}
								{card}
							</div>
						</div>
						{flow !== "a" ? (
							<div className={flow === "b" ? "pst-island-wrap" : "pst-ledge-wrap"}>
								<StripButton
									strip={strip}
									open={open}
									onOpen={() => request(true)}
								/>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</section>
	)
}

function StripButton({
	strip,
	open,
	onOpen,
}: {
	strip: StripModel
	open: boolean
	onOpen: () => void
}) {
	return (
		<button
			type="button"
			className="pst-strip"
			aria-expanded={open}
			aria-controls="start-card"
			tabIndex={open ? -1 : undefined}
			onClick={onOpen}
			data-tone={strip.tone}
			{...(strip.busy ? { "data-busy": "" } : {})}
		>
			<span aria-hidden className="pst-sweep" />
			<span key={strip.key} className="pst-strip-body">
				{strip.posters.length ? (
					<span aria-hidden className="pst-posters">
						{strip.posters.map((p, i) =>
							p ? (
								<img
									// biome-ignore lint/suspicious/noArrayIndexKey: a fixed, short list
									key={i}
									src={tmdbImageUrl(p, "w92")}
									alt=""
									decoding="async"
									draggable={false}
									style={{ "--i": i, "--n": strip.posters.length } as CSSProperties}
								/>
							) : null,
						)}
					</span>
				) : (
					<span aria-hidden className="pst-glyph">
						{strip.busy ? <Dots /> : <Spark />}
					</span>
				)}
				<span className="pst-text">
					<span className="pst-tag">{strip.tag}</span>
					<span className="pst-line">{strip.line}</span>
				</span>
				<span className="pst-action">
					{strip.action}
					<ChevronUpIcon className="h-4 w-4" />
				</span>
			</span>
		</button>
	)
}

function Dots() {
	return (
		<span className="pst-dots">
			<i />
			<i />
			<i />
		</span>
	)
}

function Spark() {
	return (
		<svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
			<path d="M10 1.5l1.9 5.2 5.6.2-4.4 3.4 1.6 5.4L10 12.6 5.3 15.7l1.6-5.4L2.5 6.9l5.6-.2z" />
		</svg>
	)
}
