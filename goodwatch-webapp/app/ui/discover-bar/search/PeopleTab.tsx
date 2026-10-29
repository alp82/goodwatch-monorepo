// Search > Cast and crew: "Find a person", then two columns, Actors and Behind the camera.
//
// - Found: people named like the field's text (its own text wins; otherwise the bar's text while it isn't the running
//   search), behind the camera by popularity.
// - In these results: while a search or filters run, who is in their results, most titles first ("12 titles",
//   "Director · 20").
// - Featured: nothing searched or filtered: well-known people.
// Picks show as face chips joined by "or": the people filter keeps titles with any of them.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import { usePeopleNames } from "~/ui/filter-bar/useFilterData"
import { PRIVATE } from "../DiscoverBar"
import type { SubTabView } from "../DiscoverControls"
import {
	GroupHead,
	MoreLine,
	type PersonItem,
	PersonRow,
	PickedPeople,
	RowsLoading,
} from "./rows"
import { moreCount, moreRows, roleOf, togglePerson } from "./search-tab"
import { usePanelPeople, usePeopleSearch } from "./useSearchData"

export function PeopleTab({ view }: { view: SubTabView }) {
	const { phone, text, filters, page, query } = view
	const [own, setOwn] = useState("")
	const bar = text.trim()
	const name = own.trim() ? own : bar && bar !== query ? text : ""
	const search = usePeopleSearch(name)
	const panel = usePanelPeople(filters, page, query !== null, !search.asking)
	const mode = search.asking ? "found" : panel.mode
	const chosen = filters.state.people ?? []
	const names = usePeopleNames(chosen, "")
	// What a pick told us, so its face shows at once.
	const [seen, setSeen] = useState(() => new Map<number, PersonItem>())
	const toggle = (p: PersonItem) => {
		setSeen((m) => (m.has(p.id) ? m : new Map(m).set(p.id, p)))
		filters.update((s) => togglePerson(s, p.id))
	}
	const known = (id: number) => seen.get(id) ?? names.byId.get(id)

	const base = phone ? 5 : 10
	const [shown, setShown] = useState({ front: base, behind: base })
	useEffect(() => setShown({ front: base, behind: base }), [name, mode, base])

	const actors: PersonItem[] =
		mode === "found"
			? search.found
					.filter((p) => p.department === "Acting")
					.map((p) => ({ id: p.id, name: p.name, profile: p.profile }))
			: panel.actors.map((p) => ({
					id: p.id,
					name: p.name,
					profile: p.profile,
					note: mode === "results" ? p.note : undefined,
				}))
	const behind: PersonItem[] =
		mode === "found"
			? search.found
					.filter((p) => p.department !== "Acting")
					.sort((a, b) => b.popularity - a.popularity)
					.map((p) => ({
						id: p.id,
						name: p.name,
						profile: p.profile,
						note: roleOf(p.department),
					}))
			: panel.crew.map((p) => ({
					id: p.id,
					name: p.name,
					profile: p.profile,
					note: p.note,
				}))
	const waiting =
		mode === "found"
			? search.loading && search.found.length === 0
			: panel.loading
	const none =
		mode === "found"
			? search.found.length
				? "None"
				: `No one called “${name.trim()}”`
			: "None in these results"
	// The server couldn't read them: nothing rather than an empty message.
	const hidden = mode !== "found" && panel.unavailable

	const column = (
		title: string,
		list: PersonItem[],
		side: "front" | "behind",
	) =>
		// Featured people are a pick, not a count: an empty side shows nothing.
		mode === "featured" && !waiting && list.length === 0 ? null : (
			<div className="min-w-0">
				<GroupHead first>{title}</GroupHead>
				<div
					className={`mt-2 grid gap-x-4 ${phone ? "grid-cols-1" : "grid-cols-2"} ${search.loading ? "opacity-70 transition-opacity" : ""}`}
				>
					{waiting ? (
						<RowsLoading n={phone ? 3 : 6} />
					) : list.length === 0 ? (
						<span className="flex h-11 items-center pl-3 text-[13px] text-gray-600">
							{none}
						</span>
					) : (
						list
							.slice(0, shown[side])
							.map((p) => (
								<PersonRow
									key={p.id}
									p={p}
									on={chosen.includes(p.id)}
									onToggle={() => toggle(p)}
								/>
							))
					)}
				</div>
				{!waiting && (
					<MoreLine
						label="More people"
						count={moreCount(
							Math.min(shown[side], list.length),
							list.length,
							mode === "found" && search.full,
						)}
						onMore={() =>
							setShown((s) => ({ ...s, [side]: moreRows(s[side]) }))
						}
					/>
				)}
			</div>
		)

	const field = (
		<label className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl bg-white/[0.05] pr-1.5 pl-3 ring-1 ring-white/[0.06] focus-within:ring-amber-500/60">
			<MagnifyingGlassIcon
				className="h-4 w-4 shrink-0 text-gray-500"
				aria-hidden
			/>
			<input
				type="search"
				value={own}
				onChange={(event) => setOwn(event.target.value)}
				placeholder="Find a person"
				aria-label="Find a person"
				autoComplete="off"
				className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
			/>
			{own && (
				<button
					type="button"
					onClick={() => setOwn("")}
					aria-label="Clear"
					className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-gray-400 outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
				</button>
			)}
		</label>
	)
	// The running search the columns count, when they count one.
	const scope =
		mode === "results" && query ? (
			<span className="flex min-w-0 items-center gap-1.5 text-[13px] text-gray-500">
				<span className="shrink-0">In</span>
				<span className={`truncate font-semibold text-gray-300 ${PRIVATE}`}>
					{query}
				</span>
			</span>
		) : null
	const picked = (wrap: boolean) => (
		<PickedPeople
			ids={chosen}
			known={known}
			onRemove={(id) => filters.update((s) => togglePerson(s, id))}
			lead="With"
			wrap={wrap}
		/>
	)
	const front = hidden ? null : column("Actors", actors, "front")
	const back = hidden ? null : column("Behind the camera", behind, "behind")

	if (phone)
		return (
			<div className="flex flex-col gap-5">
				{field}
				{scope}
				{picked(true)}
				{front}
				{back}
			</div>
		)
	return (
		<div className="flex flex-col px-7 py-5">
			<div className="mb-4 flex h-10 shrink-0 items-center gap-5">
				<div className="w-[300px] shrink-0">{field}</div>
				<div className="min-w-0 flex-1">{scope}</div>
				<div className="min-w-0 shrink">{picked(false)}</div>
			</div>
			{!hidden && (
				<div className="grid grid-cols-2 gap-10">
					{front}
					<div className="min-w-0 border-l border-white/[0.06] pl-10">
						{back}
					</div>
				</div>
			)}
		</div>
	)
}
