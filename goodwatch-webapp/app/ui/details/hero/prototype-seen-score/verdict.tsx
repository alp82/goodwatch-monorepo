// PROTOTYPE - throwaway (seen-score), round 2. The one control for Seen and the score ("your verdict"), in the
// hero's ratings where the own score is today, and two ways for its dialog to carry both:
//   steps  - "Have you seen it?" first, as a segmented choice, then the score. Not seen takes the score away, so the
//            dialog has no Clear score.
//   switch - the score first; Seen is a switch (movie) or the status pill (show) in the dialog's header.
// Shows get the tracking machine's states: Not started, Watching, On hold, Dropped, Seen (Caught up while running).
import { useEffect, useRef, useState } from "react"
import type { Score } from "~/server/scores.server"
import ScoreDialog from "~/ui/details/hero/ScoreDialog"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { EyeIcon } from "./pieces"
import { type Watch, useFlash, useProto } from "./store"

const LOOK: Record<Watch, { word: string; text: string; border: string; bg: string; pill: string }> = {
	not_started: { word: "Seen it?", text: "text-amber-200/80", border: "border-amber-400/70", bg: "bg-amber-300/[0.06]", pill: "bg-white/10 text-gray-100" },
	watching: { word: "Watching", text: "text-sky-300", border: "border-sky-400/70", bg: "bg-sky-400/[0.07]", pill: "bg-sky-500 text-black" },
	on_hold: { word: "On hold", text: "text-violet-300", border: "border-violet-400/70", bg: "bg-violet-400/[0.07]", pill: "bg-violet-500 text-white" },
	dropped: { word: "Dropped", text: "text-pink-300", border: "border-pink-400/70", bg: "bg-pink-400/[0.07]", pill: "bg-pink-500 text-black" },
	seen: { word: "Seen", text: "text-green-300", border: "border-green-400/70", bg: "bg-green-400/[0.07]", pill: "bg-green-500 text-black" },
}

function useWords() {
	const p = useProto()
	const { watch, episodes } = p.state
	const show = p.media.mediaType === "show"
	const word = watch === "seen" && show && p.running ? "Caught up" : watch === "seen" && show ? "Seen all" : LOOK[watch].word
	const progress = show && (watch === "watching" || watch === "on_hold") && p.total ? `${episodes}/${p.total}` : null
	const ask = watch === "watching" || watch === "on_hold" ? "How is it so far?" : "How was it?"
	return { word, progress, ask, show }
}

const PLAY = "M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z"
const PAUSE = "M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5ZM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z"
const STOP = "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
const SLASH = "M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z M10.748 13.93l2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z"

export function WatchIcon({ watch, className = "" }: { watch: Watch; className?: string }) {
	const d = watch === "watching" ? PLAY : watch === "on_hold" ? PAUSE : watch === "dropped" ? STOP : null
	if (!d) return <EyeIcon className={className} />
	return (
		<svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
			<path fillRule="evenodd" clipRule="evenodd" d={d} />
		</svg>
	)
}

function EyeSlash({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
			<path fillRule="evenodd" clipRule="evenodd" d={SLASH} />
		</svg>
	)
}

