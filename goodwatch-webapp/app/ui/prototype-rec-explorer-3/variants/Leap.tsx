// PROTOTYPE - throwaway. One bold leap (bolder): each turn makes one big jump from where you stand to something far
// away in the title analysis that still fits your taste, says what it keeps and what it changes, and shows the one
// title that bridges the two. Three titles on screen: where you are, the bridge, the leap.
import { ArrowPathIcon, ArrowRightIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { Caption, Empty, PathStrip, PeekDock, Poster, TMDB, Top } from "../kit3"
import { type Ex3, useWalk } from "../useExplorer3"
import type { Turn, W } from "../wire"

export default function Leap({ ex }: { ex: Ex3 }) {
	const walk = useWalk()
	const [turn, setTurn] = useState<Turn | null>(null)
	const [busy, setBusy] = useState(true)
	const [peek, setPeek] = useState<W | null>(null)
	const here = useRef<W | null>(null)
	const n = useRef(0)

	const load = async (at: W | null) => {
		setBusy(true)
		setPeek(null)
		try {
			const t = await ex.api<Turn>("turn", {
				mode: "leap",
				at: at?.k ?? "",
				...walk.params(),
			})
			if (!at && t.here) {
				walk.show([t.here])
				walk.step(t.here, "")
			}
			here.current = t.here
			walk.show([...(t.bridge ? [t.bridge] : []), ...t.options.flatMap((o) => o.items)])
			walk.offered(
				t.options.map((o) => o.items[0]),
				t.spread,
			)
			n.current++
			setTurn(t)
		} finally {
			setBusy(false)
		}
	}
	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		void load(null)
	}, [])
	const filters = useRef(ex.filterKey)
	useEffect(() => {
		if (filters.current === ex.filterKey) return
		filters.current = ex.filterKey
		void load(here.current)
	}, [ex.filterKey])

	const go = (w: W, label: string) => {
		walk.step(w, label)
		window.scrollTo({ top: 0, behavior: "smooth" })
		void load(w)
	}
	const backTo = (k: number) => {
		const s = walk.pathRef.current[k]
		if (!s || k === walk.pathRef.current.length - 1) return
		walk.backTo(k)
		void load(s.w)
	}

	const o = turn?.options[0]
	const target = o && ex.pass(o.items[0]) ? o.items[0] : null
	const bridge = turn?.bridge && ex.pass(turn.bridge) ? turn.bridge : null
	const h = turn?.here ?? null
	return (
		<div className="rx3-page rx3-pb bg-stone-950 text-white">
			{target?.b && (
				<img
					key={target.k}
					src={`${TMDB}/w1280${target.b}`}
					alt=""
					className="rx3-in pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
				/>
			)}
			<div className="rx3-veil-x pointer-events-none absolute inset-0" />
			<div className="rx3-veil pointer-events-none absolute inset-x-0 bottom-0 h-1/3" />
			<div className="relative mx-auto max-w-7xl px-4 pt-5 md:px-8 md:pt-8">
				<Top
					ex={ex}
					bold
					title="One bold leap"
					sub="One big jump per turn, somewhere far from here that still fits your taste, and the title that connects the two."
				/>
				<PathStrip path={walk.path} onPick={backTo} start={null} className="mt-4 w-fit" />
				{!h || !o || !target ? (
					<Empty ex={ex} busy={busy} />
				) : (
					<div
						key={n.current}
						className={`mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-10 ${busy ? "opacity-50" : ""}`}
					>
						<div className="min-w-0">
							<h2 className="rx3-in rx2-display text-5xl font-black leading-none text-amber-300 md:text-7xl">
								{o.label}
							</h2>
							<p className="rx3-in rx3-in-2 mt-3 max-w-xl text-base text-stone-200 md:text-lg">
								{o.line}
							</p>
							<ol className="rx3-in rx3-in-3 mt-6 flex max-w-xl items-stretch gap-2 text-xs md:gap-3">
								<Hop it={h} note="From here" onPeek={setPeek} />
								{bridge && (
									<Hop it={bridge} note={turn?.bridgeLine ?? ""} onPeek={setPeek} wide />
								)}
								<Hop it={target} note="The leap" onPeek={setPeek} gold className="md:hidden" />
							</ol>
							<div className="rx3-in rx3-in-4 mt-6 flex flex-wrap gap-2">
								<button
									type="button"
									disabled={busy}
									onClick={() => go(target, o.label)}
									className="flex h-12 items-center gap-2 rounded-full bg-amber-400 px-5 text-base font-bold text-black hover:bg-amber-300 disabled:opacity-50"
								>
									Leap to {target.t.length > 28 ? "it" : target.t}
									<ArrowRightIcon className="h-5 w-5" />
								</button>
								<button
									type="button"
									disabled={busy}
									onClick={() => h && void load(h)}
									className="flex h-12 items-center gap-2 rounded-full border-2 border-white/25 px-4 text-sm font-semibold text-stone-100 hover:border-white/50 disabled:opacity-50"
								>
									<ArrowPathIcon className="h-4 w-4" />
									Leap somewhere else
								</button>
								{bridge && (
									<button
										type="button"
										disabled={busy}
										onClick={() => go(bridge, "halfway")}
										className="h-12 rounded-full px-4 text-sm font-semibold text-stone-300 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
									>
										Stop at the bridge
									</button>
								)}
							</div>
						</div>
						<div className="rx3-in rx3-in-2 hidden md:block">
							<Poster it={target} size="w-full" src="w500" eager onPeek={setPeek} className="shadow-2xl" />
							<Caption it={target} className="mt-2" />
						</div>
					</div>
				)}
			</div>
			<PeekDock ex={ex} it={peek} onClose={() => setPeek(null)} />
		</div>
	)
}

function Hop({
	it,
	note,
	onPeek,
	gold = false,
	wide = false,
	className = "",
}: {
	it: W
	note: string
	onPeek: (w: W) => void
	gold?: boolean
	wide?: boolean
	className?: string
}) {
	return (
		<li className={`flex min-w-0 flex-col gap-1.5 ${wide ? "flex-[1.6]" : "flex-1"} ${className}`}>
			<Poster
				it={it}
				onPeek={onPeek}
				size={gold ? "w-20 md:w-24" : "w-16 md:w-20"}
				src="w185"
				className={gold ? "ring-2 ring-amber-400" : ""}
			/>
			<p className="truncate font-semibold text-stone-100">{it.t}</p>
			<p className={`line-clamp-3 ${gold ? "text-amber-200" : "text-stone-400"}`}>{note}</p>
		</li>
	)
}
