// PROTOTYPE - throwaway. Change one thing (existing components): one title in the middle and four ways to change just
// one thing about it: another decade with the same feel, the same director, the other format, or one side of its mood
// ("Darker, same core"). The four are picked to be as different from each other as they can be.
import { useEffect, useRef, useState } from "react"
import { MatchText } from "~/ui/prototype-rec-taste/kit"
import { Empty, PathStrip, PeekDock, Poster, Top } from "../kit3"
import { type Ex3, useWalk } from "../useExplorer3"
import type { Opt, Turn, W } from "../wire"

export default function Lens({ ex }: { ex: Ex3 }) {
	const walk = useWalk()
	const [turn, setTurn] = useState<Turn | null>(null)
	const [busy, setBusy] = useState(true)
	const [peek, setPeek] = useState<{ it: W; opt?: Opt } | null>(null)
	const here = useRef<W | null>(null)
	const n = useRef(0)

	const load = async (at: W | null) => {
		setBusy(true)
		setPeek(null)
		try {
			const t = await ex.api<Turn>("turn", {
				mode: "lens",
				at: at?.k ?? "",
				...walk.params(),
			})
			if (!at && t.here) {
				walk.show([t.here])
				walk.step(t.here, "")
			}
			here.current = t.here
			walk.show(t.options.flatMap((o) => o.items))
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

	const take = (o: Opt) => {
		window.scrollTo({ top: 0, behavior: "smooth" })
		walk.step(o.items[0], o.label)
		void load(o.items[0])
	}
	const backTo = (k: number) => {
		const s = walk.pathRef.current[k]
		if (!s || k === walk.pathRef.current.length - 1) return
		walk.backTo(k)
		void load(s.w)
	}

	const options = (turn?.options ?? []).filter((o) => ex.pass(o.items[0]))
	const h = turn?.here ?? null
	const card = (o: Opt, j: number) => (
		<OptionCard
			key={o.id}
			o={o}
			j={j}
			onTake={() => take(o)}
			onPeek={() => setPeek({ it: o.items[0], opt: o })}
		/>
	)
	return (
		<div className="rx3-page rx3-atlas rx3-pb text-white">
			<div className="mx-auto max-w-6xl px-4 pt-5 md:px-8 md:pt-8">
				<Top
					ex={ex}
					title="Change one thing"
					sub="Keep what works about this title and change one thing: its decade, its director, its format, or one side of its mood."
				/>
				<PathStrip path={walk.path} onPick={backTo} start={null} className="mt-4 w-fit" />
				{!h || !options.length ? (
					<Empty ex={ex} busy={busy} />
				) : (
					<div
						key={n.current}
						className={`mt-6 grid items-center gap-4 md:grid-cols-[1fr_minmax(0,17rem)_1fr] md:gap-6 ${busy ? "opacity-50" : ""}`}
					>
						<div className="order-2 grid gap-3 md:order-1">
							{options.slice(0, 2).map(card)}
						</div>
						<div className="rx3-in order-1 flex items-center gap-4 md:order-2 md:flex-col md:text-center">
							<Poster
								it={h}
								size="w-28 md:mx-auto md:w-52"
								src="w500"
								eager
								onPeek={(it) => setPeek({ it })}
								className="ring-2 ring-amber-400"
							/>
							<div className="min-w-0">
								<h2 className="text-xl font-bold leading-tight md:text-2xl">{h.t}</h2>
								<p className="mt-1 text-xs text-stone-400">
									{h.yr} {h.k.startsWith("show") ? "series" : "film"}
									{h.g.length ? `, ${h.g.join(", ").toLowerCase()}` : ""}
								</p>
								<MatchText match={h.m} className="text-sm" />
								<p className="mt-1 text-xs text-stone-300">{turn?.hereLine}</p>
							</div>
						</div>
						<div className="order-3 grid gap-3">
							{options.slice(2).map((o, j) => card(o, j + 2))}
						</div>
					</div>
				)}
			</div>
			<PeekDock
				ex={ex}
				it={peek?.it ?? null}
				onClose={() => setPeek(null)}
				go={
					peek?.opt
						? { label: peek.opt.label, onGo: () => take(peek.opt as Opt) }
						: undefined
				}
			/>
		</div>
	)
}

function OptionCard({
	o,
	j,
	onTake,
	onPeek,
}: { o: Opt; j: number; onTake: () => void; onPeek: () => void }) {
	const it = o.items[0]
	return (
		<article
			className={`rx3-in rx3-in-${j + 2} flex items-start gap-3 rounded-xl border border-white/10 bg-black/40 p-3`}
		>
			<Poster it={it} size="w-20 md:w-24" src="w185" onPeek={onPeek} />
			<div className="min-w-0 flex-1">
				<button type="button" onClick={onTake} className="group text-left">
					<h3 className="text-base font-bold leading-tight text-amber-300 group-hover:text-amber-200 md:text-lg">
						{o.label}
					</h3>
				</button>
				<p className="mt-1 truncate text-sm font-semibold text-stone-100">{it.t}</p>
				<p className="text-xs">
					<MatchText match={it.m} />
					<span className="ml-2 text-stone-400">{it.yr || ""}</span>
				</p>
				<p className="mt-1 line-clamp-3 text-xs text-stone-300">{o.line}</p>
				<button
					type="button"
					onClick={onTake}
					className="mt-2 text-xs font-bold text-amber-200 underline-offset-2 hover:underline"
				>
					Go this way
				</button>
			</div>
		</article>
	)
}
