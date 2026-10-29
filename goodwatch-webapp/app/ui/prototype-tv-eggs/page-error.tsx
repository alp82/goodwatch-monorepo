// PROTOTYPE - throwaway. 2. Server error (round 2: b's auto retry on a's test card and words). The retry is
// simulated: `?outcome=fail` makes the first retry fail again, so both endings can be seen.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { BigRemote, type Key, Scene, Wordmark, backdrop, titles, useRemoteKeys, useTvPower } from "./kit"

type Phase = "down" | "off" | "boot" | "retrying" | "back" | "still"
const WAIT = 12

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
	/** OK and the countdown retry with a short off and on; Power back on retries from the boot. */
	const retry = (from: Phase = "off") => {
		if (phase !== "down" && phase !== "still") return
		setTries((n) => n + 1)
		setPhase(from)
	}
	return { phase, retry, tries }
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

/** The screen once a retry has started. */
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
					<div className="mt-[1cqh] text-[2.4cqw] text-white/80">(In production the page itself loads here.)</div>
				</div>
			</div>
		)
	return null
}

export function PageError() {
	const { phase, retry, tries } = useRetry()
	const tv = useTvPower()
	const [left, setLeft] = useState(WAIT)
	const down = phase === "down" || phase === "still"
	useEffect(() => {
		if (!down || !tv.on) return
		setLeft(WAIT)
		const id = setInterval(() => setLeft((s) => s - 1), 1000)
		return () => clearInterval(id)
	}, [down, tries, tv.on])
	useEffect(() => {
		if (down && tv.on && left <= 0) retry()
	}, [left, down, retry, tv.on])
	const press = (k: Key) => {
		// Turn it off and on again: switching back on retries.
		if (k === "power") {
			if (!tv.on) retry("boot")
			return tv.toggle()
		}
		if (tv.on && k === "ok") retry()
	}
	useRemoteKeys(press)
	return (
		<Scene
			heading="Something went wrong"
			power={phase === "off" || !tv.on ? "off" : "on"}
			dimRoom={tv.on ? 0 : 0.6}
			screen={
				down ? (
					<>
						<Bars />
						<div className="absolute inset-x-0 top-[12%] flex justify-center">
							<div className="flex flex-col items-center rounded-[1.4cqw] bg-black/85 px-[4cqw] py-[3cqh] text-center shadow-2xl">
								<Wordmark size="7cqw" />
								<div className="mt-[1.6cqh] text-[4.6cqw] font-bold leading-none">{phase === "still" ? "Still off air" : "We'll be right back"}</div>
								<div className="mt-[1.2cqh] text-[2cqw] text-white/65">Technical difficulties on our side</div>
							</div>
						</div>
						<div className="absolute inset-x-0 bottom-[7cqh] flex items-stretch">
							<div className="flex items-center bg-amber-400 px-[2.5cqw] text-[2.2cqw] font-bold uppercase tracking-[0.08em] text-black">
								<span className="egg-blink mr-[1cqw] inline-block h-[1.3cqw] w-[1.3cqw] rounded-full bg-red-600" />
								Please stand by
							</div>
							<div className="flex flex-1 items-center bg-black/85 px-[2.5cqw] py-[1.4cqh] text-[2.2cqw]">
								Trying again in {Math.max(0, left)} s · <b className="ml-[0.6cqw]">OK</b>&nbsp;tries now ·&nbsp;<b>Power</b>&nbsp;off and on
							</div>
						</div>
						<div className="absolute inset-x-0 bottom-[5.8cqh] h-[0.7cqh] bg-black/40">
							<div className="egg-progress h-full bg-amber-400" style={{ transform: `scaleX(${1 - Math.max(0, left) / WAIT})`, transition: "transform 1s linear" }} />
						</div>
					</>
				) : (
					<RetryScreen phase={phase} />
				)
			}
			remote={<BigRemote press={press} off={!tv.on} enabled={["ok", "power"]} pulse={down ? "power" : undefined} />}
		/>
	)
}
