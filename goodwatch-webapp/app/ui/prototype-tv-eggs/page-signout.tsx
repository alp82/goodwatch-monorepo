// PROTOTYPE - throwaway. 3. Sign-out (round 2: c's "Good night" with a's power off). The TV says good night with
// the time, switches off, and the lamps dim; Power turns it back on to sign in. The member is the demo person Sam.
import { useEffect, useState } from "react"
import { BigRemote, type Key, Scene, Wordmark, useRemoteKeys } from "./kit"

const NAME = "Sam"

function useLater(ms: number, run: number) {
	const [done, setDone] = useState(false)
	useEffect(() => {
		setDone(false)
		const id = setTimeout(() => setDone(true), ms)
		return () => clearTimeout(id)
	}, [ms, run])
	return done
}

export function PageSignout() {
	const [run, setRun] = useState(0)
	const off = useLater(3400, run)
	const [wake, setWake] = useState(false)
	const press = (k: Key) => {
		if (k !== "power") return
		if (wake) {
			// Prototype only: Power again replays the sign-out.
			setWake(false)
			setRun((n) => n + 1)
		} else if (off) setWake(true)
	}
	useRemoteKeys(press)
	const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
	const dark = off && !wake
	return (
		<Scene
			key={run}
			heading="You're signed out"
			power={dark ? "off" : "on"}
			dimRoom={dark ? 0.62 : 0}
			screen={
				wake ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] bg-gradient-to-b from-[#101522] to-black text-center">
						<Wordmark size="9cqw" />
						<div className="text-[4cqw] font-bold">Welcome back</div>
						<a href="/sign-in" className="rounded-[1cqw] bg-amber-400 px-[3cqw] py-[1.4cqh] text-[2.4cqw] font-bold text-black">
							Sign in
						</a>
						<div className="text-[1.8cqw] text-white/45">Your ratings and lists are saved.</div>
					</div>
				) : (
					<div className="absolute inset-0 bg-gradient-to-br from-[#16181f] via-[#08090c] to-black">
						<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
							<div className="text-[6cqw] font-bold text-white/85">Good night, {NAME}</div>
							<div className="mt-[1.4cqh] text-[2.3cqw] text-white/55">You're signed out. Your ratings and lists are saved.</div>
							<div className="mt-[2cqh] font-mono text-[2.6cqw] text-white/35">{time}</div>
						</div>
					</div>
				)
			}
			remote={
				<BigRemote
					press={press}
					enabled={["power"]}
					pulse={dark ? "power" : undefined}
					powerLabel={dark ? "Sign back in" : wake ? "Replay (prototype)" : undefined}
				/>
			}
		/>
	)
}
