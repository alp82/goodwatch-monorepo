// The error page's TV: a test card with "We'll be right back" and a "Please stand by" bar that counts down to a
// retry (a reload). OK retries now. Power switches the set off; switching it back on retries ("turn it off and on
// again"). It needs no data, so it works whatever failed.
import { useEffect, useState } from "react"
import { type Key, Remote, Room, Wordmark, useRemoteKeys, useTvPower } from "./Room"

const BARS = ["#e5e7eb", "#fbbf24", "#2dd4bf", "#4ade80", "#e879f9", "#f87171", "#60a5fa"]
const STORAGE_KEY = "gw_error_tv_retries"
/** The first wait before a retry, in seconds; it doubles with every retry in a row, up to MAX_WAIT. */
const FIRST_WAIT = 15
const MAX_WAIT = 120
/** Retries further apart than this start over at FIRST_WAIT. */
const RUN_GAP_MS = 5 * 60_000

/** How long to wait before the next retry, from the retries in a row so far (kept for the tab). */
export function retryWait(retries: number): number {
	return Math.min(MAX_WAIT, FIRST_WAIT * 2 ** Math.max(0, retries))
}

function readRetries(): number {
	try {
		const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as { n: number; at: number } | null
		return stored && Date.now() - stored.at < RUN_GAP_MS ? stored.n : 0
	} catch {
		return 0
	}
}

function reloadAfterRetry(retries: number) {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ n: retries + 1, at: Date.now() }))
	} catch {
		// Without storage every wait is the first one.
	}
	window.location.reload()
}

function TestCard() {
	return (
		<div className="absolute inset-0 flex flex-col">
			<div className="flex h-[66%]">
				{BARS.map((color) => (
					<div key={color} className="flex-1" style={{ background: color }} />
				))}
			</div>
			<div className="flex h-[8%]">
				{[...BARS].reverse().map((color, i) => (
					<div key={color} className="flex-1" style={{ background: i % 2 ? "#111" : color, opacity: 0.85 }} />
				))}
			</div>
			<div className="flex flex-1">
				{["#0b1f4d", "#fff", "#3b0764", "#111", "#151515", "#222", "#101010"].map((color) => (
					<div key={color} className="flex-1" style={{ background: color }} />
				))}
			</div>
		</div>
	)
}

export default function ErrorTv() {
	const tv = useTvPower()
	const [retries] = useState(readRetries)
	const wait = retryWait(retries)
	const [left, setLeft] = useState(wait)
	const [leaving, setLeaving] = useState(false)
	// Switched back on: the tube lights up, then the page reloads.
	const [waking, setWaking] = useState(false)
	useEffect(() => {
		if (!waking) return
		const id = setTimeout(() => reloadAfterRetry(retries), 700)
		return () => clearTimeout(id)
	}, [waking, retries])
	// The countdown runs while the set is on.
	useEffect(() => {
		if (!tv.on || leaving) return
		const id = setInterval(() => setLeft((s) => s - 1), 1000)
		return () => clearInterval(id)
	}, [tv.on, leaving])
	// A retry: the tube switches off, then the page reloads.
	const retry = () => setLeaving(true)
	useEffect(() => {
		if (left <= 0 && !leaving) setLeaving(true)
	}, [left, leaving])
	useEffect(() => {
		if (!leaving) return
		const id = setTimeout(() => reloadAfterRetry(retries), 650)
		return () => clearTimeout(id)
	}, [leaving, retries])
	const press = (key: Key) => {
		if (leaving || waking) return
		if (key === "power") {
			if (!tv.on) setWaking(true)
			return tv.toggle()
		}
		if (tv.on && key === "ok") retry()
	}
	useRemoteKeys(press)
	return (
		<Room
			power={tv.on && !leaving ? "on" : "off"}
			screen={
				<>
					<TestCard />
					<div className="absolute inset-x-0 top-[12%] flex justify-center">
						<div className="flex flex-col items-center rounded-[1.4cqw] bg-black/85 px-[4cqw] py-[3cqh] text-center shadow-2xl">
							<Wordmark size="7cqw" />
							<div className="mt-[1.6cqh] text-[4.6cqw] font-bold leading-none">We'll be right back</div>
							<div className="mt-[1.2cqh] text-[2cqw] text-white/65">Technical difficulties on our side</div>
						</div>
					</div>
					<div className="absolute inset-x-0 bottom-[7cqh] flex items-stretch">
						<div className="flex items-center bg-amber-400 px-[2.5cqw] text-[2.2cqw] font-bold uppercase tracking-[0.08em] text-black">
							Please stand by
						</div>
						<div className="flex flex-1 items-center justify-center bg-black/85 px-[2.5cqw] py-[1.4cqh] text-center text-[2.2cqw] tabular-nums">
							Trying again in {Math.max(0, left)} s
						</div>
					</div>
					<div className="absolute inset-x-0 bottom-[5.8cqh] h-[0.7cqh] bg-black/40">
						<div
							className="h-full origin-left bg-amber-400"
							style={{ transform: `scaleX(${1 - Math.max(0, left) / wait})`, transition: "transform 1s linear" }}
						/>
					</div>
				</>
			}
			remote={<Remote press={press} off={!tv.on} enabled={["power", "ok"]} />}
		/>
	)
}
