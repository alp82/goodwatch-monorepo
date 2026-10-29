// PROTOTYPE - throwaway. 5. The AUTH_MAINTENANCE notice as a program break (round 2: variant a picked). The words
// are production's (utils/auth-maintenance.ts); the back-at time is "now + 30 minutes".
import { useEffect, useMemo, useState } from "react"
import { MAINTENANCE_TITLE } from "~/utils/auth-maintenance"
import { BigRemote, type Key, Scene, Wordmark, useRemoteKeys, useToast } from "./kit"

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
	const press = (k: Key) => {
		if (k === "up" || k === "down") toast("Sign-in is paused on every channel")
		if (k === "ok") toast(`Back at ${clock}`)
		if (k === "power") toast("Power: keep browsing (start page)")
	}
	useRemoteKeys(press)
	return (
		<Scene
			heading={MAINTENANCE_TITLE}
			msg={msg}
			screen={
				<div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#0f1a2e] to-[#070a12]">
					<div className="flex items-center justify-between px-[3cqw] pt-[3cqh] text-[1.8cqw] font-semibold uppercase tracking-[0.16em] text-white/55">
						<span>Program break</span>
						<span className="font-mono normal-case tracking-normal">{countdown}</span>
					</div>
					<div className="flex flex-1 flex-col items-center justify-center text-center">
						<Wordmark size="8cqw" />
						<div className="mt-[2.4cqh] px-[6cqw] text-[4.2cqw] font-bold leading-tight">{MAINTENANCE_TITLE}</div>
						<div className="mt-[1.6cqh] text-[2.6cqw] text-amber-300">Back at {clock}</div>
					</div>
					<div className="flex h-[9cqh] items-center gap-[2cqw] overflow-hidden bg-amber-400 px-[3cqw] text-[2cqw] font-semibold text-black">
						<span className="shrink-0 rounded-[0.5cqw] bg-black px-[1cqw] py-[0.3cqh] text-amber-300">Still on air</span>
						<span className="truncate">Ratings and Wishlist are safe · Power to keep browsing</span>
					</div>
				</div>
			}
			remote={<BigRemote press={press} enabled={["power", "ok", "up", "down"]} powerLabel="Keep browsing" />}
		/>
	)
}
