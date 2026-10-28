// PROTOTYPE (Discover lab, services a): the baseline. Today's Streaming card at full width: the mode pill (My
// services, Everywhere, Streaming in…), the country and a service search, Any service and the country's services as
// logo chips with counts, "+N more". Not seen yet sits beside the pill.
import { NotSeenSwitch } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { Chip, More, SearchField } from "~/ui/filter-bar/SheetControls"
import { productionCountryName } from "~/domain/production-country"
import { useState } from "react"
import type { SectionProps } from "../../types"
import { CountrySelect, ModePill, SearchToggle, cleanName, logo, useServiceSearch, useServices } from "./parts"

export function ServicesA({ d, pieces, phone }: SectionProps) {
	const sv = useServices(d, pieces)
	const find = useServiceSearch(sv)
	const [open, setOpen] = useState(false)
	const [all, setAll] = useState(false)
	const limit = phone ? 9 : 22
	const keep = Math.max(limit, sv.chosen.length)
	const shown = find.term || all ? find.matches.slice(0, 120) : find.matches.slice(0, keep)
	const rest = find.matches.length - shown.length
	const total = sv.mode === "mine" ? sv.totals.mine : sv.mode === "pick" ? null : sv.totals.all

	return (
		<div className={phone ? "space-y-4" : "flex h-full flex-col gap-4 px-7 py-5"}>
			<div className={phone ? "space-y-3" : "flex items-center gap-4"}>
				<ModePill sv={sv} phone={phone} />
				{!phone && total != null && <span className="text-[13px] text-gray-500 tabular-nums">{total.toLocaleString("en")} titles</span>}
				<div className={phone ? "" : "ml-auto"}>
					<NotSeenSwitch {...pieces.notSeenProps} size={phone ? "sm" : "md"} />
				</div>
			</div>

			<div className={phone ? "space-y-3" : "flex min-h-0 flex-1 flex-col gap-3"}>
				<div className="flex items-center gap-2">
					<span className="text-[13px] text-gray-400">Services in</span>
					<CountrySelect sv={sv} className={phone ? "min-w-0 flex-1" : "w-56"} />
					<SearchToggle open={open} onClick={() => (open ? (setOpen(false), find.setSearch("")) : setOpen(true))} />
					{!phone && open && (
						<div className="w-80">
							<SearchField value={find.search} onChange={find.setSearch} placeholder={`Find a service in ${productionCountryName(sv.country)}`} autoFocus />
						</div>
					)}
				</div>
				{phone && open && (
					<SearchField value={find.search} onChange={find.setSearch} placeholder={`Find a service in ${productionCountryName(sv.country)}`} autoFocus />
				)}
				<div className={phone ? "flex flex-wrap gap-1.5" : "-mx-1 flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain px-1 pb-1"}>
					{!find.term && (
						<Chip
							o={{
								id: "any",
								label: "Any service",
								active: sv.mode === "pick" && sv.anyService,
								count: sv.mode === "pick" && sv.anyService ? null : sv.totals.any,
								toggle: () => sv.setMode("pick"),
							}}
						/>
					)}
					{shown.map((p) => (
						<Chip
							key={p.id}
							img={logo(p.logo_path)}
							o={{ id: String(p.id), label: cleanName(p.name), active: sv.isOn(p.id), count: sv.countOf(p.id), toggle: () => sv.pick(p.id) }}
						/>
					))}
					{!find.term && rest > 0 && <More hidden={rest} open={false} onClick={() => setAll(true)} />}
					{all && !find.term && <More hidden={0} open onClick={() => setAll(false)} />}
					{find.term && !find.matches.length && <p className="px-1 py-1.5 text-[13px] text-gray-500">No service called “{find.search}” here.</p>}
					{!sv.providers.length && <p className="px-1 py-1.5 text-[13px] text-gray-500">Loading services…</p>}
				</div>
				{phone && total != null && <p className="text-[12px] text-gray-500">{compactCount(total)} titles</p>}
			</div>
		</div>
	)
}
