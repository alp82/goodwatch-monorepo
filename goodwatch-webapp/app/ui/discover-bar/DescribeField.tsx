// PROTOTYPE (discover-field): five looks for Discover's search field, chosen by ?variant= (see prototype-field-switcher).
// Round 3: the text is left-aligned and the examples always sit inside the field; the looks differ in how they sit there.
// Easy never shows the Search label; Advanced shows it once there is text. Examples under the field hide in Advanced,
// where the filter bar continues the field. Ready to watch stays inside the field on desktop.
import {
	ArrowRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { PRIVATE } from "./DiscoverBar"
import { type Look, useLook } from "./prototype-field-switcher"

/** Example searches, each run through the real field and checked for relevant results. */
const TRY: { label: string; query?: string }[] = [
	{ label: "cozy anime" },
	{ label: "Timothée Chalamet movies" },
	{ label: "mind-bending sci-fi" },
	{ label: "korean thrillers" },
	{ label: "funny horror" },
	{ label: "Studio Ghibli" },
	{ label: "A24 horror" },
	{ label: "80+ last 5 years" },
	{ label: "slow burn thrillers" },
	{ label: "Ryan Gosling movies" },
	{ label: "japanese revenge thrillers" },
	{ label: "Wednesday vibes, but darker" },
	{ label: "folk horror" },
	{ label: "anime from the last 3 years" },
	{ label: "romcoms from the 2000s" },
	{ label: "vampires but funny" },
	{ label: "Christopher Nolan films" },
	{ label: "nordic noir" },
	{ label: "post-apocalyptic shows" },
	{ label: "horror from the last 3 years" },
	{ label: "food documentaries" },
	{ label: "spy thrillers from the 70s" },
	{ label: "hong kong action" },
	{ label: "Florence Pugh movies" },
	{ label: "survival in the wilderness" },
	{ label: "sports underdog stories" },
	{ label: "one-location thrillers" },
	{ label: "dystopian thrillers" },
	{ label: "cyberpunk" },
	{ label: "heartwarming show for a rainy day" },
	{ label: "courtroom drama" },
	{ label: "funny and under 90 minutes" },
]

const PLACEHOLDER: Record<Look, string> = {
	A: "What do you feel like watching?",
	B: "What are you in the mood for?",
	C: "What are you in the mood for?",
	D: "Describe what you want to watch",
	E: "What do you feel like watching?",
}

const TYPING_PAUSE_MS = 400
const MIN_CHARS = 2

const linkStyle =
	"shrink-0 cursor-pointer text-[13px] text-gray-300 underline decoration-white/30 decoration-dotted underline-offset-[3px] transition outline-none hover:text-amber-300 hover:decoration-amber-400 focus-visible:text-amber-300"

function TryLinks({ run, center }: { run: (text: string) => void; center?: boolean }) {
	return (
		<div
			className={`flex items-center gap-3.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] ${center ? "justify-start lg:justify-center" : ""}`}
		>
			<span className="shrink-0 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">
				Try
			</span>
			{TRY.slice(0, 4).map((item) => (
				<button
					key={item.label}
					type="button"
					onClick={() => run(item.query ?? item.label)}
					className={linkStyle}
				>
					{item.label}
				</button>
			))}
		</div>
	)
}

function TryPills({ run }: { run: (text: string) => void }) {
	return (
		<div className="flex items-center gap-2 overflow-x-auto px-px py-px whitespace-nowrap [scrollbar-width:none]">
			{TRY.slice(0, 4).map((item) => (
				<button
					key={item.label}
					type="button"
					onClick={() => run(item.query ?? item.label)}
					className="shrink-0 cursor-pointer rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[13px] text-gray-300 ring-1 ring-white/10 transition outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400/60"
				>
					{item.label}
				</button>
			))}
		</div>
	)
}

function TryOne({ run }: { run: (text: string) => void }) {
	const [index, setIndex] = useState(0)
	const [paused, setPaused] = useState(false)
	useEffect(() => setIndex(Math.floor(Math.random() * TRY.length)), [])
	useEffect(() => {
		if (paused) return
		const timer = setInterval(() => setIndex((i) => (i + 1) % TRY.length), 3200)
		return () => clearInterval(timer)
	}, [paused])
	return (
		<div
			className="relative h-5"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
		>
			{TRY.map((item, i) => (
				<button
					key={item.label}
					type="button"
					tabIndex={i === index ? 0 : -1}
					onClick={() => run(item.query ?? item.label)}
					className={`absolute left-0 cursor-pointer text-left text-[13px] text-gray-400 transition duration-500 outline-none hover:text-amber-300 focus-visible:text-amber-300 ${i === index ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
				>
					Try “{item.label}”
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
	/** The filter bar continues the field: Advanced. */
	flatBottom: boolean
	/** Inside the field on desktop. */
	ready: ReactNode
	inputRef?: Ref<HTMLInputElement>
}) {
	const look = useLook()
	const advanced = flatBottom
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

	const centered = false
	const twoLines = look !== "E"
	const inline = look === "B"
	const pills = look === "C"
	const below = false
	const decks = look === "E"
	const label = advanced && filled

	// True center: the left side mirrors what sits to the right of the text.
	const right = useRef<HTMLDivElement>(null)
	const [rightWidth, setRightWidth] = useState(0)
	useEffect(() => {
		const node = right.current
		if (!node) return
		const observer = new ResizeObserver(() => setRightWidth(node.offsetWidth))
		observer.observe(node)
		return () => observer.disconnect()
	}, [])

	const lift = label
		? "translate-y-2"
		: twoLines && !filled
			? pills
				? "-translate-y-[19px]"
				: inline
					? "-translate-y-[13px] xl:translate-y-0"
					: "-translate-y-[13px]"
			: "translate-y-0"

	const search = (
		<button
			type="submit"
			aria-label="Search"
			className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-amber-400 font-bold text-gray-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white lg:h-auto lg:w-auto lg:px-6 lg:py-3.5"
		>
			<ArrowRightIcon className="h-5 w-5 lg:hidden" aria-hidden />
			<span className="hidden lg:inline">Search</span>
		</button>
	)

	const hideBelow = filled && typed.trim().length > 0

	return (
		<>
			<form
				role="search"
				onSubmit={(event) => {
					event.preventDefault()
					send(text.trim())
				}}
				className={`relative bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 ${
					flatBottom
						? "rounded-t-[22px] lg:rounded-t-[32px]"
						: "rounded-[22px] lg:rounded-[32px]"
				}`}
			>
				<div className="flex items-stretch pl-4 lg:pl-8">
					<div
						className={`relative flex min-w-0 flex-1 flex-col justify-center pr-2 lg:pr-3 ${
							decks
								? "min-h-[66px] lg:min-h-[76px]"
								: twoLines
									? pills
										? "min-h-[104px] lg:min-h-[120px]"
										: inline
											? "min-h-[92px] lg:min-h-[108px] xl:min-h-[88px]"
											: "min-h-[92px] lg:min-h-[108px]"
									: "min-h-[70px] lg:min-h-[88px]"
						}`}
						style={
							centered && !decks
								? { paddingLeft: Math.max(0, rightWidth - 16) }
								: undefined
						}
					>
						<span
							className={`absolute top-[25px] flex h-[15px] items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-amber-300/80 uppercase transition-opacity duration-150 lg:top-[30px] ${label ? "opacity-100" : "opacity-0"} ${centered ? "inset-x-0 justify-center" : ""}`}
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
							placeholder={PLACEHOLDER[look]}
							onChange={(event) => type(event.target.value)}
							className={`brand-header w-full min-w-0 border-0 bg-transparent p-0 pr-10 text-[20px] leading-tight text-white transition-transform duration-200 outline-none placeholder:text-[18px] placeholder:text-gray-500 focus:ring-0 lg:text-[25px] lg:placeholder:text-[25px] [&::-webkit-search-cancel-button]:hidden ${lift} ${centered ? "pl-10 text-center" : ""} ${PRIVATE}`}
						/>
						{twoLines && (
							<div
								className={`absolute inset-x-0 bottom-3 transition-opacity duration-150 lg:bottom-4 ${inline ? "xl:hidden" : ""} ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
								{...(filled ? { inert: "" } : {})}
							>
								{look === "C" ? (
									<TryPills run={run} />
								) : look === "D" ? (
									<TryOne run={run} />
								) : (
									<TryLinks run={run} />
								)}
							</div>
						)}
						{inline && (
							<div
								className={`absolute top-1/2 right-4 hidden -translate-y-1/2 transition-opacity duration-150 xl:block ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
								{...(filled ? { inert: "" } : {})}
							>
								<TryLinks run={run} />
							</div>
						)}
						{filled && (
							<button
								type="button"
								aria-label="Clear the search"
								onClick={() => {
									run("")
								}}
								className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white lg:right-2"
							>
								<XMarkIcon className="h-5 w-5" aria-hidden />
							</button>
						)}
					</div>
					{decks ? (
						<div className="flex shrink-0 items-center pr-2.5 lg:hidden">{search}</div>
					) : (
						<div ref={right} className="flex shrink-0">
							<span
								className="hidden w-px shrink-0 self-stretch bg-white/10 lg:block"
								aria-hidden
							/>
							<div className="flex shrink-0 items-center gap-1 pr-2.5 lg:pr-3 lg:pl-1.5">
								<div className="hidden h-14 items-center lg:flex">{ready}</div>
								{search}
							</div>
						</div>
					)}
				</div>
				{decks && (
					<div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-2 lg:pr-3 lg:pl-8">
						<div
							className={`min-w-0 flex-1 transition-opacity duration-150 ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
							{...(filled ? { inert: "" } : {})}
						>
							<TryLinks run={run} />
						</div>
						<div className="hidden shrink-0 items-center gap-1 lg:flex">
							<div className="flex h-12 items-center">{ready}</div>
							{search}
						</div>
					</div>
				)}
			</form>
			{below && !advanced && (
				<div
					className={`grid transition-[grid-template-rows,opacity] duration-200 ${hideBelow ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
					{...(hideBelow ? { inert: "" } : {})}
				>
					<div className="overflow-hidden">
						<div className="pt-2.5 pl-4 lg:pl-8">
							{look === "A" ? (
								<TryLinks run={run} />
							) : look === "C" ? (
								<TryPills run={run} />
							) : (
								<TryOne run={run} />
							)}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