/** The one control in the ratings. It names the watch state on top and the score (or the ask) under it. */
export function VerdictTile({ dialog }: { dialog: "steps" | "switch" }) {
	const p = useProto()
	const { watch, score } = p.state
	const { word, progress } = useWords()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLButtonElement>(null)
	const glow = useFlash(p.event?.kind === "auto-seen" ? p.event.at : undefined)
	const look = LOOK[watch]
	const color = score ? getVibeColorValue(score) : ""
	const soFar = watch === "watching" || watch === "on_hold"
	return (
		<>
			<button
				ref={ref}
				type="button"
				data-verdict={watch}
				aria-haspopup="dialog"
				onClick={() => setOpen(true)}
				className={`flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl text-left transition max-md:w-full md:min-w-[12.5rem] md:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
					score ? "pl-1.5 pr-3 hover:brightness-110" : `border-2 border-dashed ${look.border} ${look.bg} pl-2.5 pr-3.5 hover:brightness-125`
				} ${glow ? "ring-2 ring-green-300 ring-offset-2 ring-offset-stone-950" : ""}`}
				style={score ? { background: `${color}26`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
			>
				{score ? (
					<span
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums"
						style={{ background: color, color: score <= 3 ? "#fff" : "#0a0a0a" }}
					>
						{score}
					</span>
				) : (
					<WatchIcon watch={watch} className={`h-5 w-5 shrink-0 ${watch === "not_started" ? "text-amber-300" : look.text}`} />
				)}
				<span className="min-w-0 flex-1 leading-tight">
					<span className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] ${look.text}`}>
						{score && <WatchIcon watch={watch} className="h-3 w-3" />}
						{word}
						{progress && <span className="font-medium normal-case tracking-normal tabular-nums opacity-80">· {progress}</span>}
					</span>
					<span className="block truncate text-sm font-bold text-white">{score ? scoreLabels[score] : soFar ? "Rate it so far" : "Rate it"}</span>
				</span>
				{score && (
					<svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden="true">
						<path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
					</svg>
				)}
			</button>
			<VerdictDialog kind={dialog} open={open} onClose={() => setOpen(false)} opener={ref} />
		</>
	)
}

function VerdictDialog({ kind, open, onClose, opener }: { kind: "steps" | "switch"; open: boolean; onClose: () => void; opener: React.RefObject<HTMLElement | null> }) {
	const p = useProto()
	const { show } = useWords()
	const title = p.media.details.title
	// A show rated from Not started is marked Seen all; the dialog stays up so Watching is one press away.
	const [autoNote, setAutoNote] = useState(false)
	useEffect(() => {
		if (!open) setAutoNote(false)
	}, [open])
	const onRate = (score: Score) => {
		const fromNothing = p.state.watch === "not_started"
		p.rate(score)
		if (show && fromNothing) setAutoNote(true)
		else onClose()
	}
	return (
		<ScoreDialog
			title={title}
			open={open}
			value={p.state.score}
			busy={false}
			opener={opener}
			hideClear
			heading={kind === "switch" ? <SwitchHeading /> : undefined}
			top={kind === "steps" ? <Steps /> : <SwitchAsk />}
			footer={<Notes autoNote={autoNote} onDone={onClose} />}
			onRate={onRate}
			onClear={p.clearScore}
			onClose={onClose}
		/>
	)
}

/** The cleared-score Undo and the "marked as Seen all" note, under the score control. */
function Notes({ autoNote, onDone }: { autoNote: boolean; onDone: () => void }) {
	const p = useProto()
	const ev = p.event
	return (
		<>
			{ev?.kind === "cleared" && ev.undo.score != null && (
				<p className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-gray-300">
					<span>
						Not seen, so your score of <b className="text-white">{ev.undo.score}</b> is gone too.
					</span>
					<button type="button" onClick={() => p.undo(ev.undo)} className="shrink-0 cursor-pointer font-semibold text-white underline underline-offset-2">
						Undo
					</button>
				</p>
			)}
			{autoNote && (
				<div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-green-400/[0.08] px-3 py-2 text-xs text-gray-200 ring-1 ring-green-400/30">
					<span>
						Marked as <b className="text-green-300">{p.running ? "Caught up" : "Seen all"}</b>. Still watching? Pick <b>Watching</b>.
					</span>
					<button type="button" onClick={onDone} className="h-8 shrink-0 cursor-pointer rounded-lg bg-white/10 px-3 font-semibold text-white hover:bg-white/20">
						Done
					</button>
				</div>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// steps: "Have you seen it?" first, then the score
// ---------------------------------------------------------------------------------------------------------

const SEG = "inline-flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1.5 text-xs sm:gap-2 sm:px-2 sm:text-sm font-semibold transition-colors"
const SEG_OFF = "text-gray-300 hover:bg-white/10 hover:text-white"

function Steps() {
	const p = useProto()
	const { watch } = p.state
	const { show, ask } = useWords()
	const choices: [Watch, string][] = show
		? [
				["not_started", "Not started"],
				["watching", "Watching"],
				["seen", p.running ? "Caught up" : "Seen all"],
			]
		: [
				["not_started", "Not seen"],
				["seen", "Seen"],
			]
	return (
		<div className="mb-4">
			<p className="mb-2 text-sm font-semibold text-gray-400">{show ? "Where are you with it?" : "Have you seen it?"}</p>
			<div role="radiogroup" className="flex gap-1 rounded-xl bg-white/[0.06] p-1 ring-1 ring-white/10">
				{choices.map(([w, label]) => {
					const on = watch === w || (w === "watching" && (watch === "on_hold" || watch === "dropped"))
					return (
						<button
							key={w}
							type="button"
							role="radio"
							aria-checked={on}
							onClick={() => p.setWatch(w)}
							className={`${SEG} ${on ? LOOK[w === "watching" ? watch : w].pill : SEG_OFF}`}
						>
							{w === "not_started" ? <EyeSlash className="h-4 w-4 shrink-0" /> : <WatchIcon watch={w === "watching" ? watch : w} className="h-4 w-4 shrink-0" />}
							<span className="truncate">{w === "watching" && (watch === "on_hold" || watch === "dropped") ? LOOK[watch].word : label}</span>
						</button>
					)
				})}
			</div>
			{show && (watch === "watching" || watch === "on_hold" || watch === "dropped") && (
				<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
					<span className="tabular-nums">
						{p.state.episodes} of {p.total} episodes
					</span>
					<span className="ml-auto flex gap-1.5">
						{(["on_hold", "dropped"] as const).map((w) => (
							<button
								key={w}
								type="button"
								aria-pressed={watch === w}
								onClick={() => p.setWatch(watch === w ? "watching" : w)}
								className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 font-semibold ${watch === w ? LOOK[w].pill : "bg-white/10 text-gray-200 hover:bg-white/20"}`}
							>
								<WatchIcon watch={w} className="h-3.5 w-3.5" />
								{w === "on_hold" ? (watch === w ? "On hold" : "Pause") : watch === w ? "Dropped" : "Drop"}
							</button>
						))}
					</span>
				</div>
			)}
			<p className="mb-2 mt-4 text-sm font-semibold text-gray-400">
				{watch === "not_started" ? (
					<>
						Or rate it now <span className="font-normal text-gray-500">- that marks it as {show ? "Seen all" : "Seen"}.</span>
					</>
				) : (
					ask
				)}
			</p>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// switch: the score first, Seen as a switch (movie) or the status pill (show) in the header
