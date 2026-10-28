// PROTOTYPE (Discover lab, origin b): the world in columns. On top, Anywhere / Hollywood / Outside Hollywood as one
// choice with counts, and the country search. Below, one column per region: the region's name picks all of it, and
// its countries are rows with flags. The search narrows every column at once.
import { CheckIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { SearchField, Segmented } from "~/ui/filter-bar/SheetControls"
import { productionCountryName } from "~/domain/production-country"
import type { SectionProps } from "../../types"
import { Flag, HOLLYWOOD, REGIONS, WORLD, searchCountries, useAllCountries, useOrigin, useOriginCounts } from "./parts"

type Split = "any" | "hollywood" | "world" | "custom"

export function OriginB({ d, phone }: SectionProps) {
	const o = useOrigin(d)
	const [search, setSearch] = useState("")
	const all = useAllCountries(o.chosen)
	const counts = useOriginCounts(d, [[], HOLLYWOOD, WORLD, ...REGIONS.map((r) => r.codes)])
	const split: Split = !o.chosen.length ? "any" : o.isOnly(HOLLYWOOD) ? "hollywood" : o.isOnly(WORLD) ? "world" : "custom"
	const term = search.trim()
	const inRegions = new Set(REGIONS.flatMap((r) => r.codes))
	const others = all.list.filter((c) => !inRegions.has(c.code))
	const columns = [
		...REGIONS.map((r, i) => ({ ...r, count: counts[3 + i], rows: r.codes.map((code) => ({ code, name: productionCountryName(code) })) })),
		...(term ? [{ id: "other", name: "Everywhere else", codes: [] as string[], count: null, rows: others }] : []),
	]
		.map((c) => ({ ...c, rows: term ? searchCountries(c.rows, term) : c.rows }))
		.filter((c) => !term || c.rows.length)

	const pickSplit = (s: Split) => (s === "any" ? o.clear() : s === "hollywood" ? o.set(HOLLYWOOD) : s === "world" ? o.set(WORLD) : null)

	return (
		<div className={phone ? "space-y-4" : "flex h-full flex-col gap-4 px-7 py-5"}>
			<div className={phone ? "space-y-2" : "flex items-center gap-4"}>
				<div className={phone ? "flex" : "flex w-[520px]"}>
					<Segmented
						label="Made in"
						value={split === "custom" ? ("" as Split) : split}
						onChange={pickSplit}
						options={[
							{ id: "any", label: "Anywhere", count: split === "any" ? null : counts[0] },
							{ id: "hollywood", label: "Hollywood", count: split === "hollywood" ? null : counts[1] },
							{ id: "world", label: phone ? "Outside" : "Outside Hollywood", count: split === "world" ? null : counts[2] },
						]}
					/>
				</div>
				<div className={phone ? "" : "ml-auto w-[360px]"}>
					<SearchField value={search} onChange={setSearch} placeholder="Find a country" />
				</div>
			</div>

			<div className={phone ? "space-y-4" : "grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-3"}>
				{columns.map((col) => {
					const on = col.codes.length > 0 && o.allOf(col.codes)
					const picked = col.rows.filter((r) => o.has(r.code)).length
					return (
						<section key={col.id} className={phone ? "" : "flex min-h-0 min-w-0 flex-col rounded-2xl bg-white/[0.025] ring-1 ring-white/[0.05]"}>
							<button
								type="button"
								disabled={!col.codes.length}
								aria-pressed={on}
								onClick={() => o.toggleAll(col.codes)}
								className={`flex h-11 shrink-0 items-center gap-2 rounded-t-2xl px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
									col.codes.length ? "cursor-pointer hover:bg-white/[0.04]" : ""
								} ${phone ? "w-full rounded-xl bg-white/[0.04]" : "border-b border-white/[0.05]"}`}
							>
								<span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${on ? "text-amber-300" : "text-gray-100"}`}>{col.name}</span>
								{picked > 0 && !on && <span className="text-[11px] text-amber-300/90 tabular-nums">{picked}</span>}
								<span className="text-[11px] tabular-nums text-gray-500">{col.count != null ? compactCount(col.count) : ""}</span>
								{col.codes.length > 0 && (
									<span className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded-[5px] ring-1 ${on ? "bg-amber-400 text-gray-950 ring-amber-400" : "ring-white/25"}`}>
										{on && <CheckIcon className="h-3.5 w-3.5" />}
									</span>
								)}
							</button>
							<ul
								className={
									phone
										? "mt-1.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
										: "min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]"
								}
							>
								{col.rows.map((r) => {
									const sel = o.has(r.code)
									return (
										<li key={r.code} className={phone ? "shrink-0" : ""}>
											<button
												type="button"
												aria-pressed={sel}
												onClick={() => o.toggle(r.code)}
												className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
													sel ? "bg-white font-semibold text-gray-950" : phone ? "bg-white/[0.06] text-gray-200" : "text-gray-300 hover:bg-white/[0.06] hover:text-white"
												}`}
											>
												<Flag code={r.code} />
												<span className="min-w-0 truncate">{r.name}</span>
											</button>
										</li>
									)
								})}
							</ul>
						</section>
					)
				})}
				{term && !columns.length && <p className="text-[13px] text-gray-500">{all.loading ? "Loading countries…" : "No matching country."}</p>}
			</div>
		</div>
	)
}
