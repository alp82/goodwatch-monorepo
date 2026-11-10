// The start page's search: one line in a pill that echoes the Choose button under it (an amber disc, the same heights),
// with one example at a time under the placeholder. Examples and typed requests use the same commit rule; the
// interpretation loads when a request is present and uses that request's actual result, in a box under the pill.
import {
	ArrowRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import {
	type FocusEvent,
	Suspense,
	lazy,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { preloadSearchRequest } from "~/ui/search/search-client"
import { SEARCH_EXAMPLES } from "~/ui/search/search-examples"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { StartQuery, StartResults } from "../stage/start-query"
import { createFieldCommit } from "./field-commit"
import { PLACEHOLDER, SEARCH_LABEL } from "./presets"

const SearchInterpretation = lazy(
	reloadOnStaleChunk(() => import("./SearchInterpretation")),
)
export const START_SEARCH_INPUT = "start-search-input"

/** Discover's pace. */
const EXAMPLE_MS = 3200

/**
 * One example at a time, changing while the field is empty and nothing hovers it. Only the shown example and the one
 * fading out are in the page (the guest's HTML stays small).
 */
function Example({
	run,
	paused,
}: {
	run: (text: string) => void
	paused: boolean
}) {
	const [at, setAt] = useState({ index: 0, previous: -1 })
	const [hovered, setHovered] = useState(false)
	useEffect(
		() =>
			setAt({
				index: Math.floor(Math.random() * SEARCH_EXAMPLES.length),
				previous: -1,
			}),
		[],
	)
	const still = paused || hovered
	useEffect(() => {
		if (still || matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const timer = setInterval(
			() =>
				setAt(({ index }) => ({
					index: (index + 1) % SEARCH_EXAMPLES.length,
					previous: index,
				})),
			EXAMPLE_MS,
		)
		return () => clearInterval(timer)
	}, [still])
	return (
		<div
			className="start-example"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{at.previous >= 0 && (
				<span key={`out-${at.previous}`} aria-hidden data-out="">
					Try “{SEARCH_EXAMPLES[at.previous]}”
				</span>
			)}
			<button
				key={at.index}
				type="button"
				tabIndex={paused ? -1 : 0}
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => run(SEARCH_EXAMPLES[at.index])}
			>
				Try “{SEARCH_EXAMPLES[at.index]}”
			</button>
		</div>
	)
}

export function StartSearchBar({
	query,
	results,
	searchRevision,
	search,
	clearSearch,
	onAsk,
}: {
	query: StartQuery
	results: Pick<
		StartResults,
		"signature" | "status" | "reading" | "interpretation"
	>
	/** Changes on a committed search, explicit clear or URL navigation, including equal text. */
	searchRevision: number
	search: (text: string) => void
	clearSearch: () => void
	onAsk?: () => void
}) {
	// Live typing stays in this control; the stage and Browse only see committed searches.
	const [draft, setDraft] = useState(query.draft)
	const field = useRef<HTMLInputElement>(null)
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
	useEffect(() => {
		commit.cancel()
		setDraft(query.draft)
	}, [searchRevision, query.draft, commit])
	const filled = draft.trim().length > 0
	const own = JSON.parse(results.signature)[0] === query.text
	const onBlur = (event: FocusEvent<HTMLFormElement>) => {
		if (
			!event.currentTarget.contains(event.relatedTarget as Node | null) &&
			latest.current.query.text
		)
			onAsk?.()
	}
	return (
		<form
			role="search"
			className="start-bar relative mx-auto w-full"
			onBlur={onBlur}
			onSubmit={(event) => {
				event.preventDefault()
				if (!commit.submit(draft)) return
				field.current?.blur()
				onAsk?.()
			}}
		>
			<span aria-hidden className="start-bar-floor" />
			<span aria-hidden className="start-bar-shadow" />
			<span aria-hidden className="start-bar-glow" />
			<div className="start-pill">
				<span aria-hidden className="start-pill-disc">
					<MagnifyingGlassIcon className="h-5 w-5 sm:h-[26px] sm:w-[26px]" />
				</span>
				<div
					className="start-pill-field"
					{...(filled ? { "data-filled": "" } : {})}
				>
					<input
						ref={field}
						id={START_SEARCH_INPUT}
						type="search"
						aria-label={SEARCH_LABEL}
						value={draft}
						placeholder={PLACEHOLDER}
						maxLength={SEARCH_MAX_CHARS}
						autoComplete="off"
						enterKeyHint="search"
						data-ph-no-capture
						className="search-private ph-no-capture sentry-mask"
						onFocus={preloadSearchRequest}
						onChange={(e) => {
							setDraft(e.target.value)
							commit.type(e.target.value)
						}}
					/>
					<div
						className="start-pill-examples"
						{...(filled ? { inert: "" } : {})}
					>
						<Example
							paused={filled}
							run={(phrase) => {
								setDraft(phrase)
								commit.preset(phrase)
								onAsk?.()
							}}
						/>
					</div>
				</div>
				{filled && (
					<button
						type="button"
						aria-label="Clear the search"
						className="start-pill-clear"
						onMouseDown={(event) => {
							// Keep the field (and a phone's keyboard) focused while its clear button is pressed.
							if (event.button === 0) event.preventDefault()
						}}
						onClick={() => {
							commit.cancel()
							setDraft("")
							clearSearch()
							field.current?.focus()
						}}
					>
						<XMarkIcon className="h-5 w-5" aria-hidden />
					</button>
				)}
				<button type="submit" aria-label="Search" className="start-pill-go">
					<ArrowRightIcon className="h-5 w-5 sm:hidden" aria-hidden />
					<span className="hidden sm:inline">Search</span>
				</button>
			</div>
			{query.text && (
				<div className="start-reading">
					<Suspense
						fallback={
							<div className="px-6 py-3 text-sm text-gray-400">
								Reading your search…
							</div>
						}
					>
						<SearchInterpretation
							query={query.text}
							interpretation={own ? results.interpretation : undefined}
							reading={own ? results.reading : null}
							loading={!own || results.status === "loading"}
						/>
					</Suspense>
				</div>
			)}
		</form>
	)
}
