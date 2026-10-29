// PROTOTYPE - throwaway. 3. Sign-out (round 3): the TV says good night with the time, switches off by itself, and
// the lamps dim. Power works as on every page: back on shows the sign-in card, off again switches it off. Sam is
// the demo member.
import { useEffect, useState } from "react"
import { BigRemote, type Key, Scene, Wordmark, useRemoteKeys, useTvPower } from "./kit"

const NAME = "Sam"

export function PageSignout() {
	const tv = useTvPower()
	// Once the set has been off, it wakes to the sign-in card instead of the good night.
	const [slept, setSlept] = useState(false)
	useEffect(() => {
		const id = setTimeout(() => {
			tv.setOn(false)
			setSlept(true)
		}, 3400)
		return () => clearTimeout(id)
	}, [tv.setOn])
	const press = (k: Key) => {
		if (k !== "power") return
		setSlept(true)
		tv.toggle()
	}
	useRemoteKeys(press)
	const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
	return (
		<Scene
			heading="You're signed out"
			power={tv.power}
			screen={
				slept ? (
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
			remote={<BigRemote press={press} enabled={["power"]} off={!tv.on} powerLabel={tv.on ? undefined : "Sign back in"} />}
		/>
	)
}
