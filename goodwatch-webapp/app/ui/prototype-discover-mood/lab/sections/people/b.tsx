// PROTOTYPE (Discover lab, people b): split by role. The bar's text finds people, sorted into two columns, in front of
// the camera and behind it, so a director and an actor with the same name are told apart at a glance. Picked people
// are big faces on the right.
import type { SectionProps } from "../../types"
import { LaneHead } from "../titles/shared"
import { NameExamples, PeopleLoading, type Person, PersonTile, PickedFace, usePeople } from "./shared"

function Column({ title, list, people, phone }: { title: string; list: Person[]; people: ReturnType<typeof usePeople>; phone: boolean }) {
	return (
		<div className="min-w-0">
			<LaneHead right={list.length > 0 ? <span className="text-gray-500">{list.length}</span> : undefined}>{title}</LaneHead>
			<div className={`grid gap-0.5 ${phone ? "grid-cols-1" : "grid-cols-2"} ${people.loading ? "opacity-70 transition-opacity" : ""}`}>
				{list.slice(0, phone ? 4 : 10).map((p) => (
					<PersonTile key={p.id} p={p} on={people.has(p.id)} onToggle={() => people.toggle(p)} size={40} />
				))}
				{list.length === 0 && !people.loading && <span className="px-2 py-2 text-[13px] text-gray-600">None</span>}
				{list.length === 0 && people.loading && <PeopleLoading n={2} size={40} />}
			</div>
		</div>
	)
}

export function PeopleB({ d, phone, text, setText }: SectionProps) {
	const people = usePeople(d, text)
	const typed = text.trim()
	const acting = people.found.filter((p) => p.department === "Acting")
	const behind = people.found.filter((p) => p.department !== "Acting")
	const none = people.asking && !people.loading && people.found.length === 0
	return (
		<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_340px]"}>
			<div className={phone ? "" : "min-h-0 overflow-hidden px-6 py-5"}>
				{!people.asking || none ? (
					<div className="flex flex-col gap-4">
						<LaneHead>Cast and crew</LaneHead>
						{none && <p className="px-1 text-[13px] text-gray-500">No one called “{typed}”</p>}
						<NameExamples onPick={setText} scroll={phone} />
					</div>
				) : (
					<div className={phone ? "flex flex-col gap-6" : "grid grid-cols-2 gap-6"}>
						<Column title="Actors" list={acting} people={people} phone={phone} />
						<div className={phone ? "" : "border-l border-white/[0.06] pl-6"}>
							<Column title="Behind the camera" list={behind} people={people} phone={phone} />
						</div>
					</div>
				)}
			</div>
			{(!phone || people.chosen.length > 0) && (
				<div className={phone ? "" : "min-h-0 overflow-y-auto border-l border-white/[0.06] px-5 py-5"}>
					<LaneHead right={people.chosen.length > 1 ? <span className="text-gray-500">Any of these</span> : undefined}>Picked people</LaneHead>
					<div className="flex flex-wrap gap-3">
						{people.chosen.map((id) => (
							<PickedFace key={id} id={id} big p={people.known(id)} onRemove={() => people.remove(id)} />
						))}
						{people.chosen.length === 0 && <span className="h-16 w-16 rounded-full border border-dashed border-white/[0.12]" />}
					</div>
				</div>
			)}
		</div>
	)
}
