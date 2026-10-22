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
// The phone shows the same pick on its fixed canvas without scrolling, in one of two designs to compare (a
// prototype, ../prototype/watch-next-variant.tsx): A, one pick at a time with an arrow to either side and a swipe
// to the next; B, a compact strip of the picks' posters that pages by its arrows.
//
// A chunk the TV asks for on first use (screen-code.tsx).
import { type ReactNode, useEffect, useRef, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	Ambient,
	CornerBar,
	Expand,
	ExpandCorner,
	Img,
	Item,
	PHONE_FOOT,
	PHONE_HEAD,
	PHONE_SIDE,
	PageArrow,
	TrailerKey,
	backdropSize,
	keySize,
	phoneFit,
	usePage,
	useTvView,
} from "../kit"
import {
	type WatchNextVariant,
	WatchNextVariantSwitcher,
	useWatchNextVariant,
} from "../prototype/watch-next-variant"
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
	const variant = useWatchNextVariant()
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
			className={`tvc-btn tvc-watch flex shrink-0 items-center gap-2.5 whitespace-nowrap ${P ? "px-4 text-[19px]" : "px-7 text-[24px]"}`}
			style={{ height: h }}
		>
			{offer && !P
				? `Watch on ${offer.name}`
				: offer
					? "Watch"
					: "Where to watch"}
		</Item>
	)
	const keyClass = `tvc-btn flex shrink-0 items-center justify-center gap-2 whitespace-nowrap ${P ? "px-3.5 text-[19px]" : "px-7 text-[24px]"}`
	const trailer = items.includes("trailer") && (
		<TrailerKey height={h} says={`Trailer: ${card.title}`} />
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
			<PhoneTonight
				variant={variant}
				items={items}
				picks={picks}
				at={at}
				backdrop={backdrop}
				keys={{ watch, trailer, details, another }}
			/>
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

// ---------------------------------------------------------------------------------------------------------
// The phone: the canvas's 448 x 194 under the header, in three rows as tall as a key, and nothing scrolls.

/** How tall a title is set on the phone: long names smaller, so they stay on their line. */
const phoneName = (name: string) => (name.length > 30 ? 18 : name.length > 22 ? 21 : 25)

/** A pick's name and its facts with its score, on one line each. `short` leaves the runtime out where it is narrow. */
function PhoneTitle({
	pick,
	at,
	count,
	short = false,
}: { pick: TvTonightPick; at: number; count: number; short?: boolean }) {
	const card = pick.card
	const facts = short
		? [card.release_year, card.media_type === "show" ? "Show" : "Movie", pick.episode?.code]
				.filter(Boolean)
				.join(" · ")
		: pickFacts(pick)
	return (
		<div className="min-w-0 flex-1">
			<div
				className="truncate font-extrabold leading-[1.15] tracking-tight"
				style={{ fontSize: phoneName(card.title) }}
			>
				{card.title}
			</div>
			<div className="mt-1 flex items-center gap-2 text-[16px] leading-tight text-white/80">
				<ScoreRing media={{ details: card }} size={26} label={false} />
				<span className="shrink-0 font-semibold text-amber-300">
					{at + 1} of {count}
				</span>
				<span className="min-w-0 truncate">{facts}</span>
			</div>
		</div>
	)
}

/**
 * A swipe across the picture: sideways, far enough and more sideways than down. It shows the pick before or after;
 * the finger's pointing (pointing.ts) is cancelled first, so letting go chooses nothing under it.
 */
function useSwipe(onSwipe: (by: 1 | -1) => void) {
	const start = useRef<{ id: number; x: number; y: number } | null>(null)
	const latest = useRef(onSwipe)
	latest.current = onSwipe
	return {
		onPointerDown: (e: React.PointerEvent) => {
			if (e.pointerType === "mouse") return
			start.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
		},
		onPointerUp: (e: React.PointerEvent) => {
			const from = start.current
			start.current = null
			if (!from || from.id !== e.pointerId) return
			const dx = e.clientX - from.x
			const dy = e.clientY - from.y
			if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.4) return
			window.dispatchEvent(
				new PointerEvent("pointercancel", { pointerId: e.pointerId, pointerType: e.pointerType }),
			)
			latest.current(dx < 0 ? 1 : -1)
		},
		onPointerCancel: () => {
			start.current = null
		},
	}
}

