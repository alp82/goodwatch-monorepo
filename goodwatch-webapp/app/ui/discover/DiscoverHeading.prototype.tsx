// PROTOTYPE - throwaway. Discover's heading as a full-width field that stays an input while a search is on, with the
// text shrinking to fit long queries (down to a floor), and the "Read as" / taste line grouped with it.
// Round 2: ten lighter ways to group the field and the line (D-M), with round 1 (A-C) and today's heading kept for
// comparison. Switch with ?variant= on /discover, or the arrow keys.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const HEADING_VARIANTS = {
	D: "Hairline",
	E: "Fade band",
	F: "Ghost",
	G: "Sentence",
	H: "Linked icons",
	I: "Kicker",
	J: "Rule notch",
	K: "Tray",
	L: "Capsule",
	M: "Marker",
	A: "One plate (r1)",
	B: "Rail (r1)",
	C: "Notch (r1)",
	now: "Today",
} as const
export type HeadingVariant = keyof typeof HEADING_VARIANTS

export function useHeadingVariant(): HeadingVariant {
	const [params] = useSearchParams()
	const v = params.get("variant")
	return v && v in HEADING_VARIANTS ? (v as HeadingVariant) : "D"
}

export function HeadingSwitcher() {
	return <PrototypeSwitcher variants={HEADING_VARIANTS} />
}

const COMMIT_MS = 800
const PRIVATE = "search-private ph-no-capture sentry-mask"

interface Range {
	max: number
	min: number
}
/** Wide screens: 48 px down to 22 px. Phones: 30 px down to 18 px. */
const WIDE: Range = { max: 48, min: 22 }
const NARROW: Range = { max: 30, min: 18 }

// The size at which the text fills the room it has, between the floor and the ceiling. Past the floor the field
// scrolls sideways like any input, and its end fades while it isn't being edited. The room is the row's width minus
// what else sits in it (`chrome`), so the field may size itself to its text.
function useFitSize(
	text: string,
	row: HTMLElement | null,
	input: HTMLInputElement | null,
	chrome: { wide: number; narrow: number },
	ranges: { wide: Range; narrow: Range },
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
	const [fontsReady, setFontsReady] = useState(false)
	useEffect(() => {
		document.fonts?.ready.then(() => setFontsReady(true))
	}, [])
	const [fit, setFit] = useState({
		size: ranges.wide.max,
		overflows: false,
		textWidth: 0,
	})
	useLayoutEffect(() => {
		if (!input || !width) return
		const wide = width >= 640
		const range = wide ? ranges.wide : ranges.narrow
		const style = getComputedStyle(input)
		const ctx = document.createElement("canvas").getContext("2d")
		if (!ctx) return
		ctx.font = `${style.fontWeight} 100px ${style.fontFamily}`
		const at100 = ctx.measureText(text || input.placeholder || " ").width
		const room = Math.max(80, width - (wide ? chrome.wide : chrome.narrow))
		const ideal = ((room - 4) / at100) * 100
		const size = Math.max(range.min, Math.min(range.max, Math.floor(ideal)))
		setFit({
			size,
			overflows: ideal < range.min,
			textWidth: Math.ceil((at100 * size) / 100) + 6,
		})
	}, [text, width, input, chrome.wide, chrome.narrow, ranges, fontsReady])
	return fit
}

interface HeadingProps {
	q: string | null
	onSearch: (text: string) => void
	onClear: () => void
	explanation: ReactNode
	/** The explanation has something to show. */
	hasExplanation: boolean
	variant: Exclude<HeadingVariant, "now">
}

