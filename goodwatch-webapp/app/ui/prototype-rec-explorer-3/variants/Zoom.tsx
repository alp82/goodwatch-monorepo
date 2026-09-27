// PROTOTYPE - throwaway. Zoom in (existing components): round 2's nested map, one level at a time. Each level shows
// only its groups, each with a clear name, one sentence on what sets it apart from its neighbors, and one or two titles
// that stand for it (the best for you, then the most different). Tap a group to zoom into it: the map dives into
// that circle and the next level opens with new titles. The finest level shows a handful of titles with reasons.
// Detail grows with depth: a poster and a name far out, two posters and a sentence a level down, full cards at the end.
import { useEffect, useRef, useState } from "react"
import { Crumbs } from "~/ui/prototype-rec-explorer-2/kit2"
import { Caption, Empty, PeekDock, Poster, Top } from "../kit3"
import { type Ex3, useWalk } from "../useExplorer3"
import type { W, ZoomNode, ZoomRes } from "../wire"

type Phase = "idle" | "out" | "pre"

export default function Zoom({ ex }: { ex: Ex3 }) {
	const walk = useWalk()
	const [res, setRes] = useState<ZoomRes | null>(null)
	const [trail, setTrail] = useState<{ id: number; name: string }[]>([])
	const [busy, setBusy] = useState(true)
	const [peek, setPeek] = useState<W | null>(null)
	const [phase, setPhase] = useState<Phase>("idle")
	const [focus, setFocus] = useState<ZoomNode | null>(null)
	const node = useRef(-1)
	const n = useRef(0)

	const fetchLevel = async (id: number) => {
		const r = await ex.api<ZoomRes>("zoom", { node: id, ...walk.params() })
		const shown = r.kids.length ? r.kids.flatMap((k) => k.items) : r.titles
		walk.show(shown)
		walk.offered(
			r.kids.length ? r.kids.map((k) => k.items[0]) : r.titles,
			r.spread,
		)
		return r
	}
	const open = async (id: number, via: ZoomNode | null) => {
		setBusy(true)
		setPeek(null)
		const reduce =
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		// Dive into the circle while the next level loads.
		if (via && !reduce) {
			setFocus(via)
			setPhase("out")
		}
		try {
			const [r] = await Promise.all([
				fetchLevel(id),
				new Promise((ok) => setTimeout(ok, via && !reduce ? 520 : 0)),
			])
			node.current = id
			n.current++
			setRes(r)
			setFocus(null)
			if (via && !reduce) {
				setPhase("pre")
				requestAnimationFrame(() =>
					requestAnimationFrame(() => setPhase("idle")),
				)
			} else setPhase("idle")
		} finally {
			setBusy(false)
		}
	}
	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		void open(-1, null)
	}, [])
	const filters = useRef(ex.filterKey)
	useEffect(() => {
		if (filters.current === ex.filterKey) return
		filters.current = ex.filterKey
		void open(node.current, null)
	}, [ex.filterKey])

	const enter = (k: ZoomNode) => {
		if (busy) return
		window.scrollTo({ top: 0, behavior: "smooth" })
		walk.step(k.items[0], k.name)
		setTrail((t) => [...t, { id: k.id, name: k.name }])
		void open(k.id, k)
	}
	const back = (j: number) => {
		// j = 0 is the whole map.
		const t = trail.slice(0, j)
		setTrail(t)
		void open(t.length ? t[t.length - 1].id : -1, null)
	}

	const kids = (res?.kids ?? [])
		.map((k) => ({ ...k, items: k.items.filter(ex.pass) }))
		.filter((k) => k.items.length)
	const titles = (res?.titles ?? []).filter(ex.pass)
	const depth = trail.length
	const transform =
		phase === "out" && focus
			? `scale(${Math.min(4, 0.92 / focus.r)}) translate(${-focus.x * 50}%, ${-focus.y * 50}%)`
			: phase === "pre"
				? "scale(0.72)"
				: "none"
	return (
		<div className="rx3-page rx3-atlas rx3-pb text-white">
			<div className="mx-auto grid max-w-7xl gap-6 px-4 pt-5 md:px-8 md:pt-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
				<div>
					<Top
						ex={ex}
						title={res?.node?.name ?? "Zoom in"}
						sub={
							titles.length
								? "The finest level: a handful of titles, each with why it's here."
								: depth
									? "Each group differs from its neighbors in the way its sentence says. Tap one to zoom in."
									: "The whole catalog in nine groups, one title each. Tap a group to zoom in; every level shows new titles."
						}
					/>
					<Crumbs
						label="Where you are on the map"
						className="mt-4 w-fit"
						items={[
							{ key: "all", name: "Whole map", current: !trail.length },
							...trail.map((t, j) => ({
								key: String(t.id),
								name: t.name,
								current: j === trail.length - 1,
							})),
						]}
						onPick={back}
					/>
				</div>
				{!res || (!kids.length && !titles.length) ? (
					<Empty ex={ex} busy={busy} />
				) : titles.length ? (
					<ul
						key={n.current}
						className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4"
					>
						{titles.map((t, j) => (
							<li key={t.k} className={`rx3-in rx3-in-${Math.min(4, j + 1)} min-w-0`}>
								<Poster it={t} size="w-full" src="w342" onPeek={setPeek} eager />
								<Caption it={t} className="mt-2" />
								<p className="mt-1 line-clamp-2 text-xs text-stone-300">{t.why}</p>
							</li>
						))}
					</ul>
				) : (
					<>
						{/* Phone: groups as rows. */}
						<ul key={`l${n.current}`} className="flex flex-col gap-3 md:hidden">
							{kids.map((k) => (
								<li key={k.id} className="rx3-in flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-2.5">
									<div className="flex shrink-0 gap-1.5">
										{k.items.map((it) => (
											<Poster key={it.k} it={it} size="w-14" src="w154" onPeek={setPeek} />
										))}
									</div>
									<button type="button" aria-label={`Zoom into ${k.name}`} onClick={() => enter(k)} className="min-w-0 flex-1 text-left">
										<span className="block text-base font-bold leading-tight text-amber-200">{k.name}</span>
										<span className="mt-0.5 block text-xs text-stone-300">{k.line}</span>
										<span className="mt-1 block text-xs text-stone-500">{k.count} titles</span>
									</button>
								</li>
							))}
						</ul>
						{/* Desktop: the map itself. */}
						<div className="relative hidden aspect-square w-full max-w-[min(100%,calc(100vh-7rem))] justify-self-center md:block">
							<div
								key={`m${n.current}`}
								className={`absolute inset-0 ${phase === "pre" ? "" : "rx3-zoom"}`}
								style={{ transform, opacity: phase === "idle" ? 1 : 0 }}
							>
								{kids.map((k) => (
									<Group key={k.id} k={k} depth={depth} onEnter={() => enter(k)} onPeek={setPeek} />
								))}
							</div>
						</div>
					</>
				)}
			</div>
			<PeekDock ex={ex} it={peek} onClose={() => setPeek(null)} />
		</div>
	)
}

