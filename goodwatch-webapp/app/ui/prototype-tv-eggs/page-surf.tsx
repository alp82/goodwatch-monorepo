// PROTOTYPE - throwaway. 4. The hidden channel-surfing page: good titles on the member's services, one channel at
// a time. Nothing links to it but a small remote icon in the footer (and the keys T, V typed anywhere).
import { type ReactNode, useMemo, useState } from "react"
import {
	Below,
	Broadcast,
	ChannelNumber,
	InfoBar,
	type Key,
	MiniRemote,
	Ring,
	Scene,
	type Title,
	backdrop,
	openTitle,
	poster,
	titles,
	useRemoteKeys,
	useToast,
} from "./kit"

export const VARIANTS_SURF: Record<string, string> = {
	a: "Broadcast + quick view",
	b: "Multi-view wall",
	c: "Zap three, pick one",
}

const SERVICES = ["Netflix", "Amazon Prime Video", "Disney Plus", "HBO Max", "Hulu"]

function useLineup() {
	return useMemo(() => {
		const on = titles.filter((t) => t.service && SERVICES.includes(t.service))
		// Best scores first; production would use the member's own services and taste.
		return on.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 32)
	}, [])
}

export function PageSurf({ variant }: { variant: string }) {
	if (variant === "b") return <Wall />
	if (variant === "c") return <ZapPick />
	return <BroadcastSurf />
}

function BelowSurf({ extra }: { extra?: ReactNode }) {
	return (
		<Below
			heading="Channel surfing"
			text={
				<>
					Flip through good titles on your services. <span className="text-gray-500">Hidden page: it opens from the remote icon in the footer.</span>
				</>
			}
		>
			{extra}
		</Below>
	)
}

// a. Full-screen broadcast with the info bar. OK opens a quick view on the TV; OK again opens the title.
function BroadcastSurf() {
	const list = useLineup()
	const [at, setAt] = useState(0)
	const [flips, setFlips] = useState(0)
	const [info, setInfo] = useState(false)
	const [msg, toast] = useToast()
	const t = list[at]
	const press = (k: Key) => {
		if (k === "up" || k === "down") {
			setAt((i) => (i + (k === "up" ? 1 : -1) + list.length) % list.length)
			setFlips((f) => f + 1)
			setInfo(false)
		}
		if (k === "ok") info ? openTitle(t) : setInfo(true)
		if (k === "power") toast("Power: leaves the page")
	}
	useRemoteKeys(press)
	return (
		<Scene
			msg={msg}
			screen={
				<>
					<Broadcast title={t} />
					{info ? (
						<div className="egg-fade-in absolute inset-y-0 right-0 flex w-[46%] flex-col justify-center bg-black/80 p-[3cqw]">
							<div className="flex items-center gap-[1.5cqw]">
								<Ring t={t} size="7cqw" />
								<div className="text-[3.6cqw] font-bold leading-tight">{t.title}</div>
							</div>
							<div className="mt-[1.5cqh] text-[2cqw] italic text-white/75">{t.tagline}</div>
							<div className="mt-[1.5cqh] flex flex-wrap gap-[0.8cqw]">
								{t.feels.map((f) => (
									<span key={f} className="rounded-full bg-white/10 px-[1.2cqw] py-[0.5cqh] text-[1.7cqw]">
										{f}
									</span>
								))}
							</div>
							<div className="mt-[2cqh] text-[1.9cqw] text-white/60">
								{[t.year, t.runtime ? `${t.runtime} min` : null, t.service].filter(Boolean).join(" · ")}
							</div>
							<div className="mt-[2.5cqh] text-[1.9cqw] font-semibold text-amber-300">OK opens the title page · CH keeps surfing</div>
						</div>
					) : (
						<InfoBar t={t} hint="OK for more" />
					)}
					{flips > 0 && <StaticFlash n={flips} />}
					<ChannelNumber n={at + 1} label={t.service ?? undefined} />
				</>
			}
			remote={<MiniRemote press={press} />}
			below={<BelowSurf />}
		/>
	)
}

function StaticFlash({ n }: { n: number }) {
	return (
		<div key={n} className="egg-flash pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,#888_0_2px,#222_2px_4px)] opacity-60" />
	)
}

