// PROTOTYPE - throwaway (#661). Variant "Your-side panels under the overview" (existing): the Taste page's own two
// panels ("You're here" and "Just past it", with the side's backdrop) as a section right under the overview. On a
// side: the side, then more from it. Just past a side: the side, then this title in the place just past it. Between
// two sides: one side, this title, the other side. Unseen titles follow personal order.
import { useServicesFilter, SuggestionCard, titlesOf } from "~/ui/taste/tabs/parts"
import { Panel } from "~/ui/prototype-better-sides/Tighter"
import { ProtoPoster, WatchNextLink, headline, sideOf } from "./SidesProto"
import type { SidesTitleView } from "./model"

export function PanelVariant({ view, names }: { view: SidesTitleView; names: boolean }) {
	const p = view.placement
	const side = sideOf(view, p.side)
	const services = useServicesFilter(false)
	if (!side) return null
	const { title, detail } = headline(view, names)
	const self = view.titles[view.title]
	const near = titlesOf(view.titles, p.near)
	const more = titlesOf(view.titles, p.more).filter(services.keep).slice(0, 6)
	const bridge = p.edge?.kind === "bridge"
	const other = bridge ? sideOf(view, p.edge?.toward ?? null) : null
	const sideName = (s: typeof side) => (names ? s.name : `${s.count} titles you love`)
	const backdrop = (keys: number[]) => titlesOf(view.titles, keys).find((t) => t.backdrop)
	return (
		<section className="relative mx-auto mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
			<h2 className="text-lg font-semibold text-gray-300">In your Taste</h2>
			<p className="mt-1 text-2xl font-semibold tracking-tight text-amber-200 md:text-3xl">{title}.</p>
			<div className={`mt-5 grid items-stretch gap-3 ${bridge ? "lg:grid-cols-[1fr_7rem_1fr]" : "lg:grid-cols-[1fr_2.5rem_1fr]"}`}>
				<Panel image={backdrop(side.here)} tone="amber">
					<div>
						<p className="text-sm font-semibold text-amber-300">{p.kind === "on" ? "You're here" : "Your side"}</p>
						<h3 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">{sideName(side)}</h3>
						<p className="mt-2 text-gray-200">{Math.round(side.share * 100)}% of what you love. Closest to this title:</p>
					</div>
					<div className="mt-6 grid grid-cols-4 gap-2">
						{near.slice(0, 4).map((t) => (
							<ProtoPoster key={t.key} t={t} className="w-full" />
						))}
					</div>
				</Panel>
				{bridge && self ? (
					<div className="flex flex-col items-center justify-center gap-2 text-center">
						<span className="text-xs font-semibold text-sky-300">This title sits between them</span>
						<ProtoPoster t={self} className="w-24" ring="#38bdf8" />
					</div>
				) : (
					<div className="flex items-center justify-center text-3xl text-gray-500" aria-hidden>
						<span className="rotate-90 lg:rotate-0">{p.kind === "on" ? "+" : "→"}</span>
					</div>
				)}
				{p.kind === "on" ? (
					<div className="flex flex-col justify-between rounded-2xl border-2 border-amber-500/20 bg-white/[0.03] p-5 md:p-7">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<div>
								<p className="text-sm font-semibold text-amber-300">More from this side</p>
								<p className="mt-1 text-gray-300">{p.member ? `You love this one. ${detail}.` : "Titles you haven't seen, in your personal order."}</p>
							</div>
							<WatchNextLink side={side} names={names} />
						</div>
						<div className="mt-5 grid grid-cols-3 gap-2 md:grid-cols-6 lg:grid-cols-3">
							{more.map((t) => (
								<SuggestionCard key={t.key} t={t} />
							))}
						</div>
					</div>
				) : bridge && other ? (
					<Panel image={backdrop(other.here)} tone="amber">
						<div>
							<p className="text-sm font-semibold text-amber-300">Your other side</p>
							<h3 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">{sideName(other)}</h3>
							<p className="mt-2 text-gray-200">{Math.round(other.share * 100)}% of what you love. Closest to this title:</p>
						</div>
						<div className="mt-6 grid grid-cols-4 gap-2">
							{titlesOf(view.titles, p.nearOther).slice(0, 4).map((t) => (
								<ProtoPoster key={t.key} t={t} className="w-full" />
							))}
						</div>
						<div className="mt-4">
							<WatchNextLink side={other} names={names} />
						</div>
					</Panel>
				) : (
					<Panel image={self?.backdrop ? self : backdrop(p.more)} tone="sky">
						<div>
							<p className="text-sm font-semibold text-sky-300">{bridge ? "Between them" : "Just past it"}</p>
							<h3 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">{bridge && other ? sideName(other) : self?.title}</h3>
							<p className="mt-2 text-gray-200">{bridge ? detail : names ? detail : "This title sits next to the side, somewhere you've barely tried."}</p>
						</div>
						<div className="mt-6 grid grid-cols-4 gap-2">
							{self && <ProtoPoster t={self} className="w-full" ring="#38bdf8" />}
							{(bridge ? titlesOf(view.titles, p.nearOther) : titlesOf(view.titles, p.more)).slice(0, 3).map((t) => (
								<ProtoPoster key={t.key} t={t} className="w-full opacity-80" />
							))}
						</div>
						<div className="mt-4">
							<WatchNextLink side={side} names={names} />
						</div>
					</Panel>
				)}
			</div>
		</section>
	)
}
