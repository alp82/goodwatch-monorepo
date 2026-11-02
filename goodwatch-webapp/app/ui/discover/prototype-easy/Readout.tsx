// PROTOTYPE (discover-easy): the card under the shared search in Advanced: the fingerprint qualities the ranking
// favors or ranks lower, and every filter (press to change it, × to remove), in the start page's style.
import { PlusIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { BarChip } from "~/ui/discover-bar/chips"
import { FilterList, FingerprintList, Label, qualitiesOf } from "./reading"

export function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-1 items-baseline gap-1 lg:grid-cols-[96px_1fr] lg:gap-3">
			<Label>{label}</Label>
			<div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
		</div>
	)
}

export function Readout({
	query,
	reading,
	chips,
	onRemove,
	onOpen,
	onCustomize,
	easy = false,
}: {
	query: string | null
	reading: ReadingChip[] | undefined
	chips: readonly BarChip[]
	onRemove: (chip: BarChip) => void
	onOpen: (chip: BarChip) => void
	onCustomize: () => void
	easy?: boolean
}) {
	const filters = chips.filter((c) => c.kind !== "query")
	const qualities = qualitiesOf(reading)
	if (query === null && !filters.length) return null
	return (
		<div className="mt-3 grid gap-2.5 rounded-[22px] bg-white/[0.025] px-4 py-3.5 ring-1 ring-white/[0.07] lg:px-6">
			{query !== null && (
				<Row label="Fingerprint">
					{qualities.length ? (
						<FingerprintList reading={reading} />
					) : (
						<span className="text-[12px] text-gray-500">{reading ? "No strong qualities in these words" : "Reading…"}</span>
					)}
				</Row>
			)}
			<Row label="Filters">
				<FilterList chips={chips} onOpen={onOpen} onRemove={onRemove} />
				<button
					type="button"
					onClick={onCustomize}
					className="inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
				>
					<PlusIcon className="h-3.5 w-3.5" />
					{easy ? "More filters" : "Add filter"}
				</button>
			</Row>
		</div>
	)
}
