// PROTOTYPE - throwaway (#658). The sides-on-Discover page: a data bar (member, names toggle, list places), Discover's
// heading and filter bar on the member's list, the chosen variant, and the floating variant switcher.
import { useNavigate, useSearchParams } from "@remix-run/react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { FilterBar, type ForYouControl, ForYouExplanation, SLAB_CLEARANCE, useFilterState } from "~/ui/filter-bar"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { count, topOf } from "./bits"
import { VARIANTS, type SDView, isVariant } from "./model"
import { Labels, Lanes, Rows, SideFilter, Today } from "./variants"

export function SidesDiscoverPage({ view }: { view: SDView | null }) {
	const [params, setParams] = useSearchParams()
	const navigate = useNavigate()
	const filters = useFilterState({ defaults: view?.defaults ?? { onMyServices: false, notSeenYet: true } })
	if (!view)
		return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">The title snapshot is still loading on this dev server. Reload in a minute.</p>
	const variant = isVariant(params.get("variant")) ? (params.get("variant") as keyof typeof VARIANTS) : "today"
	const names = params.get("names") === "1"
	const places = params.get("places") === "1"
	const set = (key: string, value: string | null) => {
		const p = new URLSearchParams(params)
		if (value === null) p.delete(key)
		else p.set(key, value)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const bestMatch = view.sortUsed === "match"
	const forYou: ForYouControl = {
		on: view.forYou,
		onChange: (on) => set("foryou", on ? null : "0"),
		movedUp: view.movedUp,
		explanation: <ForYouExplanation on={view.forYou || bestMatch} bestMatch={bestMatch} ratings={view.member.rated} movedUp={view.movedUp} />,
	}
	const top = topOf(view)
	const fitting = view.sides.map((s) => top.filter((t) => view.sideOf[t.card.key] === s.index).length)
	const none = top.filter((t) => view.sideOf[t.card.key] == null).length
	const props = { view, names, places }
	return (
		<div className="pb-40 text-white">
			<div className="border-b border-fuchsia-500/30 bg-fuchsia-950/20">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-xs">
					<span className="font-semibold text-fuchsia-300">Prototype data:</span>
					{view.members.map((m) => (
						<button
							key={m.slot}
							type="button"
							onClick={() => set("as", m.slot)}
							aria-pressed={m.slot === view.member.slot}
							className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${m.slot === view.member.slot ? "border-fuchsia-400 bg-fuchsia-900/60 text-white" : "border-white/15 text-gray-300 hover:border-fuchsia-400/60"}`}
						>
							{m.label}
							{m.ratings > 0 && <span className="ml-1 text-gray-400">{m.ratings.toLocaleString("en-US")}</span>}
						</button>
					))}
					<label className="ml-2 flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/50 px-2.5 py-0.5 font-semibold text-amber-200">
						<input type="checkbox" checked={names} onChange={(e) => set("names", e.target.checked ? "1" : null)} />
						Side names (waits on the words gate, #656)
					</label>
					<label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-0.5 font-semibold text-gray-300">
						<input type="checkbox" checked={places} onChange={(e) => set("places", e.target.checked ? "1" : null)} />
						Places in the list
					</label>
					<span className="w-full text-gray-400">
						{view.member.rated} rated, {view.member.loved} loved, {view.sides.length} sides ({view.loose} loved titles fit none) · order:{" "}
						{view.order === "personal" ? "personal order" : view.order === "best-match" ? `Best match (personal order not loaded: ${view.personalOrderNote ?? "no payload"})` : `${view.sortUsed}${view.forYou ? " with For you" : ""}`} · first{" "}
						{view.list} of {count(view.listTotal)}: {fitting.map((n, i) => `side ${i + 1} ${n}`).join(", ")}, no side {none} · whole list: {view.totals.map((n, i) => `side ${i + 1} ${count(n)}`).join(", ")}, no side {count(view.noSide)} (fit at closeness ≥ {view.fit}){view.servicesDropped ? " · On my services starts off: this member's services carry nothing where they watch" : ""} · {view.computedMs} ms
					</span>
				</div>
			</div>
			<div className={`mx-auto max-w-7xl px-4 pt-5 lg:pt-8 ${SLAB_CLEARANCE}`}>
				<DiscoverHeading q={null} onSearch={(text) => text && navigate(`/discover?q=${encodeURIComponent(text)}`)} onClear={() => {}} explanation={null} />
				<div className="lg:mt-7">
					<FilterBar filters={filters} counts={view.counts} forYou={forYou} taste="ready" />
				</div>
				<div className="mt-5 lg:mt-7">
					{variant === "today" && <Today {...props} />}
					{variant === "filter" && <SideFilter {...props} />}
					{variant === "rows" && <Rows {...props} />}
					{variant === "labels" && <Labels {...props} />}
					{variant === "lanes" && <Lanes {...props} />}
				</div>
			</div>
			<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))} />
		</div>
	)
}
