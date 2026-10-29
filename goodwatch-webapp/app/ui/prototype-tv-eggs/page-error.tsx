// PROTOTYPE - throwaway. 2. Server error, "We'll be right back". The retry is simulated: `?outcome=fail` makes the
// first retry fail again, so both endings can be seen.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { Below, type Key, MiniRemote, SECONDARY, Scene, Static, Wordmark, backdrop, titles, useRemoteKeys } from "./kit"

export const VARIANTS_ERROR: Record<string, string> = {
	a: "Test card, turn it off and on",
	b: "Please stand by, auto retry",
	c: "TV on standby",
}

type Phase = "down" | "off" | "boot" | "retrying" | "back" | "still"

/** The retry as the TV plays it: off, boot, a request, then back on air or down again. */
function useRetry() {
	const [params] = useSearchParams()
	const failFirst = params.get("outcome") === "fail"
	const [phase, setPhase] = useState<Phase>("down")
	const [tries, setTries] = useState(0)
	useEffect(() => {
		const next: Partial<Record<Phase, [Phase, number]>> = {
			off: ["boot", 900],
			boot: ["retrying", 1300],
			retrying: [failFirst && tries === 1 ? "still" : "back", 1100],
		}
		const step = next[phase]
		if (!step) return
		const id = setTimeout(() => setPhase(step[0]), step[1])
		return () => clearTimeout(id)
	}, [phase, tries, failFirst])
	const retry = () => {
		if (phase !== "down" && phase !== "still") return
		setTries((n) => n + 1)
		setPhase("off")
	}
	return { phase, retry, tries }
}

export function PageError({ variant }: { variant: string }) {
	if (variant === "b") return <StandBy />
	if (variant === "c") return <Standby />
	return <TestCardRetry />
}

const BARS = ["#e5e7eb", "#fbbf24", "#2dd4bf", "#4ade80", "#e879f9", "#f87171", "#60a5fa"]

function Bars() {
	return (
		<div className="absolute inset-0 flex flex-col">
			<div className="flex h-[66%]">
				{BARS.map((c) => (
					<div key={c} className="flex-1" style={{ background: c }} />
				))}
			</div>
			<div className="flex h-[8%]">
				{BARS.slice().reverse().map((c, i) => (
					<div key={c} className="flex-1" style={{ background: i % 2 ? "#111" : c, opacity: 0.85 }} />
				))}
			</div>
			<div className="flex flex-1">
				{["#0b1f4d", "#fff", "#3b0764", "#111", "#111", "#222", "#111"].map((c, i) => (
					<div key={i} className="flex-1" style={{ background: c }} />
				))}
			</div>
		</div>
	)
}

/** The shared screen states after a retry starts. */
function RetryScreen({ phase }: { phase: Phase }) {
	if (phase === "boot")
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-black">
				<div className="egg-fade-in">
					<Wordmark size="12cqw" />
				</div>
			</div>
		)
	if (phase === "retrying")
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] bg-black">
				<Wordmark size="8cqw" />
				<div className="text-[2.4cqw] text-white/70">Tuning in…</div>
			</div>
		)
	if (phase === "back")
		return (
			<div className="egg-fade-in absolute inset-0">
				<img src={backdrop(titles[0])} alt="" className="absolute inset-0 h-full w-full object-cover" />
				<div className="absolute inset-0 bg-black/45" />
				<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
					<div className="text-[6cqw] font-bold">Back on air</div>
					<div className="mt-[1cqh] text-[2.4cqw] text-white/80">The page loaded. (In production this is the page itself.)</div>
				</div>
			</div>
		)
	return null
}

function belowFor(phase: Phase, retry: () => void) {
	return (
		<Below
			kicker="500"
			heading={phase === "still" ? "Still having trouble" : "We'll be right back"}
			text={
				phase === "still"
					? "The problem is on our side and it hasn't cleared yet. Try again in a minute."
					: "Something went wrong on our side. Try again in a moment."
			}
		>
			<button type="button" onClick={retry} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-black hover:bg-amber-300">
				Try again
			</button>
			<a href="/" className={SECONDARY}>
				Go home
			</a>
		</Below>
	)
}

