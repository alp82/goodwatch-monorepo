// PROTOTYPE (discover-easy) round 4 G "Summary": one short line under the search, "Read as ● ● ● 3 qualities · 4
// filters", that unfolds into the Advanced card. Folded by default, so easy stays one line.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { Readout } from "./Readout"
import { qualitiesOf } from "./reading"
import type { Easy } from "./bits"

export const name = "Summary"

export function EasyG({ e }: { e: Easy }) {
	const [open, setOpen] = useState(false)
	const qualities = qualitiesOf(e.reading)
	const filters = e.chips.filter((c) => c.kind !== "query")
	const has = qualities.length > 0 || filters.length > 0
	return (
		<div>
			<div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				{has ? (
					<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex cursor-pointer items-center gap-2 pl-1 text-[13px] text-gray-400 hover:text-white">
						<span className="text-[10px] font-semibold tracking-[0.075em] text-[#8395ae] uppercase">Read as</span>
						<span className="flex -space-x-0.5">
							{qualities.slice(0, 4).map((t, i) => (
								<span key={i} className="h-2.5 w-2.5 rounded-full ring-2 ring-gray-950" style={{ background: getFingerprintMeta(t.key!).color }} />
							))}
						</span>
						{qualities.length > 0 && <span>{qualities.length} {qualities.length === 1 ? "quality" : "qualities"}</span>}
						{qualities.length > 0 && filters.length > 0 && <span className="text-gray-600">·</span>}
						{filters.length > 0 && <span>{filters.length} {filters.length === 1 ? "filter" : "filters"}</span>}
						<ChevronDownIcon className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
					</button>
				) : (
					<span />
				)}
				<div className="shrink-0">{e.ready}</div>
			</div>
			{has && open && <Readout query={e.query} reading={e.reading} chips={e.chips} onRemove={e.remove} onOpen={e.open} onCustomize={e.customize} easy />}
		</div>
	)
}
