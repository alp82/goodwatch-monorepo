// PROTOTYPE (start page lab): b "Lit in place": posters in the slots, dimmed to the room's light, with a case edge,
// shadow and glare; hover (or a first tap on a phone) lifts one and shows its title and score beside it, unrotated.
// LitPoster, useSlotPointer and LiftCaption are shared with d and e.
import { Link, useNavigate } from "@remix-run/react"
import { type ReactNode, useEffect, useRef } from "react"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { TitleBand } from "~/ui/poster-card/TitleBand"
import { titleHref, tmdbImage } from "../../lab/kit"
import { type LabCard, type SlotProps, useLab } from "../../lab/types"
import type { SceneLayout } from "../../scene/SceneStage"
import { canHover, getShelf, setShelf, useRoomEl, useShelf } from "./store"

/** The poster drawn into a slot, made to sit in the room. `lifted` brings it forward and up to full brightness. */
export function LitPoster({
	card,
	kind,
	lifted,
	children,
}: {
	card: LabCard
	kind: string
	lifted: boolean
	children?: ReactNode
}) {
	const { scene } = useLab()
	const pixel = scene.landscape.style === "pixel-art"
	const isCase = kind.startsWith("case")
	return (
		<div
			className="relative h-full w-full transition-transform duration-200 ease-out will-change-transform"
			style={{ transform: lifted ? "translateY(-4%) scale(1.08)" : "none" }}
		>
			{/* Contact shadow (always), and a deeper one when lifted: only its opacity changes. */}
			<div className="absolute inset-0 shadow-[0_10px_22px_rgba(0,0,0,0.65)]" />
			<div
				className="absolute inset-0 shadow-[0_34px_60px_rgba(0,0,0,0.75)] transition-opacity duration-200"
				style={{ opacity: lifted ? 1 : 0 }}
			/>
			<img
				src={tmdbImage(card.poster_path, pixel ? "w185" : "w342")}
				alt=""
				draggable={false}
				className="absolute inset-0 h-full w-full object-cover"
				style={pixel ? { imageRendering: "pixelated" } : undefined}
			/>
			{/* The room's light: warm and lower, gone when lifted. */}
			<div
				className="absolute inset-0 bg-[rgb(28,14,2)] transition-opacity duration-200"
				style={{ opacity: lifted ? 0 : 0.34 }}
			/>
			{/* A case's spine and plastic edge, or a frame's glass edge. */}
			{isCase ? (
				<>
					<div className="absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/70 via-white/10 to-transparent" />
					<div className="absolute inset-0 shadow-[inset_0_0_0_5px_rgba(0,0,0,0.45),inset_0_0_0_7px_rgba(255,255,255,0.07)]" />
				</>
			) : (
				<div className="absolute inset-0 shadow-[inset_0_0_0_9px_rgba(0,0,0,0.5),inset_0_0_14px_12px_rgba(0,0,0,0.35)]" />
			)}
			{/* Glare across the glass or plastic. */}
			<div
				className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.04)_28%,transparent_42%,transparent_78%,rgba(255,214,160,0.08)_100%)] transition-opacity duration-200"
				style={{ opacity: lifted ? 1 : 0.7 }}
			/>
			{/* The lifted outline, in amber. */}
			<div
				className="absolute inset-0 shadow-[0_0_0_6px_rgba(251,191,36,0.75)] transition-opacity duration-200"
				style={{ opacity: lifted ? 1 : 0 }}
			/>
			{children}
		</div>
	)
}

/** Hover, focus and tap handling of a lit slot: a mouse lifts on hover and opens on click; a finger lifts on the first
 * tap and opens on the second. */
export function useSlotPointer(index: number) {
	const ref = useRef<HTMLAnchorElement>(null)
	const room = useRoomEl(ref)
	const state = useShelf(room)
	const lifted = state.lift === index
	const handlers = {
		onPointerEnter: (e: React.PointerEvent) => {
			if (e.pointerType === "mouse" && !getShelf(room).pinned) setShelf(room, { lift: index, pinned: false })
		},
		onPointerLeave: (e: React.PointerEvent) => {
			const s = getShelf(room)
			if (e.pointerType === "mouse" && s.lift === index && !s.pinned) setShelf(room, { lift: null })
		},
		onFocus: () => setShelf(room, { lift: index, pinned: false }),
		onBlur: () => {
			const s = getShelf(room)
			if (s.lift === index && !s.pinned) setShelf(room, { lift: null })
		},
		onClick: (e: React.MouseEvent) => {
			if (canHover()) return
			const s = getShelf(room)
			if (s.lift === index && s.pinned) return
			e.preventDefault()
			setShelf(room, { lift: index, pinned: true })
		},
	}
	return { ref, room, state, lifted, handlers }
}

export function LitSlot({ card, slot, index }: SlotProps) {
	const { ref, lifted, handlers } = useSlotPointer(index)
	if (!card?.poster_path) return null
	return (
		<Link
			ref={ref}
			to={titleHref(card)}
			prefetch="none"
			data-shelf-slot=""
			aria-label={card.title}
			draggable={false}
			className="block h-full w-full outline-none [-webkit-tap-highlight-color:transparent]"
			{...handlers}
		>
			<LitPoster card={card} kind={slot.kind} lifted={lifted} />
		</Link>
	)
}

