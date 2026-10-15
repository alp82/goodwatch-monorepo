// PROTOTYPE - throwaway (#658). Four ways Sides of you could appear on Discover, beside today's grid. Every variant keeps
// the list's order (personal order under Best match) inside a side; sides only group or mark titles.
//
// - filter: a row of side chips under the filter bar; choosing one narrows the grid to the titles that fit that side.
// - rows:   a row per side, and one for titles that fit no side, each placed by where its first title is in the list.
// - labels: today's grid, untouched order, each card marked with its side; the legend highlights one side.
// - lanes:  (bolder) the sides (and the titles that fit none) side by side as lanes; on phones, one lane per swipe.
import { useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { DISCOVER_GRID } from "~/ui/discover/DiscoverGrid"
import { Card, LovedStack, SideHeader, count, groupsInListOrder, hue, pct, sideLabel, titlesOf, topOf } from "./bits"
import type { SDSide, SDView } from "./model"

interface Props {
	view: SDView
	names: boolean
	places: boolean
}

// ---------- today ----------

export function Today({ view, places }: Props) {
	return (
		<div className={DISCOVER_GRID}>
			{topOf(view).map(({ card, place }, i) => (
				<Card key={card.key} card={card} index={i} place={places ? place : null} />
			))}
		</div>
	)
}

// ---------- filter ----------

export function SideFilter({ view, names, places }: Props) {
	const [params, setParams] = useSearchParams()
	const raw = params.get("side")
	const chosen = raw !== null && view.sides[Number(raw)] ? Number(raw) : null
	const pick = (i: number | null) => {
		const p = new URLSearchParams(params)
		if (i === null) p.delete("side")
		else p.set("side", String(i))
		setParams(p, { preventScrollReset: true })
	}
	const list = chosen === null ? topOf(view) : titlesOf(view, chosen)
	const side = chosen === null ? null : view.sides[chosen]
	return (
		<>
			<div className="-mx-4 mb-5 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
				<span className="mr-1 hidden shrink-0 text-sm font-semibold text-gray-400 lg:inline">Sides of you</span>
				<Chip on={chosen === null} onClick={() => pick(null)}>
					<span className="px-1">All of you</span>
					<span className="text-gray-400">{count(view.listTotal)}</span>
				</Chip>
				{view.sides.map((s) => (
					<Chip key={s.index} on={chosen === s.index} onClick={() => pick(chosen === s.index ? null : s.index)} hueOf={s}>
						<LovedStack side={s} view={view} n={3} size="h-7" />
						<span className="max-w-56 truncate">{sideLabel(s, names)}</span>
						<span className="text-gray-400">{count(view.totals[s.index])}</span>
					</Chip>
				))}
			</div>
			{side && (
				<div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-gray-900/60 p-3">
					<SideHeader side={side} view={view} names={names} inList={view.totals[side.index]} />
					{names && side.edges.length > 0 && (
						<p className="max-w-md text-xs text-gray-400">
							<span className="font-semibold text-gray-300">Just past this side: </span>
							{side.edges.join(" · ")}
						</p>
					)}
				</div>
			)}
			<div className={DISCOVER_GRID}>
				{list.map(({ card, place }, i) => (
					<Card key={card.key} card={card} index={i} place={places ? place : null} />
				))}
			</div>
			<p className="mt-6 text-sm text-gray-400">
				{side
					? `The prototype loads this side's first ${list.length} of ${count(view.totals[side.index])}; Discover would keep loading them as you scroll.`
					: `The prototype loads the first ${list.length} of ${count(view.listTotal)}; Discover would keep loading them as you scroll.`}
			</p>
		</>
	)
}

function Chip({ on, onClick, hueOf, children }: { on: boolean; onClick: () => void; hueOf?: SDSide; children: React.ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			className={`flex shrink-0 cursor-pointer snap-start items-center gap-2 rounded-full border py-1 pr-3 pl-1.5 text-sm font-semibold transition ${on ? "border-amber-400 bg-amber-400/15 text-white" : "border-white/15 bg-gray-900 text-gray-200 hover:border-white/40"}`}
			style={hueOf && on ? { borderColor: hue(hueOf) } : undefined}
		>
			{children}
		</button>
	)
}

// ---------- rows ----------

export function Rows({ view, names, places }: Props) {
	const [, setParams] = useSearchParams()
	const seeAll = (i: number) =>
		setParams(
			(p) => {
				const out = new URLSearchParams(p)
				out.set("variant", "filter")
				out.set("side", String(i))
				return out
			},
			{ preventScrollReset: false },
		)
	return (
		<div className="flex flex-col gap-10">
			{groupsInListOrder(view).map((group) => {
				const list = titlesOf(view, group)
				if (!list.length) return null
				const side = group === null ? null : view.sides[group]
				return (
					<section key={group ?? "none"}>
						{side ? (
							<div className="mb-3 flex items-end justify-between gap-3">
								<SideHeader side={side} view={view} names={names} inList={view.totals[side.index]} />
								<button type="button" onClick={() => seeAll(side.index)} className="shrink-0 cursor-pointer text-sm font-bold text-amber-400 hover:text-amber-300">
									See all {count(view.totals[side.index])}
								</button>
							</div>
						) : (
							<NoSideHeader view={view} />
						)}
						<Row list={list} places={places} />
					</section>
				)
			})}
		</div>
	)
}

/** The titles that fit no side, as a group of their own: no posters stand for it. */
function NoSideHeader({ view, compact = false }: { view: SDView; compact?: boolean }) {
	return (
		<div className={compact ? "" : "mb-3"}>
			<h2 className={`${compact ? "text-base" : "text-lg md:text-xl"} font-bold text-white`}>More for you</h2>
			<p className="text-sm text-gray-400">Fits none of your sides · {count(view.noSide)} in this list</p>
		</div>
	)
}

function Row({ list, places }: { list: ReturnType<typeof titlesOf>; places: boolean }) {
	return (
		<div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
			{list.slice(0, 16).map(({ card, place }, i) => (
				<div key={card.key} className="w-[40%] shrink-0 snap-start xs:w-[30%] sm:w-[23%] md:w-[19%] lg:w-[15.5%]">
					<Card card={card} index={i} place={places ? place : null} />
				</div>
			))}
		</div>
	)
}

// ---------- labels ----------

export function Labels({ view, names, places }: Props) {
	const [lit, setLit] = useState<number | null>(null)
	return (
		<>
			<div className="-mx-4 mb-5 flex items-center gap-x-4 gap-y-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
				{view.sides.map((s) => (
					<button
						key={s.index}
						type="button"
						onClick={() => setLit(lit === s.index ? null : s.index)}
						onMouseEnter={() => setLit(s.index)}
						onMouseLeave={() => setLit(null)}
						aria-pressed={lit === s.index}
						className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-md py-1 pr-2 text-sm transition ${lit === null || lit === s.index ? "opacity-100" : "opacity-40"}`}
					>
						<span className="h-3 w-3 rounded-full" style={{ background: hue(s) }} aria-hidden />
						<LovedStack side={s} view={view} n={3} size="h-7" />
						<span className="font-semibold text-gray-100">{sideLabel(s, names)}</span>
						<span className="text-gray-400">{pct(s.share)}</span>
					</button>
				))}
			</div>
			<div className={DISCOVER_GRID}>
				{topOf(view).map(({ card, place }, i) => {
					const side = view.sideOf[card.key]
					const s = side == null ? null : view.sides[side]
					const dim = lit !== null && side !== lit
					return (
						<div key={card.key} className={`transition-opacity ${dim ? "opacity-25" : ""}`}>
							<div className="mb-1 flex h-5 items-center gap-1.5 px-1 text-xs font-semibold text-gray-300">
								{s ? (
									<>
										<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hue(s) }} aria-hidden />
										<span className="truncate">{sideLabel(s, names)}</span>
									</>
								) : (
									<span className="font-normal text-gray-500">No side</span>
								)}
							</div>
							<Card card={card} index={i} place={places ? place : null} />
						</div>
					)
				})}
			</div>
		</>
	)
}

// ---------- lanes ----------

export function Lanes({ view, names, places }: Props) {
	const groups = groupsInListOrder(view).filter((g) => titlesOf(view, g).length > 0)
	const n = groups.length
	const desktopCols = ["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4", "md:grid-cols-5", "md:grid-cols-6"][n] ?? "md:grid-cols-6"
	// Wide enough lanes keep the card titles: two columns only with three lanes or fewer.
	const inner = n <= 2 ? "grid-cols-2 lg:grid-cols-3" : n === 3 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-1"
	const go = (id: string) => document.getElementById(`lane-${id}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
	return (
		<>
			<div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:hidden">
				{groups.map((g) => (
					<button key={g ?? "none"} type="button" onClick={() => go(String(g ?? "none"))} className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-gray-900 px-2.5 py-1 text-xs font-semibold text-gray-200">
						<span className="h-2 w-2 rounded-full" style={{ background: g === null ? "#9ca3af" : hue(g) }} aria-hidden />
						{g === null ? "More for you" : sideLabel(view.sides[g], names)}
					</button>
				))}
			</div>
			<div className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:overflow-visible md:px-0 ${desktopCols}`}>
				{groups.map((g) => {
					const list = titlesOf(view, g)
					const side = g === null ? null : view.sides[g]
					return (
						<section key={g ?? "none"} id={`lane-${g ?? "none"}`} className="w-[86vw] shrink-0 snap-center md:w-auto">
							<div className="z-20 -mx-1 mb-3 rounded-lg border-t-4 bg-gray-950/95 px-2 py-2 md:sticky md:top-14" style={{ borderTopColor: side ? hue(side) : "#9ca3af" }}>
								{side ? <SideHeader side={side} view={view} names={names} inList={view.totals[side.index]} compact /> : <NoSideHeader view={view} compact />}
							</div>
							<div className={`grid gap-3 ${inner}`}>
								{list.slice(0, 40).map(({ card, place }, i) => (
									<Card key={card.key} card={card} index={i} place={places ? place : null} />
								))}
							</div>
						</section>
					)
				})}
			</div>
		</>
	)
}
