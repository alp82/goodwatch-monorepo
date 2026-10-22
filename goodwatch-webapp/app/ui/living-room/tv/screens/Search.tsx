import { browseActions } from "./browse-actions"
import { copyMediaPresentation } from "~/utils/media-presentation"
// Search is explicit: a real input for physical/touch typing and, on the desktop, a directional screen keyboard.
// QWERTY rows and Space/Delete/Search actions recover the pre-6a85a3de TV keyboard; digits and Clear are added.
// A phone types with its own keyboard only (the owner, 2026-10-22). No input auto-focus steals remote OK.
// The entire screen, keyboard, filter panel and data code arrive with Search's lazy screen chunk.
import { type CSSProperties, useEffect } from "react"
import { KEY_ROWS } from "../tv-browse"
import BrowseFilters from "./BrowseFilters"
import { preloadSearchRequest } from "~/ui/search/search-client"
import { TitleList, type TvListTitle } from "../TitleList"
import {
	CornerBar,
	Item,
	PHONE_FOOT,
	PHONE_HEAD,
	PHONE_SIDE,
	Shade,
	keySize,
	useReport,
	useTvView,
} from "../kit"
import { TV_INPUT_ATTR } from "../tv-dom"
import { tvTitleKey } from "../tv-home"
import { SEARCH_GO, type TvScreen } from "../tv-machine"
import {
	SEARCH_MAX_LENGTH,
	SEARCH_QUESTION,
	goLabel,
	searchCrumb,
	searchEmptyLine,
	searchFacts,
} from "../tv-search"
import { type TvSearchReport, useTvSearch } from "../use-tv-search"

/**
 * The search for the query in the address (use-tv-search.ts). Draws nothing. The scene mounts it once while the
 * address names a query, and gets what it holds through `report`. It is in this chunk, so the search's data costs
 * no request for code of its own and nothing in the page's first view.
 */
export function SearchData({
	report,
	...on
}: Parameters<typeof useTvSearch>[0] & {
	report: (list: TvSearchReport | null) => void
}) {
	useReport(report, useTvSearch(on))
	return null
}

function Question({
	items,
	draft,
	onDraft,
}: {
	items: readonly string[]
	draft: string
	onDraft: (text: string) => void
}) {
	const { canvas } = useTvView()
	useEffect(() => {
		if (!canvas.first) preloadSearchRequest()
	}, [canvas.first])
	return canvas.edition === "phone" ? (
		<PhoneQuestion items={items} draft={draft} onDraft={onDraft} />
	) : (
		<TvQuestion items={items} draft={draft} onDraft={onDraft} />
	)
}

/** The search's line: a real input, for a keyboard, a phone's own keyboard, and the TV's keys on the desktop. */
function Line({
	draft,
	onDraft,
	className,
	style,
	hint,
}: {
	draft: string
	onDraft: (text: string) => void
	className: string
	style?: CSSProperties
	hint: string
}) {
	const { dispatch } = useTvView()
	return (
		<form
			className="contents"
			onSubmit={(e) => {
				e.preventDefault()
				// The phone's keyboard goes once the search starts: the results take the whole picture.
				const line = e.currentTarget.querySelector("input")
				line?.blur()
				dispatch({ type: "submit-search", query: draft })
			}}
		>
			<input
				type="text"
				{...{ [TV_INPUT_ATTR]: "" }}
				aria-label="Search"
				aria-describedby={hint}
				inputMode="search"
				enterKeyHint="search"
				autoComplete="off"
				autoCapitalize="none"
				autoCorrect="off"
				spellCheck={false}
				maxLength={SEARCH_MAX_LENGTH}
				value={draft}
				onChange={(e) => onDraft(e.target.value)}
				// Enter in the line (a phone keyboard's search key) searches for what it holds. Not the Remote's OK: that
				// presses the TV's focused item, which is the line's own key after Edit search, and nothing was searched.
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.nativeEvent.isComposing) e.stopPropagation()
				}}
				placeholder={SEARCH_QUESTION}
				className={className}
				style={style}
			/>
		</form>
	)
}

