// Watch next: the person's next pick, one at a time, large, and the rest of their picks in a stack beside it. The
// pick on show is enough to decide: its name, what kind of pick it is, a short line of facts, its GoodWatch score
// and where it streams, with Watch, Trailer and Details right there. Details has the rest (the title screen). A
// member's picks are their Next episode, their movies and their first show to start, in Watch next's own order
// (tv-home.ts, `tonightPicks`); a guest's are the best of the pool, led by the last title on their Wishlist.
//
// The stack shows three cards. The Remote and the keys move one card at a time with a card of lookahead; the wheel
// and a trackpad move one card per notch or stretch of swipe, at most one every 130 ms, and nothing is saved up at
// the ends. A pointer only points: the stack holds still under it, and cards out of view take no pointer. The card
// with the focus is the pick on show, and the address names it (tv-machine.ts, `showPick`).
//
// A chunk the TV asks for on first use (screen-code.tsx).
import { useEffect, useRef, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	Ambient,
	CornerBar,
	ExpandCorner,
	Img,
	Item,
	PhoneFoot,
	backdropSize,
	keySize,
	useTvView,
} from "../kit"
import { primaryOffer } from "../title-extras"
import type { TvTonightPick } from "../tv-home"
import { pickFacts, tonightWords } from "../tv-title"
import { useTvTitleExtras } from "../use-tv-extras"

const VISIBLE = 3
const CARD = 120
const RING = 12

/** Where a pick streams, in one quiet line: the person's own service first. */
export function StreamLine({
	services,
	size,
}: { services: TvTonightPick["card"]["services"]; size: number }) {
	const first = services?.[0]
	if (services === null)
		return <span className="text-white/55">Checking where it streams</span>
	if (!first) return <span className="text-white/60">Not streaming here</span>
	return (
		<span className="flex min-w-0 items-center gap-2.5">
			{first.logo_path && (
				<Img
					src={tmdbImageUrl(first.logo_path, "w92")}
					className="shrink-0 rounded-md"
					width={size}
					height={size}
				/>
			)}
			<span className="truncate font-semibold">{first.name}</span>
		</span>
	)
}

/**
 * Whether a wheel turn over the screen should scroll the room instead: the room scrolls first while it can still
 * move that way, and the screen steps after. Otherwise a TV that fills the window keeps the Remote under it out of
 * the wheel's reach.
 */
function roomScrolls(screen: HTMLElement, dy: number) {
	const room = screen.closest<HTMLElement>(".tvr-scroll")
	if (!room || !dy) return false
	return dy > 0
		? room.scrollTop + room.clientHeight < room.scrollHeight - 1
		: room.scrollTop > 0
}

/**
 * One step per wheel notch, or per stretch of a trackpad swipe, at most one every 130 ms. A pause or a turn starts a
 * new gesture; nothing is saved up at an end of the list, so turning back never jumps.
 */
