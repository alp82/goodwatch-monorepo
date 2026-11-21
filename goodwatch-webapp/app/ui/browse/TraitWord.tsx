// A fingerprint trait as a word. The word carries its family's color
// (feel rose, humor yellow, world sky, story violet, craft green); numbers never show up front. Hover, focus or tap
// opens a small card under the word with what the trait measures and, in
// plain words, how far this place leans that way against the usual. No scores: people don't steer by 7.7 of 10.
// the card renders into the document body, so no stacking context on the page (a head with `isolate`, the
// poster grid after it) can hide or clip it.
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { TraitWord as Trait } from "~/domain/browse/types"

const CARD_W = 264

export function TraitWord({
	trait,
	to,
	noun = "titles",
	children,
	className = "",
}: {
	trait: Trait
	/** The trait's own page; adds a link to the card. */
	to?: string
	/** "movies" or "shows", for the card's link. */
	noun?: string
	/** Other words than the trait's adjective. */
	children?: ReactNode
	className?: string
}) {
	const id = useId()
	const anchor = useRef<HTMLButtonElement>(null)
	const [open, setOpen] = useState(false)
	const [pinned, setPinned] = useState(false)
	const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null)
	const closeTimer = useRef<ReturnType<typeof setTimeout>>()

	const place = () => {
		const el = anchor.current
		if (!el) return
		const r = el.getBoundingClientRect()
		const left = Math.min(
			Math.max(8, r.left + r.width / 2 - CARD_W / 2),
			window.innerWidth - CARD_W - 8,
		)
		// Under the word unless the card would run off the bottom of the screen.
		const below = r.bottom + 200 < window.innerHeight || r.top < 190
		setPos({ left, top: below ? r.bottom + 8 : r.top - 8, below })
	}
	const show = () => {
		clearTimeout(closeTimer.current)
		place()
		setOpen(true)
	}
	const hide = () => {
		clearTimeout(closeTimer.current)
		closeTimer.current = setTimeout(() => {
			setOpen(false)
			setPinned(false)
		}, 120)
	}

	useEffect(() => {
		if (!open) return
		const away = (e: Event) => {
			if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return
			if (e.type === "pointerdown" && (e.target as HTMLElement).closest(`[data-trait="${id}"]`))
				return
			setOpen(false)
			setPinned(false)
		}
		const moved = () => !pinned && setOpen(false)
		window.addEventListener("pointerdown", away)
		window.addEventListener("keydown", away)
		window.addEventListener("scroll", moved, { passive: true })
		return () => {
			window.removeEventListener("pointerdown", away)
			window.removeEventListener("keydown", away)
			window.removeEventListener("scroll", moved)
		}
	}, [open, pinned, id])

	return (
		<span data-trait={id} className="relative inline">
			<button
				ref={anchor}
				type="button"
				aria-expanded={open}
				aria-controls={open ? id : undefined}
				onPointerEnter={(e) => e.pointerType === "mouse" && show()}
				onPointerLeave={(e) => e.pointerType === "mouse" && !pinned && hide()}
				onFocus={show}
				onBlur={() => !pinned && hide()}
				onClick={() => {
					if (open && pinned) {
						setOpen(false)
						setPinned(false)
					} else {
						show()
						setPinned(true)
					}
				}}
				className={`cursor-help rounded-sm font-semibold underline decoration-dotted decoration-1 underline-offset-[5px] outline-none transition-[text-decoration-color,filter] duration-150 hover:brightness-125 focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
				style={{
					color: trait.color,
					textDecorationColor: `color-mix(in oklab, ${trait.color} 55%, transparent)`,
				}}
			>
				{children ?? trait.word}
			</button>
			{open &&
				pos &&
				createPortal(
					<span
						data-trait={id}
						id={id}
						role="tooltip"
						ref={(el) => {
							if (!el || el.dataset.shown) return
							el.dataset.shown = "1"
							if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
							// A short, small scale-fade from the word: nothing flies in.
							const lift = pos.below ? "" : "translateY(-100%) "
							el.style.transformOrigin = pos.below ? "50% 0" : "50% 100%"
							el.animate(
								[
									{ opacity: 0, transform: `${lift}scale(0.96)` },
									{ opacity: 1, transform: `${lift}scale(1)` },
								],
								{ duration: 140, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
							)
						}}
						onPointerEnter={() => clearTimeout(closeTimer.current)}
						onPointerLeave={(e) => e.pointerType === "mouse" && !pinned && hide()}
						className="trait-card fixed z-[70] block rounded-xl bg-gray-900 p-3.5 text-left text-sm font-normal text-gray-300 shadow-2xl shadow-black/60 ring-1 ring-white/15"
						style={{
							width: CARD_W,
							left: pos.left,
							top: pos.top,
							transform: pos.below ? undefined : "translateY(-100%)",
						}}
					>
						<span className="flex items-center gap-2">
							<span
								aria-hidden
								className="h-2 w-2 rounded-full"
								style={{ background: trait.color }}
							/>
							<span className="font-semibold text-white">{trait.label}</span>
						</span>
						{trait.meaning && <span className="mt-1.5 block leading-snug">{trait.meaning}</span>}
						<span className="mt-3 flex items-center gap-2.5">
							<Lean trait={trait} />
							<span className="text-[13px] leading-snug font-semibold text-white">
								{leanWords(trait, noun)}
							</span>
						</span>
						{to && (
							<Link
								to={to}
								prefetch="intent"
								className="mt-3 block border-t border-white/10 pt-2.5 text-sm font-semibold text-amber-300 hover:text-amber-200"
							>
								All {trait.word} {noun} <span aria-hidden>→</span>
							</Link>
						)}
					</span>,
					document.body,
				)}
		</span>
	)
}

/** How far a place leans: the gap between its average and the usual, as a word people use. */
function leanStrength(t: Trait): 0 | 1 | 2 | 3 {
	const gap = Math.abs(t.value - t.base)
	return gap >= 3 ? 3 : gap >= 1.6 ? 2 : gap >= 0.6 ? 1 : 0
}

/** "Far more melancholic than most movies", "A little less violent than most shows". */
export function leanWords(t: Trait, noun = "titles"): string {
	const n = leanStrength(t)
	if (n === 0) return `About as ${t.word} as most ${noun}`
	const how = n === 3 ? "Far" : n === 2 ? "Clearly" : "A little"
	return `${how} ${t.dir === "less" ? "less" : "more"} ${t.word} than most ${noun}`
}

/** Three small bars that fill with the strength of the lean, in the trait's color: a gauge without a number. */
function Lean({ trait }: { trait: Trait }) {
	const n = leanStrength(trait)
	return (
		<span aria-hidden className="flex shrink-0 items-end gap-[3px]">
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="w-[5px] rounded-sm"
					style={{
						height: 7 + i * 4,
						background: i < n ? trait.color : "rgba(255,255,255,0.12)",
					}}
				/>
			))}
		</span>
	)
}

const join = (nodes: ReactNode[], last: string) =>
	nodes.flatMap((node, i) =>
		i === 0
			? [node]
			: [i === nodes.length - 1 ? (nodes.length > 2 ? `, ${last} ` : ` ${last} `) : ", ", node],
	)

/**
 * A place's character as one sentence of trait words: "Heartwarming, hopeful and funny. Rarely bleak or violent."
 * Words, not chips: it reads as a line of the page.
 */
export function TraitSentence({
	more,
	less = [],
	to,
	noun,
	className = "",
}: {
	more: Trait[]
	less?: Trait[]
	/** The trait's page, where one exists. */
	to?: (trait: Trait) => string
	noun?: string
	className?: string
}) {
	if (!more.length) return null
	const word = (t: Trait, first: boolean) => (
		<TraitWord key={t.key} trait={t} to={to?.(t)} noun={noun}>
			{first ? t.word.charAt(0).toUpperCase() + t.word.slice(1) : t.word}
		</TraitWord>
	)
	return (
		<p className={`text-lg leading-relaxed text-gray-300 ${className}`}>
			{join(
				more.map((t, i) => word(t, i === 0)),
				"and",
			)}
			.
			{less.length > 0 && (
				<>
					{" "}
					Rarely{" "}
					{join(
						less.map((t) => word(t, false)),
						"or",
					)}
					.
				</>
			)}
		</p>
	)
}
