// Discover's search field, the same in both modes. The text is left-aligned; while the field is empty one example at a time
// sits under the placeholder. The search runs on a pause in typing. Advanced shows the Search label over the text, Easy
// doesn't. Ready to watch sits inside the field on desktop, after a full-height line.
import {
	ArrowRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { PRIVATE } from "./DiscoverBar"

/** Example searches. Each one was run through this field and checked for relevant results; rerun new ones the same way. */
const TRY = [
	"cozy anime",
	"Timothée Chalamet movies",
	"mind-bending sci-fi",
	"korean thrillers",
	"funny horror",
	"Studio Ghibli",
	"A24 horror",
	"80+ last 5 years",
	"slow burn thrillers",
	"Ryan Gosling movies",
	"japanese revenge thrillers",
	"Wednesday vibes, but darker",
	"folk horror",
	"anime from the last 3 years",
	"romcoms from the 2000s",
	"vampires but funny",
	"Christopher Nolan films",
	"nordic noir",
	"post-apocalyptic shows",
	"horror from the last 3 years",
	"food documentaries",
	"spy thrillers from the 70s",
	"hong kong action",
	"Florence Pugh movies",
	"survival in the wilderness",
	"sports underdog stories",
	"one-location thrillers",
	"dystopian thrillers",
	"cyberpunk",
	"heartwarming show for a rainy day",
	"courtroom drama",
	"funny and under 90 minutes",
]
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
}: {
	/** What the running search shows in the field. */
	typed: string
	onSearch: (text: string) => void
	onClear: () => void
	/** Advanced: the filter bar continues the field. */
	flatBottom: boolean
	/** Inside the field on desktop. */
	ready: ReactNode
	inputRef?: Ref<HTMLInputElement>
}) {
	const [text, setText] = useState(typed)
	// What this field last sent: its answer coming back must not overwrite what is being typed.
	const sent = useRef(typed)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => {
		if (typed === sent.current) return
		clearTimeout(timer.current)
		sent.current = typed
		setText(typed)
	}, [typed])
	useEffect(() => () => clearTimeout(timer.current), [])
	const filled = text.trim().length > 0
	const label = flatBottom && filled
	const send = (value: string) => {
		clearTimeout(timer.current)
		if (value === sent.current) return
		sent.current = value
		if (value) onSearch(value)
		else onClear()
	}
	const type = (value: string) => {
		setText(value)
		clearTimeout(timer.current)
		const words = value.trim()
		if (!words) return send("")
		if (words.length >= MIN_CHARS)
			timer.current = setTimeout(() => send(words), TYPING_PAUSE_MS)
	}
	const run = (value: string) => {
		setText(value)
		send(value)
	}
	return (
		<form
			role="search"
			onSubmit={(event) => {
				event.preventDefault()
				send(text.trim())
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
				className="hidden w-px shrink-0 self-stretch bg-white/10 lg:block"
				aria-hidden
			/>
			<div className="flex shrink-0 items-center gap-1 pr-2.5 lg:pr-3 lg:pl-1.5">
				<div className="hidden h-14 items-center lg:flex">{ready}</div>
				<button
					type="submit"
					aria-label="Search"
					className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-amber-400 font-bold text-gray-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white lg:h-auto lg:w-auto lg:px-6 lg:py-3.5"
				>
					<ArrowRightIcon className="h-5 w-5 lg:hidden" aria-hidden />
					<span className="hidden lg:inline">Search</span>
				</button>
			</div>
		</form>
	)
}
