// PROTOTYPE (Discover lab, people a): the people search follows the bar. Whatever is typed there lists matching people
// as faces right away (the sheet's Cast and crew search, no second field). Picked people stay on the right as
// removable face chips.
import type { SectionProps } from "../../types"
import { LaneHead } from "../titles/shared"
import { NameExamples, PeopleLoading, PersonTile, PickedFace, usePeople } from "./shared"

export function PeopleA({ d, phone, text, setText }: SectionProps) {
	const people = usePeople(d, text)
	const typed = text.trim()
	const shown = people.found.slice(0, phone ? 8 : 16)
	return (
		<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_300px]"}>
			<div className={phone ? "" : "min-h-0 overflow-hidden px-6 py-5"}>
				<LaneHead right={people.asking && people.found.length > 0 ? <span className="text-gray-500">{people.found.length > 16 ? "16+" : people.found.length}</span> : undefined}>
					{people.asking ? `People called “${typed}”` : "Cast and crew"}
				</LaneHead>
				{!people.asking ? (
					<NameExamples onPick={setText} scroll={phone} />
				) : shown.length > 0 ? (
					<div className={`grid gap-1 ${phone ? "grid-cols-1" : "grid-cols-4"} ${people.loading ? "opacity-70 transition-opacity" : ""}`}>
						{shown.map((p) => (
							<PersonTile key={p.id} p={p} on={people.has(p.id)} onToggle={() => people.toggle(p)} />
						))}
					</div>
				) : people.loading ? (
					<div className={`grid gap-1 ${phone ? "grid-cols-1" : "grid-cols-4"}`}>
						<PeopleLoading n={phone ? 4 : 8} />
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<p className="px-1 text-[13px] text-gray-500">No one called “{typed}”</p>
						<NameExamples onPick={setText} scroll={phone} />
					</div>
				)}
			</div>
			{(!phone || people.chosen.length > 0) && (
				<div className={phone ? "" : "min-h-0 overflow-y-auto border-l border-white/[0.06] px-5 py-5"}>
					<LaneHead right={people.chosen.length > 1 ? <span className="text-gray-500">Any of these</span> : undefined}>Picked people</LaneHead>
					<div className={`flex gap-2 ${phone ? "flex-wrap" : "flex-col items-start"}`}>
						{people.chosen.map((id) => (
							<PickedFace key={id} id={id} p={people.known(id)} onRemove={() => people.remove(id)} />
						))}
						{people.chosen.length === 0 && <span className="h-9 w-40 rounded-full border border-dashed border-white/[0.12]" />}
					</div>
				</div>
			)}
		</div>
	)
}