// a. Our own test card with "We'll be right back". The Remote's one live key: Turn it off and on again.
function TestCardRetry() {
	const { phase, retry } = useRetry()
	const press = (k: Key) => k === "power" && retry()
	useRemoteKeys(press)
	const down = phase === "down" || phase === "still"
	return (
		<Scene
			power={phase === "off" ? "off" : "on"}
			screen={
				down ? (
					<>
						<Bars />
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="flex flex-col items-center rounded-[1.4cqw] bg-black/85 px-[4cqw] py-[3cqh] text-center shadow-2xl">
								<Wordmark size="7cqw" />
								<div className="mt-[1.6cqh] text-[4.6cqw] font-bold leading-none">{phase === "still" ? "Still off air" : "We'll be right back"}</div>
								<div className="mt-[1.2cqh] text-[2cqw] text-white/65">Technical difficulties on our side</div>
							</div>
						</div>
					</>
				) : (
					<RetryScreen phase={phase} />
				)
			}
			remote={<MiniRemote press={press} enabled={["power"]} pulse={down ? "power" : undefined} powerLabel="Turn it off and on again" />}
			below={belowFor(phase, retry)}
		/>
	)
}

// b. A frozen frame with a "Please stand by" lower third; it retries by itself after a countdown. OK tries now.
function StandBy() {
	const { phase, retry, tries } = useRetry()
	const [left, setLeft] = useState(12)
	const down = phase === "down" || phase === "still"
	useEffect(() => {
		if (!down) return
		setLeft(12)
		const id = setInterval(() => setLeft((s) => s - 1), 1000)
		return () => clearInterval(id)
	}, [down, tries])
	useEffect(() => {
		if (down && left <= 0) retry()
	}, [left, down, retry])
	const press = (k: Key) => (k === "ok" || k === "power") && retry()
	useRemoteKeys(press)
	const frame = titles[14]
	return (
		<Scene
			power={phase === "off" ? "off" : "on"}
			screen={
				down ? (
					<>
						<img src={backdrop(frame)} alt="" className="absolute inset-0 h-full w-full object-cover grayscale-[0.4]" />
						<div className="egg-scanlines" />
						<Static opacity={0.12} />
						<div className="absolute inset-x-0 bottom-[8cqh] flex items-stretch">
							<div className="flex items-center bg-amber-400 px-[2.5cqw] text-[2.4cqw] font-bold uppercase tracking-[0.08em] text-black">
								<span className="egg-blink mr-[1cqw] inline-block h-[1.4cqw] w-[1.4cqw] rounded-full bg-red-600" />
								Please stand by
							</div>
							<div className="flex-1 bg-black/85 px-[2.5cqw] py-[1.4cqh]">
								<div className="text-[2.6cqw] font-bold">{phase === "still" ? "Still not working" : "We're having technical difficulties"}</div>
								<div className="text-[1.9cqw] text-white/65">Trying again in {Math.max(0, left)} s · OK tries now</div>
							</div>
						</div>
						<div className="absolute inset-x-0 bottom-[6.6cqh] h-[0.6cqh] bg-white/10">
							<div className="egg-progress h-full bg-amber-400" style={{ transform: `scaleX(${1 - Math.max(0, left) / 12})`, transition: "transform 1s linear" }} />
						</div>
					</>
				) : (
					<RetryScreen phase={phase} />
				)
			}
			remote={<MiniRemote press={press} enabled={["ok", "power"]} okLabel="Retry" note="All channels paused" />}
			below={belowFor(phase, retry)}
		/>
	)
}

// c. The set sits on standby: a black screen with a red light, the room a little dimmer. Power wakes it.
function Standby() {
	const { phase, retry } = useRetry()
	const press = (k: Key) => k === "power" && retry()
	useRemoteKeys(press)
	const down = phase === "down" || phase === "still"
	return (
		<Scene
			dimRoom={down ? 0.35 : 0}
			screen={
				down ? (
					<div className="absolute inset-0 bg-gradient-to-br from-[#14161c] to-black">
						<div className="absolute bottom-[5cqh] right-[4cqw] flex items-center gap-[1cqw] text-[1.8cqw] text-white/45">
							<span className="egg-blink inline-block h-[1.2cqw] w-[1.2cqw] rounded-full bg-red-500 shadow-[0_0_1.4cqw_rgba(239,68,68,.9)]" />
							{phase === "still" ? "Still no picture" : "Standby"}
						</div>
						<div className="absolute left-[4cqw] top-[5cqh] text-[2.4cqw] font-semibold text-white/30">Something went wrong on our side</div>
					</div>
				) : (
					<RetryScreen phase={phase} />
				)
			}
			remote={<MiniRemote press={press} enabled={["power"]} pulse={down ? "power" : undefined} powerLabel="Wake it up" />}
			below={belowFor(phase, retry)}
		/>
	)
}