function PhoneTonight({
	variant,
	items,
	picks,
	at,
	backdrop,
	keys,
}: {
	variant: WatchNextVariant
	items: readonly string[]
	picks: readonly TvTonightPick[]
	at: number
	backdrop: string | null
	keys: Record<"watch" | "trailer" | "details" | "another", ReactNode>
}) {
	const { canvas, dispatch } = useTvView()
	const count = picks.length
	const key = keySize(canvas, 54)
	const swipe = useSwipe((by) => {
		const arrow = by > 0 ? "next-pick" : "prev-pick"
		if (items.includes(arrow)) dispatch({ type: "choose", item: arrow })
	})
	const shown = picks[at]
	const arrow = (id: "prev-pick" | "next-pick") =>
		items.includes(id) ? (
			<Item
				id={id}
				label={id === "next-pick" ? "Next pick" : "Previous pick"}
				className="tvc-btn tvc-arrow flex shrink-0 items-center justify-center"
				style={{ width: key, height: key }}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
					<path d={id === "next-pick" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
				</svg>
			</Item>
		) : (
			<span aria-hidden className="shrink-0" style={{ width: key }} />
		)
	const row = "flex items-center gap-2"
	// B's strip: four posters a page. Worked out for A too, so the hooks stay the same whichever is on show.
	const ids = picks.map((_, i) => `pick:${i}`).filter((id) => items.includes(id))
	// Four posters a page upright, up to seven on a phone's wide canvas; the page holds the pick on show, so Back
	// from Details comes back to it.
	const page = usePage(
		ids,
		phoneFit(canvas, 4, Math.round(((key + 4) * 2) / 3) + 8, 7),
		`pick:${at}`,
	)
	const expand = items.includes("expand") && <Expand />
	let body: ReactNode
	if (variant === "b") {
		// B: the strip of posters, a page of four, then the pick on show and its keys.
		const posterH = key + 4
		body = (
			<>
				<div className={row} style={{ height: posterH }}>
					<PageArrow to={page.prev} dir="prev" label="Previous picks" />
					<div className="flex min-w-0 flex-1 items-center gap-2">
						{page.shown.map((id) => {
							const p = picks[Number(id.slice(5))]
							return (
								<Item
									key={id}
									id={id}
									label={p.card.title}
									pressed={id === `pick:${at}`}
									className={`tvc-ring block shrink-0 overflow-hidden rounded-[8px] bg-[#161a24] ${id === `pick:${at}` ? "shadow-[0_0_0_2px_#fbbf24]" : "opacity-80"}`}
									style={{ width: Math.round((posterH * 2) / 3), height: posterH }}
								>
									{p.card.poster_path && (
										<Img src={tmdbImageUrl(p.card.poster_path, "w154")} className="absolute inset-0 h-full w-full" />
									)}
								</Item>
							)
						})}
					</div>
					<PageArrow to={page.next} dir="next" label="More picks" />
					{keys.another}
				</div>
				<div className={`${row} mt-1`} style={{ height: key }}>
					<PhoneTitle pick={shown} at={at} count={count} short />
					{expand}
				</div>
				<div className={`${row} mt-1`} style={{ height: key }}>
					{keys.watch}
					{keys.trailer}
					{keys.details}
				</div>
			</>
		)
	} else {
		// A: one pick at a time, an arrow to either side; then its keys, and Not now beside the way to all of them.
		body = (
			<>
				<div className={row} style={{ height: key }}>
					{arrow("prev-pick")}
					<div key={at} className="tvc-fade min-w-0 flex-1 px-1">
						<PhoneTitle pick={shown} at={at} count={count} />
					</div>
					{arrow("next-pick")}
				</div>
				<div className={`${row} mt-1.5`} style={{ height: key }}>
					{keys.watch}
					{keys.trailer}
					{keys.details}
				</div>
				<div className={`${row} mt-1.5 justify-between`} style={{ height: key }}>
					{keys.another}
					{expand}
				</div>
			</>
		)
	}
	return (
		<div className="absolute inset-0" {...(variant === "a" ? swipe : {})}>
			{backdrop && <Ambient src={backdrop} />}
			<div
				className="absolute inset-0"
				style={{
					background:
						"linear-gradient(0deg, rgba(7,8,12,.96) 0%, rgba(7,8,12,.86) 55%, rgba(7,8,12,.55) 100%)",
				}}
			/>
			<div
				data-watch-next-variant={variant}
				className="absolute inset-x-0 bottom-0 flex flex-col justify-end"
				style={{ top: PHONE_HEAD, paddingLeft: PHONE_SIDE, paddingRight: PHONE_SIDE, paddingBottom: PHONE_FOOT }}
			>
				{body}
			</div>
			<CornerBar items={items} />
			<WatchNextVariantSwitcher variant={variant} />
		</div>
	)
}
