// PROTOTYPE - throwaway.
// Allsliders, polished: hovering or tapping a slider opens a floating card (desktop) or bottom sheet (phones); nothing moves.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { HEX } from "~/ui/details/DetailsFingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import {
	BLURB,
	GROUPS,
	GroupHead,
	KEYFRAMES,
	MoreLinkChips,
	RowFace,
	type Scale,
	SectionTitle,
	TraitBars,
	cardStyle,
	groupOf,
	id,
	moreLinks,
	reading,
} from "./slidepop-parts"

type Open = { sc: Scale; pinned: boolean; sheet: boolean } | null

const CARD_W = 344
const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (min-width: 640px)").matches

function CardBody({ sc, t, onClose, titleId }: { sc: Scale; t: F.TitleInput; onClose?: () => void; titleId: string }) {
	const r = reading(sc, t)
	const links = moreLinks(sc, t)
	return (
		<>
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
						<span className="h-1.5 w-1.5 rounded-full" style={{ background: HEX[sc.area] }} aria-hidden="true" />
						{groupOf(sc)} · {sc.name}
					</p>
					<p id={titleId} className="mt-1 text-xl font-semibold leading-tight text-white">
						{r.word}
					</p>
					<p className="mt-1 text-sm text-gray-400">{BLURB[sc.name]}</p>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</div>
			<p className="mb-2.5 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Traits behind it</p>
			<TraitBars sc={sc} t={t} n={4} />
			{links.length > 0 && (
				<div className="mt-4 border-t border-white/8 pt-3">
					<p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">More like this</p>
					<MoreLinkChips links={links} area={sc.area} size="xs" />
				</div>
			)}
		</>
	)
}

