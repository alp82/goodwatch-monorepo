// The crew with every job, calm by default:
//   1. Key crew as a short list: Created by · Directed by · Written by · Produced by · Music by.
//   2. Everyone: the departments as chips with counts (Directing 37 · Writing 5 · Camera 17 …) and a server-side
//      search over names and jobs. Picking a department (or typing) lists its people in place, leading jobs first,
//      in pages; nothing is listed before that, so the section stays short.
// The page's four crew lines make the key list (no request); /api/title-people the rest. Find can ask for a person:
// Everyone searches for their name and rings their row.
import { Link } from "@remix-run/react"
import { useRef, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	RINGED,
	useFindRequests,
	useRingPerson,
} from "~/ui/details/find/find-bus"
import { useSectionNear } from "~/ui/details/below-fold"
import {
	CAPTION,
	FilterChips,
	MoreRow,
	Reveal,
	SearchField,
	SubHeading,
	fmt,
} from "~/ui/details/page-ui"
import { PersonRow } from "~/ui/details/people/PersonRow"
import { usePeople } from "~/ui/details/people/usePeople"
import { personPath } from "~/utils/helpers"

type Media = MovieResult | ShowResult

const DEPARTMENT_PAGE = 24

/** The short key list from the page's own crew lines, plus "Created by" for a show (one small request). */
function KeyCrew({ media }: { media: Media }) {
	const show = media.mediaType === "show"
	const near = useSectionNear()
	const creators = usePeople({
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		kind: "crew",
		q: "creator",
		pageSize: 6,
		enabled: show && near,
	})
	const created = creators.ready
		? creators.rows.filter((r) => r.roles.includes("Creator"))
		: []
	const lines = [
		{
			role: "Created by",
			people: created.map((p) => ({ id: p.id, name: p.name })),
		},
		{ role: show ? "Directors" : "Directed by", people: media.crew.directors },
		{ role: "Written by", people: media.crew.writers },
		{ role: "Produced by", people: media.crew.producers },
		{ role: "Music by", people: media.crew.composers },
	].filter((l) => l.people.length > 0)
	if (!lines.length) return null
	return (
		<dl className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
			{lines.map((line) => (
				<div key={line.role} className="min-w-0">
					<dt className={CAPTION}>{line.role}</dt>
					<dd className="mt-0.5 text-[15px] leading-relaxed text-gray-100">
						{line.people.map((p, i) => (
							<span key={p.id}>
								{i > 0 && <span className="text-gray-500">, </span>}
								<Link
									to={personPath(p.id, p.name)}
									prefetch="intent"
									data-person-id={p.id}
									className="font-medium hover:text-amber-300"
								>
									{p.name}
								</Link>
							</span>
						))}
					</dd>
				</div>
			))}
		</dl>
	)
}

const departmentLabel = (key: string, label: string) =>
	key === "Crew" ? "Other crew" : label

/**
 * Everyone behind the camera: a search over names and jobs, and the departments as chips with live counts (they follow
 * the search). Nothing is listed until a department is picked or a search typed; a department's people come in pages,
 * its leading jobs first.
 */
function AllCrew({ media }: { media: Media }) {
	const [q, setQ] = useState("")
	const [group, setGroup] = useState("")
	const searching = q.trim().length > 0
	const listing = searching || Boolean(group)
	const near = useSectionNear()
	const people = usePeople({
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		kind: "crew",
		q,
		group,
		pageSize: listing ? DEPARTMENT_PAGE : 1,
		enabled: near,
	})
	// Find asked for someone behind the camera: search for them, then ring their row once it is in.
	const root = useRef<HTMLElement>(null)
	const ring = useRingPerson(root, people.ready && !people.busy)
	useFindRequests((r) => {
		if (r.type !== "person" || r.kind !== "crew") return
		setGroup("")
		setQ(r.name)
		ring(r.id)
	})
	const total = people.total
	if (people.error && !people.rows.length) return null
	// While searching, departments without a match step back (the one picked stays).
	const chips = people.groups
		.filter((g) => !searching || g.count > 0 || g.key === group)
		.map((g) => ({
			key: g.key,
			label: departmentLabel(g.key, g.label),
			count: g.count,
		}))
	// A new search looks in every department.
	const search = (next: string) => {
		if (!q.trim() && next.trim()) setGroup("")
		setQ(next)
	}
	const matched = people.matched ?? 0
	const label = chips.find((c) => c.key === group)?.label
	const left = matched - people.rows.length
	return (
		<section ref={root} aria-labelledby="crew-all-h">
			<SubHeading
				id="crew-all-h"
				note={total != null ? `${fmt(total)} people` : undefined}
			>
				Everyone
			</SubHeading>
			<SearchField
				value={q}
				onChange={search}
				busy={people.busy && searching}
				label="Search the crew"
				placeholder={
					total
						? `Search ${fmt(total)} crew by name or job`
						: "Search the crew by name or job"
				}
				className="max-w-md"
			/>
			<div className="mt-3 min-h-8">
				{chips.length > 0 ? (
					<FilterChips
						label="Departments"
						chips={chips}
						value={group}
						onChange={(k) => setGroup(k === group ? "" : k)}
					/>
				) : (
					<span className="block h-8 w-2/3 rounded-full bg-white/[0.04]" />
				)}
			</div>
			{listing ? (
				<Reveal key={group} className="mt-4">
					<p aria-live="polite" className="mb-1.5 text-xs text-gray-500">
						{!people.ready && !people.rows.length
							? "Loading…"
							: matched === 0
								? `No one ${label ? `in ${label} ` : "in the crew "}matches “${people.q}”.`
								: `${fmt(matched)} ${searching ? (matched === 1 ? "match" : "matches") : matched === 1 ? "person" : "people"}${label ? ` in ${label}` : ""}${people.q ? ` for “${people.q}”` : ""}`}
					</p>
					<ul
						className={`grid gap-x-6 transition-opacity duration-150 sm:grid-cols-2 lg:grid-cols-3 ${people.busy ? "opacity-60" : ""}`}
					>
						{people.rows.map((r) => (
							<li key={r.id} className={`min-w-0 ${RINGED}`}>
								<PersonRow
									row={r}
									size={32}
									showEpisodes={media.mediaType === "show"}
									strongRoles
									note={group ? undefined : departmentLabel(r.group, r.group)}
								/>
							</li>
						))}
					</ul>
					{people.hasMore && (
						<MoreRow
							onClick={people.loadMore}
							busy={people.loadingMore}
							className="mt-3 sm:w-auto sm:px-6"
						>
							Show {fmt(Math.min(DEPARTMENT_PAGE, left))} more{" "}
							<span className="font-normal text-gray-500">
								of {fmt(matched)}
							</span>
						</MoreRow>
					)}
				</Reveal>
			) : (
				<p className="mt-3 text-xs text-gray-500">
					Pick a department, or search for a name or a job (“editor”, “stunt”).
				</p>
			)}
		</section>
	)
}

/** Key crew, then everyone. */
export function CrewSection({ media }: { media: Media }) {
	return (
		<div data-feedback-area="cast" className="flex flex-col gap-8">
			<KeyCrew media={media} />
			<AllCrew media={media} />
		</div>
	)
}
