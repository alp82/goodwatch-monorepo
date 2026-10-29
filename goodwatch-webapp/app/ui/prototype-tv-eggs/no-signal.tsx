// PROTOTYPE - throwaway. The 404's resting screen, five takes (round 5, ?variant=a-e): fewer words, more TV.
// Each one only tells you that CH+ tunes in (and the service keys narrow it down); the address itself is left out.
import { type ReactNode, useEffect, useState } from "react"
import { ServiceMark } from "~/ui/living-room/Remote"
import { Static, Wordmark } from "./kit"

export const NO_SIGNAL_VARIANTS: Record<string, string> = {
	a: "Big 404 glow",
	b: "Set-top OSD",
	c: "Test circle",
	d: "Channel scan",
	e: "Bouncing 404",
}

/** A key of the Remote drawn on the screen, as the hint. */
function Cap({ children, wide }: { children: ReactNode; wide?: boolean }) {
	return (
		<span
			className={`inline-flex h-[5.2cqw] items-center justify-center rounded-full bg-gradient-to-b from-[#3d4046] to-[#26272b] px-[1.6cqw] text-[2.2cqw] font-bold text-white/90 shadow-[0_0.3cqw_0_#0e0f11,inset_0_1px_0_rgba(255,255,255,.12)] ${wide ? "min-w-[11cqw]" : "min-w-[5.2cqw]"}`}
		>
			{children}
		</span>
	)
}

function Keys({ count, services = true }: { count: number; services?: boolean }) {
	return (
		<div className="flex items-center justify-center gap-[1.4cqw]">
			<Cap>CH +</Cap>
			{count > 0 && <span className="text-[2cqw] text-white/60">{count} matches</span>}
			{services && (
				<>
					<span className="mx-[1cqw] h-[3cqw] w-px bg-white/20" />
					<Cap wide>
						<ServiceMark service={{ id: 8, name: "Netflix", logo_path: null }} height={11} onKey={0.42} />
					</Cap>
					<Cap wide>
						<ServiceMark service={{ id: 9, name: "Prime Video", logo_path: null }} height={11} onKey={0.42} />
					</Cap>
				</>
			)}
		</div>
	)
}

export function NoSignal({ variant, count }: { variant: string; count: number }) {
	if (variant === "b") return <Osd count={count} />
	if (variant === "c") return <TestCircle count={count} />
	if (variant === "d") return <Scan count={count} />
	if (variant === "e") return <Bounce count={count} />
	return <BigGlow count={count} />
}

// a. One huge glowing 404 over faint static, one line, the keys.
function BigGlow({ count }: { count: number }) {
	return (
		<>
			<Static calm opacity={0.35} />
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(0,0,0,.2),rgba(0,0,0,.85)_70%)]" />
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<div className="brand-header text-[22cqw] leading-[0.85] text-amber-400 [text-shadow:0_0_3cqw_rgba(251,191,36,.55),0_0_8cqw_rgba(251,191,36,.25)]">404</div>
				<div className="mt-[2cqh] text-[3cqw] font-bold text-white/90">Nothing on this channel</div>
				<div className="mt-[4cqh]">
					<Keys count={count} />
				</div>
			</div>
		</>
	)
}

// b. A set-top box's on-screen display: big channel number top left, a slim bar at the foot. No card.
function Osd({ count }: { count: number }) {
	return (
		<>
			<Static calm opacity={0.45} />
			<div className="absolute left-[4cqw] top-[5cqh] font-mono text-[9cqw] font-bold leading-none text-lime-300 [text-shadow:0_0_1.5cqw_rgba(0,0,0,.9)]">
				404
			</div>
			<div className="absolute left-[4.4cqw] top-[5cqh] mt-[10cqw] text-[2.2cqw] font-semibold uppercase tracking-[0.2em] text-white/80 [text-shadow:0_0_1cqw_rgba(0,0,0,.9)]">
				No signal<span className="egg-blink">_</span>
			</div>
			<div className="absolute inset-x-[4cqw] bottom-[5cqh] flex items-center justify-between rounded-[1.4cqw] bg-black/75 px-[2cqw] py-[1.4cqh]">
				<span className="text-[2.4cqw] font-semibold">Try another channel</span>
				<Keys count={count} />
			</div>
		</>
	)
}

