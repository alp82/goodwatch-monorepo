// The start page's search bar: a two-row bar. The first row is the field and an amber Search button joined to its ↵
// key; under a hairline, the second row holds the six presets, or, while a search is on, how the search read the text
// (Discover's "Read as" chips, then the picks' names). Both rows have fixed heights and both layers of the second row
// are always mounted (the hidden one transparent and inert), so the bar's box never changes height.
//
// When it searches is field-commit.ts's rule: after an 800 ms pause, at once on Enter, the Search button, or a preset.
// `onAsk` tells the page the guest asked (Enter, Search, a preset, or the field losing focus while a search is on).
//
// Search text is private: the field is masked from session replay, as on Discover.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type FocusEvent, useEffect, useMemo, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { WORD_BY_ID } from "~/domain/taste-picker"
import { ReadAsChips, readAsChips } from "~/ui/discover/ReadAsChips"
import { preloadSearchRequest } from "~/ui/search/search-client"
import type { StartQuery, StartResults } from "../stage/start-query"
import { createFieldCommit } from "./field-commit"
import {
	PLACEHOLDER_NARROW,
	PLACEHOLDER_WIDE,
	SEARCH_LABEL,
	START_PRESETS,
} from "./presets"

const PRIVATE = "search-private ph-no-capture sentry-mask"

/** The field's id, for whatever brings the guest back to the search (the intro's Try it). */
export const START_SEARCH_INPUT = "start-search-input"

/** The wide placeholder from 640 px, the short one below (after hydration; the server renders the wide one). */
function usePlaceholder() {
	const [placeholder, setPlaceholder] = useState(PLACEHOLDER_WIDE)
	useEffect(() => {
		const wide = window.matchMedia("(min-width: 640px)")
		const update = () =>
			setPlaceholder(wide.matches ? PLACEHOLDER_WIDE : PLACEHOLDER_NARROW)
		update()
		wide.addEventListener("change", update)
		return () => wide.removeEventListener("change", update)
	}, [])
	return placeholder
}

export function StartSearchBar({
	query,
	results,
	setDraft,
	search,
	clearSearch,
	onAsk,
}: {
	query: StartQuery
	/** The results of the query, for the reading row. */
	results: Pick<StartResults, "signature" | "status" | "reading">
	setDraft: (draft: string) => void
	search: (text: string) => void
	clearSearch: () => void
	onAsk?: () => void
}) {
	const input = useRef<HTMLInputElement>(null)
	const latest = useRef({ query, search, clearSearch })
	latest.current = { query, search, clearSearch }
	const commit = useMemo(
		() =>
			createFieldCommit({
				searched: () => latest.current.query.text,
				search: (text) => latest.current.search(text),
				clear: () => latest.current.clearSearch(),
			}),
		[],
	)
	useEffect(() => commit.cancel, [commit])
	const placeholder = usePlaceholder()
	const searching = query.text !== ""
	const filled = query.draft !== "" || searching

	const ask = () => onAsk?.()
	const onBlur = (event: FocusEvent<HTMLFormElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
		if (latest.current.query.text) ask()
	}

	return (
		<form
			// biome-ignore lint/a11y/useSemanticElements: React 18 has no <search> element; the form is the search landmark
			role="search"
			className="start-bar relative mx-auto w-full"
			onSubmit={(event) => {
				event.preventDefault()
				if (!commit.submit(query.draft)) return
				// Phones: puts the keyboard away to show the results.
				input.current?.blur()
				ask()
			}}
			onBlur={onBlur}
		>
			<span aria-hidden className="start-bar-shadow" />
			<span aria-hidden className="start-bar-glow" />
			<div className="relative overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:rounded-[22px]">
				<div className="flex h-[58px] items-center gap-2 pl-4 pr-2 sm:h-[70px] sm:gap-3 sm:pl-6 sm:pr-3 lg:h-[74px]">
					<div
						className={`flex h-full min-w-0 flex-1 items-center gap-2.5 sm:gap-3 ${PRIVATE}`}
					>
						<MagnifyingGlassIcon
							className={`h-5 w-5 shrink-0 ${query.draft ? "text-amber-400" : "text-gray-400"}`}
							aria-hidden
						/>
						<input
							ref={input}
							id={START_SEARCH_INPUT}
							type="search"
							aria-label={SEARCH_LABEL}
							value={query.draft}
							autoComplete="off"
							enterKeyHint="search"
							maxLength={SEARCH_MAX_CHARS}
							data-ph-no-capture
							placeholder={placeholder}
							onFocus={preloadSearchRequest}
							onChange={(event) => {
								const draft = event.target.value
								setDraft(draft)
								commit.type(draft)
							}}
							className="brand-header h-full w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[20px] leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 sm:text-[28px] lg:text-[34px] [&::-webkit-search-cancel-button]:hidden"
						/>
						<button
							type="button"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								commit.cancel()
								clearSearch()
								input.current?.focus()
							}}
							aria-label="Clear the search"
							tabIndex={filled ? 0 : -1}
							className={`inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 outline-none transition-[color,background-color,opacity] hover:bg-amber-400/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 ${filled ? "opacity-100" : "pointer-events-none opacity-0"}`}
						>
							<XMarkIcon className="h-4 w-4" aria-hidden />
							<span className="hidden lg:inline">Clear</span>
						</button>
					</div>
					{/* The action and its key, two joined segments. */}
					<button
						type="submit"
						aria-label="Search"
						className="group flex h-10 shrink-0 cursor-pointer items-stretch overflow-hidden rounded-xl font-bold text-gray-950 shadow-[0_6px_18px_-6px_rgb(251_191_36/.6)] outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 sm:h-12"
					>
						<span className="flex items-center bg-amber-400 px-3.5 text-sm transition-colors group-hover:bg-amber-300 sm:px-5 sm:text-base">
							Search
						</span>
						<span className="flex items-center border-l border-amber-600/40 bg-amber-500 px-2.5 transition-colors group-hover:bg-amber-400 max-sm:hidden">
							<EnterKey />
						</span>
					</button>
				</div>
				<div className="mx-4 h-px bg-white/[0.08] sm:mx-6" />
				<div className="relative h-[42px] min-w-0 sm:h-[44px]">
					<div
						className="start-bar-row"
						{...(searching ? { "data-off": "", inert: "" } : {})}
					>
						<Presets
							onPick={(phrase) => {
								commit.preset(phrase)
								ask()
							}}
						/>
					</div>
					<div
						className="start-bar-row"
						aria-live="polite"
						{...(searching ? {} : { "data-off": "", inert: "" })}
					>
						{searching ? <Reading query={query} results={results} /> : null}
					</div>
				</div>
			</div>
		</form>
	)
}