export default function SlidePop({ t }: VariantProps) {
	const [open, setOpen] = useState<Open>(null)
	const [pos, setPos] = useState<{ left: number; top: number; arrow: number; above: boolean } | null>(null)
	const box = useRef<HTMLDivElement>(null)
	const card = useRef<HTMLDivElement>(null)
	const rows = useRef(new Map<string, HTMLButtonElement>())
	const closeTimer = useRef<ReturnType<typeof setTimeout>>()
	const openTimer = useRef<ReturnType<typeof setTimeout>>()

	const close = useCallback((refocus = false) => {
		setOpen((o) => {
			if (o && refocus) rows.current.get(o.sc.name)?.focus()
			return null
		})
	}, [])

	// Place the card under the row (or above it near the bottom of the viewport), centred on the thumb.
	const place = useCallback(() => {
		if (!open || open.sheet || !box.current || !card.current) return
		const row = rows.current.get(open.sc.name)
		const thumb = row?.querySelector<HTMLElement>("[role=img]")
		if (!row || !thumb) return
		const b = box.current.getBoundingClientRect()
		const rr = row.getBoundingClientRect()
		const tr = thumb.getBoundingClientRect()
		const v = reading(open.sc, t).v
		// Page coordinates: the card lives in a portal on <body>, above the page's other sections.
		const thumbX = tr.left + 14 + v * (tr.width - 28)
		const left = Math.max(b.left, Math.min(b.right - CARD_W, thumbX - CARD_W / 2))
		const h = card.current.offsetHeight
		const above = rr.bottom + h + 16 > window.innerHeight && rr.top - h - 16 > 72
		const top = (above ? rr.top - h - 8 : rr.bottom + 8) + window.scrollY
		setPos({ left: left + window.scrollX, top, arrow: Math.max(18, Math.min(CARD_W - 18, thumbX - left)), above })
	}, [open, t])

	useLayoutEffect(() => {
		place()
	}, [place])

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true)
		const onDown = (e: PointerEvent) => {
			const n = e.target as Node
			if (card.current?.contains(n)) return
			if ([...rows.current.values()].some((r) => r.contains(n))) return
			close()
		}
		window.addEventListener("keydown", onKey)
		window.addEventListener("resize", place)
		if (open.pinned || open.sheet) document.addEventListener("pointerdown", onDown)
		return () => {
			window.removeEventListener("keydown", onKey)
			window.removeEventListener("resize", place)
			document.removeEventListener("pointerdown", onDown)
		}
	}, [open, close, place])

	useEffect(() => {
		if (open?.sheet) card.current?.querySelector<HTMLButtonElement>("button")?.focus()
	}, [open?.sheet, open?.sc])

	const hoverIn = (sc: Scale) => {
		clearTimeout(closeTimer.current)
		if (open?.pinned) return
		clearTimeout(openTimer.current)
		openTimer.current = setTimeout(() => setOpen({ sc, pinned: false, sheet: false }), open ? 0 : 90)
	}
	const hoverOut = () => {
		clearTimeout(openTimer.current)
		if (open?.pinned) return
		closeTimer.current = setTimeout(() => setOpen((o) => (o?.pinned ? o : null)), 160)
	}
	const click = (sc: Scale) => {
		clearTimeout(openTimer.current)
		if (open?.sc === sc && (open.pinned || open.sheet)) return close()
		setOpen({ sc, pinned: true, sheet: !canHover() })
	}

	const titleId = open ? `${id("slidepop-card", open.sc)}-title` : undefined

	return (
		<div ref={box} className="relative">
			<style>{KEYFRAMES}</style>
			<SectionTitle t={t} />
			<p className="mt-2 max-w-3xl text-[17px] leading-relaxed text-gray-300">{F.summary(t)}</p>

			<div className="mt-6 grid gap-x-16 gap-y-6 lg:grid-cols-2 [&>*]:min-w-0">
				{[[GROUPS[0]], [GROUPS[1], GROUPS[2]]].map((col) => (
					<div key={col[0].name} className="space-y-6">
						{col.map((g) => (
							<section key={g.name}>
								<GroupHead name={g.name} />
								<ul>
									{g.scales.map((sc) => {
										const active = open?.sc === sc
										return (
											<li key={sc.name}>
												<button
													type="button"
													ref={(el) => {
														if (el) rows.current.set(sc.name, el)
													}}
													aria-expanded={active}
													aria-haspopup="dialog"
													aria-controls={active ? id("slidepop-card", sc) : undefined}
													onPointerEnter={(e) => e.pointerType === "mouse" && hoverIn(sc)}
													onPointerLeave={(e) => e.pointerType === "mouse" && hoverOut()}
													onClick={() => click(sc)}
													className={`-mx-2.5 flex w-[calc(100%+1.25rem)] cursor-pointer rounded-xl px-2.5 py-1.5 text-left sm:py-2 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-amber-300 ${active ? "bg-white/[0.05]" : ""}`}
												>
													<RowFace sc={sc} t={t} active={active} />
												</button>
											</li>
										)
									})}
								</ul>
							</section>
						))}
					</div>
				))}
			</div>
			<p className="mt-4 text-xs text-gray-500">
				<span className="hidden sm:inline">Point at a scale to see the traits behind it; click to keep it open.</span>
				<span className="sm:hidden">Tap a scale to see the traits behind it.</span>
			</p>

			{/* Desktop: floating card, absolutely placed, so it never moves the page. */}
			{open &&
				!open.sheet &&
				createPortal(
				<div
					ref={card}
					id={id("slidepop-card", open.sc)}
					role="dialog"
					aria-labelledby={titleId}
					onPointerEnter={() => clearTimeout(closeTimer.current)}
					onPointerLeave={hoverOut}
					className="absolute z-30 rounded-2xl border border-white/10 p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] motion-safe:animate-[fpIn_140ms_ease-out]"
					style={{ ...cardStyle(open.sc.area), width: CARD_W, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
				>
					{pos && (
						<span
							className={`absolute h-3 w-3 rotate-45 border-white/10 bg-[#0e1015] ${pos.above ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-l border-t"}`}
							style={{ left: pos.arrow - 6 }}
							aria-hidden="true"
						/>
					)}
					<CardBody sc={open.sc} t={t} titleId={titleId!} onClose={open.pinned ? () => close(true) : undefined} />
				</div>,
				document.body,
			)}

			{/* Phones: bottom sheet overlay above everything, including the bottom drawer. */}
			{open?.sheet &&
				createPortal(
				<div className="fixed inset-0 z-[1100]">
					<button
						type="button"
						aria-label="Close"
						tabIndex={-1}
						onClick={() => close(true)}
						className="absolute inset-0 cursor-default bg-black/65 motion-safe:animate-[fpFade_160ms_ease-out]"
					/>
					<div
						ref={card}
						id={id("slidepop-card", open.sc)}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.9)] motion-safe:animate-[fpUp_220ms_cubic-bezier(.2,.8,.2,1)]"
						style={cardStyle(open.sc.area)}
					>
						<div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
						<CardBody sc={open.sc} t={t} titleId={titleId!} onClose={() => close(true)} />
					</div>
				</div>,
				document.body,
			)}
		</div>
	)
}
