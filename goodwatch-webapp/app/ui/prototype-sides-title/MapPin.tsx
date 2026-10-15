// PROTOTYPE - throwaway (#661). Variant "A pin on the map of you" (bolder): the #657 map of what the member loves
// (each dot a loved title, each side a colored region with its typical posters, its places just past it dashed at
// its rim) as a section under the overview, with this title as a pin: inside its side, at the side's rim, or between
// two sides. No pin, no map: a title that fits no side shows nothing.
import { titlesOf } from "~/ui/taste/tabs/parts"
import type { SideCard, SidesTitleView } from "./model"
import { ProtoPoster, WatchNextLink, headline, sideOf } from "./SidesProto"

const pct = (x: number) => `${(x * 100).toFixed(2)}%`

export function MapVariant({ view, names }: { view: SidesTitleView; names: boolean }) {
	const p = view.placement
	const side = sideOf(view, p.side)
	if (!side || !p.pin) return null
	const { title, detail } = headline(view, names)
	const self = view.titles[view.title]
	const other = p.edge?.kind === "bridge" ? sideOf(view, p.edge.toward) : null
	const lit = (s: SideCard) => s === side || s === other
	return (
		<section className="relative mx-auto mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-gray-300">On the map of what you love</h2>
					<p className="mt-1 text-2xl font-semibold tracking-tight text-amber-200 md:text-3xl">{title}.</p>
					<p className="mt-1 text-gray-400">{detail}</p>
				</div>
				<WatchNextLink side={side} names={names} />
			</div>
			<div className="relative mt-5 aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-gray-800 bg-gray-950 sm:aspect-[16/8]">
				<div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
				<svg className="absolute inset-0 h-full w-full" aria-hidden>
					{view.sides.flatMap((s) =>
						s.edges
							.filter((e) => e.kind !== "bridge")
							.map((e) => (
								<line key={e.id} x1={pct(s.x)} y1={pct(s.y)} x2={pct(e.x)} y2={pct(e.y)} stroke={s.color} strokeOpacity={lit(s) ? 0.45 : 0.1} strokeDasharray="6 6" strokeWidth={2} />
							)),
					)}
					{other && <line x1={pct(side.x)} y1={pct(side.y)} x2={pct(other.x)} y2={pct(other.y)} stroke="#7dd3fc" strokeOpacity={0.6} strokeDasharray="4 6" strokeWidth={2} />}
				</svg>
				{view.sides.map((s) => (
					<div key={s.id} className={`transition-opacity ${lit(s) ? "opacity-100" : "opacity-30"}`}>
						{s.dots.map((d) => (
							<span key={d.key} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pct(d.x), top: pct(d.y), background: s.color, opacity: 0.55 }} />
						))}
						{titlesOf(view.titles, s.here.slice(0, 3)).map((t) => {
							const d = s.dots.find((x) => x.key === t.key)
							if (!d || t.key === view.title) return null
							return (
								<img
									key={t.key}
									src={`https://image.tmdb.org/t/p/w185${t.poster}`}
									alt={t.title}
									title={t.title}
									className="absolute w-7 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 shadow-lg md:w-10"
									style={{ left: pct(d.x), top: pct(d.y), borderColor: s.color }}
								/>
							)
						})}
						{s.edges
							.filter((e) => e.kind !== "bridge")
							.map((e) => (
								<span key={e.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: pct(e.x), top: pct(e.y) }}>
									<span className="block h-6 w-6 rounded-full border-2 border-dashed md:h-8 md:w-8" style={{ borderColor: s.color }} />
									{names && lit(s) && <span className="hidden whitespace-nowrap rounded-full bg-gray-950/85 px-2 py-0.5 text-[11px] font-semibold text-gray-200 sm:inline">{e.chip}</span>}
								</span>
							))}
						<span
							className="absolute max-w-[40%] -translate-x-1/2 -translate-y-[190%] truncate whitespace-nowrap rounded-full border-2 bg-gray-950/90 px-3 py-1 text-xs font-bold shadow-xl md:max-w-none md:text-sm"
							style={{ left: pct(s.x), top: pct(s.y), borderColor: s.color }}
						>
							{names ? s.name : `${s.count} you love`}
						</span>
					</div>
				))}
				{self && (
					<div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: pct(p.pin.x), top: pct(p.pin.y) }}>
						<span className={`absolute h-20 w-20 rounded-full motion-safe:animate-ping ${p.kind === "on" ? "bg-amber-400/20" : "bg-sky-300/20"}`} aria-hidden />
						<ProtoPoster t={self} className="w-11 shadow-2xl md:w-14" ring={p.kind === "on" ? "#fbbf24" : "#7dd3fc"} />
						<span className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-black ${p.kind === "on" ? "bg-amber-400" : "bg-sky-300"}`}>This title</span>
					</div>
				)}
			</div>
			<p className="mt-2 text-xs text-gray-500">Each dot is a title you love; each colored group is one of your sides. Dashed rings are places just past a side, where you've barely been.</p>
		</section>
	)
}
