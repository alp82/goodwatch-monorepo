// PROTOTYPE - throwaway. 1. "Channel 404" (round 2: variant a picked). The address names no page; the TV shows no
// signal and CH+ tunes to guesses from the broken address, then to popular titles. The Netflix and Prime Video
// keys keep the channels to that service. `?path=` sets the broken address to try.
import { useMemo, useState } from "react"
import {
	BigRemote,
	Broadcast,
	ChannelNumber,
	InfoBar,
	type Key,
	Scene,
	type ServiceKey,
	Static,
	type Title,
	openTitle,
	serviceCatalogName,
	serviceName,
	titles,
	useRemoteKeys,
	useToast,
	useTvPower,
} from "./kit"

// Guesses: trigram likeness between the address's words and each title.
const norm = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
const grams = (s: string) => {
	const p = `  ${s} `
	const out = new Set<string>()
	for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3))
	return out
}
const likeness = (a: string, b: string) => {
	const A = grams(a)
	const B = grams(b)
	let n = 0
	for (const g of A) if (B.has(g)) n++
	return n / Math.max(1, Math.min(A.size, B.size) + Math.abs(A.size - B.size) * 0.3)
}

function guessesFor(path: string): Title[] {
	const words = norm(
		path
			.split("/")
			.filter((p) => !["movie", "movies", "show", "shows", "tv", "tv-shows", "title"].includes(p))
			.join(" ")
			.replace(/\b(19|20)\d\d\b/g, " ")
			.replace(/\b\d+\b/g, " "),
	)
	if (!words) return []
	return titles
		.map((t) => ({ t, s: likeness(words, norm(t.title)) }))
		.filter((x) => x.s > 0.28)
		.sort((a, b) => b.s - a.s)
		.slice(0, 3)
		.map((x) => x.t)
}

export function Page404({ path }: { path: string }) {
	const guesses = useMemo(() => guessesFor(path), [path])
	const [service, setService] = useState<ServiceKey | null>(null)
	const list = useMemo(() => {
		if (service) {
			const name = serviceCatalogName(service)
			const on = titles.filter((t) => t.service === name)
			return [...guesses.filter((g) => on.includes(g)), ...on.filter((t) => !guesses.includes(t))]
		}
		return [...guesses, ...titles.filter((t) => !guesses.includes(t)).slice(0, 12)]
	}, [guesses, service])
	const [at, setAt] = useState(-1) // -1 is channel 404 itself
	const [flips, setFlips] = useState(0)
	const [msg, toast] = useToast()
	const tv = useTvPower()
	const press = (k: Key) => {
		if (k === "power") return tv.toggle()
		if (!tv.on) return
		if (k === "up" || k === "down") {
			setAt((i) => {
				const n = i + (k === "up" ? 1 : -1)
				return n < -1 ? list.length - 1 : n >= list.length ? -1 : n
			})
			setFlips((f) => f + 1)
		}
		if (k === "ok") at >= 0 ? openTitle(list[at]) : toast("Press CH+ to tune in")
	}
	const pickService = (k: ServiceKey) => {
		if (!tv.on) return
		setService((s) => (s === k ? null : k))
		setAt(0)
		setFlips((f) => f + 1)
	}
	useRemoteKeys(press)
	const t = at >= 0 ? list[at] : null
	const label = t ? (service ? serviceName(service) : guesses.includes(t) ? "Did you mean" : "Popular now") : "No signal"
	return (
		<Scene
			heading="Page not found"
			msg={msg}
			power={tv.power}
			screen={
				<>
					{t ? (
						<>
							<Broadcast title={t} />
							<InfoBar t={t} hint="OK to open" />
						</>
					) : (
						<>
							<Static calm opacity={0.5} />
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="max-w-[80%] rounded-[1.2cqw] bg-black/80 px-[4cqw] py-[3cqh] text-center">
									<div className="font-mono text-[2cqw] uppercase tracking-[0.2em] text-white/50">Error 404</div>
									<div className="mt-[1cqh] text-[6cqw] font-bold leading-none">No signal</div>
									<div className="mt-[1.6cqh] text-[2.1cqw] text-white/70">
										<span className="font-mono text-white/90">{path}</span> doesn't lead anywhere.
									</div>
									<div className="mt-[2.4cqh] flex flex-wrap items-center justify-center gap-x-[2.4cqw] gap-y-[1cqh] text-[2cqw] text-white/75">
										<span>
											<b className="text-white">CH+</b>{" "}
											{guesses.length ? (guesses.length === 1 ? "a likely match" : `${guesses.length} likely matches`) : "something good"}
										</span>
										<span>
											<b className="text-white">Netflix / Prime</b> only that service
										</span>
									</div>
								</div>
							</div>
						</>
					)}
					{flips > 0 && <Static flash={flips} opacity={0.75} />}
					<ChannelNumber n={t ? 405 + at : 404} label={label} />
				</>
			}
			remote={<BigRemote press={press} off={!tv.on} pulse={at === -1 ? "up" : undefined} services openService={service} onService={pickService} />}
		/>
	)
}