// The field's behavior, shared by the variants: typing searches after a pause, Enter at once, Escape puts the
// search back. Browsing, the title shows until tapped; with a search on, the field stays.
function useQueryField({ q, onSearch, onClear }: HeadingProps) {
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState(q ?? "")
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const [input, setInput] = useState<HTMLInputElement | null>(null)
	const latest = useRef({ q, onSearch, draft })
	latest.current = { q, onSearch, draft }
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
	return {
		input,
		inputRef: useCallback((el: HTMLInputElement | null) => setInput(el), []),
		draft,
		showField: q !== null || open,
		open: () => setOpen(true),
		type: (text: string) => {
			setDraft(text)
			clearTimeout(timer.current)
			timer.current = setTimeout(() => run(text), COMMIT_MS)
		},
		enter: () => {
			clearTimeout(timer.current)
			run(latest.current.draft)
			input?.blur()
		},
		escape: () => {
			clearTimeout(timer.current)
			setDraft(latest.current.q ?? "")
			input?.blur()
			if (latest.current.q === null) setOpen(false)
		},
		blur: () => {
			if (latest.current.q === null && !latest.current.draft.trim())
				setOpen(false)
		},
		clear: () => {
			clearTimeout(timer.current)
			last.current = ""
			setDraft("")
			setOpen(false)
			onClear()
		},
	}
}

/** Clear: a small labeled pill. */
function ClearButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onMouseDown={(e) => e.preventDefault()}
			onClick={onClick}
			aria-label="Clear the search, back to Discover"
			className="group/clear inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-full bg-white/[0.06] px-2 text-xs font-semibold sm:pr-3 text-gray-300 ring-1 ring-inset ring-white/10 transition-colors cursor-pointer hover:bg-white/[0.12] hover:text-white"
		>
			<XMarkIcon className="h-4 w-4 text-gray-400 transition-colors group-hover/clear:text-white sm:h-3.5 sm:w-3.5" />
			<span className="hidden sm:inline">Clear</span>
		</button>
	)
}

interface RowOptions {
	/** Row height classes. */
	height?: string
	ranges?: { wide: Range; narrow: Range }
	/** The field sizes to its text and this follows it in the same row, wrapping below when there's no room. */
	after?: ReactNode
	/** An amber marker under the query's words. */
	marker?: boolean
	/** No magnifier in the row (the variant draws its own). */
	noIcon?: boolean
}

const DEFAULT_RANGES = { wide: WIDE, narrow: NARROW }