/**
 * The phone (the owner, 2026-10-22): the phone's own keyboard and no TV keys. The line is a real input a tap
 * focuses; with the Remote, OK on it (`field`) does the same. Search searches, as the keyboard's search key does,
 * and the keyboard goes with it. Under them, four ideas, two by two. Nothing scrolls.
 */
function PhoneQuestion({
	items,
	draft,
	onDraft,
}: {
	items: readonly string[]
	draft: string
	onDraft: (text: string) => void
}) {
	const { canvas } = useTvView()
	const key = keySize(canvas, 54)
	const hint = "tv-search-hint-phone"
	// Two rows of ideas where the picture holds them at a key's height, else one (a phone 360 px wide).
	const rows = Math.max(
		1,
		Math.min(2, Math.floor((canvas.h - PHONE_HEAD - PHONE_FOOT - key) / (key + 5))),
	)
	const ideas = items.filter((id) => id.startsWith("idea:")).slice(0, rows * 2)
	return (
		<>
			<Shade dim={0.86} />
			<div
				className="absolute inset-x-0 bottom-0 flex flex-col gap-[5px]"
				style={{ top: PHONE_HEAD, paddingLeft: PHONE_SIDE, paddingRight: PHONE_SIDE, paddingBottom: PHONE_FOOT }}
			>
				<div className="flex shrink-0 gap-2" style={{ height: key }}>
					{/* The field: the TV's item behind the real input, so the Remote's focus rings it and OK on it gives the
					    line the browser's focus. A tap reaches the input itself. */}
					<div className="relative min-w-0 flex-1">
						{items.includes("field") && (
							<Item
								id="field"
								label="Search: type here"
								className="tvc-ring absolute inset-0 rounded-xl bg-white/10"
							>
								<span className="sr-only">Search</span>
							</Item>
						)}
						<Line
							draft={draft}
							onDraft={onDraft}
							hint={hint}
							className="absolute inset-0 h-full w-full rounded-xl border-0 bg-transparent px-4 text-[22px] font-bold text-white placeholder:text-white/65 focus:outline-none focus:ring-[3px] focus:ring-inset focus:ring-amber-300"
						/>
					</div>
					{items.includes(SEARCH_GO) && (
						<Item
							id={SEARCH_GO}
							label={goLabel(draft)}
							className="tvc-btn tvc-watch flex h-full shrink-0 items-center justify-center px-5 text-[20px]"
						>
							Search
						</Item>
					)}
				</div>
				<div id={hint} className="sr-only">
					Two characters or more. Type with your phone's keyboard, or choose an idea.
				</div>
				<div
					className="grid shrink-0 grid-cols-2 gap-[5px]"
					style={{ gridTemplateRows: `repeat(${rows}, ${key}px)` }}
				>
					{ideas.map((id) => (
						<Item
							key={id}
							id={id}
							label={`Search for ${id.slice("idea:".length)}`}
							className="tvc-btn flex h-full items-center justify-center px-3 text-center text-[18px] leading-tight"
						>
							{id.slice("idea:".length)}
						</Item>
					))}
				</div>
			</div>
			<CornerBar items={items} />
		</>
	)
}

