import { browseActions } from "./browse-actions"
import { copyMediaPresentation } from "~/utils/media-presentation"
// Search is explicit: a real input for physical/touch typing and a directional screen keyboard.
// QWERTY rows and Space/Delete/Search actions recover the pre-6a85a3de TV keyboard; digits and Clear are added.
// On phones the rows wrap and scroll between a fixed query and action row. No input auto-focus steals remote OK.
// The entire screen, keyboard, filter panel and data code arrive with Search's lazy screen chunk.
import { useEffect } from "react"
import { KEY_ROWS } from "../tv-browse"
import BrowseFilters from "./BrowseFilters"
import { preloadSearchRequest } from "~/ui/search/search-client"
import { TitleList, type TvListTitle } from "../TitleList"
import { CornerBar, Item, Shade, keySize, useReport, useTvView } from "../kit"
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
	const { canvas, dispatch } = useTvView()
	const P = canvas.edition === "phone"
	useEffect(() => {
		if (!canvas.first) preloadSearchRequest()
	}, [canvas.first])
	const hint = `tv-search-hint-${canvas.edition}`
	return (
		<>
			<Shade dim={0.86} />
			<div
				className={`absolute inset-x-0 flex flex-col gap-3 ${P ? "top-[72px] bottom-3 px-5" : "top-[100px] bottom-[76px] px-14"}`}
			>
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
				<div
					id={hint}
					className={`shrink-0 text-white/70 ${P ? "text-[20px]" : "text-[24px]"}`}
				>
					{draft.length}/{SEARCH_MAX_LENGTH} · Two characters or more. Type or
					use the keys.
				</div>
				<div data-tv-scroll className="min-h-0 flex-1 overflow-y-auto p-2">
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
