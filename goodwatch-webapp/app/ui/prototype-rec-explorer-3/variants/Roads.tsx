// PROTOTYPE - throwaway. Three roads (bolder): from where you stand, three next steps that go somewhere very different
// from each other. Each road is four titles with one sentence on what it changes ("More grotesque and scarier,
// keeps bleak endings"). Take a road and its lead becomes where you stand; nothing you've seen comes back.
import { useEffect, useRef, useState } from "react"
import {
	Caption,
	Empty,
	PathStrip,
	PeekDock,
	Poster,
	TMDB,
	Top,
} from "../kit3"
import { type Ex3, useWalk } from "../useExplorer3"
import type { Opt, Turn, W } from "../wire"

export default function Roads({ ex }: { ex: Ex3 }) {
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
				mode: "roads",
				at: at?.k ?? "",
				...walk.params(),
			})
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

	const take = (o: Opt, w: W) => {
		here.current = w
		walk.step(w, o.label)
		window.scrollTo({ top: 0, behavior: "smooth" })
		void load(w)
	}
	const backTo = (k: number) => {
		const s = walk.pathRef.current[k]
		if (!s || k === walk.pathRef.current.length - 1) return
		walk.backTo(k)
		here.current = s.w
		void load(s.w)
	}

	const options = (turn?.options ?? [])
		.map((o) => ({ ...o, items: o.items.filter(ex.pass) }))
		.filter((o) => o.items.length)
	const h = here.current
	return (
		<div className="rx3-page rx3-atlas rx3-pb text-white">
			{h?.b && (
				<img
					src={`${TMDB}/w1280${h.b}`}
					alt=""
					className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] w-full object-cover opacity-25"
				/>
			)}
			<div className="rx3-veil pointer-events-none absolute inset-x-0 top-0 h-[28rem]" />
			<div className="relative mx-auto max-w-7xl px-4 pt-5 md:px-8 md:pt-8">
				<Top
					ex={ex}
					bold
					title="Three roads"
					sub="Three next steps that go somewhere different from each other. Take one; nothing you've passed comes back."
				/>
				<div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
					{h ? (
						<div className="flex min-w-0 items-center gap-3">
							<Poster it={h} size="w-14" src="w154" onPeek={(it) => setPeek({ it })} />
							<div className="min-w-0">
								<p className="text-xs text-stone-400">You're at</p>
								<p className="truncate rx2-display text-2xl font-bold leading-tight text-stone-100">
									{h.t}
								</p>
							</div>
						</div>
					) : (
						<p className="text-sm text-stone-300">
							<span className="rx2-display mr-2 text-2xl font-bold text-stone-100">
								Your taste
							</span>
							{turn?.hereLine ? "Every road starts from what you rated." : ""}
						</p>
					)}
					<PathStrip
						path={walk.path}
						onPick={backTo}
						className="md:ml-auto"
					/>
				</div>

				{!options.length ? (
					<Empty ex={ex} busy={busy} />
				) : (
					<div
						key={n.current}
						className={`mt-6 grid gap-8 md:grid-cols-3 md:gap-6 ${busy ? "opacity-50" : ""}`}
					>
						{options.map((o, j) => (
							<Road
								key={o.id}
								o={o}
								j={j}
								onPeek={(it) => setPeek({ it, opt: o })}
								onTake={() => take(o, o.items[0])}
							/>
						))}
					</div>
				)}
			</div>
			<PeekDock
				ex={ex}
				it={peek?.it ?? null}
				onClose={() => setPeek(null)}
				go={
					peek?.opt
						? {
								label: `Go here: ${peek.opt.label.toLowerCase()}`,
								onGo: () => take(peek.opt as Opt, peek.it),
							}
						: undefined
				}
			/>
		</div>
	)
}

function Road({
	o,
	j,
	onPeek,
	onTake,
}: {
	o: Opt
	j: number
	onPeek: (it: W) => void
	onTake: () => void
}) {
	const [lead, ...more] = o.items
	return (
		<section className={`rx3-in rx3-in-${j + 2} flex flex-col`}>
			<button type="button" onClick={onTake} className="group text-left">
				<h2 className="rx2-display text-3xl font-black leading-none text-amber-300 group-hover:text-amber-200 md:text-4xl">
					{o.label}
				</h2>
				<p className="mt-1.5 min-h-10 text-sm text-stone-300">{o.line}</p>
			</button>
			<div className="mt-3 flex gap-3">
				<div className="w-32 shrink-0 md:w-44">
					<Poster it={lead} onPeek={onPeek} size="w-full" src="w342" eager />
					<Caption it={lead} className="mt-2" />
				</div>
				<ul className="flex min-w-0 flex-1 flex-col gap-2">
					{more.map((it) => (
						<li key={it.k} className="flex min-w-0 items-center gap-2">
							<Poster it={it} onPeek={onPeek} size="w-12 md:w-14" src="w154" />
							<button
								type="button"
								onClick={() => onPeek(it)}
								className="min-w-0 text-left"
							>
								<span className="line-clamp-2 text-sm font-semibold leading-tight text-stone-200">
									{it.t}
								</span>
								<span className="text-xs text-stone-400">{it.yr || ""}</span>
							</button>
						</li>
					))}
				</ul>
			</div>
			<button
				type="button"
				onClick={onTake}
				className="mt-4 h-11 rounded-full border-2 border-amber-400/70 px-4 text-sm font-bold text-amber-200 hover:bg-amber-400 hover:text-black"
			>
				Take this road
			</button>
		</section>
	)
}