function FieldRow({
	props,
	height = "h-14 lg:h-16",
	ranges = DEFAULT_RANGES,
	after,
	marker = false,
	noIcon = false,
}: { props: HeadingProps } & RowOptions) {
	const f = useQueryField(props)
	const [row, setRow] = useState<HTMLDivElement | null>(null)
	const searching = props.q !== null
	const showClear = searching || Boolean(f.draft)
	// Icon and gaps, and the Clear pill when it shows. A field sized to its text leaves the rest of the row to `after`.
	const chrome = {
		wide: (noIcon ? 0 : 32) + (showClear ? 88 : 0),
		narrow: (noIcon ? 0 : 32) + (showClear ? 44 : 0),
	}
	const { size, overflows, textWidth } = useFitSize(
		f.draft,
		row,
		f.input,
		chrome,
		ranges,
	)
	const [focused, setFocused] = useState(false)
	const fade =
		overflows && !focused
			? "linear-gradient(to right, black calc(100% - 3rem), transparent)"
			: undefined
	const inputId = useId()

	if (!f.showField)
		return (
			<button
				type="button"
				onClick={f.open}
				aria-label="Search Discover"
				className={`group flex w-full min-w-0 items-center gap-3 text-left cursor-text outline-none ${height}`}
			>
				<h1 className="brand-header text-3xl text-white lg:text-4xl">
					Discover
				</h1>
				<span className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-200 ring-1 ring-white/15 group-hover:bg-white/10">
					<MagnifyingGlassIcon className="h-5 w-5" />
				</span>
			</button>
		)

	const inline = after !== undefined
	const icon = !noIcon && (
		<MagnifyingGlassIcon
			className={`h-5 w-5 shrink-0 ${searching ? "text-amber-400" : "text-gray-400"}`}
			aria-hidden
		/>
	)
	const field = (
		<span className={`relative flex min-w-0 flex-1 items-center ${inline ? "h-12 lg:h-14" : "h-full"}`}>
			<input
				ref={f.inputRef}
				id={inputId}
				type="search"
				value={f.draft}
				// Opened by the person's tap when browsing; a search on screen doesn't take focus.
				// biome-ignore lint/a11y/noAutofocus: opened by the person
				autoFocus={!searching}
				autoComplete="off"
				enterKeyHint="search"
				maxLength={SEARCH_MAX_CHARS}
				data-ph-no-capture
				placeholder="What’s the mood?"
				onChange={(e) => f.type(e.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => {
					setFocused(false)
					f.blur()
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault()
						f.enter()
					}
					if (e.key === "Escape") {
						e.preventDefault()
						f.escape()
					}
				}}
				style={{ fontSize: size, maskImage: fade, WebkitMaskImage: fade }}
				className="brand-header h-full w-full min-w-0 border-0 bg-transparent p-0 leading-tight text-white outline-none transition-[font-size] duration-150 placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{marker && f.draft && (
				<span
					aria-hidden
					className="pointer-events-none absolute left-0 h-[3px] rounded-full bg-linear-to-r from-amber-400/80 to-amber-400/30 transition-[width] duration-150"
					style={{ top: `calc(50% + ${size * 0.62}px)`, width: `min(100%, ${textWidth}px)` }}
				/>
			)}
		</span>
	)
	const clear = showClear && <ClearButton onClick={f.clear} />
	const labels = (
		<>
			{searching && <h1 className="sr-only">Search: {props.q}</h1>}
			<label htmlFor={inputId} className="sr-only">
				Search Discover
			</label>
		</>
	)

	// The field takes its text's width (icon, text and Clear as one piece); `after` follows, wrapping under it.
	if (inline)
		return (
			<div
				ref={setRow}
				className={`flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-1 py-2 ${PRIVATE}`}
			>
				{labels}
				<span
					className="flex min-w-0 max-w-full items-center gap-3"
					style={{ width: `calc(${textWidth}px + ${(noIcon ? 0 : 32) + (showClear ? 100 : 0)}px)` }}
				>
					{icon}
					{field}
					{clear}
				</span>
				<div className="min-w-48 flex-1">{after}</div>
			</div>
		)

	return (
		<div
			ref={setRow}
			className={`flex w-full min-w-0 items-center gap-x-3 ${height} ${PRIVATE}`}
		>
			{labels}
			{icon}
			{field}
			{clear}
		</div>
	)
}

