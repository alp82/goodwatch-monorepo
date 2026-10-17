// PROTOTYPE - throwaway (seen-score). Stateless copies of the hero's own-score rectangle and helpers, driven by the
// in-memory store. They look exactly like the live ones.
import { forwardRef, useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import type { Score } from "~/server/scores.server"
import ScoreDialog from "~/ui/details/hero/ScoreDialog"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { useFlash, useProto } from "./store"

const STAR = "M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
const PENCIL = "m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z"
const EYE = "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"

export function EyeIcon({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
			<path fillRule="evenodd" clipRule="evenodd" d={EYE} />
		</svg>
	)
}

/** The live OwnScore rectangle, stateless. `prompt` swaps "Your score" for a nudge after Seen. */
export const ScoreRect = forwardRef<
	HTMLButtonElement,
	{ score: Score | null; mediaType: string; onClick: () => void; className?: string; prompt?: boolean; label?: string }
>(function ScoreRect({ score, mediaType, onClick, className = "", prompt = false, label = "Your score" }, ref) {
	const color = score ? getVibeColorValue(score) : ""
	return (
		<button
			ref={ref}
			type="button"
			onClick={onClick}
			className={`flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
				score
					? "pl-1.5 pr-3 hover:brightness-110"
					: `border-2 border-dashed border-amber-400/70 bg-amber-300/[0.06] pl-2.5 pr-3.5 hover:border-amber-300 hover:bg-amber-300/[0.12] ${prompt ? "!border-solid !border-amber-300 !bg-amber-300/[0.14] shadow-[0_0_0_4px_rgba(252,211,77,.15)]" : ""}`
			} ${className}`}
			style={score ? { background: `${color}26`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
		>
			{score ? (
				<>
					<span
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums"
						style={{ background: color, color: score <= 3 ? "#fff" : "#0a0a0a" }}
					>
						{score}
					</span>
					<span className="min-w-0 flex-1 leading-tight">
						<span className="block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">{label}</span>
						<span className="block truncate text-sm font-bold text-white">{scoreLabels[score]}</span>
					</span>
					<svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden="true">
						<path d={PENCIL} />
					</svg>
				</>
			) : (
				<>
					<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true">
						<path fillRule="evenodd" clipRule="evenodd" d={STAR} />
					</svg>
					<span className="min-w-0 flex-1 leading-tight">
						<span className="block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200/80">{prompt ? "How was it?" : label}</span>
						<span className="block whitespace-nowrap text-sm font-bold text-white">
							Rate <span className="sm:hidden">it</span>
							<span className="max-sm:hidden">this {mediaType}</span>
						</span>
					</span>
				</>
			)}
		</button>
	)
})

/** The live Seen button, fed by the store. Glows for a moment when a score turned it on. */
export function SeenButton({ size = "sm", className = "", label = "long" }: { size?: "sm" | "md"; className?: string; label?: "long" | "auto" }) {
	const p = useProto()
	const glow = useFlash(p.event?.kind === "auto-seen" ? p.event.at : undefined)
	return (
		<ActionButton
			kind="seen"
			label={label}
			size={size}
			active={p.state.seen}
			onClick={p.pressSeen}
			className={`${glow ? "ring-2 ring-green-300 ring-offset-2 ring-offset-stone-950" : ""} ${className}`}
		/>
	)
}

export function WantButton({ className = "" }: { className?: string }) {
	const p = useProto()
	return <ActionButton kind="want" label="long" size="sm" rewatch={p.state.seen} active={p.state.want} onClick={p.toggleWant} className={className} />
}

export function HideButton({ className = "" }: { className?: string }) {
	const p = useProto()
	if (!p.canHide) return null
	return <ActionButton kind="hide" label="wide" size="sm" active={p.state.hidden} onClick={p.toggleHide} className={className} />
}

/** The live score dialog. With `afterSeen`, it reads as the next step after pressing Seen and offers Skip. */
export function ProtoScoreDialog({
	open,
	onClose,
	opener,
	afterSeen = false,
	seenToggle = false,
}: {
	open: boolean
	onClose: () => void
	opener: React.RefObject<HTMLElement | null>
	afterSeen?: boolean
	/** Variant B: the dialog also holds Seen itself. */
	seenToggle?: boolean
}) {
	const p = useProto()
	const title = p.media.details.title
	return (
		<ScoreDialog
			title={title}
			open={open}
			value={p.state.score}
			busy={false}
			opener={opener}
			heading={
				afterSeen ? (
					<span className="flex items-center gap-2">
						<EyeIcon className="h-4 w-4 text-green-400" />
						<span className="truncate">Seen. How was {title}?</span>
					</span>
				) : undefined
			}
			footer={
				seenToggle ? (
					<div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
						<button
							type="button"
							onClick={p.pressSeen}
							className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-xs font-semibold ${p.state.seen ? "bg-green-500 text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
						>
							<EyeIcon className="h-4 w-4" />
							{p.state.seen ? "Seen" : "Seen it, no score yet"}
						</button>
						<span className="text-xs text-gray-400">A score marks it as Seen.</span>
					</div>
				) : afterSeen ? (
					<div className="mt-4 flex justify-end">
						<button type="button" onClick={onClose} className="cursor-pointer text-sm text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white">
							Skip for now
						</button>
					</div>
				) : undefined
			}
			onRate={(value) => {
				p.rate(value)
				onClose()
			}}
			onClear={p.clearScore}
			onClose={onClose}
		/>
	)
}

/** Shows the store's "blocked" message and the auto-Seen note as the live toasts. */
export function useProtoToasts() {
	const p = useProto()
	const last = useRef(0)
	useEffect(() => {
		if (!p.event || p.event.at === last.current) return
		last.current = p.event.at
		if (p.event.kind === "blocked") toast.info(p.event.message)
		if (p.event.kind === "auto-seen") toast.success(`Marked ${p.media.details.title} as Seen`)
	}, [p.event, p.media.details.title])
}

/** Opens the score dialog when Seen goes on. */
export function useOpenAfterSeen() {
	const p = useProto()
	const [open, setOpen] = useState(false)
	const [afterSeen, setAfterSeen] = useState(false)
	const last = useRef(0)
	useEffect(() => {
		if (p.event?.kind === "seen-on" && p.event.at !== last.current) {
			last.current = p.event.at
			if (p.state.score == null) {
				setAfterSeen(true)
				setOpen(true)
			}
		}
	}, [p.event, p.state.score])
	return {
		open,
		afterSeen,
		openPlain: () => {
			setAfterSeen(false)
			setOpen(true)
		},
		close: () => setOpen(false),
	}
}

/** The prototype's state, so each press shows what changed. */
export function StateStrip() {
	const p = useProto()
	const s = p.state
	return (
		<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dashed border-fuchsia-500/60 bg-fuchsia-500/[0.06] px-3 py-1.5 font-mono text-[11px] text-fuchsia-200">
			<span className="font-sans font-semibold">Prototype state (not saved)</span>
			<span>seen={String(s.seen)}</span>
			<span>score={s.score ?? "none"}</span>
			<span>want={String(s.want)}</span>
			<span>hidden={String(s.hidden)}</span>
			<span>last={p.event?.kind ?? "-"}</span>
			<button type="button" onClick={p.reset} className="ml-auto cursor-pointer font-sans underline">
				Reset to my real data
			</button>
		</div>
	)
}
