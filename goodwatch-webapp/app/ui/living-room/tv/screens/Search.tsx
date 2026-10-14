import { copyMediaPresentation } from "~/utils/media-presentation"
// Search on the TV. Its first screen is one line to type into and a few ideas; OK on what is typed, or on an idea,
// runs the full search and shows the first titles it found in the list every app shows its titles in. A title
// leads to its title screen. A chunk the TV asks for at the first interaction (screen-code.tsx).
//
// The line is a real input dressed as the question: a phone has no keyboard until an input has the browser's
// focus. It takes that focus when the screen opens, and a tap gives it too. While it has it, every key types,
// except the arrows, Enter and Escape, which stay the Remote's (use-tv.ts): the arrows move the TV's focus, Enter
// is OK, Escape is Back. Typing puts the TV's focus on the key that searches for what is typed (tv-machine.ts).
//
// Nothing is asked for while the person types: no search, no suggestions. The ideas are fixed queries. The search
// starts with OK and with nothing else (use-tv-search.ts).
//
// On the phone every key is a touch target, 44 px or more on the phone's screen (`keySize` in kit.tsx). The
// question screen has no page to grow into, so no Expand key; the results have one, and the list keeps its corner
// free.
import { useEffect, useRef } from "react"
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
	searchLine,
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

/** An idea's words from its item, `idea:cozy mystery`. */
const ideaOf = (item: string) => item.slice("idea:".length)

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
	const line = useRef<HTMLInputElement>(null)
	// The line takes the browser's focus when the screen opens, so what is typed lands in it and a phone that
	// lets a page open its keyboard opens it. Not before the window is measured: both editions are drawn then.
	// The code for the search request is asked for now, so OK does not wait for it.
	useEffect(() => {
		if (canvas.first) return
		preloadSearchRequest()
		line.current?.focus({ preventScroll: true })
	}, [canvas.first])
	// The two editions are in the HTML together before the window is measured: each hint has an id of its own.
	const hint = `tv-search-hint-${canvas.edition}`
	const answers = items.filter(
		(item) => item === SEARCH_GO || item.startsWith("idea:"),
	)
	const height = P ? keySize(canvas, 52) : 116
	return (
		<>
			<Shade dim={0.82} />
			<div
				className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[70px]" : "px-14 pt-16"}`}
			>
				{/* A phone's keyboard may send its search key as the form's submit and not as a key. */}
				<form
					onSubmit={(e) => {
						e.preventDefault()
						dispatch({ type: "ok" })
					}}
				>
					{/* One target for a finger: a tap on the word, the line or the hint gives the line the focus. */}
					<label className="block cursor-text">
						<span
							className={`block font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}
						>
							Search
						</span>
						<input
							ref={line}
							{...{ [TV_INPUT_ATTR]: "" }}
							type="text"
							aria-label="Search"
							aria-describedby={hint}
							inputMode="search"
							enterKeyHint="search"
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="none"
							spellCheck={false}
							maxLength={SEARCH_MAX_LENGTH}
							placeholder={SEARCH_QUESTION}
							value={draft}
							onChange={(e) => onDraft(e.target.value)}
							className={`block w-full appearance-none rounded-none border-0 bg-transparent p-0 font-bold tracking-tight text-white caret-amber-400 shadow-none outline-none ring-0 placeholder:text-white focus:outline-none focus:ring-0 ${P ? "mt-1" : "mt-2"}`}
							style={{
								fontSize: P ? 32 : 60,
								height: P ? 38 : 70,
								lineHeight: 1.02,
							}}
						/>
						<span
							id={hint}
							className={`block text-white/80 ${P ? "mt-2 text-[20px] leading-tight" : "mt-3 text-[30px]"}`}
						>
							{searchLine(draft, P)}
						</span>
					</label>
				</form>
				<div
					className={`grid ${P ? "mt-4 grid-cols-2 gap-2.5" : "mt-10 grid-cols-4 gap-5"}`}
				>
					{answers.map((item) => (
						<Item
							key={item}
							id={item}
							className={`tvc-btn flex min-w-0 items-center justify-center text-center ${P ? "px-3 text-[20px] leading-[1.1]" : "rounded-[26px] px-4 text-[32px] leading-tight"}`}
							style={{ height }}
						>
							<span className="line-clamp-2 break-words">
								{item === SEARCH_GO ? goLabel(draft) : ideaOf(item)}
							</span>
						</Item>
					))}
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
	list,
}: {
	items: readonly string[]
	query: string
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
			crumb={searchCrumb(query)}
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
	return screen.query ? (
		<Results items={items} query={screen.query} list={list} />
	) : (
		<Question items={items} draft={draft} onDraft={onDraft} />
	)
}
