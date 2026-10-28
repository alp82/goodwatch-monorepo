// PROTOTYPE (Discover lab, origin a): the baseline. Today's Production countries card, opened up: a country search,
// popular countries as flag chips with counts, regions as one-tap groups with counts, Any country to clear.
import { useState } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { Chip, SearchField } from "~/ui/filter-bar/SheetControls"
import { productionCountryName } from "~/domain/production-country"
import type { SectionProps } from "../../types"
import { SubHead } from "../../shell-parts"
import { Flag, POPULAR, REGIONS, flagUrl, searchCountries, useAllCountries, useOrigin, useOriginCounts } from "./parts"

export function OriginA({ d, phone }: SectionProps) {
	const o = useOrigin(d)
	const [search, setSearch] = useState("")
	const all = useAllCountries(o.chosen)
	const popular = [...o.chosen.filter((c) => !POPULAR.includes(c)), ...POPULAR]
	const counts = useOriginCounts(d, [[], ...POPULAR.map((c) => [c]), ...REGIONS.map((r) => r.codes)])
	const anyCount = counts[0]
	const countOf = (code: string) => {
		const i = POPULAR.indexOf(code)
		return i < 0 ? null : counts[1 + i]
	}
	const regionCount = (i: number) => counts[1 + POPULAR.length + i]
	const matches = search.trim() ? searchCountries(all.list, search).slice(0, 60) : []

	const chip = (code: string, count: number | null) => (
		<Chip
			key={code}
			img={flagUrl(code)}
			o={{ id: code, label: productionCountryName(code), active: o.has(code), count, toggle: () => o.toggle(code) }}
		/>
	)

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
				<div className={phone ? "space-y-5" : "grid min-h-0 flex-1 grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-8"}>
					<section>
						<SubHead>Popular</SubHead>
						<div className="flex flex-wrap gap-1.5">{popular.map((c) => chip(c, countOf(c)))}</div>
					</section>
					<section>
						<SubHead>Regions</SubHead>
						<div className="space-y-1.5">
							{REGIONS.map((r, i) => {
								const on = o.allOf(r.codes)
								const some = !on && r.codes.some(o.has)
								const n = regionCount(i)
								return (
									<button
										key={r.id}
										type="button"
										aria-pressed={on}
										onClick={() => o.toggleAll(r.codes)}
										className={`flex h-9 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
											on ? "bg-white font-semibold text-gray-950" : "bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]"
										}`}
									>
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