/** The desktop: the line, the ideas, the TV's keyboard with digits, and Delete, Space, Clear and Search. */
function TvQuestion({
	items,
	draft,
	onDraft,
}: {
	items: readonly string[]
	draft: string
	onDraft: (text: string) => void
}) {
	const { canvas } = useTvView()
	const actions = (
		<div className="flex shrink-0 gap-2">
			{[
				["delete", "Delete"],
				["space", "Space"],
				["clear", "Clear"],
			].map(([key, label]) => (
				<Item
					key={key}
					id={`key:${key}`}
					className="tvc-btn flex-1 px-2 text-[22px]"
					style={{ height: keySize(canvas, 52) }}
				>
					{label}
				</Item>
			))}
			<Item
				id={SEARCH_GO}
				label={goLabel(draft)}
				className="tvc-btn flex-1 bg-amber-400 px-2 text-[22px] text-black"
				style={{ height: keySize(canvas, 52) }}
			>
				Search
			</Item>
		</div>
	)
	const hint = "tv-search-hint-desktop"
	return (
		<>
			<Shade dim={0.86} />
			<div className="absolute inset-x-0 bottom-[76px] top-[100px] flex flex-col gap-3 px-14">
				<Line
					draft={draft}
					onDraft={onDraft}
					hint={hint}
					className="w-full shrink-0 rounded-xl border-0 bg-white/10 px-4 text-[40px] font-bold text-white placeholder:text-white/65"
					style={{ height: keySize(canvas, 56) }}
				/>
				{/* For a screen reader: what the line takes. On screen the ideas stand under it instead. */}
				<div id={hint} className="sr-only">
					Two characters or more. Type, use the keys, or choose an idea.
				</div>
				<div className="flex shrink-0 items-center gap-3">
					<span className="shrink-0 text-[22px] text-white/55">Try</span>
					{items
						.filter((id) => id.startsWith("idea:"))
						.map((id) => (
							<Item
								key={id}
								id={id}
								label={`Search for ${id.slice("idea:".length)}`}
								className="tvc-btn flex shrink-0 items-center whitespace-nowrap px-5 text-[22px]"
								style={{ height: keySize(canvas, 48) }}
							>
								{id.slice("idea:".length)}
							</Item>
						))}
				</div>
				<div data-tv-scroll className="min-h-0 flex-1 overflow-y-auto p-2">
					{KEY_ROWS.map((row) => (
						<div key={row} className="mb-2 flex justify-center gap-1.5">
							{[...row].map((c) => (
								<Item
									key={c}
									id={`key:${c}`}
									className="tvc-btn flex shrink-0 items-center justify-center text-[30px] font-bold uppercase"
									style={{ width: 76, height: keySize(canvas, 52) }}
								>
									{c}
								</Item>
							))}
						</div>
					))}
				</div>
				{actions}
			</div>
			<CornerBar items={items} />
		</>
	)
}

/** The titles the search found, in the list every app shows its titles in (../TitleList.tsx). */
function Results({
	items,
	query,
	screen,
	list,
}: {
	items: readonly string[]
	query: string
	screen: Extract<TvScreen, { name: "search" }>
	list: TvSearchReport | null
}) {
	const titles: TvListTitle[] = (list?.cards ?? []).map((card) => ({
		key: tvTitleKey(card),
		...copyMediaPresentation(card),
		title: card.title,
		poster: card.poster_path,
		backdrop: card.backdrop_path,
		facts: searchFacts(card),
	}))
	return (
		<TitleList
			name="Search"
			phoneName={searchCrumb(query)}
			crumb={`${searchCrumb(query)} · Page ${screen.page ?? 1}${list ? ` of ${list.pages} · ${list.total} matches` : ""}`}
			actions={browseActions(screen, list)}
			actionsLabel={list?.summary}
			items={items}
			titles={titles}
			empty={searchEmptyLine({
				waiting: list?.waiting ?? true,
				failed: list?.failed ?? null,
			})}
		/>
	)
}

export default function Search({
	items,
	screen,
	draft,
	onDraft,
	list,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	screen: Extract<TvScreen, { name: "search" }>
	/** What is typed on the line, and where a change of it goes. */
	draft: string
	onDraft: (text: string) => void
	/** The titles found for the query in the address; null until their data component has reported. */
	list: TvSearchReport | null
}) {
	if (screen.filters)
		return (
			<BrowseFilters
				screen={screen}
				items={items}
				summary={list?.summary}
				controls={list?.controls}
				hasTaste={list?.hasTaste}
			/>
		)
	return screen.query ? (
		<Results items={items} query={screen.query} screen={screen} list={list} />
	) : (
		<Question items={items} draft={draft} onDraft={onDraft} />
	)
}
