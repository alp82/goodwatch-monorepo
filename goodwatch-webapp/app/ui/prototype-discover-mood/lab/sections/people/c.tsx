// PROTOTYPE (Discover lab, people c): two calm columns. In front of the camera on the left, behind it on the right,
// only small faces and names, one tap adds. The bar's text finds people; an empty bar shows well-known ones. Picked
// people sit in one line at the bottom, joined by "or".
import type { SectionProps } from "../../types"
import { LaneHead } from "../titles/shared"
import { NameRow, PickedOr, RowsLoading, byRole, roleFor, useFeatured } from "./roles"
import { type Person, roleOf, usePeople } from "./shared"

export function PeopleC({ d, phone, text }: SectionProps) {
	const people = usePeople(d, text)
	const featured = useFeatured()
	const found = byRole(people.found)
	const typed = text.trim()
	const max = phone ? 5 : 10
	const front: Person[] = people.asking ? found.actors : featured.actors
	const behind: Person[] = people.asking
		? [...found.directors, ...found.writers, ...found.crew].sort((a, b) => b.popularity - a.popularity)
		: [...featured.directors.slice(0, 4), ...featured.writers.slice(0, 4), ...featured.crew.slice(0, 2)]
	const waiting = people.asking ? people.loading && people.found.length === 0 : featured.loading

	const column = (title: string, list: Person[], notes: boolean) => (
		<div className="min-w-0">
			<LaneHead right={people.asking && list.length > 0 ? <span className="text-gray-500">{list.length > max ? `${max}+` : list.length}</span> : undefined}>
				{title}
			</LaneHead>
			<div className={`grid gap-x-4 ${phone ? "grid-cols-1" : "grid-cols-2"} ${people.loading ? "opacity-70 transition-opacity" : ""}`}>
				{waiting ? (
					<RowsLoading n={phone ? 3 : 6} />
				) : list.length === 0 ? (
					<span className="flex h-11 items-center pl-1.5 text-[13px] text-gray-600">{people.found.length ? "None" : `No one called “${typed}”`}</span>
				) : (
					list
						.slice(0, max)
						.map((p) => <NameRow key={p.id} p={p} people={people} note={notes ? roleOf(people.asking ? p.department : roleDept(p, featured)) : undefined} />)
				)}
			</div>
		</div>
	)

	if (phone)
		return (
			<div className="flex flex-col gap-6">
				{people.chosen.length > 0 && <PickedOr people={people} wrap />}
				{column("Actors", front, false)}
				{column("Behind the camera", behind, true)}
			</div>
		)
	return (
		<div className="flex h-full flex-col px-7 py-5">
			<div className="grid min-h-0 flex-1 grid-cols-2 gap-10">
				{column("Actors", front, false)}
				<div className="min-w-0 border-l border-white/[0.06] pl-10">{column("Behind the camera", behind, true)}</div>
			</div>
			<div className="flex h-12 shrink-0 items-center border-t border-white/[0.06] pt-3">
				<PickedOr people={people} lead="With" />
			</div>
		</div>
	)
}

/** Featured people carry our role, not TMDB's (Greta Gerwig is listed as an actor). */
function roleDept(p: Person, featured: ReturnType<typeof useFeatured>): string {
	if (featured.directors.some((x) => x.id === p.id)) return "Directing"
	if (featured.writers.some((x) => x.id === p.id)) return "Writing"
	return roleFor(p.department) === "actors" ? "Crew" : p.department
}
