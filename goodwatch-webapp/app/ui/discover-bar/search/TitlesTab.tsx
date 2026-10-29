// Search > Titles: one list under the bar's field, driven by its text, arrow keys and Enter.
//
// - No text: the type block and Try on the left; 12 starter titles on the right (phones: 6 under Try).
// - Typing (text not yet run): "Search <text>" with the preview's count and posters, the type block, titles named like
//   the text (none: the preview's top titles under "In this search"), and up to 2 people.
// - Running (the text is the running search): the type block, 6 titles (phones 3; none named: the grid's top titles
//   under "In these results"), and people (none named: the top actor and the top person behind the camera in these
//   results under "Most in these results").
// Every title row steers the list: More like, Less like, Like this (tapping the row). More grows a group in place.
import {
	FilmIcon,
	MagnifyingGlassIcon,
	UserIcon,
} from "@heroicons/react/20/solid"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useQuickTitles } from "~/ui/filter-bar/FilterPickers"
import { compactCount } from "~/ui/filter-bar/labels"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"
import type { TitleKey } from "~/utils/title-key"
import { PRIVATE } from "../DiscoverBar"
import type { SubTabView } from "../DiscoverControls"
import { useSearchGrid } from "./combobox"
import { TypeBlock } from "./TypeBlock"
import {
	EnterKey,
	GroupHead,
	MoreLine,
	type PersonItem,
	PersonRow,
	PosterThumb,
	Row,
	RowsLoading,
	type SteerState,
	type TitleItem,
	TitleRow,
	cardItem,
} from "./rows"
import {
	type Steer,
	TRY_PROMPTS,
	matchesLabel,
	moreCount,
	moreRows,
	roleOf,
	togglePerson,
	toggleSteer,
} from "./search-tab"
import {
	type SearchPreview,
	useListNav,
	usePanelPeople,
	usePeopleSearch,
	useSearchPreview,
	useStarterTitles,
} from "./useSearchData"

type Item =
	| { kind: "run"; text: string }
	| { kind: "prompt"; text: string }
	| { kind: "title"; t: TitleItem }
	| { kind: "person"; p: PersonItem }

/** The steering picks of the filter state. */
export function useSteer(filters: FilterStateBinding): SteerState {
	const { state, update } = filters
	return {
		has: (steer: Steer, key: TitleKey) => (state[steer] ?? []).includes(key),
		toggle: (steer: Steer, key: TitleKey) =>
			update((s) => toggleSteer(s, steer, key)),
	}
}

/** Two lists as one, alternating: the top actor, the top person behind the camera, the next actor, ... */
const alternate = <T,>(a: readonly T[], b: readonly T[]): T[] =>
	Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
		[a[i], b[i]].filter((x): x is T => x !== undefined),
	).flat()