function Group({
	k,
	depth,
	onEnter,
	onPeek,
}: {
	k: ZoomNode
	depth: number
	onEnter: () => void
	onPeek: (w: W) => void
}) {
	// Circles are placed where round 2's map put them, inside the parent's circle (-1..1).
	const size = `${k.r * 100}%`
	return (
		<div
			className="pointer-events-none absolute flex items-center justify-center"
			style={{
				left: `${50 + k.x * 50 - k.r * 50}%`,
				top: `${50 + k.y * 50 - k.r * 50}%`,
				width: size,
				height: size,
			}}
		>
			<button
				type="button"
				aria-label={`Zoom into ${k.name}`}
				onClick={onEnter}
				className="pointer-events-auto absolute inset-0 rounded-full border border-amber-200/15 bg-stone-900/40 transition-colors hover:border-amber-300/60 hover:bg-amber-900/15"
			/>
			<div className="pointer-events-none relative flex w-[88%] flex-col items-center gap-1.5 text-center">
				<div className="pointer-events-auto flex justify-center gap-1.5">
					{k.items.map((it) => (
						<Poster
							key={it.k}
							it={it}
							size={depth ? "w-14 lg:w-16" : "w-16 lg:w-20"}
							src="w185"
							onPeek={onPeek}
							eager
						/>
					))}
				</div>
				<button
					type="button"
					onClick={onEnter}
					className="pointer-events-auto text-sm font-bold leading-tight text-amber-100 hover:text-amber-300 lg:text-base"
				>
					{k.name}
				</button>
				{depth > 0 && <p className="line-clamp-2 text-[11px] leading-snug text-stone-300">{k.line}</p>}
			</div>
		</div>
	)
}
