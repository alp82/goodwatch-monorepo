// The cast as a dense list, made for huge casts. Each row shows the actor's photo and, when TheTVDB has one, their
// character's portrait beside it at the same size (a lone actor photo sits centered in the two-picture width, so the
// names line up), then the name, the character and for shows the episodes. A row is a link to the person page; a
// plain click opens the character quick view instead (ui/character-quick-view), with the rows on screen as its steps.
// The controls: a server-side search over names and characters and the tiers as tabs with live counts (Main cast ·
// Recurring · Guest stars for a show, Top billed · More cast for a movie), a status line only while searching, an
// empty state with ways out, and paging in place: 24 first, and every "Show more" adds 24. The next part is fetched
// ahead, so a press shows it at once. Before the endpoint answers, the page's own first people fill the same rows, so
// the server's HTML has them and nothing jumps. Find can ask for a person: the search takes their name and their row is
// ringed. The title page's opened Starring row and the At a glance sub-page draw this same list.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	type CharacterEntry,
	CharacterLink,
} from "~/ui/character-quick-view/context"
import { TvdbCredit } from "~/ui/character-quick-view/parts"
import { useTitlePortraits } from "~/ui/character-quick-view/portraits"
import { SegmentedTabs } from "~/ui/details/SegmentedTabs"
import { useSectionNear } from "~/ui/details/below-fold"
import {
	RINGED,
	useFindRequests,
	useRingPerson,
} from "~/ui/details/find/find-bus"
import { MoreRow, SearchField, fmt } from "~/ui/details/page-ui"
import {
	ActorImage,
	type CastCharacter,
	CharacterImage,
	castCharacter,
	pageCastRows,
} from "~/ui/details/people/cast-characters"
import { episodesWords, usePeople } from "~/ui/details/people/usePeople"
import { personPath } from "~/utils/helpers"

type Media = MovieResult | ShowResult

/** Rows shown first and added by every "Show more". */
export const CAST_STEP = 24
const STEP = CAST_STEP
/** Rows per request: two steps, so the next step is already in when it is pressed. */
export const CAST_PAGE_SIZE = 48

/** The 44×66 thumb, for the actor and the character alike. */
const THUMB =
	"relative h-[66px] w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10"
const ROW =
	"group -mx-1.5 flex w-[calc(100%+0.75rem)] min-w-0 items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-white/[0.05] active:bg-white/[0.08]"

/** `onCrew`: goes to the Crew section, offered when a search finds no one in the cast. */
export function CastSection({
	media,
	onCrew,
}: { media: Media; onCrew?: () => void }) {
	const near = useSectionNear()
	const list = useCastList(media, near)
	const portraits = useTitlePortraits(
		media.mediaType,
		media.details.tmdb_id,
		near,
	)
	const people = list.visible.map((r) =>
		castCharacter(media, r, portraits, "cast"),
	)
	const siblings = people
		.map((p) => p.entry)
		.filter((e): e is CharacterEntry => e !== null)
	const show = media.mediaType === "show"
	return (
		<div
			ref={list.top}
			data-feedback-area="cast"
			className="scroll-mt-44 lg:scroll-mt-32"
		>
			<Toolbar list={list} />
			<Status list={list} />
			<Empty list={list} onCrew={onCrew} />
			<ul
				className={`mt-4 grid grid-cols-1 gap-x-4 gap-y-1 transition-opacity duration-150 min-[480px]:grid-cols-2 lg:grid-cols-3 ${list.people.busy ? "opacity-60" : ""}`}
			>
				{people.map((p) => (
					<li key={p.row.id} className={`min-w-0 ${RINGED}`}>
						<CastRow p={p} siblings={siblings} show={show} />
					</li>
				))}
			</ul>
			<Paging list={list} />
			{people.some((p) => p.portrait) && <TvdbCredit className="mt-4" />}
		</div>
	)
}

function CastRow({
	p,
	siblings,
	show,
}: { p: CastCharacter; siblings: CharacterEntry[]; show: boolean }) {
	return (
		<CharacterLink
			entry={p.entry}
			siblings={siblings}
			href={personPath(p.row.id, p.row.name)}
			personId={p.row.id}
			label={p.label}
			className={ROW}
		>
			{/* Two pictures wide for everyone, so the names line up; without a portrait the actor is centered in both. */}
			<span className="flex w-[94px] shrink-0 justify-center gap-1.5">
				<span className={THUMB}>
					<ActorImage p={p} width={44} />
				</span>
				{p.portrait && (
					<span className={THUMB}>
						<CharacterImage p={p} />
					</span>
				)}
			</span>
			<span className="min-w-0 flex-1 leading-tight">
				<span className="block truncate text-sm font-medium text-gray-100 group-hover:text-amber-300">
					{p.row.name}
				</span>
				{p.character && (
					<span className="mt-0.5 block truncate text-[13px] text-gray-400">
						{p.character}
					</span>
				)}
				{show && p.row.episodes ? (
					<span className="mt-1 block text-xs tabular-nums text-gray-500">
						{episodesWords(p.row.episodes)}
					</span>
				) : null}
			</span>
		</CharacterLink>
	)
}

// --- the list's state (search, tier, paging, Find) ----------------------------------------------------------------

