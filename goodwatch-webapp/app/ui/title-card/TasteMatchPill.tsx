import { FingerPrintIcon } from "@heroicons/react/24/solid"
import {
	type MouseEvent,
	type PointerEvent,
	useEffect,
	useRef,
	useState,
} from "react"
import { ReasonChips, reasonLabel } from "./ReasonChips"

export interface CardTaste {
	/** 50 to 99, or null without a fingerprint or taste (no pill). */
	match: number | null
	/** Fingerprint keys, strongest first. */
	reasons: string[]
}

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_PX = 10

// Following the scale of the match (~/domain/taste-match.ts): 90 and above stands out, which is the top 1 percent of
// well-known titles and needs a taste built from about 15 liked titles or more; below 60 steps back, which is the
// third that fits least (more of them for a taste built from few). The number always says the same, so the color is
// never the only signal.
function tier(match: number) {
	if (match >= 90)
		return "bg-linear-to-b from-amber-300 to-amber-500 text-gray-950 shadow-[0_0_14px_rgba(251,191,36,0.55)]"
	if (match < 60) return "bg-gray-700 text-amber-100/80"
	return "bg-linear-to-b from-amber-400 to-amber-600 text-gray-950"
}

export const tasteMatchLabel = (match: number) => `${match}% taste match`

/**
 * The amber taste-match pill that hangs under a card's GoodWatch score. Hovering it (or long-pressing it on touch, or
 * focusing the card with the keyboard) shows the label and the reasons as colored chips. It sits inside the card's
 * link, so it isn't a control of its own: a long press opens the reasons without following the link.
 */
export function TasteMatchPill({ match, reasons }: CardTaste) {
	const [pressed, setPressed] = useState(false)
	const root = useRef<HTMLSpanElement>(null)
	const press = useRef<{ timer: number; x: number; y: number } | null>(null)
	const swallowClick = useRef(false)

	useEffect(() => {
		if (!pressed) return
		const close = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) setPressed(false)
		}
		const closeNow = () => setPressed(false)
		document.addEventListener("pointerdown", close)
		window.addEventListener("scroll", closeNow, { passive: true })
		return () => {
			document.removeEventListener("pointerdown", close)
			window.removeEventListener("scroll", closeNow)
		}
	}, [pressed])

	useEffect(() => () => cancelPress(), [])

	function cancelPress() {
		if (press.current) window.clearTimeout(press.current.timer)
		press.current = null
	}

	function onPointerDown(event: PointerEvent) {
		swallowClick.current = false
		if (event.pointerType === "mouse") return
		cancelPress()
		const timer = window.setTimeout(() => {
			press.current = null
			swallowClick.current = true
			setPressed(true)
		}, LONG_PRESS_MS)
		press.current = { timer, x: event.clientX, y: event.clientY }
	}

	function onPointerMove(event: PointerEvent) {
		const start = press.current
		if (
			start &&
			Math.hypot(event.clientX - start.x, event.clientY - start.y) >
				MOVE_TOLERANCE_PX
		)
			cancelPress()
	}

	function onClick(event: MouseEvent) {
		// The release of a long press keeps the reasons open; a tap while they're open closes them. Neither opens the
		// title.
		if (swallowClick.current) {
			event.preventDefault()
			swallowClick.current = false
		} else if (pressed) {
			event.preventDefault()
			setPressed(false)
		}
	}

	if (match === null) return null
	const label = tasteMatchLabel(match)
	const spoken = reasons.length
		? `${label}, for ${reasons.map(reasonLabel).join(" and ")}`
		: label

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the click only cancels a touch long press; keyboard users reach the reasons by focusing the card's link, and screen readers hear them in the label.
		<span
			ref={root}
			className="group/match relative -mt-1 select-none [-webkit-touch-callout:none]"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={cancelPress}
			onPointerCancel={cancelPress}
			onContextMenu={(event) => event.preventDefault()}
			onClick={onClick}
		>
			<span
				className={`flex h-[26px] min-w-[56px] items-center justify-center gap-0.5 rounded-full px-2 text-[13px] font-black tabular-nums ring-[3px] ring-gray-900 ${tier(match)}`}
			>
				<FingerPrintIcon className="h-3.5 w-3.5 opacity-80" aria-hidden />
				<span aria-hidden>{match}%</span>
				<span className="sr-only">{spoken}</span>
			</span>
			<span
				aria-hidden
				className={`
					absolute top-full right-0 z-20 mt-2 w-max max-w-[min(15rem,calc(100cqw-1.5rem))]
					flex-col gap-1.5 rounded-xl bg-gray-950/95 px-3 py-2 text-left shadow-xl ring-1 ring-amber-500/30
					${pressed ? "flex" : "hidden group-hover/match:flex group-focus-visible:flex"}
				`}
			>
				<span className="flex items-center gap-1 text-xs font-bold text-amber-300">
					<FingerPrintIcon className="h-3.5 w-3.5" />
					{label}
				</span>
				<ReasonChips reasons={reasons} />
			</span>
		</span>
	)
}
