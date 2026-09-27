// The moods control in the docked strip: the picked moods as small poster chips with a remove button, a button that
// opens the grid dropdown, and the dropdown itself: the 11 moods as poster tiles with how many Wishlist titles fit
// each, "k of 3", Clear, and Done. A fourth pick is refused with a hint (the page announces it in a live region).
// The phone's Moods drawer reuses the grid and the hint.
import {
	CheckIcon,
	ChevronDownIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MAX_MOODS, MOODS, MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import type { WatchNext } from "~/server/watch-next.server"
import { EASE, backdropUrl } from "./style"

export interface MoodControl {
	moods: MoodKey[]
	counts: WatchNext["moodCounts"]
	pictures: WatchNext["moodPictures"]
	/** "on your services" or "on your Wishlist": what the counts count. */
	countScope: string
	open: boolean
	setOpen: (open: boolean) => void
	/** Picks or unpicks a mood; a fourth pick is refused. */
	toggle: (mood: MoodKey) => void
	clear: () => void
	/** The mood last refused, with a counter so the same refusal shows again. */
	refused: { mood: MoodKey; at: number } | null
}

export const refusalText = (mood: MoodKey) =>
	`Three is the most. Remove one to add ${MOOD_BY_KEY[mood].name}.`

/** The mood colors that stand for "Any mood". */
export const SPECTRUM: readonly MoodKey[] = [
	"funny",
	"romance",
	"crime",
	"worlds",
]

const isFull = (control: MoodControl, mood: MoodKey) =>
	control.moods.length >= MAX_MOODS && !control.moods.includes(mood)

// A mood's picture: the backdrop of one of its titles, washed in the mood's color.
function MoodArt({
	mood,
	path,
	className = "",
}: {
	mood: MoodKey
	path: string | null
	className?: string
}) {
	const hue = MOOD_BY_KEY[mood].hue
	return (
		<span
			className={`absolute inset-0 -z-10 overflow-hidden ${className}`}
			aria-hidden
		>
			<span className="absolute inset-0" style={{ background: hue }} />
			{path && (
				<img
					src={backdropUrl(path, "w300")}
					alt=""
					loading="lazy"
					className="absolute inset-0 h-full w-full object-cover opacity-85"
				/>
			)}
			<span
				className="absolute inset-0"
				style={{
					background: `linear-gradient(90deg, ${hue}f0 0%, ${hue}a6 40%, ${hue}1f 100%)`,
				}}
			/>
			<span className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
		</span>
	)
}

// Four mood colors in a small fan, for the "Any mood" button.
function Spectrum() {
	return (
		<span className="flex -space-x-2" aria-hidden>
			{SPECTRUM.map((mood) => (
				<span
					key={mood}
					className="h-6 w-6 rounded-full ring-2 ring-gray-900"
					style={{ background: MOOD_BY_KEY[mood].hue }}
				/>
			))}
		</span>
	)
}

/** The picked moods as poster chips. Each opens the dropdown; its × removes the mood. */
export function PickedMoods({
	control,
	pinned,
}: {
	control: MoodControl
	pinned: boolean
}) {
	return (
		<>
			{control.moods.map((mood) => {
				const { name, hue } = MOOD_BY_KEY[mood]
				return (
					<motion.span
						layout
						key={mood}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className={`relative isolate inline-flex shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)] ${pinned ? "h-8" : "h-9"}`}
						style={{ boxShadow: `0 4px 18px -6px ${hue}` }}
					>
						<MoodArt
							mood={mood}
							path={control.pictures[mood]?.backdropPath ?? null}
						/>
						<button
							type="button"
							data-moodbutton
							aria-haspopup="dialog"
							aria-expanded={control.open}
							onClick={() => control.setOpen(!control.open)}
							className="inline-flex h-full cursor-pointer items-center gap-2 pl-2.5 pr-1"
						>
							<span className="whitespace-nowrap">{name}</span>
							<span className="rounded-md bg-black/30 px-1 text-xs tabular-nums">
								{control.counts[mood]}
							</span>
						</button>
						<button
							type="button"
							aria-label={`Remove ${name}`}
							onClick={() => control.toggle(mood)}
							className="mr-1.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/25 hover:bg-black/50"
						>
							<XMarkIcon className="h-3.5 w-3.5" />
						</button>
					</motion.span>
				)
			})}
		</>
	)
}

/** Opens the dropdown: "Any mood" with nothing picked, "Add" or "Change" next to picked moods. */
export function MoodButton({
	control,
	buttonRef,
}: {
	control: MoodControl
	buttonRef: React.RefObject<HTMLButtonElement>
}) {
	const picked = control.moods.length > 0
	return (
		<button
			ref={buttonRef}
			type="button"
			data-moodbutton
			aria-haspopup="dialog"
			aria-expanded={control.open}
			aria-label={picked ? "Change moods" : undefined}
			onClick={() => control.setOpen(!control.open)}
			className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 ${picked ? "px-2.5" : "pl-1.5 pr-3"} ${control.open ? "bg-white/15" : "bg-white/10"}`}
		>
			{picked ? (
				control.moods.length < MAX_MOODS ? (
					"Add"
				) : (
					"Change"
				)
			) : (
				<>
					<Spectrum />
					Any mood
				</>
			)}
			<ChevronDownIcon
				className={`h-4 w-4 opacity-70 transition-transform ${control.open ? "rotate-180" : ""}`}
				aria-hidden
			/>
		</button>
	)
}

function Tick({ on }: { on: boolean }) {
	return (
		<span
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`}
			aria-hidden
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** The refusal of a fourth pick, shown for a few seconds in place of the title. */
export function useRefusalHint(control: MoodControl): string | null {
	const [hint, setHint] = useState<string | null>(null)
	useEffect(() => {
		if (!control.refused) return
		setHint(refusalText(control.refused.mood))
		const id = setTimeout(() => setHint(null), 3200)
		return () => clearTimeout(id)
	}, [control.refused])
	return hint
}

// The dropdown's top line: the title or the refusal hint, "k of 3", Clear, and Done.
function PanelHead({
	control,
	onDone,
}: {
	control: MoodControl
	onDone: () => void
}) {
	const k = control.moods.length
	const hint = useRefusalHint(control)
	return (
		<div className="flex min-h-9 shrink-0 items-center gap-3 border-b border-white/8 px-3 py-2">
			<AnimatePresence mode="wait" initial={false}>
				{hint ? (
					<motion.p
						key="hint"
						data-hint
						initial={{ opacity: 0, x: -6 }}
						animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.35 }}
						className="min-w-0 flex-1 text-sm font-semibold text-amber-300"
					>
						{hint}
					</motion.p>
				) : (
					<motion.p
						key="title"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.08 } }}
						className="min-w-0 flex-1 text-sm text-gray-300"
					>
						<span className="font-semibold text-white">
							Pick up to three moods
						</span>
						<span className="hidden sm:inline">
							. A title fits when it is in any of them.
						</span>
					</motion.p>
				)}
			</AnimatePresence>
			<span
				className={`shrink-0 text-sm tabular-nums ${k === MAX_MOODS ? "font-semibold text-amber-300" : "text-gray-400"}`}
			>
				{k} of {MAX_MOODS}
			</span>
			{k > 0 && (
				<button
					type="button"
					onClick={control.clear}
					className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
			<button
				type="button"
				onClick={onDone}
				className="shrink-0 cursor-pointer rounded-full bg-white px-3 py-1 text-sm font-bold text-black hover:bg-gray-200"
			>
				Done
			</button>
		</div>
	)
}