function useCastList(media: Media, enabled: boolean) {
	const [q, setQ] = useState("")
	const [group, setGroup] = useState("")
	const [limit, setLimit] = useState(STEP)
	const people = usePeople({
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		kind: "cast",
		q,
		group,
		pageSize: CAST_PAGE_SIZE,
		// The page's own first people fill the rows until then.
		enabled,
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

	const filtered = Boolean(people.q || group)
	const rows =
		people.rows.length || filtered ? people.rows : pageCastRows(media, STEP)
	const total = people.total ?? media.cast_total
	const matched = people.matched ?? total
	const everyone = people.groups.reduce((s, g) => s + g.count, 0)
	const tabs = people.groups.length
		? [
				{ key: "", label: "Everyone", count: everyone || total },
				...people.groups.map((g) => ({
					key: g.key,
					label: g.label,
					count: g.count,
				})),
			]
		: []
	return {
		q,
		setQ: (next: string) => {
			// A new search looks at everyone; a tier can narrow it after.
			if (!q.trim() && next.trim()) setGroup("")
			setQ(next)
		},
		group,
		setGroup,
		limit,
		people,
		visible: rows.slice(0, limit),
		total,
		matched,
		tabs,
		groupLabel: people.groups.find((g) => g.key === group)?.label,
		top,
		more: () => {
			const next = limit + STEP
			setLimit(next)
			// Keep a step ahead.
			if (next + STEP > people.rows.length) people.loadMore()
		},
		fewer: () => {
			setLimit(STEP)
			const box = top.current?.getBoundingClientRect()
			if (box && box.top < 0)
				top.current?.scrollIntoView({ block: "start", behavior: "smooth" })
		},
	}
}
type CastList = ReturnType<typeof useCastList>

// --- the controls -------------------------------------------------------------------------------------------------

/** Search and tiers on one line (stacked on a phone, the tiers scrolling sideways). */
function Toolbar({ list }: { list: CastList }) {
	return (
		<div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
			<SearchField
				value={list.q}
				onChange={list.setQ}
				busy={list.people.busy && Boolean(list.q.trim())}
				label="Search the cast"
				placeholder={`Search ${fmt(list.total)} people`}
				className="sm:w-64 sm:shrink-0"
			/>
			{list.tabs.length > 0 && (
				<SegmentedTabs
					label="Cast tiers"
					tabs={list.tabs}
					value={list.group}
					onChange={list.setGroup}
				/>
			)}
		</div>
	)
}

/** Only while searching: how many match. Screen readers hear it either way. */
function Status({ list }: { list: CastList }) {
	const searching = Boolean(list.people.q)
	return (
		<p
			aria-live="polite"
			className={searching ? "mt-3 text-[13px] text-gray-400" : "sr-only"}
		>
			{searching
				? `${fmt(list.matched)} ${list.matched === 1 ? "match" : "matches"} for “${list.people.q}”${list.groupLabel ? ` in ${list.groupLabel}` : ""}`
				: `${fmt(list.matched)} people${list.groupLabel ? ` in ${list.groupLabel}` : ""}`}
		</p>
	)
}

const WAY_OUT =
	"h-8 cursor-pointer rounded-lg px-3 text-[13px] font-semibold text-gray-200 ring-1 ring-white/15 hover:bg-white/[0.06]"

/** No one matches: say so, and offer the ways out. */
function Empty({ list, onCrew }: { list: CastList; onCrew?: () => void }) {
	if (!list.people.q || list.matched !== 0 || list.people.busy) return null
	return (
		<div className="mt-4 flex flex-col items-start gap-3 rounded-xl bg-white/[0.03] px-4 py-4 ring-1 ring-white/[0.06] sm:flex-row sm:items-center">
			<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-600" />
			<p className="min-w-0 flex-1 text-sm text-gray-300">
				No one in the cast is called “{list.people.q}”
				{list.groupLabel ? ` in ${list.groupLabel}` : ""}.
			</p>
			<div className="flex gap-2">
				{list.group && (
					<WayOut onClick={() => list.setGroup("")}>Search everyone</WayOut>
				)}
				{onCrew && <WayOut onClick={onCrew}>Search the crew</WayOut>}
				<button
					type="button"
					onClick={() => list.setQ("")}
					className="h-8 cursor-pointer rounded-lg bg-white/[0.08] px-3 text-[13px] font-semibold text-white hover:bg-white/[0.12]"
				>
					Clear search
				</button>
			</div>
		</div>
	)
}

function WayOut({
	onClick,
	children,
}: { onClick: () => void; children: ReactNode }) {
	return (
		<button type="button" onClick={onClick} className={WAY_OUT}>
			{children}
		</button>
	)
}

/** "Show 24 more · 324 left", and Show fewer once opened further. */
function Paging({ list }: { list: CastList }) {
	const shown = Math.min(list.limit, list.matched)
	const left = list.matched - shown
	if (left <= 0 && list.limit === STEP) return null
	return (
		<div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
			{left > 0 && (
				<MoreRow
					onClick={list.more}
					busy={list.people.loadingMore && list.visible.length < list.limit}
					className="sm:w-auto sm:px-6"
				>
					<span>Show {fmt(Math.min(STEP, left))} more</span>
					<span className="font-normal text-gray-500">· {fmt(left)} left</span>
				</MoreRow>
			)}
			{list.limit > STEP && (
				<button
					type="button"
					onClick={list.fewer}
					className="h-11 cursor-pointer px-3 text-sm font-semibold text-gray-400 hover:text-white"
				>
					Show fewer
				</button>
			)}
		</div>
	)
}
