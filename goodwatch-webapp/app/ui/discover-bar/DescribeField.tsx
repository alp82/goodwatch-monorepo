// PROTOTYPE (discover-field): five looks for Discover's search field, chosen by ?variant= (see prototype-field-switcher).
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

/** Example searches. `query` is the wording the interpreter reads right, where it isn't the label. */
const TRY: { label: string; query?: string }[] = [
	{ label: "cozy anime" },
	{ label: "feel-good K-drama", query: "heartwarming korean drama" },
	{ label: "funny horror" },
	{ label: "80+ last 5 years" },
]

const PLACEHOLDER: Record<Look, string> = {
	A: "What do you feel like watching?",
	B: "What are you in the mood for?",
	C: "What are you in the mood for?",
	D: "Describe what you want to watch",
	E: "What do you feel like watching?",
}

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
			{TRY.map((item) => (
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
		<div className="flex items-center gap-2 overflow-x-auto px-px py-px whitespace-nowrap [scrollbar-width:none] lg:justify-center">
			{TRY.map((item) => (
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
					className={`absolute inset-x-0 cursor-pointer text-center text-[13px] text-gray-400 transition duration-500 outline-none hover:text-amber-300 focus-visible:text-amber-300 ${i === index ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
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
	useEffect(() => setText(typed), [typed])
	const filled = text.trim().length > 0
	const run = (value: string) => {
		setText(value)
		onSearch(value)
	}

	const centered = look !== "A"
	const twoLines = look === "B" || look === "D"
	const below = look === "A" || look === "C"
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
			? "-translate-y-[13px]"
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
					const value = text.trim()
					if (value) onSearch(value)
					else onClear()
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
									? "min-h-[92px] lg:min-h-[108px]"
									: "min-h-[70px] lg:min-h-[88px]"
						}`}
						style={
							centered && !decks
								? { paddingLeft: Math.max(0, rightWidth - 16) }
								: undefined
						}
					>
						<span
							className={`absolute top-2.5 flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-amber-300/80 uppercase transition-opacity duration-150 lg:top-3 ${label ? "opacity-100" : "opacity-0"} ${centered ? "inset-x-0 justify-center" : ""}`}
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
							onChange={(event) => setText(event.target.value)}
							className={`brand-header w-full min-w-0 border-0 bg-transparent p-0 pr-10 text-[20px] leading-tight text-white transition-transform duration-200 outline-none placeholder:text-[18px] placeholder:text-gray-500 focus:ring-0 lg:text-[25px] lg:placeholder:text-[25px] [&::-webkit-search-cancel-button]:hidden ${lift} ${centered ? "pl-10 text-center" : ""} ${PRIVATE}`}
						/>
						{twoLines && (
							<div
								className={`absolute inset-x-0 bottom-3 transition-opacity duration-150 lg:bottom-4 ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
								style={{ paddingLeft: Math.max(0, rightWidth - 16) }}
								{...(filled ? { inert: "" } : {})}
							>
								{look === "B" ? <TryLinks run={run} center /> : <TryOne run={run} />}
							</div>
						)}
						{filled && (
							<button
								type="button"
								aria-label="Clear the search"
								onClick={() => {
									setText("")
									onClear()
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
						<div className={`pt-2.5 ${look === "A" ? "pl-4 lg:pl-8" : ""}`}>
							{look === "A" ? <TryLinks run={run} /> : <TryPills run={run} />}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