/**
 * The grid of the 11 moods as poster tiles. Tiles are checkboxes; a refused one stays focusable and says why. `dense`
 * is the phone drawer's: two columns of shorter tiles with the name and count (the description stays in the label),
 * scrolling with the drawer.
 */
export function MoodGrid({
	control,
	dense = false,
}: { control: MoodControl; dense?: boolean }) {
	return (
		<div
			className={
				dense
					? "grid grid-cols-2 gap-2"
					: "grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-3 sm:grid-cols-3 lg:grid-cols-4"
			}
		>
			{MOODS.map(({ key: mood, name, description, hue }) => {
				const on = control.moods.includes(mood)
				const full = isFull(control, mood)
				const count = `${control.counts[mood]} ${control.countScope}`
				return (
					<motion.button
						key={mood}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a poster tile that acts as a checkbox, with the tile's picture and lines inside
						role="checkbox"
						aria-checked={on}
						aria-disabled={full || undefined}
						aria-label={`${name}. ${description} ${count}.`}
						data-mood={mood}
						onClick={() => control.toggle(mood)}
						whileTap={{ scale: full ? 1 : 0.97 }}
						className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full ? "opacity-40" : ""}`}
						style={{ boxShadow: on ? `0 8px 28px -8px ${hue}` : undefined }}
					>
						<MoodArt
							mood={mood}
							path={control.pictures[mood]?.backdropPath ?? null}
							className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
						/>
						<span className="flex items-start justify-between gap-2">
							<span className="text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
								{name}
							</span>
							<Tick on={on} />
						</span>
						<span className="block">
							{!dense && (
								<span className="line-clamp-2 text-xs leading-snug text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
									{description}
								</span>
							)}
							<span className="mt-1 block text-[11px] font-semibold tabular-nums text-white/75">
								{count}
							</span>
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

/**
 * The dropdown, in a layer over the page under `anchor` (the strip), as wide as the strip. It follows the strip while
 * the page moves, closes on a tap outside, Escape, or Done, and gives focus back to the mood button.
 */
export function MoodPanel({
	control,
	anchor,
	returnFocus,
}: {
	control: MoodControl
	anchor: React.RefObject<HTMLElement | null>
	returnFocus: React.RefObject<HTMLButtonElement>
}) {
	const panel = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<{
		top: number
		left: number
		width: number
		max: number
	} | null>(null)
	const { open, setOpen } = control

	const close = (refocus: boolean) => {
		setOpen(false)
		if (refocus) returnFocus.current?.focus()
	}

	useLayoutEffect(() => {
		if (!open) return
		const place = () => {
			const el = anchor.current
			if (!el) return
			const r = el.getBoundingClientRect()
			if (r.bottom < 60) return setOpen(false)
			const vw = window.innerWidth
			const width = Math.min(r.width, vw - 16)
			const top = r.bottom + 8
			setBox({
				top,
				left: Math.max(8, Math.min(r.left, vw - width - 8)),
				width,
				max: window.innerHeight - top - 12,
			})
		}
		place()
		const observer = new ResizeObserver(place)
		if (anchor.current) observer.observe(anchor.current)
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => {
			observer.disconnect()
			window.removeEventListener("scroll", place)
			window.removeEventListener("resize", place)
		}
	}, [open, anchor, setOpen])

	useEffect(() => {
		if (!open) return
		const outside = (event: PointerEvent) => {
			const target = event.target as HTMLElement
			if (
				!panel.current?.contains(target) &&
				!target.closest("[data-moodbutton]")
			)
				setOpen(false)
		}
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			setOpen(false)
			returnFocus.current?.focus()
		}
		window.addEventListener("pointerdown", outside)
		window.addEventListener("keydown", onEscape)
		return () => {
			window.removeEventListener("pointerdown", outside)
			window.removeEventListener("keydown", onEscape)
		}
	}, [open, setOpen, returnFocus])

	// Focus moves to the first mood when the dropdown opens.
	useEffect(() => {
		if (!open || !box) return
		const id = requestAnimationFrame(() =>
			panel.current?.querySelector<HTMLElement>("[data-mood]")?.focus(),
		)
		return () => cancelAnimationFrame(id)
	}, [open, !box])

	if (typeof document === "undefined") return null
	return createPortal(
		<AnimatePresence>
			{open && box && (
				<motion.div
					key="moods"
					ref={panel}
					// biome-ignore lint/a11y/useSemanticElements: an animated, non-modal popover positioned under the strip
					role="dialog"
					aria-label="Moods"
					data-panel
					initial={{ opacity: 0, y: -8, scale: 0.985 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -8, scale: 0.985 }}
					transition={{ duration: 0.2, ease: EASE }}
					className="fixed z-[70] flex origin-top flex-col overflow-hidden rounded-2xl bg-gray-900/95 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12 backdrop-blur-xl"
					style={{
						top: box.top,
						left: box.left,
						width: box.width,
						maxHeight: box.max,
					}}
				>
					<PanelHead control={control} onDone={() => close(true)} />
					<MoodGrid control={control} />
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	)
}