/** The ↵ key cap inside the amber button. */
function EnterKey() {
	return (
		<kbd
			aria-hidden
			className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-gray-950/15 px-1.5 font-sans text-[15px] font-bold leading-none text-gray-950 shadow-[inset_0_-2px_0_rgb(0_0_0/.22),inset_0_0_0_1px_rgb(0_0_0/.18)]"
		>
			↵
		</kbd>
	)
}

/** The presets as small chips in one row; the row scrolls sideways where it doesn't fit (phones). */
function Presets({ onPick }: { onPick: (phrase: string) => void }) {
	return (
		<div className="flex w-max items-center gap-1.5">
			<span className="flex shrink-0 items-center gap-1 pr-0.5 text-[13px] text-gray-400">
				<MagnifyingGlassIcon
					className="h-3.5 w-3.5 text-amber-400"
					aria-hidden
				/>
				Try
			</span>
			{START_PRESETS.map((phrase) => (
				<button
					key={phrase}
					type="button"
					// Keeps the field's focus, so picking a preset doesn't count as leaving the field.
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onPick(phrase)}
					className="inline-flex h-7 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full bg-white/[0.06] px-2.5 text-[13px] text-gray-200 outline-none ring-1 ring-inset ring-white/10 transition-colors hover:bg-amber-400/10 hover:text-white hover:ring-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					{phrase}
				</button>
			))}
		</div>
	)
}

const LABEL = "shrink-0 whitespace-nowrap text-[13px] text-gray-400 sm:text-sm"

/** How the search read the text: "Reading…" until the reading arrives, then the chips, then the picks' names. */
function Reading({
	query,
	results,
}: {
	query: StartQuery
	results: Pick<StartResults, "signature" | "status" | "reading">
}) {
	// The results' reading is this text's while only the picks changed (querySignature is `[text, picks]`), so it
	// stays on screen while the picks re-filter.
	const [answered] = JSON.parse(results.signature) as [string, string[]]
	const own = answered === query.text
	const reading = own ? results.reading : null
	const picks = query.picks.flatMap((id) => WORD_BY_ID[id] ?? [])
	const tail = picks.length ? (
		<>
			<span aria-hidden className="shrink-0 text-gray-500">
				·
			</span>
			{picks.map((word) => (
				<span
					key={word.id}
					className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-gray-100 ring-1 ring-inset ring-white/10"
				>
					<span
						aria-hidden
						className="h-2 w-2 rounded-full"
						style={{ background: word.hue }}
					/>
					{word.name}
				</span>
			))}
		</>
	) : null
	if (reading === null && (!own || results.status === "loading"))
		return (
			<span className={`inline-flex items-center gap-2 ${LABEL}`}>
				<span
					aria-hidden
					className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent motion-reduce:animate-none"
				/>
				Reading…
			</span>
		)
	if (reading && readAsChips(reading).length)
		return (
			<span className="flex w-max items-center gap-2">
				<span className={LABEL}>Read as</span>
				<ReadAsChips
					reading={reading}
					className="!flex-nowrap [&>li]:shrink-0 [&>li]:whitespace-nowrap"
				/>
				{tail}
			</span>
		)
	return (
		<span className={`flex w-max items-center gap-2 ${PRIVATE}`}>
			<span className={LABEL}>{`“${query.text}”`}</span>
			{tail}
		</span>
	)
}
