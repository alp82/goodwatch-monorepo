// For you, next to the sort: an on/off switch with an amber glow when on, the fingerprint icon inside it (hover,
// focus, or tap it for the explanation), and "↑N moved" after it changed the order.
import { ArrowUpIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useId, useRef, useState } from "react"
import { SEARCH_MAX_MOVE } from "~/domain/for-you"
import { ReasonChips } from "~/ui/title-card/ReasonChips"
import { Knob, MENU, TAP } from "./motion"
import type { ForYouControl } from "./types"

/**
 * What For you does, for the fingerprint icon's tooltip. Browsing, the taste it leans on as colored chips; searching,
 * how little it moves a result.
 */
export function ForYouExplanation({
	on,
	searching = false,
	leanings = [],
	ratings,
	movedUp,
}: {
	on: boolean
	searching?: boolean
	/** Fingerprint attribute keys the person's taste leans to. */
	leanings?: string[]
	ratings?: number
	movedUp: number
}) {
	return (
		<div>
			<p className="flex items-center gap-2 text-sm font-bold text-white">
				<FingerPrintIcon className="h-4 w-4 text-amber-400" />
				For you
				<span
					className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? "bg-amber-500 text-gray-950" : "text-gray-400 ring-1 ring-inset ring-white/15"}`}
				>
					{on ? "On" : "Off"}
				</span>
			</p>
			{searching ? (
				<p className="mt-2 text-[13px] leading-relaxed text-gray-300">
					Your search stays in charge; taste only swaps close matches,{" "}
					{SEARCH_MAX_MOVE} places at most.
				</p>
			) : (
				<>
					<p className="mt-2 text-[13px] leading-relaxed text-gray-300">
						Lets titles you'd likely rate highly rise within the sort. It
						reorders; nothing is hidden.
					</p>
					{leanings.length > 0 && (
						<div className="mt-2.5">
							<p className="text-xs text-gray-400">Your taste leans to</p>
							<ReasonChips reasons={leanings} className="mt-1.5" />
							{ratings ? (
								<p className="mt-1.5 text-xs text-gray-500">
									From {ratings.toLocaleString("en")} ratings
								</p>
							) : null}
						</div>
					)}
				</>
			)}
			<p
				className={`mt-2.5 text-[13px] ${on ? "text-amber-300" : "text-gray-500"}`}
			>
				{!on
					? "Off: the same order everyone sees."
					: movedUp
						? `Right now ${movedUp.toLocaleString("en")} ${searching ? "results" : "titles"} moved up.`
						: "Right now your taste agrees with this order."}
			</p>
		</div>
	)
}

/** The fingerprint icon; hovering (mouse), focusing, or tapping it shows the explanation. Fixed width. */
function FingerprintTip({
	on,
	explanation,
}: {
	on: boolean
	explanation: React.ReactNode
}) {
	const [open, setOpen] = useState(false)
	const id = useId()
	const ref = useRef<HTMLSpanElement>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => {
		if (!open) return
		const down = (e: Event) =>
			!ref.current?.contains(e.target as Node) && setOpen(false)
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [open])
	useEffect(() => () => clearTimeout(timer.current), [])
	const show = () => {
		clearTimeout(timer.current)
		setOpen(true)
	}
	const hide = () => {
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setOpen(false), 120)
	}
	return (
		<span
			ref={ref}
			className="relative flex h-full items-center"
			onPointerEnter={(e) => e.pointerType === "mouse" && show()}
			onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
		>
			<button
				type="button"
				aria-label="What For you does"
				aria-describedby={open ? id : undefined}
				aria-expanded={open}
				onFocus={show}
				onBlur={hide}
				onClick={() => setOpen((o) => !o)}
				className={`grid h-9 w-9 place-items-center rounded-xl cursor-help outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-amber-400 hover:bg-amber-500/15" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"}`}
			>
				<FingerPrintIcon className="h-5 w-5" />
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						id={id}
						role="tooltip"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.14 }}
						className={`absolute top-full left-0 z-50 mt-3 w-80 p-4 ${MENU}`}
					>
						{explanation}
					</motion.div>
				)}
			</AnimatePresence>
		</span>
	)
}

function MovedUp({ on, movedUp }: { on: boolean; movedUp: number }) {
	const shown = on && movedUp > 0
	return (
		<span
			aria-hidden={!shown}
			className={`inline-flex w-11 items-center justify-end gap-0.5 text-xs tabular-nums ${shown ? "text-amber-300" : "text-transparent"}`}
		>
			<ArrowUpIcon className="h-3 w-3" />
			{movedUp}
			<span className="sr-only"> moved up</span>
		</span>
	)
}

/** The desktop control: the fingerprint, then the switch with "↑N". */
export function ForYouSwitch({ forYou }: { forYou: ForYouControl }) {
	const { on, onChange, movedUp, explanation, replacement, disabled } = forYou
	if (replacement)
		return (
			<div className="flex h-12 w-56 shrink-0 items-center">{replacement}</div>
		)
	const lit = on && !disabled
	return (
		<div
			className={`relative flex h-12 w-56 shrink-0 items-center rounded-2xl pl-1.5 transition-[background-color,box-shadow] duration-300 ${
				lit
					? "bg-amber-500/[0.14] ring-1 ring-amber-500/45 shadow-[0_0_30px_-8px_rgba(245,158,11,.6),inset_0_1px_0_rgba(255,255,255,.06)]"
					: "bg-white/[0.04] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
			}`}
		>
			<FingerprintTip on={lit} explanation={explanation} />
			<motion.button
				type="button"
				role="switch"
				aria-checked={lit}
				aria-disabled={disabled || undefined}
				whileTap={disabled ? undefined : TAP}
				onClick={() => !disabled && onChange(!on)}
				className={`flex h-full flex-1 items-center gap-2 rounded-r-2xl pr-4 pl-1.5 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${disabled ? "cursor-not-allowed text-gray-500" : lit ? "cursor-pointer text-amber-100" : "cursor-pointer text-gray-400 hover:text-gray-200"}`}
			>
				<span className="flex-1 text-left">For you</span>
				<MovedUp on={lit} movedUp={movedUp} />
				<Knob on={lit} />
			</motion.button>
		</div>
	)
}

/** A full-width For you row with the switch, for the phone's sheet and the explanation menu. */
export function ForYouRow({
	forYou,
	compact = false,
}: {
	forYou: ForYouControl
	compact?: boolean
}) {
	const { on, onChange, disabled, hint } = forYou
	const lit = on && !disabled
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={lit}
			aria-disabled={disabled || undefined}
			whileTap={disabled ? undefined : TAP}
			onClick={() => !disabled && onChange(!on)}
			className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${lit ? "bg-amber-500/[0.14] ring-1 ring-amber-500/45 shadow-[0_0_24px_-10px_rgba(245,158,11,.7)]" : "bg-white/[0.04] ring-1 ring-white/10"}`}
		>
			<FingerPrintIcon
				className={`h-5 w-5 shrink-0 ${lit ? "text-amber-400" : "text-gray-500"}`}
			/>
			<span className="min-w-0 flex-1">
				<span
					className={`block text-sm font-bold ${lit ? "text-amber-100" : "text-gray-300"}`}
				>
					For you
				</span>
				{!compact && (
					<span
						className={`block text-xs ${lit ? "text-amber-200/70" : "text-gray-500"}`}
					>
						{!lit
							? "Same order for everyone"
							: (hint ?? "Titles you'd rate highly rise")}
					</span>
				)}
			</span>
			<Knob on={lit} />
		</motion.button>
	)
}
