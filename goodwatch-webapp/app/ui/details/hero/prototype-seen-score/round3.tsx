// PROTOTYPE - throwaway (seen-score), round 3.
// Movies: the compact score-first dialog stays; the variants try different Seen toggles in it.
// Shows: the watch status and the score split apart again, but sit together, so Watching or On hold never goes
// through the score dialog. Seen all asks for the score.
import { useEffect, useRef, useState } from "react"
import type { Score } from "~/server/scores.server"
import ScoreDialog from "~/ui/details/hero/ScoreDialog"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { EyeIcon, ScoreRect } from "./pieces"
import { type Watch, useFlash, useProto } from "./store"
import { type DialogProps, EyeSlash, LOOK, Notes, StatusPill, SwitchAsk, VerdictDialog, VerdictTile, WatchIcon, useWords } from "./verdict"

// ---------------------------------------------------------------------------------------------------------
// Movies: one dialog, five Seen toggles
// ---------------------------------------------------------------------------------------------------------

function useMovieDialog(onClose: () => void) {
	const p = useProto()
	const toggle = () => p.setWatch(p.seen ? "not_started" : "seen")
	const onRate = (score: Score) => {
		p.rate(score)
		onClose()
	}
	return { p, toggle, onRate }
}

function Ask() {
	const p = useProto()
	return (
		<p className="mb-2 text-sm font-semibold text-gray-400">
			How was it? {!p.seen && <span className="font-normal text-gray-500">A score marks it as Seen.</span>}
		</p>
	)
}

/** chip: the live Seen button, small, beside the title. */
export function ChipDialog({ open, onClose, opener }: DialogProps) {
	const { p, toggle, onRate } = useMovieDialog(onClose)
	return (
		<ScoreDialog
			title={p.media.details.title}
			open={open}
			value={p.state.score}
			busy={false}
			opener={opener}
			hideClear
			heading={
				<span className="flex min-w-0 items-center gap-3">
					<span className="min-w-0 truncate">{p.media.details.title}</span>
					<ActionButton kind="seen" label="long" size="sm" active={p.seen} onClick={toggle} className="!w-auto shrink-0 !px-3" />
				</span>
			}
			top={<Ask />}
			footer={<Notes autoNote={false} onDone={onClose} />}
			onRate={onRate}
			onClear={p.clearScore}
			onClose={onClose}
		/>
	)
}

