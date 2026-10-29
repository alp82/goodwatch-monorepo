// PROTOTYPE (Discover lab, people e): faces in role lanes. A line on top reads "With Zendaya or Pedro Pascal" from the
// picked faces (the filter keeps titles with any of them). Underneath, one lane per role, each a row of round faces
// with names; tap a face to add it. The bar's text fills the lanes; an empty bar shows well-known people.
import { CheckIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { TAP } from "~/ui/filter-bar/motion"
import type { SectionProps } from "../../types"
import { useResultPeople } from "./in-results"
import { PickedOr, byRole, useFeatured } from "./roles"
import { Face, type People, type Person, usePeople } from "./shared"

function FaceButton({ p, people, size }: { p: Person; people: People; size: number }) {
	const on = people.has(p.id)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={() => people.toggle(p)}
			title={p.name}
			className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			style={{ width: size + 28 }}
		>
			<span className="relative">
				<Face
					src={p.profile}
					size={size}
					className={`transition-shadow ${on ? "ring-2 ring-purple-300 ring-offset-2 ring-offset-[#0b1120]" : "group-hover:ring-2 group-hover:ring-white/25"}`}
				/>
				{on && (
					<span className="absolute -right-0.5 -bottom-0.5 grid h-5 w-5 place-items-center rounded-full bg-purple-300 text-gray-950 ring-2 ring-[#0b1120]">
						<CheckIcon className="h-3 w-3" aria-hidden />
					</span>
				)}
			</span>
			<span className={`w-full truncate text-center text-[12px] leading-tight ${on ? "font-semibold text-white" : "text-gray-300"}`}>{p.name}</span>
		</motion.button>
	)
}

function Lane({ title, list, people, phone, waiting, typed }: { title: string; list: Person[]; people: People; phone: boolean; waiting: boolean; typed: string }) {
	const size = phone ? 52 : 56
	return (
		<div className={phone ? "" : "flex min-w-0 items-center gap-5"}>
			<span className={`shrink-0 text-[13px] font-semibold text-gray-400 ${phone ? "mb-2 block" : "w-[96px]"}`}>{title}</span>
			<div
				className={`flex min-w-0 flex-1 gap-2 ${phone ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : "overflow-hidden"} ${people.loading ? "opacity-70 transition-opacity" : ""}`}
				style={{ height: size + 26 }}
			>
				{waiting ? (
					Array.from({ length: 8 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
						<span key={i} className="shrink-0 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none" style={{ width: size, height: size, marginInline: 14 }} />
					))
				) : list.length === 0 ? (
					<span className="self-center text-[13px] text-gray-600">{!typed ? "None in these results" : people.found.length ? "None" : `No one called “${typed}”`}</span>
				) : (
					list.slice(0, 14).map((p) => <FaceButton key={p.id} p={p} people={people} size={size} />)
				)}
			</div>
		</div>
	)
}

export function PeopleE({ d, phone, text }: SectionProps) {
	// Round 9: the running search's text doesn't search names; its results' people show instead of well-known ones.
	const bar = text.trim()
	const name = bar && bar !== d.q ? text : ""
	const people = usePeople(d, name)
	const featured = useFeatured()
	const inResults = useResultPeople(d)
	const base = inResults.active ? byRole([...inResults.actors, ...inResults.behind]) : featured
	const found = byRole(people.found)
	const typed = name.trim()
	const waiting = people.asking ? people.loading && people.found.length === 0 : inResults.active ? inResults.loading : featured.loading
	const lanes: { title: string; list: Person[] }[] = [
		{ title: "Actors", list: people.asking ? found.actors : base.actors },
		{ title: "Directors", list: people.asking ? found.directors : base.directors },
		{
			title: "Writers and crew",
			list: people.asking ? [...found.writers, ...found.crew].sort((a, b) => b.popularity - a.popularity) : [...base.writers, ...base.crew],
		},
	]
	return (
		<div className={phone ? "flex flex-col gap-5" : "flex h-full flex-col gap-3 px-7 py-4"}>
			<div className="flex min-h-11 items-center">
				<PickedOr people={people} lead="With" wrap={phone} />
			</div>
			<div className={phone ? "flex flex-col gap-4" : "flex min-h-0 flex-1 flex-col justify-between border-t border-white/[0.06] pt-3"}>
				{lanes.map((l) => (
					<Lane key={l.title} title={l.title} list={l.list} people={people} phone={phone} waiting={waiting} typed={typed} />
				))}
			</div>
		</div>
	)
}
