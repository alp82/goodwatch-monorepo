// Discover's search field, the same in both modes. It shows two things at a time: while empty the Try examples over the
// placeholder, with text the Search label over the text. The text line never moves. Ready to watch sits inside the field
// on desktop, after a full-height line.
import {
	ArrowRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { type ReactNode, type Ref, useEffect, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { PRIVATE } from "./DiscoverBar"

/** Example searches. `query` is the wording the interpreter reads right, where it isn't the label. */
const TRY: { label: string; query?: string }[] = [
	{ label: "cozy anime" },
	{ label: "feel-good K-drama", query: "heartwarming korean drama" },
	{ label: "funny horror" },
	{ label: "80+ last 5 years" },
]
const PLACEHOLDER_WIDE = "Describe it: “Wednesday vibes, but darker”"
const PLACEHOLDER_NARROW = "Describe it: “cozy anime”"

function usePlaceholder() {
	const [value, set] = useState(PLACEHOLDER_WIDE)
	useEffect(() => {
		const wide = matchMedia("(min-width: 1024px)")
		const update = () => set(wide.matches ? PLACEHOLDER_WIDE : PLACEHOLDER_NARROW)
		update()
		wide.addEventListener("change", update)
		return () => wide.removeEventListener("change", update)
	}, [])
	return value
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
	/** The filter bar continues the field. */
	flatBottom: boolean
	/** Inside the field on desktop. */
	ready: ReactNode
	inputRef?: Ref<HTMLInputElement>
}) {
	const placeholder = usePlaceholder()
	const [text, setText] = useState(typed)
	useEffect(() => setText(typed), [typed])
	const filled = text.trim().length > 0
	const run = (value: string) => {
		setText(value)
		onSearch(value)
	}
	return (
		<form
			role="search"
			onSubmit={(event) => {
				event.preventDefault()
				const value = text.trim()
				if (value) onSearch(value)
				else onClear()
			}}
			className={`relative flex items-stretch bg-white/[0.045] pl-4 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 lg:pl-8 ${
				flatBottom
					? "rounded-t-[22px] lg:rounded-t-[32px]"
					: "rounded-[22px] lg:rounded-[32px]"
			}`}
		>
			<div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3.5 pr-2 lg:gap-2 lg:py-[18px] lg:pr-3">
				<div className="relative h-[18px]">
					<span
						className={`absolute inset-0 flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-amber-300/80 uppercase transition-opacity duration-150 ${filled ? "opacity-100" : "opacity-0"}`}
					>
						<MagnifyingGlassIcon className="h-3 w-3" aria-hidden />
						Search
					</span>
					<div
						className={`absolute inset-0 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap transition-opacity duration-150 [scrollbar-width:none] ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
						{...(filled ? { inert: "" } : {})}
					>
						<span className="mr-1 shrink-0 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">
							Try
						</span>
						{TRY.map((item, index) => (
							<button
								key={item.label}
								type="button"
								onClick={() => run(item.query ?? item.label)}
								className={`shrink-0 cursor-pointer text-[13px] text-gray-300 underline decoration-white/30 decoration-dotted underline-offset-[3px] transition outline-none hover:text-amber-300 hover:decoration-amber-400 focus-visible:text-amber-300 ${index ? "ml-2" : ""}`}
							>
								{item.label}
							</button>
						))}
					</div>
				</div>
				<input
					ref={inputRef}
					type="search"
					value={text}
					maxLength={SEARCH_MAX_CHARS}
					autoComplete="off"
					enterKeyHint="search"
					aria-label="Search by mood, plot, or title"
					placeholder={placeholder}
					onChange={(event) => setText(event.target.value)}
					className={`brand-header w-full min-w-0 border-0 bg-transparent p-0 text-[20px] leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 lg:text-[25px] [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
				/>
			</div>
			{filled && (
				<div className="flex shrink-0 items-center pr-1 lg:pr-3">
					<button
						type="button"
						aria-label="Clear the search"
						onClick={() => {
							setText("")
							onClear()
						}}
						className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
					>
						<XMarkIcon className="h-5 w-5" aria-hidden />
					</button>
				</div>
			)}
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
