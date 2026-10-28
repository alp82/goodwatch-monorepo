// PROTOTYPE (Discover lab, origin a): the baseline. Today's Production countries card, opened up: a country search,
// film industries as one-tap country sets (Hollywood, Bollywood, …, Rest of the world), popular countries as flag
// chips with counts, regions as one-tap groups with counts, Any country to clear. productionCountries can only
// include, so "Rest of the world" is every other country the catalog knows, co-productions with the big ones included.
import { GlobeAltIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { Chip, SearchField } from "~/ui/filter-bar/SheetControls"
import { productionCountryName } from "~/domain/production-country"
import type { SectionProps } from "../../types"
import { SubHead } from "../../shell-parts"
import {
	BIG,
	Flag,
	INDUSTRIES,
	POPULAR,
	REGIONS,
	flagUrl,
	restOfWorld,
	searchCountries,
	useAllCountries,
	useOrigin,
	useOriginCounts,
} from "./parts"

/** Picked countries outside Popular show first in Popular, unless a big set (Rest of the world) is on. */
const MAX_EXTRA = 8

export function OriginA({ d, phone }: SectionProps) {
	const o = useOrigin(d)
	const [search, setSearch] = useState("")
	const all = useAllCountries(o.chosen)
	const rest = restOfWorld(all.list)
	const industries = [...INDUSTRIES, { id: "rest", name: "Rest of the world", codes: rest }]
	const extra = o.chosen.filter((c) => !POPULAR.includes(c))
	const popular = extra.length <= MAX_EXTRA ? [...extra, ...POPULAR] : POPULAR
	const counts = useOriginCounts(d, [
		[],
		...POPULAR.map((c) => [c]),
		...REGIONS.map((r) => r.codes),
		...industries.map((g) => g.codes),
	])
	const anyCount = counts[0]
	const countOf = (code: string) => {
		const i = POPULAR.indexOf(code)
		return i < 0 ? null : counts[1 + i]
	}
	const regionCount = (i: number) => counts[1 + POPULAR.length + i]
	const industryCount = (i: number) => counts[1 + POPULAR.length + REGIONS.length + i]
	const matches = search.trim() ? searchCountries(all.list, search).slice(0, 60) : []

	const chip = (code: string, count: number | null) => (
		<Chip
			key={code}
			img={flagUrl(code)}
			o={{ id: code, label: productionCountryName(code), active: o.has(code), count, toggle: () => o.toggle(code) }}
		/>
	)

	const row = (on: boolean, h: string) =>
		`flex ${h} w-full min-w-0 items-center gap-2.5 rounded-xl px-3 text-left text-[13px] cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
			on ? "bg-white font-semibold text-gray-950" : "bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]"
		}`

	const scroll = phone ? "" : "-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-1"

	return (
		<div className={phone ? "space-y-5" : "flex h-full flex-col gap-4 px-7 py-5"}>
			<div className={phone ? "space-y-2" : "flex items-center gap-3"}>
				<div className={phone ? "" : "w-[420px]"}>
					<SearchField value={search} onChange={setSearch} placeholder="Find a country" />
				</div>
				<Chip o={{ id: "any", label: "Any country", active: o.chosen.length === 0, count: anyCount, toggle: o.clear }} />
			</div>

			{search.trim() ? (
				<div className={phone ? "flex flex-wrap gap-1.5" : "-mx-1 flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain px-1"}>
					{matches.map((c) => chip(c.code, countOf(c.code)))}
					{!matches.length && <p className="py-1.5 text-[13px] text-gray-500">{all.loading ? "Loading countries…" : "No matching country."}</p>}
				</div>
			) : (
				<div className={phone ? "space-y-5" : "grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-7"}>
					<section className="flex min-h-0 flex-col">
						<SubHead>Film industries</SubHead>
						<div className={`grid grid-cols-2 gap-1 ${scroll}`}>
							{industries.map((g, i) => {
								const on = g.codes.length > 0 && o.allOf(g.codes)
								const n = industryCount(i)
								const isRest = g.id === "rest"
								return (
									<button
										key={g.id}
										type="button"
										aria-pressed={on}
										disabled={!g.codes.length}
										title={isRest ? `Any country but ${BIG.map(productionCountryName).join(", ")}, co-productions with them included` : g.codes.map(productionCountryName).join(", ")}
										onClick={() => o.toggleAll(g.codes)}
										className={row(on, "h-8")}
									>
										{isRest ? (
											<GlobeAltIcon className={`h-4 w-5 shrink-0 ${on ? "text-gray-700" : "text-gray-400"}`} />
										) : (
											<span className="flex shrink-0 -space-x-2">
												{g.codes.slice(0, 3).map((c) => (
													<Flag key={c} code={c} className="h-3.5 w-5 ring-2 ring-gray-950" />
												))}
											</span>
										)}
										<span className="min-w-0 flex-1 truncate">{g.name}</span>
										<span className={`text-[12px] tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}>{n != null ? compactCount(n) : ""}</span>
									</button>
								)
							})}
						</div>
					</section>
					<section className="flex min-h-0 flex-col">
						<SubHead note={extra.length > MAX_EXTRA ? `${extra.length} more picked` : undefined}>Popular</SubHead>
						<div className={`flex flex-wrap content-start gap-1.5 ${scroll}`}>{popular.map((c) => chip(c, countOf(c)))}</div>
					</section>
					<section className="flex min-h-0 flex-col">
						<SubHead>Regions</SubHead>
						<div className={`space-y-1 ${scroll}`}>
							{REGIONS.map((r, i) => {
								const on = o.allOf(r.codes)
								const some = !on && r.codes.some(o.has)
								const n = regionCount(i)
								return (
									<button key={r.id} type="button" aria-pressed={on} onClick={() => o.toggleAll(r.codes)} className={row(on, "h-9")}>
										<span className="flex shrink-0 -space-x-1.5">
											{r.codes.slice(0, 4).map((c) => (
												<Flag key={c} code={c} className="h-4 w-6 ring-2 ring-gray-950" />
											))}
										</span>
										<span className="min-w-0 flex-1 truncate">{r.name}</span>
										{some && <span className="text-[11px] text-amber-300/90">{r.codes.filter(o.has).length} picked</span>}
										<span className={`text-[12px] tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}>{n != null ? compactCount(n) : ""}</span>
									</button>
								)
							})}
						</div>
					</section>
				</div>
			)}
		</div>
	)
}
