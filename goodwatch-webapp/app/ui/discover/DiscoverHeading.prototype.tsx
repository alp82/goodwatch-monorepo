// PROTOTYPE - throwaway. Discover's heading as a full-width field that stays an input while a search is on, with the
// text shrinking to fit long queries (down to a floor), and the "Read as" / taste line grouped with it.
// Three variants plus today's heading, switchable with ?variant= on /discover:
//   A  One plate: field and line share one surface, a hairline between them.
//   B  Rail: no box; an underline field and an amber rail on the left that ties the line to the query.
//   C  Notch: an outlined field with the line sitting in a notch on its bottom border.
//   now  Today's heading.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const HEADING_VARIANTS = {
	A: "One plate",
	B: "Rail",
	C: "Notch",
	now: "Today",
} as const
export type HeadingVariant = keyof typeof HEADING_VARIANTS

export function useHeadingVariant(): HeadingVariant {
	const [params] = useSearchParams()
	const v = params.get("variant")
	return v && v in HEADING_VARIANTS ? (v as HeadingVariant) : "A"
}

export function HeadingSwitcher() {
	return <PrototypeSwitcher variants={HEADING_VARIANTS} />
}

const COMMIT_MS = 800
const PRIVATE = "search-private ph-no-capture sentry-mask"
/** Wide screens: 48 px down to 22 px. Phones: 30 px down to 18 px. */
const WIDE = { max: 48, min: 22 }
const NARROW = { max: 30, min: 18 }

// The size at which the text fills the field's width, between the floor and the ceiling. Past the floor the field
// scrolls sideways like any input.
function useFitSize(text: string, field: RefObject<HTMLInputElement>) {
	const [size, setSize] = useState(WIDE.max)
	const [overflows, setOverflows] = useState(false)
	const [width, setWidth] = useState(0)
	useLayoutEffect(() => {
		const el = field.current
		if (!el) return
		const observer = new ResizeObserver(([entry]) =>
			setWidth(entry.contentRect.width),
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [field])
	const [fontsReady, setFontsReady] = useState(false)
	useEffect(() => {
		document.fonts?.ready.then(() => setFontsReady(true))
	}, [])
	useLayoutEffect(() => {
		const el = field.current
		if (!el || !width) return
		const range = width >= 640 ? WIDE : NARROW
		const style = getComputedStyle(el)
		const ctx = document.createElement("canvas").getContext("2d")
		if (!ctx) return
		ctx.font = `${style.fontWeight} 100px ${style.fontFamily}`
		const at100 = ctx.measureText(text || " ").width
		const fit = ((width - 4) / at100) * 100
		setSize(Math.max(range.min, Math.min(range.max, Math.floor(fit))))
		setOverflows(fit < range.min)
	}, [text, width, field, fontsReady])
	return { size, overflows }
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
	const field = useRef<HTMLInputElement>(null)
	const latest = useRef({ q, onSearch })
	latest.current = { q, onSearch }
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
		field,
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
			run(draft)
			field.current?.blur()
		},
		escape: () => {
			clearTimeout(timer.current)
			setDraft(latest.current.q ?? "")
			field.current?.blur()
			if (latest.current.q === null) setOpen(false)
		},
		blur: () => {
			if (latest.current.q === null && !draft.trim()) setOpen(false)
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

function FieldRow(props: HeadingProps) {
	const f = useQueryField(props)
	const { size, overflows } = useFitSize(f.draft, f.field)
	const [focused, setFocused] = useState(false)
	// Past the floor, the end of the text fades out while the field isn't being edited.
	const fade =
		overflows && !focused
			? "linear-gradient(to right, black calc(100% - 3rem), transparent)"
			: undefined
	const inputId = useId()
	const searching = props.q !== null

	if (!f.showField)
		return (
			<button
				type="button"
				onClick={f.open}
				aria-label="Search Discover"
				className="group flex h-14 w-full min-w-0 items-center gap-3 text-left cursor-text outline-none lg:h-16"
			>
				<h1 className="brand-header text-3xl text-white lg:text-4xl">
					Discover
				</h1>
				<span className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-200 ring-1 ring-white/15 group-hover:bg-white/10">
					<MagnifyingGlassIcon className="h-5 w-5" />
				</span>
			</button>
		)

	return (
		<div className={`flex h-14 w-full min-w-0 items-center gap-3 lg:h-16 ${PRIVATE}`}>
			{searching && <h1 className="sr-only">Search: {props.q}</h1>}
			<label htmlFor={inputId} className="sr-only">
				Search Discover
			</label>
			<MagnifyingGlassIcon
				className={`h-5 w-5 shrink-0 ${searching ? "text-amber-400" : "text-gray-400"}`}
				aria-hidden
			/>
			<input
				ref={f.field}
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
				className="brand-header h-full min-w-0 flex-1 border-0 bg-transparent p-0 leading-tight text-white outline-none transition-[font-size] duration-150 placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{(searching || f.draft) && (
				<button
					type="button"
					onMouseDown={(e) => e.preventDefault()}
					onClick={f.clear}
					aria-label="Clear the search, back to Discover"
					className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-300 ring-1 ring-white/10 cursor-pointer hover:bg-white/10 hover:text-white"
				>
					<XMarkIcon className="h-5 w-5" />
				</button>
			)}
		</div>
	)
}

export function DiscoverHeadingPrototype(props: HeadingProps) {
	const { variant, explanation, hasExplanation, q } = props
	const searching = q !== null

	if (variant === "A")
		return (
			<div className="rounded-2xl bg-white/[0.045] ring-1 ring-white/10 transition-shadow focus-within:ring-amber-400/50">
				<div className="px-4 lg:px-5">
					<FieldRow {...props} />
				</div>
				{hasExplanation && (
					<div className="overflow-hidden border-t border-white/[0.07] px-4 py-2.5 lg:px-5">
						{explanation}
					</div>
				)}
			</div>
		)

	if (variant === "B")
		return (
			<div className="relative pl-4 lg:pl-5">
				<span
					aria-hidden
					className={`absolute top-1 bottom-1 left-0 w-[3px] rounded-full transition-colors ${searching ? "bg-amber-400/80" : "bg-white/15"}`}
				/>
				<div className="border-b border-white/15 transition-colors focus-within:border-amber-400/70">
					<FieldRow {...props} />
				</div>
				{hasExplanation && (
					<div className="overflow-hidden pt-2.5">{explanation}</div>
				)}
			</div>
		)

	// C: the line sits in a notch on the outline's bottom edge.
	return (
		<div
			className={`relative rounded-2xl ring-1 transition-shadow focus-within:ring-amber-400/60 ${searching ? "ring-white/25" : "ring-white/15"} ${hasExplanation ? "mb-5" : ""}`}
		>
			<div className="px-4 pb-1 lg:px-5">
				<FieldRow {...props} />
			</div>
			{hasExplanation && (
				<div className="absolute right-3 bottom-0 left-3 flex translate-y-1/2">
					<div className="min-w-0 max-w-full overflow-hidden bg-gray-900 px-2">
						{explanation}
					</div>
				</div>
			)}
		</div>
	)
}
