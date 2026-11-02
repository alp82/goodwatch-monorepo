// PROTOTYPE (discover-easy) E "Strip": one fixed-height line beside Ready, under the search, in both modes, that never wraps:
// fingerprint, then filters, scrolling sideways when long.
import { FilterList, FingerprintList, LockedUnseen, qualitiesOf } from "./reading"
import { type EmptyAfterType, EmptyReading, type EmptyKind, TypeSwitch } from "./Empty"
import type { Easy } from "./types"

export const name = "Strip"

export function EasyE({ e, empty = "summary", after }: { e: Easy; empty?: EmptyKind; after?: EmptyAfterType }) {
	const locked = !e.member && e.filters.state.onMyServices
	const typeLead = empty === "type"
	const has = qualitiesOf(e.reading).length > 0 || e.chips.some((c) => c.kind !== "query" && !(typeLead && c.group === "type"))
	if (!has)
		return (
			<div className="flex h-8 min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]">
				{typeLead ? (
					<>
						<TypeSwitch e={e} />
						{after ? (
							<>
								<span className="h-4 w-px shrink-0 bg-white/10" />
								<EmptyReading e={e} kind={after} />
							</>
						) : (
							<span className="text-[13px] text-gray-500">Search a mood above, or add a filter.</span>
						)}
					</>
				) : (
					<EmptyReading e={e} kind={empty} />
				)}
			</div>
		)
	return (
		<div
			className="flex h-8 min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]"
			style={{ maskImage: "linear-gradient(to right, black 94%, transparent)" }}
		>
			{typeLead && <TypeSwitch e={e} />}
			<FingerprintList reading={e.reading} className="shrink-0 flex-nowrap!" />
			{qualitiesOf(e.reading).length > 0 && <span className="h-4 w-px shrink-0 bg-white/10" />}
			<FilterList
				chips={typeLead ? e.chips.filter((c) => c.group !== "type") : e.chips}
				onOpen={e.open}
				onRemove={e.remove}
				className="shrink-0 flex-nowrap!"
			/>
			{locked && <LockedUnseen />}
			<button type="button" onClick={e.customize} className="shrink-0 cursor-pointer pr-8 text-[12px] font-semibold text-amber-400 hover:text-amber-300">
				More filters
			</button>
		</div>
	)
}
