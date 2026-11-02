// The start-page composer. Presets and typed requests use the same commit rule;
// interpretation loads when a request is present and uses that request's actual result.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import {
	lazy,
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FocusEvent,
} from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { preloadSearchRequest } from "~/ui/search/search-client"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { StartQuery, StartResults } from "../stage/start-query"
import { createFieldCommit } from "./field-commit"
import {
	PLACEHOLDER_NARROW,
	PLACEHOLDER_WIDE,
	SEARCH_LABEL,
	START_PRESETS,
} from "./presets"
const SearchInterpretation = lazy(
	reloadOnStaleChunk(() => import("./SearchInterpretation")),
)
export const START_SEARCH_INPUT = "start-search-input"
function usePlaceholder() {
	const [value, set] = useState(PLACEHOLDER_WIDE)
	useEffect(() => {
		const wide = matchMedia("(min-width: 640px)"),
			update = () => set(wide.matches ? PLACEHOLDER_WIDE : PLACEHOLDER_NARROW)
		update()
		wide.addEventListener("change", update)
		return () => wide.removeEventListener("change", update)
	}, [])
	return value
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
	results: Pick<
		StartResults,
		"signature" | "status" | "reading" | "interpretation"
	>
	setDraft: (draft: string) => void
	search: (text: string) => void
	clearSearch: () => void
	onAsk?: () => void
}) {
	const field = useRef<HTMLTextAreaElement>(null),
		latest = useRef({ query, search, clearSearch })
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
	useEffect(() => {
		const resize = () => {
			const el = field.current
			if (!el) return
			el.style.height = "auto"
			const line = Number.parseFloat(getComputedStyle(el).lineHeight)
			el.style.height = `${Math.min(el.scrollHeight, line * 5)}px`
		}
		resize()
		window.addEventListener("resize", resize)
		return () => window.removeEventListener("resize", resize)
	}, [query.draft])
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
			data-search-composer=""
			className="start-bar relative mx-auto w-full"
			onBlur={onBlur}
			onSubmit={(event) => {
				event.preventDefault()
				if (!commit.submit(query.draft)) return
				field.current?.blur()
				onAsk?.()
			}}
		>
			<span aria-hidden className="start-bar-shadow" />
			<span aria-hidden className="start-bar-glow" />
			<div className="relative overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:rounded-[22px]">
				<div className="sq-input sq-composer">
					<label htmlFor={START_SEARCH_INPUT} className="sq-input-label">
						What would you like to watch?
					</label>
					<div className="sq-input-main search-private ph-no-capture sentry-mask">
						<MagnifyingGlassIcon aria-hidden className="sq-input-icon" />
						<textarea
							ref={field}
							id={START_SEARCH_INPUT}
							aria-label={SEARCH_LABEL}
							value={query.draft}
							placeholder={placeholder}
							maxLength={SEARCH_MAX_CHARS}
							rows={2}
							data-ph-no-capture
							enterKeyHint="search"
							onFocus={preloadSearchRequest}
							onChange={(e) => {
								setDraft(e.target.value)
								commit.type(e.target.value)
							}}
							onKeyDown={(e) => {
								if (
									e.key === "Enter" &&
									!e.shiftKey &&
									!e.nativeEvent.isComposing
								) {
									e.preventDefault()
									e.currentTarget.form?.requestSubmit()
								}
							}}
						/>
					</div>
					<div className="sq-composer-footer">
						<span>
							Enter to search <i>·</i> Shift + Enter for a new line
						</span>
						<div className="sq-input-actions">
							<button
								type="button"
								onClick={() => {
									commit.cancel()
									clearSearch()
									field.current?.focus()
								}}
							>
								Clear
							</button>
							<button type="submit">
								Search <span aria-hidden>↵</span>
							</button>
						</div>
					</div>
				</div>
				<div className="mx-4 h-px bg-white/[0.08] sm:mx-6" />
				<div
					role="group"
					aria-label="Search presets"
					className="overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:thin]"
				>
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
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									commit.preset(phrase)
									onAsk?.()
								}}
								className="inline-flex h-7 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full bg-white/[0.06] px-2.5 text-[13px] text-gray-200 outline-none ring-1 ring-inset ring-white/10 hover:bg-amber-400/10 hover:text-white hover:ring-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								{phrase}
							</button>
						))}
					</div>
				</div>
				{query.text && (
					<Suspense
						fallback={
							<div className="px-6 pb-3 text-sm text-gray-400">
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
				)}
			</div>
		</form>
	)
}