// c. A round test emblem: rings, colour wedges, the G in the middle, 404 on its band.
function TestCircle({ count }: { count: number }) {
	const WEDGES = ["#e5e7eb", "#fbbf24", "#2dd4bf", "#4ade80", "#e879f9", "#f87171", "#60a5fa", "#a78bfa"]
	return (
		<div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,#16181d_0_6cqw,#1c1f25_6cqw_12cqw)]">
			<div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_6cqw,rgba(255,255,255,.04)_6cqw_calc(6cqw+1px))]" />
			<div className="absolute left-1/2 top-[44%] h-[66cqh] w-[66cqh] -translate-x-1/2 -translate-y-1/2">
				<svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
					{WEDGES.map((c, i) => {
						const a0 = (i / WEDGES.length) * 2 * Math.PI - Math.PI / 2
						const a1 = ((i + 1) / WEDGES.length) * 2 * Math.PI - Math.PI / 2
						const p = (a: number, r: number) => `${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`
						return <path key={c} d={`M ${p(a0, 49)} A 49 49 0 0 1 ${p(a1, 49)} L ${p(a1, 36)} A 36 36 0 0 0 ${p(a0, 36)} Z`} fill={c} />
					})}
					<circle cx="50" cy="50" r="36" fill="#0b0d12" />
					<circle cx="50" cy="50" r="49" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".6" />
					<line x1="0" y1="50" x2="100" y2="50" stroke="#fff" strokeOpacity=".25" strokeWidth=".4" />
					<line x1="50" y1="0" x2="50" y2="100" stroke="#fff" strokeOpacity=".25" strokeWidth=".4" />
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<Wordmark size="9cqh" />
					<div className="mt-[1.4cqh] font-mono text-[5.5cqh] font-bold tracking-[0.2em] text-white">404</div>
				</div>
			</div>
			<div className="absolute inset-x-0 bottom-[5cqh]">
				<Keys count={count} />
			</div>
		</div>
	)
}

// d. The set scans for channels: frequencies tick by, a bar fills, then it reports what it found.
function Scan({ count }: { count: number }) {
	const [mhz, setMhz] = useState(174)
	const done = mhz >= 862
	useEffect(() => {
		if (done) return
		const id = setInterval(() => setMhz((m) => Math.min(862, m + 23)), 70)
		return () => clearInterval(id)
	}, [done])
	const share = (mhz - 174) / (862 - 174)
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0d1220] to-black">
			<div className="text-[2cqw] font-semibold uppercase tracking-[0.3em] text-white/50">Channel 404</div>
			<div className="mt-[1.5cqh] text-[5cqw] font-bold">{done ? (count ? `${count} channels found` : "Nothing here") : "Scanning…"}</div>
			<div className="mt-[3cqh] h-[1.2cqh] w-[50%] overflow-hidden rounded-full bg-white/10">
				<div className="egg-progress h-full bg-amber-400" style={{ transform: `scaleX(${share})` }} />
			</div>
			<div className="mt-[1.2cqh] font-mono text-[2cqw] tabular-nums text-white/45">{mhz} MHz</div>
			<div className={`mt-[4cqh] transition-opacity duration-300 ${done ? "opacity-100" : "opacity-0"}`}>
				<Keys count={0} />
			</div>
		</div>
	)
}

// e. The old DVD player screensaver: a 404 drifting from edge to edge on black.
function Bounce({ count }: { count: number }) {
	return (
		<div className="absolute inset-0 overflow-hidden bg-black">
			<div className="egg-bounce-x absolute left-0 top-0">
				<div className="egg-bounce-y flex items-center gap-[1cqw] rounded-[1cqw] bg-amber-400 px-[2cqw] py-[1cqh] text-black">
					<Wordmark size="5cqw" color="#000" />
					<span className="brand-header text-[6cqw] leading-none">404</span>
				</div>
			</div>
			<div className="absolute inset-x-0 bottom-[5cqh]">
				<Keys count={count} />
			</div>
		</div>
	)
}
