// Discover's search field, the same in both modes. The text is left-aligned; while the field is empty one example at a time
// sits under the placeholder. The search runs on a pause in typing. Advanced shows the Search label over the text, Easy
// doesn't. Ready to watch sits inside the field on desktop, after a full-height line. While a search runs, an amber line
// slides along the field's foot (discover/search-pending.ts).
import {
	ArrowRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import type { SearchTrigger } from "~/domain/search-attribution"
import { SEARCH_EXAMPLES as TRY } from "~/ui/search/search-examples"
import { PRIVATE } from "./DiscoverBar"

const TRY_MS = 3200
const PLACEHOLDER = "Describe what you want to watch"
const TYPING_PAUSE_MS = 500
const MIN_CHARS = 2

function OneExample({
	run,
	paused,
}: {
	run: (text: string) => void
	paused: boolean
}) {
	const [index, setIndex] = useState(0)
	const [hovered, setHovered] = useState(false)
	useEffect(() => setIndex(Math.floor(Math.random() * TRY.length)), [])
	const still = paused || hovered
	useEffect(() => {
		if (still || matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const timer = setInterval(
			() => setIndex((current) => (current + 1) % TRY.length),
			TRY_MS,
		)
		return () => clearInterval(timer)
	}, [still])
	return (
		<div
			className="relative h-5"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{TRY.map((example, position) => (
				<button
					key={example}
					type="button"
					tabIndex={position === index ? 0 : -1}
					aria-hidden={position !== index}
					onClick={() => run(example)}
					className={`absolute left-0 cursor-pointer text-left text-[13px] text-gray-400 transition duration-500 outline-none hover:text-amber-300 focus-visible:text-amber-300 ${position === index ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
				>
					Try “{example}”
				</button>
			))}
		</div>
	)
}

export function DescribeField({
	typed,
	onSearch,
	onClear,
	flatBottom,
	ready,
	inputRef,
	pending = false,
	onUnsent,
}: {
	/** What the running search shows in the field. */
	typed: string
	/** The trigger says what sent the words: a typing pause, Enter, the Search button, or an example. */
	onSearch: (text: string, trigger: SearchTrigger) => void
	onClear: () => void
	/** Advanced: the filter bar continues the field. */
	flatBottom: boolean
	/** Inside the field on desktop. */
	ready: ReactNode
	inputRef?: Ref<HTMLInputElement>
	/** A search is running: the line on the field's foot. */
	pending?: boolean
	/** The words the typing pause will send, from the keystroke that arms it; null when it will send nothing new. */
	onUnsent?: (words: string | null) => void
}) {
	const [text, setText] = useState(typed)
	// What this field last sent: its answer coming back must not overwrite what is being typed.
	const sent = useRef(typed)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	// The person's own Enter or Search button press, for the submit it sets off in the same task: a submit without one
	// (form.requestSubmit from a script, an extension, an untrusted event) is no action and buys no reading.
	const pressed = useRef<"enter" | "search_button" | null>(null)
	const press = (how: "enter" | "search_button") => {
		// Enter submits through a click on the Search button (implicit submission): the key it came from stays the label.
		if (pressed.current) return
		pressed.current = how
		setTimeout(() => {
			pressed.current = null
		}, 0)
	}
	// An input method is composing: the Enter that confirms its text is no search. Typing pauses still run on the
	// composing text (Android keyboards keep the last word composing until a space or suggestion).
	const composing = useRef(false)
	useEffect(() => {
		if (typed === sent.current) return
		clearTimeout(timer.current)
		sent.current = typed
		setText(typed)
		// The words changed elsewhere (Clear all, a link): nothing is about to be searched.
		onUnsent?.(null)
	}, [typed])
	useEffect(
		() => () => {
			clearTimeout(timer.current)
			onUnsent?.(null)
		},
		[],
	)
	const filled = text.trim().length > 0
	const label = flatBottom && filled
	// A typing pause on the words already sent sends nothing. Enter and the Search button always send: on the words a
	// link brought, they are the person's action that lets a withheld reading run (useDiscoverSearch). A submit no
	// press set off is labeled navigation and, on the same words, sends nothing.
	const send = (value: string, trigger: SearchTrigger) => {
		clearTimeout(timer.current)
		const same = value === sent.current
		if (
			same &&
			(trigger === "typing_pause" || trigger === "navigation" || !value)
		)
			return onUnsent?.(null)
		sent.current = value
		// The page keeps the search pending until the URL has these words; the URL already has the same words.
		onUnsent?.(same ? null : value || null)
		if (value) onSearch(value, trigger)
		else onClear()
	}
	const type = (value: string) => {
		setText(value)
		clearTimeout(timer.current)
		const words = value.trim()
		if (!words) return send("", "typing_pause")
		onUnsent?.(
			words.length >= MIN_CHARS && words !== sent.current ? words : null,
		)
		if (words.length >= MIN_CHARS)
			timer.current = setTimeout(
				() => send(words, "typing_pause"),
				TYPING_PAUSE_MS,
			)
	}
	const run = (value: string) => {
		setText(value)
		send(value, "selection")
	}
	return (
		<form
			role="search"
			onSubmit={(event) => {
				event.preventDefault()
				const trigger = pressed.current ?? "navigation"
				pressed.current = null
				send(text.trim(), trigger)
			}}
			className={`relative flex items-stretch bg-white/[0.045] pl-4 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 lg:pl-8 ${
				flatBottom
					? "rounded-t-[22px] lg:rounded-t-[32px]"
					: "rounded-[22px] lg:rounded-[32px]"
			}`}
		>
			<div className="relative flex min-h-[92px] min-w-0 flex-1 flex-col justify-center pr-2 lg:min-h-[108px] lg:pr-3">
				<span
					className={`absolute top-[25px] flex h-[15px] items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-amber-300/80 uppercase transition-opacity duration-150 lg:top-[30px] ${label ? "opacity-100" : "opacity-0"}`}
					aria-hidden={!label}
				>
					<MagnifyingGlassIcon className="h-3 w-3" aria-hidden />
					Search
				</span>
				<input
					ref={inputRef}
					type="search"
					value={text}
					maxLength={SEARCH_MAX_CHARS}
					autoComplete="off"
					enterKeyHint="search"
					aria-label="Search by mood, plot, or title"
					placeholder={PLACEHOLDER}
					onChange={(event) => type(event.target.value)}
					onKeyDown={(event) => {
						// The Enter that confirms a composition is no search (Safari sends it after compositionend, as 229).
						if (
							event.key === "Enter" &&
							event.nativeEvent.isTrusted &&
							!event.nativeEvent.isComposing &&
							event.nativeEvent.keyCode !== 229 &&
							!composing.current
						)
							press("enter")
					}}
					onCompositionStart={() => {
						composing.current = true
					}}
					onCompositionEnd={() => {
						composing.current = false
					}}
					className={`brand-header w-full min-w-0 border-0 bg-transparent p-0 pr-10 text-[20px] leading-tight text-white transition-transform duration-200 outline-none placeholder:text-[18px] placeholder:text-gray-500 focus:ring-0 lg:text-[25px] lg:placeholder:text-[25px] [&::-webkit-search-cancel-button]:hidden ${label ? "translate-y-2" : filled ? "translate-y-0" : "-translate-y-[13px]"} ${PRIVATE}`}
				/>
				<div
					className={`absolute inset-x-0 bottom-3 transition-opacity duration-150 lg:bottom-4 ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
					{...(filled ? { inert: "" } : {})}
				>
					<OneExample run={run} paused={filled} />
				</div>
				{filled && (
					<button
						type="button"
						aria-label="Clear the search"
						onClick={() => run("")}
						className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white lg:right-2"
					>
						<XMarkIcon className="h-5 w-5" aria-hidden />
					</button>
				)}
			</div>
			<span
				aria-hidden
				className={`pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full transition-opacity duration-150 lg:inset-x-10 ${pending ? "opacity-100" : "opacity-0"}`}
			>
				<span
					className={`block h-full w-1/3 animate-search-pending rounded-full bg-amber-400 motion-reduce:w-full motion-reduce:animate-none motion-reduce:bg-amber-400/60 ${pending ? "" : "[animation-play-state:paused]"}`}
				/>
			</span>
			<span
				className="hidden w-px shrink-0 self-stretch bg-white/10 lg:block"
				aria-hidden
			/>
			<div className="flex shrink-0 items-center gap-1 pr-2.5 lg:pr-3 lg:pl-1.5">
				<div className="hidden h-14 items-center lg:flex">{ready}</div>
				<button
					type="submit"
					aria-label="Search"
					onClick={(event) => {
						if (event.nativeEvent.isTrusted) press("search_button")
					}}
					className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-amber-400 font-bold text-gray-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white lg:h-auto lg:w-auto lg:px-6 lg:py-3.5"
				>
					<ArrowRightIcon className="h-5 w-5 lg:hidden" aria-hidden />
					<span className="hidden lg:inline">Search</span>
				</button>
			</div>
		</form>
	)
}
