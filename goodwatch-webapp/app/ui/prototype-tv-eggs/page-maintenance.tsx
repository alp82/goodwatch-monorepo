// PROTOTYPE - throwaway. 5. The AUTH_MAINTENANCE notice as a program break. The words are production's
// (utils/auth-maintenance.ts); the back-at time is "now + 30 minutes".
import { Link } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { MAINTENANCE_SUB, MAINTENANCE_TITLE } from "~/utils/auth-maintenance"
import {
	Below,
	Broadcast,
	ChannelNumber,
	InfoBar,
	type Key,
	MiniRemote,
	PRIMARY,
	Scene,
	Wordmark,
	openTitle,
	titles,
	useRemoteKeys,
	useToast,
} from "./kit"

export const VARIANTS_MAINTENANCE: Record<string, string> = {
	a: "Program break slate",
	b: "Small TV in the sign-in card",
	c: "Intermission, keep browsing",
}

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
	return { clock, countdown: `${mm}:${ss}`, share: 1 - left / (30 * 60_000) }
}

export function PageMaintenance({ variant }: { variant: string }) {
	if (variant === "b") return <CardTv />
	if (variant === "c") return <Intermission />
	return <Slate />
}

/** The slate itself, drawn in screen units so it fits any TV size. */
function SlateScreen({ clock, countdown }: { clock: string; countdown: string }) {
	return (
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
				<span className="truncate">Ratings and Wishlist are safe · browsing works as usual</span>
			</div>
		</div>
	)
}

// a. The whole room with a broadcast slate on the TV; the channel keys only say that every channel is paused.
function Slate() {
	const { clock, countdown } = useBackAt()
	const [msg, toast] = useToast()
	const press = (k: Key) => {
		if (k === "up" || k === "down") toast("Sign-in is paused on every channel")
		if (k === "ok") toast(`Back at ${clock}`)
		if (k === "power") toast("Power: keep browsing")
	}
	useRemoteKeys(press)
	return (
		<Scene
			msg={msg}
			screen={<SlateScreen clock={clock} countdown={countdown} />}
			remote={<MiniRemote press={press} note="All sign-in channels paused" />}
			below={
				<Below heading={MAINTENANCE_TITLE} text={MAINTENANCE_SUB}>
					<Link to="/" className={PRIMARY}>
						Keep browsing
					</Link>
				</Below>
			}
		/>
	)
}

// b. No room: a small TV set inside the sign-in card, where the notice shows today (MaintenanceCard).
function CardTv() {
	const { clock, countdown } = useBackAt()
	return (
		<div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-12">
			<div className="flex w-full flex-col items-center gap-8 rounded-3xl bg-white/[0.04] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] sm:flex-row sm:p-8">
				<div className="w-full max-w-[320px] shrink-0">
					<div className="rounded-xl bg-[#1b1c20] p-2 shadow-2xl ring-1 ring-white/10">
						<div className="relative aspect-video overflow-hidden rounded-md bg-black text-white" style={{ containerType: "size" }}>
							<SlateScreen clock={clock} countdown={countdown} />
						</div>
					</div>
					<div className="mx-auto h-3 w-20 rounded-b-lg bg-[#1b1c20]" />
				</div>
				<div className="text-center sm:text-left">
					<h1 className="text-2xl font-bold text-gray-100">{MAINTENANCE_TITLE}</h1>
					<p className="mt-2 text-gray-400">{MAINTENANCE_SUB}</p>
					<p className="mt-2 text-sm text-amber-300">Back at {clock}</p>
					<Link to="/" className={`${PRIMARY} mt-6 inline-flex`}>
						Keep browsing
					</Link>
				</div>
			</div>
		</div>
	)
}

// c. An intermission card with a progress bar to the back-at time. CH still tunes to titles, since browsing
// works; the card stays as a corner badge while you surf.
function Intermission() {
	const { clock, countdown, share } = useBackAt()
	const list = titles.slice(0, 20)
	const [at, setAt] = useState(-1)
	const [msg, toast] = useToast()
	const press = (k: Key) => {
		if (k === "up") setAt((i) => (i + 1 >= list.length ? -1 : i + 1))
		if (k === "down") setAt((i) => (i - 1 < -1 ? list.length - 1 : i - 1))
		if (k === "ok") at >= 0 ? openTitle(list[at]) : toast("CH+ to browse while you wait")
		if (k === "power") setAt(-1)
	}
	useRemoteKeys(press)
	const t = at >= 0 ? list[at] : null
	return (
		<Scene
			msg={msg}
			screen={
				t ? (
					<>
						<Broadcast title={t} />
						<InfoBar t={t} hint="OK opens" />
						<ChannelNumber n={at + 1} />
						<div className="absolute left-[3cqw] top-[3cqh] rounded-[0.8cqw] bg-black/75 px-[1.5cqw] py-[1cqh] text-[1.7cqw]">
							<div className="font-semibold">Intermission · sign-in back at {clock}</div>
							<div className="mt-[0.6cqh] h-[0.6cqh] w-full overflow-hidden rounded-full bg-white/15">
								<div className="egg-progress h-full bg-amber-400" style={{ transform: `scaleX(${share})` }} />
							</div>
						</div>
					</>
				) : (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#3b2a12,#0c0a08_70%)] text-center">
						<div className="text-[2cqw] uppercase tracking-[0.4em] text-amber-200/70">Intermission</div>
						<div className="mt-[2cqh] px-[6cqw] text-[4cqw] font-bold leading-tight">{MAINTENANCE_TITLE}</div>
						<div className="mt-[3cqh] h-[1cqh] w-[50%] overflow-hidden rounded-full bg-white/15">
							<div className="egg-progress h-full bg-amber-400" style={{ transform: `scaleX(${share})` }} />
						</div>
						<div className="mt-[1.2cqh] font-mono text-[2.2cqw] text-white/70">
							{countdown} · back at {clock}
						</div>
						<div className="mt-[3cqh] text-[2cqw] text-white/80">
							Press <b>CH+</b> to keep browsing while you wait
						</div>
					</div>
				)
			}
			remote={<MiniRemote press={press} pulse={t ? undefined : "up"} note="Power: back to the intermission" />}
			below={
				<Below heading={MAINTENANCE_TITLE} text={MAINTENANCE_SUB}>
					<Link to="/" className={PRIMARY}>
						Keep browsing
					</Link>
				</Below>
			}
		/>
	)
}