export function useWheelSteps(onStep: (by: 1 | -1) => void) {
	const root = useRef<HTMLDivElement>(null)
	const step = useRef(onStep)
	step.current = onStep
	useEffect(() => {
		const el = root.current
		if (!el) return
		const w = { acc: 0, last: 0, at: 0 }
		const onWheel = (e: WheelEvent) => {
			const dy =
				e.deltaMode === 1
					? e.deltaY * 40
					: e.deltaMode === 2
						? e.deltaY * 600
						: e.deltaY
			if (roomScrolls(el, dy)) return
			e.preventDefault()
			const now = performance.now()
			if (!dy) return
			if (now - w.last > 200 || Math.sign(dy) !== Math.sign(w.acc)) w.acc = 0
			w.last = now
			w.acc += dy
			// A wheel's notch is one big delta; a trackpad sends a stream of small ones.
			const need = Math.abs(dy) >= 50 ? 50 : 140
			if (Math.abs(w.acc) < need || now - w.at < 130) return
			step.current(w.acc > 0 ? 1 : -1)
			w.acc = 0
			w.at = now
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => el.removeEventListener("wheel", onWheel)
	}, [])
	return root
}

export default function Tonight({
	items,
	picks,
	pick,
	waiting,
	failed = false,
	mine = [],
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	/** The picks, as many as the stack holds. */
	picks: readonly TvTonightPick[]
	/** The one on show, as the URL counts it. */
	pick: number
	/** The picks are still on their way; else there are none. */
	waiting: boolean
	/** The picks couldn't be read: not the same as an empty Wishlist. */
	failed?: boolean
	/** The person's own services, by TMDB provider id: Watch opens one of them first. */
	mine?: readonly number[]
}) {
	const { canvas, focused, byPointer, dispatch } = useTvView()
	const P = canvas.edition === "phone"
	const count = picks.length
	const at = count ? pick % count : 0
	const shown = picks[at]
	const key = shown ? `${shown.card.media_type}-${shown.card.tmdb_id}` : null
	const extras = useTvTitleExtras(key)
	const offer = extras.data
		? primaryOffer(
				extras.data.offers,
				mine.map((id) => ({ id })),
			)
		: null

	// The stack's first card in view. The keys keep a card of lookahead; a pointer points at a card in view, so the
	// stack holds still under it.
	const [first, setFirst] = useState(() =>
		Math.max(0, Math.min(at - 1, count - VISIBLE)),
	)
	useEffect(() => {
		const lead = byPointer ? 0 : 1
		setFirst((f) => {
			if (at < f + lead) return Math.max(0, at - lead)
			if (at > f + VISIBLE - 1 - lead)
				return Math.max(0, Math.min(at - VISIBLE + 1 + lead, count - VISIBLE))
			return f
		})
	}, [at, byPointer, count])

	// The wheel walks the stack, one card at a time, and stops at its ends.
	const root = useWheelSteps((by) => {
		const next = Math.max(0, Math.min(count - 1, at + by))
		if (next !== at) dispatch({ type: "focus", item: `pick:${next}` })
	})

	if (!shown)
		return (
			<div ref={root} className="absolute inset-0">
				<div className="absolute inset-0 bg-[#0b0d13]" />
				<div
					className={`absolute inset-0 flex flex-col justify-center text-white/70 ${P ? "px-5 pt-[84px] text-[21px]" : "px-14 pt-16 text-[28px]"}`}
				>
					{waiting
						? "Your next picks are on their way."
						: failed
							? "Your picks couldn't load. Try again in a moment."
							: "No picks right now. Add titles with Want to See, and they show here."}
				</div>
				<ExpandCorner items={items} />
				<CornerBar items={items} />
			</div>
		)

	const card = shown.card
	const words = tonightWords(shown, at, count)
	const h = keySize(canvas, P ? 50 : 56)
	const ring = { media: { details: card } }
	const watch = items.includes("watch") && (
		<Item
			id="watch"
			href={offer?.url}
			linkData={
				offer && extras.data
					? {
							"data-product-event": "streaming service clicked",
							"data-provider-id": offer.id,
							"data-tmdb-id": card.tmdb_id,
							"data-media-type": card.media_type,
							"data-country": extras.data.country,
							"data-offer-type": offer.type,
						}
					: undefined
			}
			label={
				offer
					? `Watch on ${offer.name} (opens in a new tab)`
					: "Where to watch, on its page"
			}
			className={`tvc-btn tvc-watch flex shrink-0 items-center gap-2.5 whitespace-nowrap ${P ? "px-5 text-[20px]" : "px-7 text-[24px]"}`}
			style={{ height: h }}
		>
			{offer && !P
				? `Watch on ${offer.name}`
				: offer
					? "Watch"
					: "Where to watch"}
		</Item>
	)
	const keyClass = `tvc-btn flex shrink-0 items-center justify-center gap-2 whitespace-nowrap ${P ? "px-4 text-[20px]" : "px-7 text-[24px]"}`
	const trailer = items.includes("trailer") && (
		<Item
			id="trailer"
			label="Trailer"
			className={keyClass}
			style={{ height: h }}
		>
			Trailer
		</Item>
	)
	const details = items.includes("details") && (
		<Item
			id="details"
			label="Details: scores, fingerprint, where to watch"
			className={keyClass}
			style={{ height: h }}
		>
			Details
		</Item>
	)
	const another = items.includes("another") && (
		<Item
			id="another"
			label="Not now"
			className={keyClass}
			style={{ height: h }}
		>
			Not now
		</Item>
	)
	const backdrop = card.backdrop_path
		? tmdbImageUrl(card.backdrop_path, backdropSize(canvas))
		: null

	if (P)
		return (
			<div ref={root} className="absolute inset-0">
				{backdrop && <Ambient src={backdrop} />}
				<div
					className="absolute inset-0"
					style={{
						background:
							"linear-gradient(0deg, rgba(7,8,12,1) 0%, rgba(7,8,12,.85) 38%, rgba(7,8,12,.15) 70%, rgba(7,8,12,.75) 100%)",
					}}
				/>
				{/* Anchored at the bottom; on a short phone it scrolls (mt-auto, not justify-end, so its top stays in
				    reach). */}
				<div
					data-tv-scroll
					className="absolute inset-x-0 bottom-2 top-[78px] flex flex-col overflow-hidden [&>*]:shrink-0"
				>
					<div className="mt-auto px-5">
						{canvas.h >= 380 && (
							<div className="flex items-center justify-between text-[18px] font-semibold text-amber-300">
								<span className="truncate">{words.crumb}</span>
								<span className="shrink-0 text-white/70">
									{at + 1} / {count}
								</span>
							</div>
						)}
						<div className="mt-1 flex h-[70px] items-end">
							<div className="line-clamp-2 text-[32px] font-extrabold leading-[1.05] tracking-tight">
								{card.title}
							</div>
						</div>
						<div className="mt-2 flex items-center gap-3 text-[18px] text-white/80">
							<ScoreRing {...ring} size={38} label={false} />
							<span className="truncate">{pickFacts(shown)}</span>
						</div>
					</div>
					{/* One row of keys; it pages sideways with the focus, and a finger can swipe it. The stack's cards are
					    items too, on a row of their own under it, for the keys and the Remote's wheel. */}
					<div
						data-tv-row
						className="mt-1.5 flex items-center gap-2.5 overflow-x-auto px-5 py-2 [scrollbar-width:none]"
					>
						{watch}
						{trailer}
						{details}
						{another}
					</div>
					{/* The stack's row gives way to the Expand key, which ends it (kit.tsx, `PhoneFoot`): its words say where
					    it goes, so it is as wide as they are and never rides past the picture's edge. */}
					<PhoneFoot
						items={items}
						height={Math.max(64, h) * 1.5 + 8}
						className="px-5"
					>
						<div
							data-tv-row
							className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]"
						>
							{picks.map((p, i) => (
								<Item
									key={`${p.card.media_type}-${p.card.tmdb_id}`}
									id={`pick:${i}`}
									label={p.card.title}
									className="tvc-ring tvc-lift block shrink-0 overflow-hidden rounded-[10px]"
									style={{
										width: Math.max(64, h),
										height: Math.max(64, h) * 1.5,
									}}
								>
									{p.card.poster_path && (
										<Img
											src={tmdbImageUrl(p.card.poster_path, "w154")}
											className="absolute inset-0 h-full w-full"
										/>
									)}
								</Item>
							))}
						</div>
					</PhoneFoot>
				</div>
				<CornerBar items={items} />
			</div>
		)

	return (
		<div ref={root} className="absolute inset-0">
			{backdrop && <Ambient src={backdrop} />}
			<div
				className="absolute inset-0"
				style={{
					background:
						"linear-gradient(90deg, rgba(7,8,12,.95) 0%, rgba(7,8,12,.72) 36%, rgba(7,8,12,.18) 58%, rgba(7,8,12,.55) 76%, rgba(7,8,12,.88) 100%), linear-gradient(0deg, rgba(7,8,12,.9) 0%, rgba(7,8,12,0) 40%), linear-gradient(180deg, rgba(7,8,12,.7) 0%, rgba(7,8,12,0) 22%)",
				}}
			/>
			<div className="absolute left-14 top-[100px] w-[640px]">
				<div className="flex h-[176px] flex-col justify-end">
					<div className="mb-2 text-[21px] font-semibold text-amber-300">
						{words.crumb}
					</div>
					<div className="line-clamp-2 text-[64px] font-extrabold leading-[1.04] tracking-tight [text-wrap:balance]">
						{card.title}
					</div>
				</div>
				<div className="mt-3 text-[22px] text-white/80">{pickFacts(shown)}</div>
				<div className="mt-5 flex h-[62px] items-center gap-7 text-[19px]">
					<ScoreRing {...ring} size={56} />
					<StreamLine services={card.services} size={30} />
				</div>
				<div className="mt-7 flex items-center gap-3.5">
					{watch}
					{trailer}
					{details}
				</div>
			</div>
			<div className="absolute right-12 top-[100px] w-[350px]">
				<div className="mb-1 flex h-[46px] items-center justify-between text-[20px]">
					<span>
						<span className="font-bold">Watch next</span>
						<span className="ml-2 text-white/60">
							{at + 1} of {count}
						</span>
					</span>
					{another}
				</div>
				{/* Three cards in view; the clip leaves room for the ring. Cards out of view are faded and take no
				    pointer, so nothing half hidden can take the focus. */}
				<div
					className="relative overflow-hidden"
					style={{
						height: CARD * VISIBLE + RING * 2,
						margin: `0 -${RING}px`,
						padding: `${RING}px ${RING}px 0`,
					}}
				>
					<div
						className="tvc-stack"
						style={{ transform: `translateY(${-first * CARD}px)` }}
					>
						{picks.map((p, i) => {
							const away = i < first || i >= first + VISIBLE
							return (
								<div
									key={`${p.card.media_type}-${p.card.tmdb_id}`}
									className="py-[6px] transition-opacity duration-200"
									style={{ height: CARD, opacity: away ? 0 : 1 }}
								>
									<Item
										id={`pick:${i}`}
										label={p.card.title}
										className={`tvc-ring flex h-full w-full items-center gap-4 rounded-[14px] pr-3 ${away ? "pointer-events-none" : ""} ${i === at ? "bg-white/[.16]" : "bg-black/45"}`}
									>
										<span className="relative h-[96px] w-[170px] shrink-0 overflow-hidden rounded-[10px] bg-[#161a24]">
											{p.card.backdrop_path && (
												<Img
													src={tmdbImageUrl(p.card.backdrop_path, "w300")}
													className="absolute inset-0 h-full w-full"
												/>
											)}
										</span>
										<span className="min-w-0 flex-1">
											<span className="line-clamp-2 text-[20px] font-bold leading-[1.15]">
												{p.card.title}
											</span>
											<span className="mt-1 block truncate text-[17px] text-white/60">
												{pickFacts(p, { code: true })}
											</span>
										</span>
									</Item>
								</div>
							)
						})}
					</div>
				</div>
			</div>
			<ExpandCorner items={items} />
			<CornerBar items={items} />
		</div>
	)
}
