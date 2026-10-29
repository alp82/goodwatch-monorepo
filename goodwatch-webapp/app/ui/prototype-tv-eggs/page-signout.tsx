// PROTOTYPE - throwaway. 3. Sign-out, "Thanks for watching". The member is the demo person Sam; their week is
// made up from the fixture titles.
import { type ReactNode, useEffect, useState } from "react"
import { Below, type Key, MiniRemote, PRIMARY, Ring, SECONDARY, Scene, Wordmark, backdrop, poster, titles, useRemoteKeys } from "./kit"

export const VARIANTS_SIGNOUT: Record<string, string> = {
	a: "End card, then power off",
	b: "End credits of your week",
	c: "Lights out, good night",
}

const NAME = "Sam"
const RATED = [titles[58], titles[60], titles[46]] // Severance, Shōgun, Shutter Island
const WISHED = [titles[63], titles[59]] // Fallout, The Bear

export function PageSignout({ variant }: { variant: string }) {
	const [run, setRun] = useState(0)
	const replay = () => setRun((n) => n + 1)
	if (variant === "b") return <Credits key={run} replay={replay} />
	if (variant === "c") return <LightsOut key={run} replay={replay} />
	return <EndCard key={run} replay={replay} />
}

function useLater(ms: number) {
	const [done, setDone] = useState(false)
	useEffect(() => {
		const id = setTimeout(() => setDone(true), ms)
		return () => clearTimeout(id)
	}, [ms])
	return done
}

function SignedOut({ replay, signIn }: { replay: () => void; signIn?: boolean }) {
	return (
		<Below
			heading={signIn ? "Welcome back" : "You're signed out"}
			text={signIn ? "Sign in to pick up where you left off." : "Your ratings and lists are saved. See you next time."}
		>
			<a href="/sign-in" className={PRIMARY}>
				Sign in again
			</a>
			<a href="/" className={SECONDARY}>
				Go home
			</a>
			<button type="button" onClick={replay} className="text-xs text-gray-500 underline">
				Replay (prototype)
			</button>
		</Below>
	)
}

/** After the set is off, Power turns it back on to a sign-in card. */
function WakeCard() {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] bg-gradient-to-b from-[#101522] to-black text-center">
			<Wordmark size="9cqw" />
			<div className="text-[4cqw] font-bold">Welcome back</div>
			<a href="/sign-in" className="rounded-[1cqw] bg-amber-400 px-[3cqw] py-[1.4cqh] text-[2.4cqw] font-bold text-black">
				Sign in
			</a>
		</div>
	)
}

// a. An end card with the member's name and one line about their week; after a moment the tube switches off and
// the lamps dim.
function EndCard({ replay }: { replay: () => void }) {
	const off = useLater(3200)
	const [wake, setWake] = useState(false)
	const press = (k: Key) => k === "power" && off && setWake(true)
	useRemoteKeys(press)
	return (
		<Scene
			power={off && !wake ? "off" : "on"}
			dimRoom={off && !wake ? 0.5 : 0}
			screen={
				wake ? (
					<WakeCard />
				) : (
					<div className="absolute inset-0">
						<img src={backdrop(RATED[0])} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[0.3cqw]" />
						<div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
						<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
							<Wordmark size="7cqw" />
							<div className="mt-[2cqh] text-[6cqw] font-bold leading-none">Thanks for watching, {NAME}</div>
							<div className="mt-[1.6cqh] text-[2.3cqw] text-white/70">
								This week you rated {RATED.length} titles and added {WISHED.length} to your Wishlist.
							</div>
						</div>
					</div>
				)
			}
			remote={<MiniRemote press={press} enabled={["power"]} pulse={off && !wake ? "power" : undefined} powerLabel={off ? "Turn it back on" : undefined} />}
			below={<SignedOut replay={replay} signIn={wake} />}
		/>
	)
}

// b. End credits of the member's week roll up the screen; the tube switches off when they end.
function Credits({ replay }: { replay: () => void }) {
	const ROLL = 13000
	const off = useLater(ROLL + 400)
	const [wake, setWake] = useState(false)
	const [skip, setSkip] = useState(false)
	const press = (k: Key) => {
		if (k === "power" && (off || skip)) setWake(true)
		if (k === "ok" && !off) setSkip(true)
	}
	useRemoteKeys(press)
	const isOff = (off || skip) && !wake
	const Row = ({ role, children }: { role: string; children: ReactNode }) => (
		<div className="mt-[4cqh]">
			<div className="text-[1.8cqw] uppercase tracking-[0.2em] text-white/50">{role}</div>
			<div className="mt-[0.8cqh] text-[3.2cqw] font-semibold leading-snug">{children}</div>
		</div>
	)
	return (
		<Scene
			power={isOff ? "off" : "on"}
			dimRoom={isOff ? 0.45 : 0}
			screen={
				wake ? (
					<WakeCard />
				) : (
					<div className="absolute inset-0 overflow-hidden bg-black">
						<div className="egg-credits absolute inset-x-0 text-center" style={{ ["--roll" as string]: `${ROLL}ms` }}>
							<div className="text-[1.8cqw] uppercase tracking-[0.3em] text-white/50">GoodWatch presents</div>
							<div className="mt-[2cqh] text-[6cqw] font-bold leading-none">{NAME}'s week</div>
							<Row role="Starring">{NAME}</Row>
							<Row role="Rated">
								{RATED.map((t) => (
									<div key={t.id} className="flex items-center justify-center gap-[1.2cqw]">
										{t.title} <Ring t={t} size="3.4cqw" />
									</div>
								))}
							</Row>
							<Row role="Added to Wishlist">
								{WISHED.map((t) => (
									<div key={t.id}>{t.title}</div>
								))}
							</Row>
							<Row role="Coming up next">
								<img src={poster(WISHED[0])} alt="" className="mx-auto mt-[1cqh] h-[30cqh] rounded-[0.6cqw]" />
							</Row>
							<div className="mt-[10cqh] pb-[20cqh]">
								<Wordmark size="8cqw" />
								<div className="mt-[2cqh] text-[3cqw] font-bold">See you next time</div>
							</div>
						</div>
					</div>
				)
			}
			remote={
				<MiniRemote
					press={press}
					enabled={isOff || wake ? ["power"] : ["ok"]}
					okLabel="Skip"
					pulse={isOff ? "power" : undefined}
					powerLabel={isOff ? "Turn it back on" : undefined}
				/>
			}
			below={<SignedOut replay={replay} signIn={wake} />}
		/>
	)
}

// c. The set is already off and the room is dark; a small clock sits on the screen. Power signs back in.
function LightsOut({ replay }: { replay: () => void }) {
	const dark = useLater(200)
	const [wake, setWake] = useState(false)
	const press = (k: Key) => k === "power" && setWake(true)
	useRemoteKeys(press)
	const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
	return (
		<Scene
			dimRoom={wake ? 0 : dark ? 0.62 : 0}
			screen={
				wake ? (
					<WakeCard />
				) : (
					<div className="absolute inset-0 bg-gradient-to-br from-[#16181f] via-[#08090c] to-black">
						<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
							<div className="text-[5cqw] font-bold text-white/80">Good night, {NAME}</div>
							<div className="mt-[1cqh] font-mono text-[2.6cqw] text-white/35">{time}</div>
						</div>
					</div>
				)
			}
			remote={<MiniRemote press={press} enabled={["power"]} pulse={!wake ? "power" : undefined} powerLabel={wake ? undefined : "Sign back in"} />}
			below={<SignedOut replay={replay} signIn={wake} />}
		/>
	)
}
