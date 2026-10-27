// Discover's heading, shared by browsing and searching: one full-width row over a hairline, with the explanation
// (taste chips, or "Read as" while searching) under it. Browsing, the row names the list with a Search button;
// tapping either opens the field. With a search on, the row stays an input showing the query, so it can be
// edited in place. Typing searches after 800 ms or on Enter; Escape puts the search back; Clear returns to browsing.
//
// The query's text shrinks to fit the row: from the title's size down to a floor (42 to 22 px wide, 32 to 18 px on
// phones). Past the floor the field scrolls sideways, and its end fades out while it isn't being edited.
//
// Search text is private: the field is masked from session replay (as the search page was).
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import {
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { fitSize } from "./heading-fit"

/** Typing searches once it pauses this long. */
const COMMIT_MS = 800
const PRIVATE = "search-private ph-no-capture sentry-mask"
/** The query's size range in px; the top is the title's size. Phones below `WIDE_FROM` px of row. */
const WIDE = { max: 42, min: 22 }
const NARROW = { max: 32, min: 18 }
const WIDE_FROM = 640
/** The row's width the text can't have: the magnifier and its gap, and Clear when it shows (just its icon on phones). */
const ICON_ROOM = 32
const CLEAR_ROOM = { wide: 92, narrow: 44 }
const FADE = "linear-gradient(to right, black calc(100% - 3rem), transparent)"

let canvas: HTMLCanvasElement | undefined

// The text's width at 100 px in the input's own font.
function measure(input: HTMLInputElement, text: string) {
	canvas ??= document.createElement("canvas")
	const ctx = canvas.getContext("2d")
	if (!ctx) return 0
	const style = getComputedStyle(input)
	ctx.font = `${style.fontWeight} 100px ${style.fontFamily}`
	return ctx.measureText(text || input.placeholder).width
}

function useFit(
	text: string,
	row: HTMLElement | null,
	input: HTMLInputElement | null,
	clear: boolean,
) {
	const [width, setWidth] = useState(0)
	useLayoutEffect(() => {
		if (!row) return
		const observer = new ResizeObserver(([entry]) =>
			setWidth(entry.contentRect.width),
		)
		observer.observe(row)
		return () => observer.disconnect()
	}, [row])
	// The heading font may arrive after the first measure.
	const [fonts, setFonts] = useState(0)
	useEffect(() => {
		let live = true
		document.fonts?.ready.then(() => live && setFonts((n) => n + 1))
		return () => {
			live = false
		}
	}, [])
	const [fit, setFit] = useState({ size: WIDE.max, overflows: false })
	useLayoutEffect(() => {
		if (!input || !width) return
		const wide = width >= WIDE_FROM
		const room =
			width - ICON_ROOM - (clear ? CLEAR_ROOM[wide ? "wide" : "narrow"] : 0) - 4
		setFit(fitSize(measure(input, text), room, wide ? WIDE : NARROW))
	}, [text, width, input, clear, fonts])
	return fit
}

export function DiscoverHeading({
	q,
	onSearch,
	onClear,
	explanation,
}: {
	/** The query while searching, else null. */
	q: string | null
	/** Search for the text (already trimmed); empty text returns to browsing. */
	onSearch: (text: string) => void
	onClear: () => void
	/** The line under the row (taste chips or "Read as"), or null when it has nothing to say. */
	explanation: ReactNode
}) {
	const searching = q !== null
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState(q ?? "")
	const [focused, setFocused] = useState(false)
	const [row, setRow] = useState<HTMLDivElement | null>(null)
	const [input, setInput] = useState<HTMLInputElement | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const latest = useRef({ q, onSearch, draft })
	latest.current = { q, onSearch, draft }
	const inputId = useId()

	// Follow the URL when the query changes elsewhere (the palette, back and forward, a clear).
	const shown = q ?? ""
	const last = useRef(shown)
	useEffect(() => {
		if (last.current === shown) return
		last.current = shown
		setDraft(shown)
		if (!shown) setOpen(false)
	}, [shown])
	useEffect(() => () => clearTimeout(timer.current), [])

	const run = (text: string) => {
		const trimmed = text.trim()
		if (trimmed === (latest.current.q ?? "")) return
		last.current = trimmed
		latest.current.onSearch(trimmed)
	}
	const type = (text: string) => {
		setDraft(text)
		clearTimeout(timer.current)
		timer.current = setTimeout(() => run(text), COMMIT_MS)
	}
	const clear = () => {
		clearTimeout(timer.current)
		last.current = ""
		setDraft("")
		setOpen(false)
		onClear()
	}

	const showClear = searching || draft !== ""
	const { size, overflows } = useFit(draft, row, input, showClear)
	const fade = overflows && !focused ? FADE : undefined
	const field = searching || open

	return (
		<div className="group/heading">
			{field ? (
				<div
					ref={setRow}
					className={`flex h-14 w-full min-w-0 items-center gap-3 lg:h-16 ${PRIVATE}`}
				>
					{searching && <h1 className="sr-only">Search: {q}</h1>}
					<label htmlFor={inputId} className="sr-only">
						Search Discover
					</label>
					<MagnifyingGlassIcon
						className={`h-5 w-5 shrink-0 ${searching ? "text-amber-400" : "text-gray-400"}`}
						aria-hidden
					/>
					<input
						ref={setInput}
						id={inputId}
						type="search"
						value={draft}
						// Opened by the person's tap while browsing; a search on screen doesn't take focus.
						// biome-ignore lint/a11y/noAutofocus: opened by the person
						autoFocus={!searching}
						autoComplete="off"
						enterKeyHint="search"
						maxLength={SEARCH_MAX_CHARS}
						data-ph-no-capture
						placeholder="What’s the mood?"
						onChange={(e) => type(e.target.value)}
						onFocus={() => setFocused(true)}
						onBlur={() => {
							setFocused(false)
							if (latest.current.q === null && !latest.current.draft.trim())
								setOpen(false)
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault()
								clearTimeout(timer.current)
								run(draft)
								// Phones: puts the keyboard away to show the results.
								input?.blur()
							}
							if (e.key === "Escape") {
								e.preventDefault()
								clearTimeout(timer.current)
								setDraft(latest.current.q ?? "")
								input?.blur()
								if (latest.current.q === null) setOpen(false)
							}
						}}
						style={{ fontSize: size, maskImage: fade, WebkitMaskImage: fade }}
						className="brand-header h-full min-w-0 flex-1 border-0 bg-transparent p-0 leading-tight text-white outline-none transition-[font-size] duration-150 placeholder:text-gray-500 focus:ring-0 motion-reduce:transition-none [&::-webkit-search-cancel-button]:hidden"
					/>
					{showClear && (
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={clear}
							aria-label="Clear the search, back to Discover"
							className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 outline-none transition-colors cursor-pointer hover:bg-amber-400/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<XMarkIcon className="h-4 w-4" aria-hidden />
							<span className="hidden sm:inline">Clear</span>
						</button>
					)}
				</div>
			) : (
				<button
					type="button"
					onClick={() => setOpen(true)}
					aria-label="Search Discover"
					className="group flex min-h-14 w-full min-w-0 items-center gap-3 py-2 rounded-lg text-left cursor-text outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:min-h-16"
				>
					<h1 className="brand-header min-w-0 text-[32px] leading-tight text-white lg:text-[42px]">
						Discover movies and TV shows
					</h1>
					<span className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white/[0.06] px-3.5 text-sm font-semibold text-gray-200 transition-colors group-hover:bg-white/10 group-hover:text-white">
						<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
						Search
					</span>
				</button>
			)}
			{/* Brightest at the left, amber while the field is being edited. */}
			<div className="h-px bg-linear-to-r from-white/25 via-white/10 to-transparent transition-colors group-focus-within/heading:from-amber-400/80 group-focus-within/heading:via-amber-400/20" />
			{explanation && (
				<div className="overflow-hidden pt-2.5">{explanation}</div>
			)}
		</div>
	)
}
