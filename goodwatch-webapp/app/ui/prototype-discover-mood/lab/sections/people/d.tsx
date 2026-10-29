// PROTOTYPE (Discover lab, people d): a role switch and one short list. Actors, Directors, Writers, Music and crew,
// each with how many people the bar's text found in that role; the list shows only the chosen role. With a name typed
// the switch starts on the first role that has someone. Picked people sit next to the switch, joined by "or".
import { motion } from "framer-motion"
import { useState } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import type { SectionProps } from "../../types"
import { NameRow, PickedOr, ROLES, type Role, RowsLoading, byRole, useFeatured } from "./roles"
import { useResultPeople } from "./in-results"
import { usePeople } from "./shared"

export function PeopleD({ d, phone, text }: SectionProps) {
	// Round 9: the running search's text doesn't search names; its results' people show instead of well-known ones.
	const bar = text.trim()
	const name = bar && bar !== d.q ? text : ""
	const people = usePeople(d, name)
	const featured = useFeatured()
	const inResults = useResultPeople(d)
	const counted = byRole([...inResults.actors, ...inResults.behind])
	const found = byRole(people.found)
	const typed = name.trim()
	const [pick, setPick] = useState<{ role: Role; text: string } | null>(null)
	const auto: Role = people.asking ? (ROLES.find((r) => found[r.id].length > 0)?.id ?? "actors") : "actors"
	const role = pick && pick.text === people.term ? pick.role : auto
	const list = people.asking ? found[role] : inResults.active ? counted[role] : featured[role]
	const max = phone ? 6 : 20
	const waiting = people.asking ? people.loading && people.found.length === 0 : inResults.active ? inResults.loading : featured.loading

	const tabs = (
		<div role="tablist" aria-label="Role" className={`flex gap-1 rounded-full bg-white/[0.05] p-1 ${phone ? "-mx-1 overflow-x-auto [scrollbar-width:none]" : ""}`}>
			{ROLES.map((r) => {
				const on = r.id === role
				const n = people.asking ? found[r.id].length : inResults.active && !inResults.loading ? counted[r.id].length : null
				return (
					<motion.button
						key={r.id}
						type="button"
						role="tab"
						aria-selected={on}
						whileTap={TAP}
						onClick={() => setPick({ role: r.id, text: people.term })}
						className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							on ? "bg-white/[0.14] font-semibold text-white" : n === 0 ? "text-gray-600 hover:text-gray-400" : "text-gray-300 hover:text-white"
						}`}
					>
						{r.label}
						{n != null && <span className={`tabular-nums ${on ? "text-gray-300" : "text-gray-500"}`}>{n > 99 ? "99+" : n}</span>}
					</motion.button>
				)
			})}
		</div>
	)
	const grid = (
		<div className={`grid gap-x-4 ${phone ? "grid-cols-1" : "grid-cols-4"} ${people.loading ? "opacity-70 transition-opacity" : ""}`}>
			{waiting ? (
				<RowsLoading n={phone ? 4 : 8} />
			) : list.length === 0 ? (
				<span className="flex h-11 items-center pl-1.5 text-[13px] text-gray-600">
					{!people.asking
						? "None in these results"
						: people.found.length === 0
							? `No one called “${typed}”`
							: `No ${ROLES.find((r) => r.id === role)?.label.toLowerCase()} called “${typed}”`}
				</span>
			) : (
				list.slice(0, max).map((p) => (
					<NameRow key={p.id} p={p} people={people} note={"count" in p ? `${(p as { count: number }).count}` : undefined} />
				))
			)}
		</div>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				{tabs}
				{grid}
				{people.chosen.length > 0 && <PickedOr people={people} wrap />}
			</div>
		)
	return (
		<div className="flex h-full flex-col gap-4 px-7 py-5">
			<div className="flex min-w-0 items-center gap-6">
				{tabs}
				<div className="ml-auto min-w-0">
					<PickedOr people={people} lead="With" />
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">{grid}</div>
		</div>
	)
}