// b. A multi-view wall of nine channels; CH moves the frame, OK puts that channel full screen, OK again opens it.
function Wall() {
	const list = useLineup()
	const [page, setPage] = useState(0)
	const [at, setAt] = useState(0)
	const [full, setFull] = useState(false)
	const [msg, toast] = useToast()
	const nine = list.slice(page * 9, page * 9 + 9)
	const press = (k: Key) => {
		if (k === "up" || k === "down") {
			setFull(false)
			const n = at + (k === "up" ? 1 : -1)
			if (n >= nine.length) {
				setPage((p) => (p + 1) % Math.ceil(list.length / 9))
				setAt(0)
			} else if (n < 0) {
				setPage((p) => (p - 1 + Math.ceil(list.length / 9)) % Math.ceil(list.length / 9))
				setAt(8)
			} else setAt(n)
		}
		if (k === "ok") full ? openTitle(nine[at]) : setFull(true)
		if (k === "power") (full ? setFull(false) : toast("Power: leaves the page"))
	}
	useRemoteKeys(press)
	const t = nine[Math.min(at, nine.length - 1)]
	return (
		<Scene
			msg={msg}
			screen={
				full ? (
					<>
						<Broadcast title={t} />
						<InfoBar t={t} hint="OK opens · Power back to wall" />
					</>
				) : (
					<div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-[0.4cqw] bg-black p-[0.4cqw]">
						{nine.map((x, i) => (
							<div key={x.id} className={`relative overflow-hidden ${i === at ? "z-10 ring-[0.5cqw] ring-amber-400" : "opacity-75"}`}>
								<img src={backdrop(x, "w300")} alt="" className="absolute inset-0 h-full w-full object-cover" />
								<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-[0.8cqw] pb-[0.5cqh] pt-[2cqh]">
									<div className="truncate text-[1.7cqw] font-semibold">{x.title}</div>
								</div>
								<div className="absolute left-[0.6cqw] top-[0.6cqh] font-mono text-[1.4cqw] text-lime-300">{page * 9 + i + 1}</div>
							</div>
						))}
					</div>
				)
			}
			remote={<MiniRemote press={press} note="CH moves · OK zooms" />}
			below={<BelowSurf />}
		/>
	)
}

// c. Zap through channels and keep up to three with OK; then the TV plays the final three side by side and OK
// picks tonight's title.
function ZapPick() {
	const list = useLineup()
	const [at, setAt] = useState(0)
	const [flips, setFlips] = useState(0)
	const [kept, setKept] = useState<Title[]>([])
	const [final, setFinal] = useState(0)
	const [msg, toast] = useToast()
	const showdown = kept.length === 3
	const t = list[at]
	const press = (k: Key) => {
		if (showdown) {
			if (k === "up") setFinal((i) => (i + 1) % 3)
			if (k === "down") setFinal((i) => (i + 2) % 3)
			if (k === "ok") openTitle(kept[final])
			if (k === "power") setKept([])
			return
		}
		if (k === "up" || k === "down") {
			setAt((i) => (i + (k === "up" ? 1 : -1) + list.length) % list.length)
			setFlips((f) => f + 1)
		}
		if (k === "ok") {
			if (kept.includes(t)) return toast("Already kept")
			setKept((ks) => [...ks, t])
			toast(kept.length === 2 ? "Three kept: pick one" : `Kept ${kept.length + 1} of 3`)
			setAt((i) => (i + 1) % list.length)
			setFlips((f) => f + 1)
		}
		if (k === "power") toast("Power: leaves the page")
	}
	useRemoteKeys(press)
	return (
		<Scene
			msg={msg}
			screen={
				showdown ? (
					<div className="absolute inset-0 flex flex-col bg-[#0b0d12] p-[2.5cqw]">
						<div className="text-center text-[3cqw] font-bold">Tonight's pick</div>
						<div className="mt-[2cqh] flex flex-1 items-center justify-center gap-[2cqw]">
							{kept.map((x, i) => (
								<div key={x.id} className={`flex w-[26%] flex-col items-center transition-transform duration-200 ${i === final ? "scale-110" : "scale-95 opacity-50"}`}>
									<img src={poster(x)} alt="" className={`w-full rounded-[0.8cqw] ${i === final ? "ring-[0.5cqw] ring-amber-400" : ""}`} />
									<div className="mt-[1cqh] w-full truncate text-center text-[1.9cqw] font-semibold">{x.title}</div>
								</div>
							))}
						</div>
						<div className="text-center text-[1.8cqw] text-white/60">CH to choose · OK to watch · Power to start over</div>
					</div>
				) : (
					<>
						<Broadcast title={t} />
						<InfoBar t={t} hint={kept.includes(t) ? "Kept" : "OK to keep"} />
						{flips > 0 && <StaticFlash n={flips} />}
						<ChannelNumber n={at + 1} label={t.service ?? undefined} />
						<div className="absolute left-[3cqw] top-[3cqh] flex gap-[0.8cqw]">
							{[0, 1, 2].map((i) => (
								<div key={i} className="h-[11cqh] w-[7.3cqh] overflow-hidden rounded-[0.5cqw] bg-white/10 ring-1 ring-white/30">
									{kept[i] && <img src={poster(kept[i], "w154")} alt="" className="egg-fade-in h-full w-full object-cover" />}
								</div>
							))}
						</div>
					</>
				)
			}
			remote={<MiniRemote press={press} okLabel={showdown ? "Watch" : "Keep"} pulse={showdown ? "ok" : undefined} />}
			below={<BelowSurf />}
		/>
	)
}