/** segmented: "Not seen | Seen" under the title, the score's first question. */
export function SegmentedDialog({ open, onClose, opener }: DialogProps) {
	const { p, onRate } = useMovieDialog(onClose)
	return (
		<ScoreDialog
			title={p.media.details.title}
			open={open}
			value={p.state.score}
			busy={false}
			opener={opener}
			hideClear
			heading={
				<span className="flex min-w-0 items-center gap-3">
					<span className="min-w-0 truncate">{p.media.details.title}</span>
					<span role="radiogroup" className="inline-flex shrink-0 rounded-lg bg-white/[0.06] p-0.5 text-xs font-semibold ring-1 ring-white/10">
						{([false, true] as const).map((seen) => {
							const on = p.seen === seen
							return (
								<button
									key={String(seen)}
									type="button"
									role="radio"
									aria-checked={on}
									onClick={() => p.setWatch(seen ? "seen" : "not_started")}
									className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 ${on ? (seen ? "bg-green-500 text-black" : "bg-white/15 text-white") : "text-gray-400 hover:text-white"}`}
								>
									{seen ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeSlash className="h-3.5 w-3.5" />}
									{seen ? "Seen" : "Not seen"}
								</button>
							)
						})}
					</span>
				</span>
			}
			top={<Ask />}
			footer={<Notes autoNote={false} onDone={onClose} />}
			onRate={onRate}
			onClear={p.clearScore}
			onClose={onClose}
		/>
	)
}

/** strip: Seen is the first cell of the score control, as tall as the levels and the numbers together. */
export function StripDialog({ open, onClose, opener }: DialogProps) {
	const { p, toggle, onRate } = useMovieDialog(onClose)
	return (
		<ScoreDialog
			title={p.media.details.title}
			open={open}
			value={p.state.score}
			busy={false}
			opener={opener}
			hideClear
			top={<Ask />}
			control={
				<div className="flex items-stretch gap-1.5">
					<button
						type="button"
						aria-pressed={p.seen}
						onClick={toggle}
						title={p.seen ? "Seen. Press to take it back (clears the score)." : "Mark as Seen without a score"}
						className={`flex w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold transition-colors ${
							p.seen ? "bg-green-500 text-black" : "bg-white/10 text-gray-200 hover:bg-white/20"
						}`}
					>
						<EyeIcon className={`h-5 w-5 ${p.seen ? "" : "text-green-300"}`} />
						Seen
					</button>
					<span className="w-px shrink-0 bg-white/10" aria-hidden="true" />
					<div className="min-w-0 flex-1">
						<ScoreControl value={p.state.score} onRate={onRate} />
					</div>
				</div>
			}
			footer={<Notes autoNote={false} onDone={onClose} />}
			onRate={onRate}
			onClear={p.clearScore}
			onClose={onClose}
		/>
	)
}

/** footer: the live Seen button at full width under the score, the way the hero block has it. */
export function FooterDialog({ open, onClose, opener }: DialogProps) {
	const { p, toggle, onRate } = useMovieDialog(onClose)
	return (
		<ScoreDialog
			title={p.media.details.title}
			open={open}
			value={p.state.score}
			busy={false}
			opener={opener}
			hideClear
			top={<p className="mb-2 text-sm font-semibold text-gray-400">How was it?</p>}
			footer={
				<>
					<div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
						<ActionButton kind="seen" label="long" active={p.seen} onClick={toggle} className="flex-1" />
					</div>
					<p className="mt-2 text-center text-xs text-gray-500">{p.seen ? "Taking Seen back clears the score." : "A score marks it as Seen."}</p>
					<Notes autoNote={false} onDone={onClose} />
				</>
			}
			onRate={onRate}
			onClear={p.clearScore}
			onClose={onClose}
		/>
	)
}

/** split (movie): Seen and the score are two halves of one control in the ratings. Seen on asks for the score. */
export function MovieSplit() {
	const p = useProto()
	const { score } = p.state
	const [open, setOpen] = useState(false)
	const [afterSeen, setAfterSeen] = useState(false)
	const ref = useRef<HTMLButtonElement>(null)
	const last = useRef(0)
	useEffect(() => {
		if (p.event?.kind === "seen-on" && p.event.at !== last.current) {
			last.current = p.event.at
			setAfterSeen(true)
			setOpen(true)
		}
	}, [p.event])
	const glow = useFlash(p.event?.kind === "auto-seen" ? p.event.at : undefined)
	return (
		<>
			<Joined
				left={
					<button
						type="button"
						aria-pressed={p.seen}
						onClick={p.pressSeen}
						className={`flex h-full w-[4.5rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
							p.seen ? "bg-green-500 text-black" : "text-gray-200 hover:bg-white/10"
						} ${glow ? "ring-2 ring-inset ring-green-200" : ""}`}
					>
						<EyeIcon className={`h-4 w-4 ${p.seen ? "" : "text-green-300"}`} />
						{p.seen ? "Seen" : "Seen?"}
					</button>
				}
				right={<ScoreHalf onClick={() => (setAfterSeen(false), setOpen(true))} ref={ref} />}
			/>
			<ScoreDialog
				title={p.media.details.title}
				open={open}
				value={score}
				busy={false}
				opener={ref}
				heading={
					afterSeen ? (
						<span className="flex items-center gap-2">
							<EyeIcon className="h-4 w-4 text-green-400" />
							<span className="truncate">Seen. How was it?</span>
						</span>
					) : undefined
				}
				top={afterSeen ? undefined : <Ask />}
				footer={
					<>
						{afterSeen && (
							<div className="mt-4 flex justify-end">
								<button type="button" onClick={() => setOpen(false)} className="cursor-pointer text-sm text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white">
									Skip for now
								</button>
							</div>
						)}
						<Notes autoNote={false} onDone={() => setOpen(false)} />
					</>
				}
				onRate={(s) => {
					p.rate(s)
					setOpen(false)
				}}
				onClear={p.clearScore}
				onClose={() => setOpen(false)}
			/>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Shared bits for the split controls
// ---------------------------------------------------------------------------------------------------------

/** One rounded control, 48px high, in two halves with a line between. */
function Joined({ left, right, className = "" }: { left: React.ReactNode; right: React.ReactNode; className?: string }) {
	const p = useProto()
	const score = p.state.score
	const color = score ? getVibeColorValue(score) : ""
	return (
		<div
			className={`relative flex h-12 min-w-0 items-stretch overflow-visible rounded-xl max-md:w-full md:min-w-[16rem] md:shrink-0 ${score ? "" : "ring-1 ring-white/15 bg-white/[0.05]"} ${className}`}
			style={score ? { background: `${color}1f`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
		>
			<div className="flex shrink-0 overflow-hidden rounded-l-xl">{left}</div>
			<span className="w-px shrink-0 bg-white/15" aria-hidden="true" />
			<div className="flex min-w-0 flex-1">{right}</div>
		</div>
	)
}

/** The score half of a joined control: the number on its color, or the ask. */
const ScoreHalf = ({ onClick, ref }: { onClick: () => void; ref?: React.Ref<HTMLButtonElement> }) => {
	const p = useProto()
	const { ask } = useWords()
	const score = p.state.score
	const color = score ? getVibeColorValue(score) : ""
	const soFar = p.state.watch === "watching" || p.state.watch === "on_hold"
	return (
		<button ref={ref} type="button" aria-haspopup="dialog" onClick={onClick} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-r-xl pl-2 pr-3 text-left hover:bg-white/[0.06]">
			{score ? (
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums" style={{ background: color, color: score <= 3 ? "#fff" : "#0a0a0a" }}>
					{score}
				</span>
			) : (
				<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true">
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
					/>
				</svg>
			)}
			<span className="min-w-0 flex-1 leading-tight">
				<span className="block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">{score ? "Your score" : p.seen ? ask : "Your score"}</span>
				<span className="block truncate text-sm font-bold text-white">{score ? scoreLabels[score] : soFar ? "Rate it so far" : "Rate it"}</span>
			</span>
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Shows: status and score apart, side by side
// ---------------------------------------------------------------------------------------------------------

const SHOW_STATES: Watch[] = ["not_started", "watching", "on_hold", "dropped", "seen"]

function useStateLabel() {
	const p = useProto()
	return (w: Watch) => (w === "not_started" ? "Not started" : w === "seen" ? (p.running ? "Caught up" : "Seen all") : LOOK[w].word)
}

/** The status menu: every state, the current one marked. Seen all asks for the score (through the store event). */
function StatusMenu({ onClose, className = "" }: { onClose: () => void; className?: string }) {
	const p = useProto()
	const label = useStateLabel()
	const box = useRef<HTMLSpanElement>(null)
	useEffect(() => {
		const down = (e: PointerEvent) => {
			if (!box.current?.contains(e.target as Node)) onClose()
		}
		const t = setTimeout(() => window.addEventListener("pointerdown", down), 0)
		return () => {
			clearTimeout(t)
			window.removeEventListener("pointerdown", down)
		}
	}, [onClose])
	return (
		<span ref={box} role="menu" className={`absolute z-40 flex w-52 flex-col rounded-xl bg-stone-800 p-1 text-sm font-semibold shadow-2xl ring-1 ring-white/15 ${className}`}>
			{SHOW_STATES.map((w) => (
				<button
					key={w}
					type="button"
					role="menuitemradio"
					aria-checked={p.state.watch === w}
					onClick={() => {
						p.setWatch(w)
						onClose()
					}}
					className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left hover:bg-white/10 ${p.state.watch === w ? "text-white" : "text-gray-300"}`}
				>
					{w === "not_started" ? <EyeSlash className="h-4 w-4 text-gray-400" /> : <WatchIcon watch={w} className={`h-4 w-4 ${LOOK[w].text}`} />}
					{label(w)}
					{p.state.watch === w ? <span className="ml-auto text-xs text-gray-400">now</span> : w === "seen" && <span className="ml-auto text-xs text-gray-500">then score</span>}
				</button>
			))}
		</span>
	)
}

/** Opens the show's score dialog when Seen all comes on without a score. */
function useScoreAfterSeenAll() {
	const p = useProto()
	const [open, setOpen] = useState(false)
	const last = useRef(0)
	useEffect(() => {
		if (p.event?.kind === "seen-on" && p.event.at !== last.current) {
			last.current = p.event.at
			setOpen(true)
		}
	}, [p.event])
	return { open, setOpen }
}

function StatusChevron() {
	return (
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true">
			<path d="m4 6 4 4 4-4" />
		</svg>
	)
}

/** split (show): [status ▾ | score] as one control in the ratings. */
export function ShowSplit() {
	const p = useProto()
	const { watch } = p.state
	const { progress } = useWords()
	const label = useStateLabel()
	const [menu, setMenu] = useState(false)
	const dialog = useScoreAfterSeenAll()
	const ref = useRef<HTMLButtonElement>(null)
	const look = LOOK[watch]
	return (
		<div className="relative max-md:w-full md:shrink-0">
			<Joined
				className="md:min-w-[18rem]"
				left={
					<button
						type="button"
						aria-haspopup="menu"
						aria-expanded={menu}
						onClick={() => setMenu((m) => !m)}
						className={`flex h-full min-w-[6.5rem] shrink-0 cursor-pointer items-center gap-2 px-2.5 text-left ${watch === "not_started" ? "text-gray-200 hover:bg-white/10" : look.pill}`}
					>
						{watch === "not_started" ? <EyeSlash className="h-4 w-4 shrink-0 text-gray-400" /> : <WatchIcon watch={watch} className="h-4 w-4 shrink-0" />}
						<span className="min-w-0 leading-tight">
							<span className="block whitespace-nowrap text-xs font-bold">{label(watch)}</span>
							{progress ? <span className="block text-[11px] tabular-nums opacity-80">{progress} eps</span> : watch === "not_started" && <span className="block text-[11px] text-gray-400">Set status</span>}
						</span>
						<StatusChevron />
					</button>
				}
				right={<ScoreHalf ref={ref} onClick={() => dialog.setOpen(true)} />}
			/>
			{menu && <StatusMenu onClose={() => setMenu(false)} className="left-0 top-[calc(100%+6px)]" />}
			<VerdictDialog kind="switch" open={dialog.open} onClose={() => dialog.setOpen(false)} opener={ref} />
		</div>
	)
}

/** stacked (show): the status pill sits on the score rectangle, both as wide as each other. */
export function ShowStacked() {
	const p = useProto()
	const { watch } = p.state
	const { progress } = useWords()
	const label = useStateLabel()
	const [menu, setMenu] = useState(false)
	const dialog = useScoreAfterSeenAll()
	const ref = useRef<HTMLButtonElement>(null)
	return (
		<div className="relative flex flex-col gap-1.5 max-md:w-full md:w-[12.5rem] md:shrink-0">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={menu}
				onClick={() => setMenu((m) => !m)}
				className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${watch === "not_started" ? "bg-white/10 text-gray-100 hover:bg-white/20" : LOOK[watch].pill}`}
			>
				{watch === "not_started" ? <EyeSlash className="h-3.5 w-3.5" /> : <WatchIcon watch={watch} className="h-3.5 w-3.5" />}
				{label(watch)}
				{progress && <span className="tabular-nums opacity-80">· {progress}</span>}
				<span className="ml-auto">
					<StatusChevron />
				</span>
			</button>
			{menu && <StatusMenu onClose={() => setMenu(false)} className="left-0 top-9" />}
			<ScoreRect ref={ref} score={p.state.score} mediaType="show" onClick={() => dialog.setOpen(true)} prompt={watch === "seen" && p.state.score == null} />
			<VerdictDialog kind="switch" open={dialog.open} onClose={() => dialog.setOpen(false)} opener={ref} />
		</div>
	)
}

/** block (show): the status stays in the "your show" block as live, the score in the ratings; only the flow is linked. */
export function ShowBlockRatings() {
	const p = useProto()
	const dialog = useScoreAfterSeenAll()
	const ref = useRef<HTMLButtonElement>(null)
	return (
		<>
			<ScoreRect ref={ref} score={p.state.score} mediaType="show" onClick={() => dialog.setOpen(true)} className="max-md:w-full md:min-w-[10.75rem] md:shrink-0" />
			<VerdictDialog kind="switch" open={dialog.open} onClose={() => dialog.setOpen(false)} opener={ref} />
		</>
	)
}

export function ShowBlockActions() {
	const p = useProto()
	const { watch, episodes } = p.state
	const label = useStateLabel()
	const { progress } = useWords()
	const [menu, setMenu] = useState(false)
	return (
		<div className="flex flex-col gap-2.5">
			<div className="relative flex min-h-9 items-center gap-2.5">
				<button
					type="button"
					aria-haspopup="menu"
					onClick={() => setMenu((m) => !m)}
					className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${watch === "not_started" ? "bg-white/10 text-gray-100 hover:bg-white/20" : LOOK[watch].pill}`}
				>
					{label(watch)}
					<StatusChevron />
				</button>
				{progress && <span className="text-xs tabular-nums text-gray-300">{progress} episodes</span>}
				{(watch === "watching" || watch === "on_hold") && (
					<span className="ml-auto truncate rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-gray-100">Next: episode {Math.min(episodes + 1, p.total)}</span>
				)}
				{menu && <StatusMenu onClose={() => setMenu(false)} className="left-0 top-10" />}
			</div>
		</div>
	)
}

/** The movie tile with one of the dialogs. */
export const movieTile = (D: React.ComponentType<DialogProps>) => () => <VerdictTile dialog={D} />
export { SwitchAsk }
