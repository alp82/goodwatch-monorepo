// PROTOTYPE (Discover lab, people c): two calm columns. In front of the camera on the left, behind it on the right,
// only small faces and names, one tap adds. Round 9: its own field finds anyone without touching the search; the bar's
// text still finds people while it's typed but not run. While a search runs, the columns show who is in its results
// (in-results.ts), most titles first; with no search, well-known people. Picked people sit at the top right, "or".
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import { PRIVATE } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { LaneHead } from "../titles/shared"
import { type CountedPerson, useResultPeople } from "./in-results"
import { NameRow, PickedOr, RowsLoading, byRole, roleFor, useFeatured } from "./roles"
import { type Person, roleOf, usePeople } from "./shared"

/** Round 22: the header search's "In Cast and crew" hands its text to Find a person once (read on mount). */
let seed = ""
export const seedFindPerson = (text: string) => {
	seed = text
}

const titles = (n: number) => `${n} ${n === 1 ? "title" : "titles"}`

export function PeopleC({ d, phone, text }: SectionProps) {
	const [own, setOwn] = useState(seed)
	useEffect(() => {
		seed = ""
	}, [])
	const bar = text.trim()
	// The field wins; else the bar's text while it isn't the running search.
	const name = own.trim() ? own : bar && bar !== d.q ? text : ""
	const people = usePeople(d, name)
	const max = phone ? 5 : 10
	const inResults = useResultPeople(d)
	const featured = useFeatured()
	const found = byRole(people.found)
	const mode: "found" | "results" | "featured" = people.asking ? "found" : inResults.active ? "results" : "featured"

	const front: Person[] =
		mode === "found" ? found.actors : mode === "results" ? inResults.actors : featured.actors
	const behind: Person[] =
		mode === "found"
			? [...found.directors, ...found.writers, ...found.crew].sort((a, b) => b.popularity - a.popularity)
			: mode === "results"
				? inResults.behind
				: [...featured.directors.slice(0, 4), ...featured.writers.slice(0, 4), ...featured.crew.slice(0, 2)]
	const waiting =
		mode === "found" ? people.loading && people.found.length === 0 : mode === "results" ? inResults.loading : featured.loading

	const note = (p: Person, behindCam: boolean): string | undefined => {
		if (mode === "results") {
			const c = (p as CountedPerson).count
			return behindCam ? `${roleLabel(p)} · ${c}` : titles(c)
		}
		if (!behindCam) return undefined
		return roleOf(mode === "found" ? p.department : roleDept(p, featured))
	}
	const none =
		mode === "results"
			? inResults.failed
				? "No counts right now"
				: "None in these results"
			: people.found.length
				? "None"
				: `No one called “${name.trim()}”`

	const column = (title: string, list: Person[], behindCam: boolean) => (
		<div className="min-w-0">
			<LaneHead right={mode === "found" && list.length > 0 ? <span className="text-gray-500">{list.length > max ? `${max}+` : list.length}</span> : undefined}>
				{title}
			</LaneHead>
			<div className={`grid gap-x-4 ${phone ? "grid-cols-1" : "grid-cols-2"} ${people.loading ? "opacity-70 transition-opacity" : ""}`}>
				{waiting ? (
					<RowsLoading n={phone ? 3 : 6} />
				) : list.length === 0 ? (
					<span className="flex h-11 items-center pl-1.5 text-[13px] text-gray-600">{none}</span>
				) : (
					list.slice(0, max).map((p) => <NameRow key={p.id} p={p} people={people} note={note(p, behindCam)} />)
				)}
			</div>
		</div>
	)

	const field = (
		<label className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl bg-white/[0.05] pr-1.5 pl-3 ring-1 ring-white/[0.06] focus-within:ring-amber-500/60">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
			<input
				type="search"
				value={own}
				onChange={(e) => setOwn(e.target.value)}
				placeholder="Find a person"
				aria-label="Find a person"
				className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
			/>
			{own && (
				<button
					type="button"
					onClick={() => setOwn("")}
					aria-label="Clear"
					className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
				</button>
			)}
		</label>
	)
	// What the columns are: the running search's results, a name, or well-known people.
	const scope =
		mode === "results" && d.q ? (
			<span className="flex min-w-0 items-center gap-1.5 text-[13px] text-gray-500">
				<span className="shrink-0">In</span>
				<span className={`truncate font-semibold text-gray-300 ${PRIVATE}`}>{d.q}</span>
			</span>
		) : null

	if (phone)
		return (
			<div className="flex flex-col gap-5">
				{field}
				{scope}
				<PickedOr people={people} wrap />
				{column("Actors", front, false)}
				{column("Behind the camera", behind, true)}
			</div>
		)
	return (
		<div className="flex h-full flex-col px-7 py-5">
			<div className="mb-4 flex h-10 shrink-0 items-center gap-5">
				<div className="w-[300px] shrink-0">{field}</div>
				<div className="min-w-0 flex-1">{scope}</div>
				<div className="min-w-0 shrink">
					<PickedOr people={people} lead="With" />
				</div>
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-2 gap-10">
				{column("Actors", front, false)}
				<div className="min-w-0 border-l border-white/[0.06] pl-10">{column("Behind the camera", behind, true)}</div>
			</div>
		</div>
	)
}

/** A counted person's role, ours: Director, Writer, or the crew department (Music, Camera, …). */
function roleLabel(p: Person): string {
	const r = (p as CountedPerson).role
	return r === "directors" ? "Director" : r === "writers" ? "Writer" : roleOf(p.department)
}

/** Featured people carry our role, not TMDB's (Greta Gerwig is listed as an actor). */
function roleDept(p: Person, featured: ReturnType<typeof useFeatured>): string {
	if (featured.directors.some((x) => x.id === p.id)) return "Directing"
	if (featured.writers.some((x) => x.id === p.id)) return "Writing"
	return roleFor(p.department) === "actors" ? "Crew" : p.department
}
