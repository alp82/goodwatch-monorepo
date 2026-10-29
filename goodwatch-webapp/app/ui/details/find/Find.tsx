// Find in title: the page's own index (find-index.ts) plus anyone in the cast or crew from the server, a one-episode
// guest of Grey's Anatomy or a storyboard artist too.
//
// useFindItems({ media, query, index, sections, onHit, onPerson, onCastSearch }) → { items, busy }
// <FindField …/> the field (↑ ↓ Enter Esc); <FindResults …/> the grouped list, with "Clear search" when empty.
import {
	MagnifyingGlassIcon,
	UserIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline"
import { type ComponentType, Fragment, type RefObject } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	type FindEntry,
	type FindHit,
	findIn,
} from "~/ui/details/find/find-index"
import { CAPTION, Kbd, fmt, initials } from "~/ui/details/page-ui"
import {
	type PeopleRow,
	episodesWords,
	usePeople,
} from "~/ui/details/people/usePeople"

type Media = MovieResult | ShowResult

export interface FindItem {
	key: string
	/** The group heading it sits under. */
	group: string
	icon: ComponentType<{ className?: string }>
	title: string
	context: string
	/** Where the query sits in the title, for the amber part. */
	at: [number, number] | null
	/** A person's photo path; `null` shows initials; undefined shows the icon. */
	photo?: string | null
	pick: () => void
}

const TIER: Record<string, string> = {
	main: "Main cast",
	recurring: "Recurring",
	guest: "Guest star",
	top: "Top billed",
	more: "More cast",
}

const matchAt = (text: string, query: string): [number, number] | null => {
	const q = query.trim().toLowerCase()
	const i = text.toLowerCase().indexOf(q)
	return q && i >= 0 ? [i, i + q.length] : null
}

export function useFindItems({
	media,
	query,
	index,
	sections,
	onHit,
	onPerson,
	onCastSearch,
}: {
	media: Media
	query: string
	index: FindEntry[]
	/** The page's sections: a hit's group heading and icon. */
	sections: {
		id: string
		label: string
		icon: ComponentType<{ className?: string }>
	}[]
	onHit: (hit: FindHit) => void
	onPerson: (kind: "cast" | "crew", row: PeopleRow) => void
	onCastSearch: (q: string) => void
}): { items: FindItem[]; busy: boolean } {
	const show = media.mediaType === "show"
	const on = query.trim().length >= 2
	const base = {
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		q: query,
		enabled: on,
	}
	const cast = usePeople({ ...base, kind: "cast", pageSize: 6 })
	const crew = usePeople({ ...base, kind: "crew", pageSize: 4 })

	const asItem = (hit: FindHit): FindItem => {
		const section = sections.find((s) => s.id === hit.entry.section)
		return {
			key: hit.entry.key,
			group: section?.label ?? "",
			icon: section?.icon ?? MagnifyingGlassIcon,
			title: hit.entry.title,
			context: hit.entry.context,
			at: hit.at,
			pick: () => onHit(hit),
		}
	}
	const hits = findIn(index, query, 30)
	const named = hits.filter((h) => h.entry.rank === 0).map(asItem)
	const rest = hits.filter((h) => h.entry.rank !== 0).map(asItem)

	const people: FindItem[] = []
	if (on) {
		for (const r of cast.rows)
			people.push({
				key: `cast:${r.id}`,
				group: "Cast",
				icon: UserIcon,
				title: r.name,
				context: [
					r.roles.length ? `as ${r.roles.join(", ")}` : null,
					TIER[r.group],
					show ? episodesWords(r.episodes) : null,
				]
					.filter(Boolean)
					.join(" · "),
				at: matchAt(r.name, query),
				photo: r.profilePath,
				pick: () => onPerson("cast", r),
			})
		const more = (cast.matched ?? 0) - cast.rows.length
		if (more > 0)
			people.push({
				key: "cast:more",
				group: "Cast",
				icon: MagnifyingGlassIcon,
				title: `All ${fmt(cast.matched ?? 0)} in the cast`,
				context: `Search the cast for “${query.trim()}”`,
				at: null,
				pick: () => onCastSearch(query.trim()),
			})
		for (const r of crew.rows)
			people.push({
				key: `crew:${r.id}`,
				group: "Crew",
				icon: UserIcon,
				title: r.name,
				context: [
					r.roles.join(", "),
					r.group === "Crew" ? null : r.group,
					show ? episodesWords(r.episodes) : null,
				]
					.filter(Boolean)
					.join(" · "),
				at: matchAt(r.name, query),
				photo: r.profilePath,
				pick: () => onPerson("crew", r),
			})
	}

	return {
		items: on ? [...named, ...people, ...rest] : [...named, ...rest],
		busy: on && (cast.busy || crew.busy),
	}
}

