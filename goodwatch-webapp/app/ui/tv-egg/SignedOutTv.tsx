// The signed-out page's TV: "Good night" with the member's handle and the time, then the set switches itself off and
// the lamps go down. Power turns it back on to a sign-in card; off again switches it off.
import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { type Key, Remote, Room, Wordmark, useRemoteKeys, useTvPower } from "./Room"
import { SIGNED_OUT_NAME_KEY } from "./signed-out-name"


function takeName(): string | null {
	try {
		const name = sessionStorage.getItem(SIGNED_OUT_NAME_KEY)
		sessionStorage.removeItem(SIGNED_OUT_NAME_KEY)
		return name
	} catch {
		return null
	}
}

/** How long "Good night" shows before the set switches itself off. */
const NIGHT_MS = 3400

export default function SignedOutTv() {
	const tv = useTvPower()
	const [name] = useState(takeName)
	const [time] = useState(() => new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))
	// Once the set has been off, it wakes to the sign-in card instead of the good night.
	const [slept, setSlept] = useState(false)
	const { setOn } = tv
	useEffect(() => {
		const id = setTimeout(() => {
			setOn(false)
			setSlept(true)
		}, NIGHT_MS)
		return () => clearTimeout(id)
	}, [setOn])
	const press = (key: Key) => {
		if (key !== "power") return
		setSlept(true)
		tv.toggle()
	}
	useRemoteKeys(press)
	return (
		<Room
			power={tv.power}
			screen={
				slept ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] bg-gradient-to-b from-[#101522] to-black text-center">
						<Wordmark size="9cqw" />
						<div className="text-[4cqw] font-bold">Welcome back</div>
						<Link
							to="/sign-in"
							className="rounded-[1cqw] bg-amber-400 px-[3cqw] py-[1.4cqh] text-[2.4cqw] font-bold text-black hover:bg-amber-300"
						>
							Sign in
						</Link>
					</div>
				) : (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#16181f] via-[#08090c] to-black text-center">
						<div className="text-[6cqw] font-bold text-white/85">{name ? `Good night, ${name}` : "Good night"}</div>
						<div className="mt-[1.4cqh] text-[2.3cqw] text-white/55">You're signed out.</div>
						<div className="mt-[2cqh] font-mono text-[2.6cqw] text-white/35">{time}</div>
					</div>
				)
			}
			remote={<Remote press={press} enabled={["power"]} off={!tv.on} />}
		/>
	)
}