export function DiscoverHeadingPrototype(props: HeadingProps) {
	const { variant, explanation, hasExplanation, q } = props
	const searching = q !== null
	const line = hasExplanation ? explanation : null

	switch (variant) {
		// D: no box. A hairline under the field, brightest at the left, amber while editing; the line sits under it.
		case "D":
			return (
				<div className="group/d">
					<FieldRow props={props} />
					<div className="h-px bg-linear-to-r from-white/25 via-white/10 to-transparent transition-colors group-focus-within/d:from-amber-400/80 group-focus-within/d:via-amber-400/20" />
					{line && <div className="overflow-hidden pt-2.5">{line}</div>}
				</div>
			)

		// E: a soft band that fades out to the right, no border; the line inside it.
		case "E":
			return (
				<div className="rounded-2xl bg-linear-to-r from-white/[0.07] via-white/[0.03] to-transparent px-4 lg:px-5">
					<FieldRow props={props} />
					{line && <div className="-mt-1 overflow-hidden pb-3">{line}</div>}
				</div>
			)

		// F: no chrome at rest; a quiet plate shows on hover and while editing.
		case "F":
			return (
				<div className="-mx-4 rounded-2xl px-4 ring-1 ring-transparent transition-[background-color,box-shadow] duration-200 hover:bg-white/[0.035] hover:ring-white/[0.07] focus-within:bg-white/[0.05] focus-within:ring-white/15 lg:-mx-5 lg:px-5">
					<FieldRow props={props} />
					{line && <div className="-mt-1 overflow-hidden pb-3">{line}</div>}
				</div>
			)

		// G: the field takes its text's width and the line follows on the same row, wrapping under a long query.
		case "G":
			return (
				<div className="border-b border-white/10">
					<FieldRow props={props} after={line ?? <span />} />
				</div>
			)

		// H: the magnifier and the fingerprint share one column, joined by a short dotted stem.
		case "H":
			return (
				<div>
					<FieldRow props={props} />
					{line && (
						<>
							<span
								aria-hidden
								className={`-mt-3.5 ml-[9px] block h-3.5 w-0 border-l-2 border-dotted ${searching ? "border-amber-400/50" : "border-white/20"}`}
							/>
							<div className="overflow-hidden pt-1">{line}</div>
						</>
					)}
				</div>
			)

		// I: the line as a kicker above the query.
		case "I":
			return (
				<div>
					{line && <div className="overflow-hidden pb-1">{line}</div>}
					<FieldRow props={props} />
					<div className="h-px bg-white/10" />
				</div>
			)

		// J: no box; one rule under the field with the line set into it at the left.
		case "J":
			return (
				<div className={`relative ${line ? "mb-4" : ""}`}>
					<FieldRow props={props} />
					<div className="h-px bg-white/15" />
					{line && (
						<div className="absolute right-0 bottom-0 left-0 flex translate-y-1/2">
							<div className="min-w-0 max-w-full overflow-hidden bg-gray-900 pr-3">
								{line}
							</div>
						</div>
					)}
				</div>
			)

		// K: the field bare, the line in a soft tray that hugs its chips.
		case "K":
			return (
				<div>
					<FieldRow props={props} />
					{line && (
						<div className="mt-1 inline-flex max-w-full overflow-hidden rounded-2xl bg-white/[0.04] px-3 py-1.5 ring-1 ring-inset ring-white/[0.06]">
							{line}
						</div>
					)}
				</div>
			)

		// L: a slim capsule field; the line under it, lined up with the text.
		case "L":
			return (
				<div>
					<div className="rounded-full bg-white/[0.06] px-5 ring-1 ring-white/10 transition-shadow focus-within:ring-amber-400/50">
						<FieldRow
							props={props}
							height="h-12 lg:h-14"
							ranges={{
								wide: { max: 34, min: 18 },
								narrow: { max: 22, min: 16 },
							}}
						/>
					</div>
					{line && <div className="overflow-hidden px-5 pt-2.5">{line}</div>}
				</div>
			)

		// M: an amber marker under the query's own words; the line right under it.
		case "M":
			return (
				<div>
					<FieldRow props={props} marker />
					{line && <div className="overflow-hidden pt-2">{line}</div>}
				</div>
			)

		// Round 1.
		case "A":
			return (
				<div className="rounded-2xl bg-white/[0.045] ring-1 ring-white/10 transition-shadow focus-within:ring-amber-400/50">
					<div className="px-4 lg:px-5">
						<FieldRow props={props} />
					</div>
					{line && (
						<div className="overflow-hidden border-t border-white/[0.07] px-4 py-2.5 lg:px-5">
							{line}
						</div>
					)}
				</div>
			)
		case "B":
			return (
				<div className="relative pl-4 lg:pl-5">
					<span
						aria-hidden
						className={`absolute top-1 bottom-1 left-0 w-[3px] rounded-full transition-colors ${searching ? "bg-amber-400/80" : "bg-white/15"}`}
					/>
					<div className="border-b border-white/15 transition-colors focus-within:border-amber-400/70">
						<FieldRow props={props} />
					</div>
					{line && <div className="overflow-hidden pt-2.5">{line}</div>}
				</div>
			)
		default:
			return (
				<div
					className={`relative rounded-2xl ring-1 transition-shadow focus-within:ring-amber-400/60 ${searching ? "ring-white/25" : "ring-white/15"} ${line ? "mb-5" : ""}`}
				>
					<div className="px-4 pb-1 lg:px-5">
						<FieldRow props={props} />
					</div>
					{line && (
						<div className="absolute right-3 bottom-0 left-3 flex translate-y-1/2">
							<div className="min-w-0 max-w-full overflow-hidden bg-gray-900 px-2">
								{line}
							</div>
						</div>
					)}
				</div>
			)
	}
}
