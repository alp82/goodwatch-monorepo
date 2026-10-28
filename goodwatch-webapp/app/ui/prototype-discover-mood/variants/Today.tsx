// PROTOTYPE - throwaway. Variant 0: today's Discover layout (heading search, Read as, filter bar, grid), rebuilt on the
// prototype kit so the other variants compare against the same data.
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterBar, SLAB_CLEARANCE } from "~/ui/filter-bar"
import { ProtoGrid, type ProtoDiscover } from "../kit"

export const NAME = "Today (baseline)"

export function VariantToday({ d }: { d: ProtoDiscover }) {
	return (
		<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
			<DiscoverHeading
				q={d.q}
				onSearch={(text) => d.setQ(text)}
				onClear={() => d.setQ(null)}
				explanation={d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null}
			/>
			<div className="mt-3 lg:mt-4">
				<FilterBar filters={d.filters} counts={d.counts} />
			</div>
			<div className="mt-4">
				<ProtoGrid d={d} />
			</div>
		</div>
	)
}
