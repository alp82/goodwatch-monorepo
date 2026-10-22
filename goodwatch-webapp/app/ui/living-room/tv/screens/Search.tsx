import { browseActions } from "./browse-actions"
import { copyMediaPresentation } from "~/utils/media-presentation"
// Search is explicit: a real input for physical/touch typing and a directional screen keyboard.
// QWERTY rows and Space/Delete/Search actions recover the pre-6a85a3de TV keyboard; digits and Clear are added.
// On phones the rows wrap and scroll between a fixed query and action row. No input auto-focus steals remote OK.
// The entire screen, keyboard, filter panel and data code arrive with Search's lazy screen chunk.
import { type ReactNode, useEffect } from "react"
import { KEY_ROWS } from "../tv-browse"
import BrowseFilters from "./BrowseFilters"
import { preloadSearchRequest } from "~/ui/search/search-client"
import { TitleList, type TvListTitle } from "../TitleList"
import { CornerBar, Item, Shade, keySize, useReport, useTvView } from "../kit"
import { TV_INPUT_ATTR, TV_ROW_ATTR } from "../tv-dom"
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
	const { canvas, dispatch } = useTvView()
	const P = canvas.edition === "phone"
	useEffect(() => {
		if (!canvas.first) preloadSearchRequest()
	}, [canvas.first])
	// Delete, Space, Clear and Search: under the scrolling column, and at its end on a picture too short to
	// spare their row (the keys would show less than a row).
	const inColumn = P && canvas.h < 330
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
	const hint = `tv-search-hint-${canvas.edition}`
	return (
		<>
			<Shade dim={0.86} />
			<div
				className={`absolute inset-x-0 flex flex-col gap-3 ${P ? "top-[78px] bottom-3 px-5" : "top-[100px] bottom-[76px] px-14"}`}
			>
				<PhoneColumn phone={P}>
					<form
						className="shrink-0"
						onSubmit={(e) => {
							e.preventDefault()
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
							spellCheck={false}
							maxLength={SEARCH_MAX_LENGTH}
							value={draft}
							onChange={(e) => onDraft(e.target.value)}
							placeholder={SEARCH_QUESTION}
							className={`w-full rounded-xl border-0 bg-white/10 px-4 font-bold text-white placeholder:text-white/65 ${P ? "text-[28px]" : "text-[40px]"}`}
							style={{ height: keySize(canvas, 56) }}
						/>
					</form>
					{/* For a screen reader: what the line takes. On screen the ideas stand under it instead. */}
					<div id={hint} className="sr-only">
						Two characters or more. Type, use the keys, or choose an idea.
					</div>
					<div
						className={`flex shrink-0 items-center ${P ? "gap-2 overflow-x-auto [scrollbar-width:none]" : "gap-3"}`}
						{...(P && { [TV_ROW_ATTR]: "" })}
					>
						<span
							className={`shrink-0 text-white/55 ${P ? "text-[18px]" : "text-[22px]"}`}
						>
							Try
						</span>
						{items
							.filter((id) => id.startsWith("idea:"))
							.map((id) => (
								<Item
									key={id}
									id={id}
									label={`Search for ${id.slice("idea:".length)}`}
									className={`tvc-btn flex shrink-0 items-center whitespace-nowrap px-5 ${P ? "text-[19px]" : "text-[22px]"}`}
									style={{ height: keySize(canvas, P ? 44 : 48) }}
								>
									{id.slice("idea:".length)}
								</Item>
							))}
					</div>
					<div
						{...(P ? {} : { "data-tv-scroll": "" })}
						className={
							P ? "-mx-1 shrink-0 px-1" : "min-h-0 flex-1 overflow-y-auto p-2"
						}
					>
						{(P
							? KEY_ROWS.flatMap((row) =>
									[row.slice(0, 5), row.slice(5)].filter(Boolean),
								)
							: KEY_ROWS
						).map((row) => (
							<div key={row} className="mb-2 flex justify-center gap-1.5">
								{[...row].map((c) => (
									<Item
										key={c}
										id={`key:${c}`}
										className={`tvc-btn flex shrink-0 items-center justify-center font-bold uppercase ${P ? "text-[25px]" : "text-[30px]"}`}
										style={{
											width: P ? keySize(canvas, 0) : 76,
											height: keySize(canvas, 52),
										}}
									>
										{c}
									</Item>
								))}
							</div>
						))}
					</div>
					{inColumn && actions}
				</PhoneColumn>
				{!inColumn && actions}
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

/**
 * On the phone the field, the ideas and the keys scroll together, by touch and with the focus, and the row of
 * Delete, Space, Clear and Search stays under them. The keys are touch targets, five to a row, so they are
 * taller than the picture: in a box of their own they showed a row and a half. On the desktop all of it fits.
 */
function PhoneColumn({
	phone,
	children,
}: { phone: boolean; children: ReactNode }) {
	if (!phone) return <>{children}</>
	return (
		<div
			data-tv-scroll
			className="-mx-2 flex min-h-0 flex-1 flex-col gap-3 px-2"
		>
			{children}
		</div>
	)
}