export function FindField({
	inputRef,
	query,
	onQuery,
	placeholder,
	items,
	active,
	onActive,
	listId,
}: {
	inputRef: RefObject<HTMLInputElement>
	query: string
	onQuery: (q: string) => void
	placeholder: string
	items: FindItem[]
	active: number
	onActive: (i: number) => void
	listId: string
}) {
	return (
		<div className="relative">
			<MagnifyingGlassIcon
				className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
				aria-hidden="true"
			/>
			<input
				ref={inputRef}
				type="search"
				value={query}
				onChange={(e) => {
					onQuery(e.target.value)
					onActive(0)
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault()
						onActive(Math.min(items.length - 1, active + 1))
					} else if (e.key === "ArrowUp") {
						e.preventDefault()
						onActive(Math.max(0, active - 1))
					} else if (e.key === "Enter" && items[active]) {
						e.preventDefault()
						items[active].pick()
					} else if (e.key === "Escape") {
						onQuery("")
						e.currentTarget.blur()
					}
				}}
				placeholder={placeholder}
				aria-label={placeholder}
				aria-controls={listId}
				aria-activedescendant={
					query && items[active] ? `${listId}-${active}` : undefined
				}
				className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-16 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/50 focus:bg-white/[0.05] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
			/>
			{query ? (
				<button
					type="button"
					onClick={() => {
						onQuery("")
						inputRef.current?.focus()
					}}
					aria-label="Clear"
					className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/5 hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			) : (
				<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 max-lg:hidden">
					<Kbd>/</Kbd>
				</span>
			)}
		</div>
	)
}

function Marked({ text, at }: { text: string; at: [number, number] | null }) {
	if (!at) return <>{text}</>
	return (
		<>
			{text.slice(0, at[0])}
			<span className="text-amber-300">{text.slice(at[0], at[1])}</span>
			{text.slice(at[1])}
		</>
	)
}

/** The matches, grouped under their heading; people with their face. Nothing found: a hint and "Clear search". */
export function FindResults({
	listId,
	query,
	items,
	busy,
	active,
	onActive,
	example,
	onClear,
}: {
	listId: string
	query: string
	items: FindItem[]
	busy: boolean
	active: number
	onActive: (i: number) => void
	example: string
	onClear: () => void
}) {
	if (!items.length)
		return (
			<div id={listId} className="px-2.5 py-3 text-sm text-gray-400">
				{busy ? (
					<p>Looking through the cast and crew…</p>
				) : (
					<>
						<p>
							Nothing here matches “{query.trim()}”. Try a name, a character, a
							job, or {example}.
						</p>
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={onClear}
							className="-mx-1 mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-semibold text-amber-300/90 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-300"
						>
							<XMarkIcon className="h-4 w-4" />
							Clear search
						</button>
					</>
				)}
			</div>
		)
	return (
		// The field keeps the focus and points at the active match (aria-activedescendant): a combobox's listbox.
		// biome-ignore lint/a11y/useSemanticElements: a listbox of rich rows, not a <select>
		// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: see above
		// biome-ignore lint/a11y/useFocusableInteractive: the field holds the focus
		<ul id={listId} role="listbox" aria-label="Matches">
			{items.map((item, i) => {
				const first = i === 0 || items[i - 1].group !== item.group
				const Icon = item.icon
				return (
					<Fragment key={item.key}>
						{first && item.group && (
							<li className={`${CAPTION} px-2.5 pb-1 ${i ? "pt-3" : "pt-1"}`}>
								{item.group}
								{busy && (item.group === "Cast" || item.group === "Crew") && (
									<span className="normal-case tracking-normal text-gray-600">
										{" "}
										· updating
									</span>
								)}
							</li>
						)}
						{/* The field holds the focus; its arrows and Enter move through the options and pick one. */}
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: the field's keys are the keyboard way */}
						{/* biome-ignore lint/a11y/useSemanticElements: an option with a photo and two lines */}
						{/* biome-ignore lint/a11y/useFocusableInteractive: the field holds the focus */}
						<li
							// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: an option of the listbox above
							role="option"
							id={`${listId}-${i}`}
							aria-selected={i === active}
							onMouseMove={() => onActive(i)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => item.pick()}
							className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 ${i === active ? "bg-white/[0.07]" : ""}`}
						>
							{item.photo !== undefined ? (
								<span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-[10px] font-semibold text-gray-500 ring-1 ring-white/10">
									{item.photo ? (
										<TmdbImage
											kind="profile"
											path={item.photo}
											width={28}
											ratio={1}
											alt=""
											className="absolute inset-0 h-full w-full object-cover"
										/>
									) : (
										initials(item.title)
									)}
								</span>
							) : (
								<Icon className="h-4 w-4 shrink-0 text-gray-500" />
							)}
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium text-gray-100">
									<Marked text={item.title} at={item.at} />
								</span>
								{item.context && (
									<span className="block truncate text-xs text-gray-500">
										{item.context}
									</span>
								)}
							</span>
						</li>
					</Fragment>
				)
			})}
		</ul>
	)
}
