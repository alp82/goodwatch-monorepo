// PROTOTYPE - throwaway. 4. Maintenance as a program break (round 4: the whole site is offline, generic words).
// OK refreshes: there is nothing to browse during maintenance (the owner, round 4). The back-at time is "now + 30 minutes".
import { useEffect, useMemo, useState } from "react"
import { BigRemote, type Key, Scene, Wordmark, useRemoteKeys, useToast, useTvPower } from "./kit"

function useBackAt() {
	const backAt = useMemo(() => {
		const d = new Date(Date.now() + 30 * 60_000)
		d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
		return d
	}, [])
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [])
	const left = Math.max(0, backAt.getTime() - now)
	const clock = backAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
	const mm = String(Math.floor(left / 60_000)).padStart(2, "0")
	const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")
	return { clock, countdown: `${mm}:${ss}` }
}

export function PageMaintenance() {
	const { clock, countdown } = useBackAt()
	const [msg, toast] = useToast()
	const tv = useTvPower()
	const press = (k: Key) => {
		if (k === "power") return tv.toggle()
		if (!tv.on) return
		if (k === "up" || k === "down") toast(`This channel is back at ${clock}`)
		if (k === "ok") toast("Refreshing… still off air")
	}
	useRemoteKeys(press)
	return (
		<Scene
			heading="Scheduled maintenance"
			msg={msg}
			power={tv.power}
			screen={
				<div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#0f1a2e] to-[#070a12]">
					<div className="flex items-center justify-between px-[3cqw] pt-[3cqh] text-[1.8cqw] font-semibold uppercase tracking-[0.16em] text-white/55">
						<span>Program break</span>
						<span className="font-mono normal-case tracking-normal">{countdown}</span>
					</div>
					<div className="flex flex-1 flex-col items-center justify-center text-center">
						<Wordmark size="8cqw" />
						<div className="mt-[2.4cqh] px-[6cqw] text-[4.6cqw] font-bold leading-tight">Scheduled maintenance</div>
						<div className="mt-[1.2cqh] px-[8cqw] text-[2.3cqw] text-white/70">GoodWatch is offline for a short while. We'll be back at {clock}.</div>
						<div className="mt-[3cqh] flex items-center gap-[1.2cqw] rounded-full bg-white/10 py-[0.8cqh] pl-[0.8cqw] pr-[2cqw] text-[2.2cqw] font-semibold">
							<span className="flex h-[4.4cqw] w-[4.4cqw] items-center justify-center rounded-full bg-white/90 text-[1.5cqw] font-bold text-black">OK</span>
							Refresh
						</div>
					</div>
					<div className="flex h-[9cqh] items-center justify-center gap-[2cqw] overflow-hidden bg-amber-400 px-[3cqw] text-[2cqw] font-semibold text-black">
						<span className="shrink-0 rounded-[0.5cqw] bg-black px-[1cqw] py-[0.3cqh] text-amber-300">Off air</span>
						<span className="truncate">Regular programming resumes at {clock}</span>
					</div>
				</div>
			}
			remote={<BigRemote press={press} off={!tv.on} pulse="ok" />}
		/>
	)
}