// ---------------------------------------------------------------------------------------------------------

function SwitchHeading() {
	const p = useProto()
	const title = p.media.details.title
	return (
		<span className="flex min-w-0 items-center gap-3">
			<span className="min-w-0 truncate">{title}</span>
			{p.media.mediaType === "show" ? <StatusPill /> : <SeenSwitch />}
		</span>
	)
}

function SeenSwitch() {
	const p = useProto()
	const on = p.seen
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			onClick={() => p.setWatch(on ? "not_started" : "seen")}
			className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full py-1 pl-2.5 pr-1 text-xs font-semibold ring-1 ring-white/15 hover:bg-white/10"
		>
			<EyeIcon className={`h-4 w-4 ${on ? "text-green-400" : "text-gray-400"}`} />
			<span className={on ? "text-green-300" : "text-gray-300"}>Seen</span>
			<span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-green-500" : "bg-white/20"}`}>
				<span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
			</span>
		</button>
	)
}

function StatusPill() {
	const p = useProto()
	const { watch } = p.state
	const { word, progress } = useWords()
	const [menu, setMenu] = useState(false)
	const states: [Watch, string][] = [
		["not_started", "Not started"],
		["watching", "Watching"],
		["on_hold", "On hold"],
		["dropped", "Dropped"],
		["seen", p.running ? "Caught up" : "Seen all"],
	]
	return (
		<span className="relative shrink-0">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={menu}
				onClick={() => setMenu((m) => !m)}
				className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${LOOK[watch].pill}`}
			>
				{watch === "not_started" ? <EyeSlash className="h-3.5 w-3.5" /> : <WatchIcon watch={watch} className="h-3.5 w-3.5" />}
				{watch === "not_started" ? "Not started" : word}
				{progress && <span className="tabular-nums opacity-80">{progress}</span>}
				<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 opacity-70" aria-hidden="true">
					<path d="m4 6 4 4 4-4" />
				</svg>
			</button>
			{menu && (
				<span role="menu" className="absolute left-0 top-9 z-10 flex w-44 flex-col rounded-xl bg-stone-800 p-1 text-sm font-semibold shadow-2xl ring-1 ring-white/15">
					{states.map(([w, label]) => (
						<button
							key={w}
							type="button"
							role="menuitemradio"
							aria-checked={watch === w}
							onClick={() => {
								p.setWatch(w)
								setMenu(false)
							}}
							className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left hover:bg-white/10 ${watch === w ? "text-white" : "text-gray-300"}`}
						>
							{w === "not_started" ? <EyeSlash className="h-4 w-4 text-gray-400" /> : <WatchIcon watch={w} className={`h-4 w-4 ${LOOK[w].text}`} />}
							{label}
							{watch === w && <span className="ml-auto text-xs text-gray-400">now</span>}
						</button>
					))}
				</span>
			)}
		</span>
	)
}

function SwitchAsk() {
	const p = useProto()
	const { ask, show } = useWords()
	return (
		<p className="mb-2 text-sm font-semibold text-gray-400">
			{p.seen ? (
				ask
			) : (
				<>
					{ask} <span className="font-normal text-gray-500">A score marks it as {show ? "Seen all" : "Seen"}.</span>
				</>
			)}
		</p>
	)
}