export function TitlesTab({ view }: { view: SubTabView }) {
	const { phone, text, filters, counts, page, query } = view
	const go = (q: string) => {
		view.setText(q)
		view.runSearch(q)
	}
	const typed = text.trim()
	const asking = typed.length >= 2
	const showing = typed !== "" && typed === query
	const steer = useSteer(filters)
	const titles = useQuickTitles(asking ? text : "")
	const people = usePeopleSearch(asking ? text : "")
	const preview = useSearchPreview(text, filters, page, query)
	const starters = useStarterTitles(page.guest, !typed)
	const noNamedPeople = showing && !people.loading && people.found.length === 0
	const inResults = usePanelPeople(filters, page, true, noNamedPeople)
	const chosenPeople = filters.state.people ?? []

	// More: how many rows each group shows; a new text starts over.
	const baseTitles = phone ? 3 : showing ? 6 : 4
	const [shown, setShown] = useState({ titles: baseTitles, people: 2 })
	const reset = `${typed}|${showing}|${phone}`
	useEffect(
		() => setShown({ titles: baseTitles, people: 2 }),
		[reset, baseTitles],
	)

	// No title has this name: the top of what the text returns, to steer by (the running results, else the preview).
	const named = useMemo(
		() =>
			titles.found.map(
				(t): TitleItem => ({
					key: t.key,
					title: t.title,
					year: t.year,
					poster: t.poster,
				}),
			),
		[titles.found],
	)
	const fallback: TitleItem[] =
		asking && !titles.loading && named.length === 0
			? (showing ? page.cards : preview.ready ? preview.cards : []).map(
					cardItem,
				)
			: []
	// The fallback holds one page of the list; the list may be longer.
	const fallbackTotal = (showing ? counts?.total : preview.total) ?? 0
	const allTitles = named.length ? named : fallback
	const titleList = asking ? allTitles.slice(0, shown.titles) : []

	// No person has this name: who is most in the running search's results.
	const counted: PersonItem[] =
		noNamedPeople && !inResults.unavailable
			? alternate(inResults.actors, inResults.crew).map((p) => ({
					id: p.id,
					name: p.name,
					profile: p.profile,
					note: p.note,
				}))
			: []
	const allPeople: PersonItem[] = people.found.length
		? people.found.map((p) => ({
				id: p.id,
				name: p.name,
				profile: p.profile,
				note: roleOf(p.department),
			}))
		: counted
	const personList = asking ? allPeople.slice(0, shown.people) : []

	const startCount = phone ? 6 : 12
	const items: Item[] = typed
		? [
				...(showing ? [] : [{ kind: "run" as const, text: typed }]),
				...titleList.map((t) => ({ kind: "title" as const, t })),
				...personList.map((p) => ({ kind: "person" as const, p })),
			]
		: [
				...TRY_PROMPTS.map((text) => ({ kind: "prompt" as const, text })),
				...starters.cards
					.slice(0, startCount)
					.map((card) => ({ kind: "title" as const, t: cardItem(card) })),
			]
	const togglePick = (id: number) => filters.update((s) => togglePerson(s, id))
	const act = (i: number) => {
		const item = items[i]
		if (!item) return
		if (item.kind === "run" || item.kind === "prompt") go(item.text)
		else if (item.kind === "title") steer.toggle("similarTo", item.t.key)
		else togglePick(item.p.id)
	}
	const listId = useId()
	const rowIds = items.map(
		(item) =>
			`${listId}-${
				item.kind === "title"
					? item.t.key
					: item.kind === "person"
						? `person-${item.p.id}`
						: item.kind === "prompt"
							? `prompt-${encodeURIComponent(item.text)}`
							: "run"
			}`,
	)
	const navigation = useListNav(
		items.length,
		act,
		reset,
		typed !== "" && !showing,
	)
	const nav = { ...navigation, rowId: (i: number) => rowIds[i] }
	useSearchGrid(listId, rowIds[nav.active])
	const list = useRef<HTMLDivElement>(null)
	useEffect(() => {
		list.current
			?.querySelector<HTMLElement>(`[data-row="${nav.active}"]`)
			?.scrollIntoView({ block: "nearest" })
	}, [nav.active])

	const at = (item: Item) => items.indexOf(item)
	const ofKind = <K extends Item["kind"]>(kind: K) =>
		items.filter((x): x is Extract<Item, { kind: K }> => x.kind === kind)
	const run = ofKind("run")[0]
	const titleRows = ofKind("title")
	const personRows = ofKind("person")
	const columns = phone
		? "flex flex-col gap-1"
		: "grid grid-cols-2 gap-x-3 gap-y-1"
	const typeBlock = (className: string) => (
		<TypeBlock
			filters={filters}
			counts={counts}
			fresh={page.countsFresh}
			className={className}
		/>
	)

	if (!typed) {
		const body = (
			// biome-ignore lint/a11y/useSemanticElements: the bar's field keeps focus and drives the list
			// biome-ignore lint/a11y/useFocusableInteractive: the bar's field keeps focus and drives the list
			<div
				ref={list}
				id={listId}
				// biome-ignore lint/a11y/useSemanticElements: a list the bar's field drives, not a select
				role="grid"
				aria-label="Suggestions"
				className={
					phone
						? "flex flex-col gap-1"
						: "grid grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-8"
				}
			>
				<div className="flex min-w-0 flex-col gap-1">
					{typeBlock(phone ? "pb-1" : "px-3 pb-1")}
					<GroupHead icon={<MagnifyingGlassIcon />}>Try</GroupHead>
					{ofKind("prompt").map((item) => (
						<Row
							key={item.text}
							id={nav.rowId(at(item))}
							i={at(item)}
							active={nav.active}
							onHover={nav.setActive}
							onClick={() => go(item.text)}
						>
							<MagnifyingGlassIcon
								className="h-4 w-4 shrink-0 text-amber-400/60"
								aria-hidden
							/>
							<span className="min-w-0 flex-1 truncate text-[15px] text-gray-300">
								{item.text}
							</span>
							<EnterKey show={nav.active === at(item)} />
						</Row>
					))}
				</div>
				<div className="flex min-w-0 flex-col gap-1">
					<GroupHead icon={<FilmIcon />} first={!phone}>
						Popular titles
					</GroupHead>
					<div className={columns}>
						{starters.loading ? (
							<RowsLoading n={startCount} poster />
						) : (
							titleRows.map((item) => (
								<TitleRow
									key={item.t.key}
									t={item.t}
									i={at(item)}
									nav={nav}
									steer={steer}
									phone={phone}
								/>
							))
						)}
					</div>
				</div>
			</div>
		)
		return phone ? body : <div className="px-5 py-4">{body}</div>
	}

	const titlesHead = named.length
		? "Titles"
		: fallback.length
			? showing
				? "In these results"
				: "In this search"
			: "Titles"
	const lookingForTitles =
		titles.loading || (showing ? false : preview.busy && named.length === 0)
	const body = (
		// biome-ignore lint/a11y/useSemanticElements: the bar's field keeps focus and drives the list
		// biome-ignore lint/a11y/useFocusableInteractive: the bar's field keeps focus and drives the list
		<div
			ref={list}
			id={listId}
			// biome-ignore lint/a11y/useSemanticElements: a list the bar's field drives, not a select
			role="grid"
			aria-label="Suggestions"
			className="flex flex-col gap-1"
		>
			{run && (
				<Row
					id={nav.rowId(at(run))}
					i={at(run)}
					active={nav.active}
					onHover={nav.setActive}
					onClick={() => go(typed)}
					tall
				>
					<MagnifyingGlassIcon
						className="h-5 w-5 shrink-0 text-amber-400"
						aria-hidden
					/>
					<span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden text-[16px] text-gray-300">
						<span className="shrink-0">Search</span>
						<span
							className={`brand-header truncate text-[18px] text-white ${PRIVATE}`}
						>
							{typed}
						</span>
					</span>
					{!phone && <PreviewStrip preview={preview} />}
					<EnterKey show={nav.active === at(run)} />
				</Row>
			)}
			{typeBlock(
				`max-w-[440px] ${phone ? "" : "px-3"} ${run ? "pt-2 pb-1" : "pb-1"}`,
			)}
			{asking && (
				<>
					<GroupHead icon={<FilmIcon />}>{titlesHead}</GroupHead>
					{titleRows.length === 0 && (
						<p className="flex h-11 items-center px-3 text-[13px] text-gray-500">
							{lookingForTitles ? "Looking…" : `No title called “${typed}”`}
						</p>
					)}
					<div className={columns}>
						{titleRows.map((item) => (
							<TitleRow
								key={item.t.key}
								t={item.t}
								i={at(item)}
								nav={nav}
								steer={steer}
								phone={phone}
							/>
						))}
					</div>
					<MoreLine
						label="More titles"
						count={moreCount(
							titleRows.length,
							allTitles.length,
							named.length > 0 ? titles.full : fallback.length < fallbackTotal,
						)}
						onMore={() =>
							setShown((s) => ({ ...s, titles: moreRows(s.titles) }))
						}
					/>
				</>
			)}
			{personRows.length > 0 && (
				<>
					<GroupHead icon={<UserIcon />}>
						{people.found.length ? "People" : "Most in these results"}
					</GroupHead>
					<div className={columns}>
						{personRows.map((item) => (
							<PersonRow
								id={nav.rowId(at(item))}
								key={item.p.id}
								p={item.p}
								i={at(item)}
								on={chosenPeople.includes(item.p.id)}
								onToggle={() => togglePick(item.p.id)}
								active={nav.active === at(item)}
								onHover={() => nav.setActive(at(item))}
							/>
						))}
					</div>
					<MoreLine
						label="More people"
						count={moreCount(
							personRows.length,
							allPeople.length,
							people.found.length > 0 && people.full,
						)}
						onMore={() =>
							setShown((s) => ({ ...s, people: moreRows(s.people) }))
						}
					/>
				</>
			)}
		</div>
	)
	return phone ? body : <div className="px-5 py-4">{body}</div>
}

/** The preview's count and first posters, a fixed-size strip: placeholders while it loads. */
function PreviewStrip({ preview }: { preview: SearchPreview }) {
	const n = 5
	const cards = preview.ready ? preview.cards.slice(0, n) : []
	return (
		<span className="flex shrink-0 items-center gap-3">
			<span className="min-w-[7.5rem] text-right text-[12px] text-gray-500 tabular-nums">
				{preview.ready && preview.total !== null
					? preview.total === 0
						? "Nothing fits the filters"
						: matchesLabel(preview.total, compactCount)
					: preview.failed
						? "No preview right now"
						: ""}
			</span>
			<span className="flex items-center gap-1.5" aria-hidden>
				{Array.from({ length: n }, (_, i) => {
					const card = cards[i]
					return card ? (
						<PosterThumb
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
							key={i}
							poster={card.poster_path}
							title={card.title}
							className="h-[33px] w-[22px]"
						/>
					) : (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
							key={i}
							className={`block h-[33px] w-[22px] rounded-md bg-white/[0.05] ${preview.busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
						/>
					)
				})}
			</span>
		</span>
	)
}
