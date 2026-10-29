// The cast as a dense list (photo, name, character; for shows the episodes too), made for huge casts: a server-side
// search over names and characters, tier chips with live counts (Main cast · Recurring · Guest stars for a show, Top
// billed · More cast for a movie), and paging in place: 24 first, and every "Show more" adds 24. The next part is
// fetched ahead, so a press shows it at once. Before the endpoint answers, the page's own first people fill the same
// rows, so the server's HTML has them and nothing jumps. Find can ask for a person: the search takes their name and
// their row is ringed. Two columns on a phone, three on a desktop.
import { useEffect, useRef, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	RINGED,
	useFindRequests,
	useRingPerson,
} from "~/ui/details/find/find-bus"
import { useSectionNear } from "~/ui/details/below-fold"
import { FilterChips, MoreRow, SearchField, fmt } from "~/ui/details/page-ui"
import { PersonRow } from "~/ui/details/people/PersonRow"
import { type PeopleRow, usePeople } from "~/ui/details/people/usePeople"

type Media = MovieResult | ShowResult

/** Rows shown first and added by every "Show more". */
const STEP = 24
/** Rows per request: two steps, so the next step is already in when it is pressed. */
const FETCH = 48

/** `onCrew`: goes to the Crew section, offered when a search finds no one in the cast. */
export function CastSection({
	media,
	onCrew,
}: { media: Media; onCrew?: () => void }) {
	const show = media.mediaType === "show"
	const [q, setQ] = useState("")
	const [group, setGroup] = useState("")
	const [limit, setLimit] = useState(STEP)
	const near = useSectionNear()
	const people = usePeople({
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		kind: "cast",
		q,
		group,
		pageSize: FETCH,
		// The page's own first people fill the rows until then.
		enabled: near,
	})
	const top = useRef<HTMLDivElement>(null)

	// Find asked for someone in the cast: search for them, then ring their row once it is in.
	const ring = useRingPerson(top, people.ready && !people.busy)
	useFindRequests((r) => {
		if (r.type === "person" && r.kind === "cast") {
			setGroup("")
			setQ(r.name)
			ring(r.id)
		} else if (r.type === "cast-search") {
			setGroup("")
			setQ(r.q)
		}
	})

	// A new search or tier starts at the first rows again.
	useEffect(() => setLimit(STEP), [people.q, group])

	const fallback: PeopleRow[] = media.cast.slice(0, STEP).map((c) => ({
		id: c.id,
		name: c.name,
		profilePath: c.profile_path,
		roles: c.characters,
		episodes: null,
		group: "",
	}))
	const filtered = Boolean(people.q || group)
	const rows = people.rows.length || filtered ? people.rows : fallback
	const total = people.total ?? media.cast_total
	const matched = people.matched ?? total
	const visible = rows.slice(0, limit)
	const collapsed = limit === STEP
	const left = matched - Math.min(limit, matched)
	const more = () => {
		const next = limit + STEP
		setLimit(next)
		// Keep a step ahead.
		if (next + STEP > people.rows.length) people.loadMore()
	}
	const fewer = () => {
		setLimit(STEP)
		const box = top.current?.getBoundingClientRect()
		if (box && box.top < 0)
			top.current?.scrollIntoView({ block: "start", behavior: "smooth" })
	}
	const everyone = people.groups.reduce((s, g) => s + g.count, 0)
	const chips = people.groups.length
		? [
				{ key: "", label: "Everyone", count: everyone },
				...people.groups.map((g) => ({
					key: g.key,
					label: g.label,
					count: g.count,
				})),
			]
		: []
	const groupLabel = people.groups.find((g) => g.key === group)?.label

	return (
		<div
			ref={top}
			data-feedback-area="cast"
			className="scroll-mt-44 lg:scroll-mt-32"
		>
			{/* Search and tiers. */}
			<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
				<SearchField
					value={q}
					onChange={(next) => {
						// A new search looks at everyone; a tier can narrow it after.
						if (!q.trim() && next.trim()) setGroup("")
						setQ(next)
					}}
					busy={people.busy && Boolean(q.trim())}
					label="Search the cast"
					placeholder={`Search ${fmt(total)} people or characters`}
					className="sm:w-72"
				/>
				{chips.length > 0 && (
					<FilterChips
						label="Cast tiers"
						chips={chips}
						value={group}
						onChange={setGroup}
					/>
				)}
			</div>

			<p aria-live="polite" className="mt-4 text-xs text-gray-500">
				{people.q && matched === 0
					? `No one in the cast matches “${people.q}”${groupLabel ? ` in ${groupLabel}` : ""}.`
					: `${fmt(Math.min(limit, matched))} of ${fmt(matched)}${people.q ? ` matching “${people.q}”` : ""}${groupLabel ? ` · ${groupLabel}` : ""}${show && !people.q ? " · most episodes first" : ""}`}
			</p>

			<ul
				className={`mt-2 grid grid-cols-2 gap-x-3 transition-opacity duration-150 sm:gap-x-6 lg:grid-cols-3 ${people.busy ? "opacity-60" : ""}`}
			>
				{visible.map((r) => (
					<li key={r.id} className={`min-w-0 ${RINGED}`}>
						<PersonRow row={r} showEpisodes={show} />
					</li>
				))}
			</ul>

			{people.q && matched === 0 && onCrew && (
				<p className="mt-1 text-sm text-gray-400">
					Looking for someone behind the camera?{" "}
					<button
						type="button"
						onClick={onCrew}
						className="cursor-pointer font-semibold text-amber-300/90 hover:text-amber-300"
					>
						See the crew
					</button>
				</p>
			)}

			<div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
				{left > 0 && (
					<MoreRow
						onClick={more}
						busy={people.loadingMore && visible.length < limit}
						className="sm:w-auto sm:px-6"
					>
						<span>Show {fmt(Math.min(STEP, left))} more</span>
						<span className="font-normal text-gray-500">of {fmt(matched)}</span>
					</MoreRow>
				)}
				{!collapsed && (
					<button
						type="button"
						onClick={fewer}
						className="h-11 cursor-pointer px-3 text-sm font-semibold text-gray-400 hover:text-white"
					>
						Show fewer
					</button>
				)}
			</div>
		</div>
	)
}