const CAPTION_W = 176

/** The title and score of the lifted slot, flat and readable, next to the slot. A link when tapped (phones). */
export function LiftCaption({ cards, layout }: { cards: LabCard[]; layout: SceneLayout | null }) {
	const ref = useRef<HTMLDivElement>(null)
	const room = useRoomEl(ref)
	const state = useShelf(room)
	const last = useRef<{ index: number; card: LabCard } | null>(null)
	const navigate = useNavigate()

	// A tap elsewhere drops a pinned lift.
	useEffect(() => {
		if (!state.pinned) return
		const off = (e: PointerEvent) => {
			const t = e.target as Element | null
			if (t?.closest("[data-shelf-slot],[data-shelf-caption]")) return
			setShelf(room, { lift: null, pinned: false })
		}
		document.addEventListener("pointerdown", off)
		return () => document.removeEventListener("pointerdown", off)
	}, [state.pinned, room])

	const index = state.lift
	const card = index != null ? cards[index] : null
	if (index != null && card) last.current = { index, card }
	const shown = last.current
	const visible = index != null && !!card

	return (
		<div ref={ref} className="pointer-events-none absolute inset-0" style={{ zIndex: visible ? 20 : undefined }}>
			{layout ? (
				<TapTargets
					layout={layout}
					cards={cards}
					onTap={(i, c) => {
						const s = getShelf(room)
						if (s.lift === i && s.pinned) navigate(titleHref(c))
						else setShelf(room, { lift: i, pinned: true })
					}}
				/>
			) : null}
			{layout && shown && layout.slots[shown.index]
				? (() => {
						const { rect } = layout.slots[shown.index]
						const { cw, ch } = layout.cover
						const w = Math.min(CAPTION_W, cw - 16)
						const h = 92
						const left = Math.max(8, Math.min(cw - w - 8, rect.left + rect.width / 2 - w / 2))
						// Below the slot, else above; and off the TV and the label a tv variant may put under it.
						const tv = layout.tv.rect
						const hitsTv = (y: number) =>
							left < tv.left + tv.width && left + w > tv.left && y < tv.top + tv.height + 56 && y + h > tv.top
						const fits = (y: number) => y >= 8 && y + h <= ch - 8
						const yBelow = rect.top + rect.height + 8
						const yAbove = rect.top - h - 8
						const options = [yBelow, yAbove].filter(fits)
						const pick = options.find((y) => !hitsTv(y)) ?? options[0] ?? Math.max(8, Math.min(ch - h - 8, yBelow))
						const below = pick === yBelow
						const top = pick
						return (
							<Link
								to={titleHref(shown.card)}
								prefetch="none"
								data-shelf-caption=""
								tabIndex={-1}
								className="@container/card absolute block overflow-hidden rounded-md bg-gray-900 shadow-lg shadow-black/60 ring-1 ring-white/10 transition-[opacity,transform] duration-200 ease-out"
								style={{
									left,
									top,
									width: w,
									height: h,
									opacity: visible ? 1 : 0,
									transform: visible ? "translateY(0)" : `translateY(${below ? -6 : 6}px)`,
									pointerEvents: visible && state.pinned ? "auto" : "none",
								}}
							>
								{shown.card.backdrop_path ? (
									<img
										src={`https://image.tmdb.org/t/p/w300${shown.card.backdrop_path}`}
										alt=""
										className="absolute inset-0 h-full w-full object-cover opacity-60"
									/>
								) : null}
								<TitleBand
									title={shown.card.title}
									year={shown.card.release_year}
									top={
										<ScorePill
											goodwatch={shown.card.goodwatch_overall_score_normalized_percent}
											score={null}
											mark={null}
											size="M"
											className="mb-1.5"
										/>
									}
								/>
							</Link>
						)
					})()
				: null}
		</div>
	)
}

const MIN_TAP = 44

/** Finger-sized tap targets over slots too small to hit on a phone (unrotated, centered on the slot). */
export function TapTargets({
	layout,
	cards,
	onTap,
}: {
	layout: SceneLayout
	cards: LabCard[]
	onTap: (index: number, card: LabCard) => void
}) {
	if (canHover()) return null
	return (
		<>
			{layout.slots.map(({ rect }, i) => {
				const card = cards[i]
				if (!card || (rect.width >= MIN_TAP && rect.height >= MIN_TAP)) return null
				const w = Math.max(MIN_TAP, rect.width)
				const h = Math.max(MIN_TAP, rect.height)
				return (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed per scene
						key={i}
						type="button"
						aria-label={card.title}
						data-shelf-slot=""
						className="pointer-events-auto absolute [-webkit-tap-highlight-color:transparent]"
						style={{ left: rect.left + rect.width / 2 - w / 2, top: rect.top + rect.height / 2 - h / 2, width: w, height: h }}
						onClick={() => onTap(i, card)}
					/>
				)
			})}
		</>
	)
}
