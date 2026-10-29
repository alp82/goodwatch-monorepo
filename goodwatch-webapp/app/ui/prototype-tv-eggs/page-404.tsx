// PROTOTYPE - throwaway. 1. "Channel 404": the address names no page; the TV shows no signal and CH+ tunes to
// guesses from the broken address, then to popular titles. `?path=` sets the broken address to try.
import { useMemo, useState } from "react"
import {
	Below,
	Broadcast,
	ChannelNumber,
	HomeLink,
	InfoBar,
	type Key,
	MiniRemote,
	Ring,
	SECONDARY,
	Scene,
	Static,
	type Title,
	backdrop,
	titleHref,
	openTitle,
	titles,
	useRemoteKeys,
	useToast,
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

export function guessesFor(path: string): Title[] {
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

function useChannels(path: string) {
	const guesses = useMemo(() => guessesFor(path), [path])
	const rest = titles.filter((t) => !guesses.includes(t)).slice(0, 12)
	return { guesses, list: [...guesses, ...rest] }
}

const VARIANT_404 = {
	a: "No signal, CH+ tunes",
	b: "Program guide",
	c: "Test card + search",
} as const
export const VARIANTS_404: Record<string, string> = VARIANT_404

export function Page404({ variant, path }: { variant: string; path: string }) {
	if (variant === "b") return <Guide path={path} />
	if (variant === "c") return <TestCard path={path} />
	return <NoSignal path={path} />
}

function BelowPlain({ path, guesses }: { path: string; guesses: Title[] }) {
	return (
		<Below
			kicker="404"
			heading="Nothing on this channel"
			text={
				<>
					<code className="rounded bg-white/5 px-1.5 py-0.5 text-sm text-gray-300">{path}</code> doesn't lead anywhere.
					{guesses.length > 0 && (
						<>
							{" "}
							Did you mean{" "}
							{guesses.map((g, i) => (
								<span key={g.id}>
									{i > 0 && (i === guesses.length - 1 ? " or " : ", ")}
									<a href={titleHref(g)} target="_blank" rel="noreferrer" className="font-semibold text-amber-300 hover:underline">
										{g.title}
									</a>
								</span>
							))}
							?
						</>
					)}
				</>
			}
		>
			<HomeLink />
			<a href="/discover" className={SECONDARY}>
				Discover
			</a>
		</Below>
	)
}

// a. No signal: static and "CH 404". CH+ / CH- flip channels (static flash between), OK opens the title.
function NoSignal({ path }: { path: string }) {
	const { guesses, list } = useChannels(path)
	const [msg, toast] = useToast()
	const [at, setAt] = useState(-1) // -1 is channel 404 itself
	const [flips, setFlips] = useState(0)
	const press = (k: Key) => {
		if (k === "up" || k === "down") {
			setAt((i) => {
				const n = i + (k === "up" ? 1 : -1)
				return n < -1 ? list.length - 1 : n >= list.length ? -1 : n
			})
			setFlips((f) => f + 1)
		}
		if (k === "ok" && at >= 0) openTitle(list[at])
		if (k === "power") toast("Power: back to the start page")
	}
	useRemoteKeys(press)
	const t = at >= 0 ? list[at] : null
	const isGuess = t != null && guesses.includes(t)
	return (
		<Scene
			msg={msg}
			screen={
				<>
					{t ? (
						<>
							<Broadcast title={t} />
							<InfoBar t={t} hint="OK to open" />
						</>
					) : (
						<>
							<Static opacity={0.55} />
							<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-center">
								<div className="rounded-[1cqw] bg-black/70 px-[3cqw] py-[2.5cqh]">
									<div className="text-[5.5cqw] font-bold leading-none">No signal</div>
									<div className="mt-[1.6cqh] text-[2.2cqw] text-white/75">
										{guesses.length ? (
											<>
												Press <b className="text-white">CH+</b> to tune to {guesses.length === 1 ? "a likely match" : `${guesses.length} likely matches`}
											</>
										) : (
											<>
												Press <b className="text-white">CH+</b> to find something on
											</>
										)}
									</div>
								</div>
							</div>
						</>
					)}
					{flips > 0 && <Static flash={flips} opacity={0.9} />}
					<ChannelNumber n={t ? 405 + at : 404} label={t ? (isGuess ? "Did you mean" : "Popular now") : "No signal"} />
				</>
			}
			remote={<MiniRemote press={press} pulse={at === -1 ? "up" : undefined} okLabel="OK" note="Power takes you home" />}
			below={<BelowPlain path={path} guesses={guesses} />}
		/>
	)
}

// b. Program guide: the TV shows a guide; a preview of the chosen row on top. CH moves the row, OK opens.
function Guide({ path }: { path: string }) {
	const { guesses, list } = useChannels(path)
	const [msg, toast] = useToast()
	const rows = list.slice(0, 9)
	const [at, setAt] = useState(0)
	const press = (k: Key) => {
		if (k === "up") setAt((i) => (i + 1) % rows.length)
		if (k === "down") setAt((i) => (i - 1 + rows.length) % rows.length)
		if (k === "ok") openTitle(rows[at])
		if (k === "power") toast("Power: back to the start page")
	}
	useRemoteKeys(press)
	const t = rows[at]
	const first = Math.max(0, Math.min(at - 2, rows.length - 5))
	return (
		<Scene
			msg={msg}
			screen={
				<div className="absolute inset-0 flex flex-col bg-[#0b1020]">
					<div className="relative h-[44%] shrink-0 overflow-hidden">
						<img key={t.id} src={backdrop(t, "w780")} alt="" className="egg-fade-in absolute inset-0 h-full w-full object-cover" />
						<div className="absolute inset-0 bg-gradient-to-r from-[#0b1020] via-[#0b1020]/70 to-transparent" />
						<div className="absolute left-[3cqw] top-[3cqh] max-w-[55%]">
							<div className="text-[1.7cqw] font-semibold uppercase tracking-[0.14em] text-amber-300">
								{guesses.includes(t) ? "Did you mean" : "On now"}
							</div>
							<div className="mt-[0.6cqh] text-[3.8cqw] font-bold leading-tight">{t.title}</div>
							<div className="mt-[0.6cqh] line-clamp-2 text-[1.8cqw] text-white/70">{t.tagline || `${t.year}`}</div>
						</div>
						<div className="absolute right-[3cqw] top-[3cqh] font-mono text-[2.2cqw] text-white/70">Guide</div>
					</div>
					<div className="relative flex-1 overflow-hidden px-[2cqw] pt-[1.5cqh]">
						<div className="flex items-center gap-[1.5cqw] rounded-[0.6cqw] px-[1.2cqw] py-[1cqh] text-white/35">
							<span className="w-[7cqw] font-mono text-[2cqw]">404</span>
							<span className="text-[2.2cqw] italic">{path} · nothing scheduled</span>
						</div>
						{rows.slice(first, first + 5).map((r) => {
							const i = rows.indexOf(r)
							return (
								<div
									key={r.id}
									className={`flex items-center gap-[1.5cqw] rounded-[0.6cqw] px-[1.2cqw] py-[1cqh] ${i === at ? "bg-amber-400 text-black" : "text-white/85"}`}
								>
									<span className="w-[7cqw] font-mono text-[2cqw]">{405 + i}</span>
									<span className="min-w-0 flex-1 truncate text-[2.3cqw] font-semibold">{r.title}</span>
									<span className="text-[1.8cqw] opacity-70">{guesses.includes(r) ? "match" : r.year}</span>
									<Ring t={r} size="3.6cqw" />
								</div>
							)
						})}
					</div>
				</div>
			}
			remote={<MiniRemote press={press} note="CH moves · OK watches" />}
			below={<BelowPlain path={path} guesses={guesses} />}
		/>
	)
}

// c. Test card with a search field on screen: type a title, CH flips the results, OK opens.
function TestCard({ path }: { path: string }) {
	const { guesses } = useChannels(path)
	const [msg, toast] = useToast()
	const [q, setQ] = useState("")
	const results = useMemo(() => {
		if (!q.trim()) return guesses.length ? guesses : titles.slice(0, 3)
		const n = norm(q)
		return titles.filter((t) => norm(t.title).includes(n)).slice(0, 4)
	}, [q, guesses])
	const [at, setAt] = useState(0)
	const sel = results[Math.min(at, results.length - 1)]
	const press = (k: Key) => {
		if (k === "up") setAt((i) => (i + 1) % Math.max(1, results.length))
		if (k === "down") setAt((i) => (i - 1 + results.length) % Math.max(1, results.length))
		if (k === "ok" && sel) openTitle(sel)
		if (k === "power") toast("Power: back to the start page")
	}
	useRemoteKeys(press)
	const BARS = ["#e5e7eb", "#fbbf24", "#2dd4bf", "#4ade80", "#e879f9", "#f87171", "#60a5fa"]
	return (
		<Scene
			msg={msg}
			screen={
				<div className="absolute inset-0 flex flex-col">
					<div className="flex h-[58%]">
						{BARS.map((c) => (
							<div key={c} className="flex-1" style={{ background: c }} />
						))}
					</div>
					<div className="flex h-[8%]">
						{BARS.slice().reverse().map((c, i) => (
							<div key={c} className="flex-1" style={{ background: i % 2 ? "#111" : c, opacity: 0.85 }} />
						))}
					</div>
					<div className="flex flex-1 items-center gap-[2cqw] bg-[#111] px-[3cqw]">
						<div className="font-mono text-[4cqw] font-bold text-white">404</div>
						<label className="flex flex-1 items-center gap-[1cqw] rounded-[1cqw] bg-white/10 px-[1.5cqw] py-[1cqh]">
							<span className="text-[1.8cqw] text-white/60">Try another channel:</span>
							<input
								value={q}
								onChange={(e) => {
									setQ(e.target.value)
									setAt(0)
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && sel) openTitle(sel)
								}}
								placeholder="type a title"
								className="min-w-0 flex-1 bg-transparent text-[2.2cqw] text-white outline-none placeholder:text-white/40"
							/>
						</label>
					</div>
					<div className="absolute left-1/2 top-[29%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[1.2cqw] bg-black/85 p-[1.4cqw] shadow-2xl">
						<div className="mb-[0.8cqh] flex items-center justify-between text-[1.6cqw] uppercase tracking-[0.12em] text-white/50">
							<span>{q ? "Found" : guesses.length ? "Did you mean" : "Try"}</span>
							<span>CH ±</span>
						</div>
						{results.length === 0 && <div className="py-[1cqh] text-[2cqw] text-white/60">No channel by that name</div>}
						{results.map((r) => (
							<div key={r.id} className={`flex items-center gap-[1cqw] rounded-[0.6cqw] px-[0.8cqw] py-[0.6cqh] ${r === sel ? "bg-white/15" : ""}`}>
								<img src={backdrop(r, "w300")} alt="" className="h-[5cqh] w-[9cqh] rounded-[0.4cqw] object-cover" />
								<span className="min-w-0 flex-1 truncate text-[2cqw] font-semibold">{r.title}</span>
								<Ring t={r} size="3.2cqw" />
							</div>
						))}
					</div>
				</div>
			}
			remote={<MiniRemote press={press} note="Type on the TV · CH picks · OK opens" />}
			below={<BelowPlain path={path} guesses={guesses} />}
		/>
	)
}
