// PROTOTYPE (start page lab): what the four search heroes share: the fixture search state, a field styled like
// DiscoverHeading's search row (Enter commits; no 800 ms timer, no hard-coded H1), the reading line and the result
// grid/row built from the real poster card.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { ReadAsChips, readAsChips } from "~/ui/discover/ReadAsChips"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { type FixtureAnswer, fixtureSearch, moodAnswer, promptAnswer } from "../../lab/fixture-search"
import { type LabCard, useLab } from "../../lab/types"

export const PRIVATE = "search-private ph-no-capture sentry-mask"
export const discoverHref = (q: string) => `/discover?q=${encodeURIComponent(q)}`

/** The captured reading as Discover's chips, whatever shape the fixture stored it in. */
export function readingChips(reading: unknown): ReadingChip[] {
	const list = Array.isArray(reading)
		? reading
		: reading && typeof reading === "object"
			? ((reading as { chips?: unknown; reading?: unknown }).chips ?? (reading as { reading?: unknown }).reading)
			: null
	if (!Array.isArray(list)) return []
	return list.filter(
		(c): c is ReadingChip => !!c && typeof c === "object" && typeof (c as ReadingChip).text === "string" && typeof (c as ReadingChip).kind === "string",
	)
}

/**
 * The hero's search: run a typed query, a mood or a captured prompt; every new answer goes to the room's shelves.
 * `land` replaces setShelfTitles when a hero wants to stage how the titles arrive.
 */
export function useHeroSearch(land?: (cards: LabCard[]) => void) {
	const lab = useLab()
	const [answer, setAnswer] = useState<FixtureAnswer | null>(null)
	const push = useRef(land ?? lab.setShelfTitles)
	push.current = land ?? lab.setShelfTitles
	useEffect(() => {
		if (answer?.titles.length) push.current(answer.titles)
	}, [answer])
	const search = useCallback((q: string) => setAnswer(q.trim() ? fixtureSearch(lab.data, q.trim()) : null), [lab.data])
	const mood = useCallback((key: string) => setAnswer(moodAnswer(lab.data, key)), [lab.data])
	const prompt = useCallback((q: string) => setAnswer(promptAnswer(lab.data, q) ?? fixtureSearch(lab.data, q)), [lab.data])
	const clear = useCallback(() => setAnswer(null), [])
	return { answer, search, mood, prompt, clear, data: lab.data }
}

/** Discover's search row: magnifier, the query in the heading font, Clear, and the hairline that turns amber. */
export function SearchField({
	value,
	onChange,
	onSubmit,
	onClear,
	placeholder = "What’s the mood?",
	overlay,
	onFocusChange,
	inputRef,
	size = "big",
	autoFocus,
}: {
	value: string
	onChange: (v: string) => void
	onSubmit: (v: string) => void
	onClear?: () => void
	placeholder?: string
	/** Drawn over the empty field (an animated example). */
	overlay?: ReactNode
	onFocusChange?: (focused: boolean) => void
	inputRef?: React.Ref<HTMLInputElement>
	size?: "big" | "small"
	autoFocus?: boolean
}) {
	const text = size === "big" ? "text-[22px] sm:text-[32px] lg:text-[42px]" : "text-[20px] sm:text-[26px]"
	return (
		<div className="group/heading">
			<form
				className={`relative flex h-14 w-full min-w-0 items-center gap-3 lg:h-16 ${PRIVATE}`}
				onSubmit={(e) => {
					e.preventDefault()
					onSubmit(value)
					;(e.currentTarget.querySelector("input") as HTMLInputElement | null)?.blur()
				}}
			>
				<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${value ? "text-amber-400" : "text-gray-400"}`} aria-hidden />
				<div className="relative h-full min-w-0 flex-1">
					<input
						ref={inputRef}
						type="search"
						aria-label="Search by mood or anything"
						value={value}
						// biome-ignore lint/a11y/noAutofocus: prototype, opened by the person
						autoFocus={autoFocus}
						autoComplete="off"
						enterKeyHint="search"
						maxLength={200}
						data-ph-no-capture
						placeholder={overlay ? "" : placeholder}
						onChange={(e) => onChange(e.target.value)}
						onFocus={() => onFocusChange?.(true)}
						onBlur={() => onFocusChange?.(false)}
						className={`brand-header h-full w-full min-w-0 border-0 bg-transparent p-0 leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${text}`}
					/>
					{overlay && !value ? <div className={`pointer-events-none absolute inset-0 flex items-center ${text}`}>{overlay}</div> : null}
				</div>
				{value || onClear ? (
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							onChange("")
							onClear?.()
						}}
						aria-label="Clear the search"
						className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 outline-none transition-colors cursor-pointer hover:bg-amber-400/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 ${value ? "" : "invisible"}`}
					>
						<XMarkIcon className="h-4 w-4" aria-hidden />
						<span className="hidden sm:inline">Clear</span>
					</button>
				) : null}
			</form>
			<div className="h-px bg-linear-to-r from-white/25 via-white/10 to-transparent transition-colors group-focus-within/heading:from-amber-400/80 group-focus-within/heading:via-amber-400/20" />
		</div>
	)
}

/** "Read as" chips when the fixture has a reading, else what the answer was. */
export function ReadingLine({ answer, className = "" }: { answer: FixtureAnswer; className?: string }) {
	const chips = readingChips(answer.reading)
	if (readAsChips(chips).length)
		return (
			<div className={`flex min-w-0 items-center gap-2 text-sm text-gray-400 ${className}`}>
				<span className="shrink-0">Read as</span>
				<ReadAsChips
					reading={chips}
					className="min-w-0 flex-1 !flex-nowrap overflow-x-auto [scrollbar-width:none] [&>li]:shrink-0 [&>li]:whitespace-nowrap sm:!flex-wrap"
				/>
			</div>
		)
	if (answer.kind === "mood")
		return <div className={`text-sm text-gray-400 ${className}`}>Mood: <span className="font-semibold text-gray-200">{answer.answeredAs}</span></div>
	return null
}

export function SeeAll({ q, className = "" }: { q: string; className?: string }) {
	return (
		<Link
			to={discoverHref(q)}
			prefetch="none"
			className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-400/10 hover:text-amber-300 ${className}`}
		>
			See all <span aria-hidden>→</span>
		</Link>
	)
}

/** Fades the cards in, a little after each other. Opacity and transform only. */
function Appear({ i, children, className = "" }: { i: number; children: ReactNode; className?: string }) {
	const reduce = useReducedMotion()
	return (
		<motion.div
			className={className}
			initial={reduce ? false : { opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay: Math.min(i, 11) * 0.035, ease: "easeOut" }}
		>
			{children}
		</motion.div>
	)
}

/** Up to 12 cards: 6 on phones (two rows of three), 8 on tablets, 12 on desktop (two rows of six). */
export function ResultGrid({ cards }: { cards: LabCard[] }) {
	return (
		<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6 lg:gap-5">
			{cards.slice(0, 12).map((card, i) => (
				<Appear key={card.key} i={i} className={i >= 8 ? "hidden lg:block" : i >= 6 ? "hidden sm:block" : ""}>
					<TitlePosterCard card={card} actions={false} posterPriority={i < 6 ? "high" : undefined} />
				</Appear>
			))}
		</div>
	)
}

/** One row of up to 12 cards that scrolls sideways (to the screen's edge on phones). */
export function ResultRow({ cards, className = "" }: { cards: LabCard[]; className?: string }) {
	return (
		<div className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:gap-3 sm:px-0 ${className}`}>
			{cards.slice(0, 12).map((card, i) => (
				<Appear key={card.key} i={i} className="w-[27vw] max-w-[150px] shrink-0 sm:w-[132px]">
					<TitlePosterCard card={card} actions={false} />
				</Appear>
			))}
		</div>
	)
}

/** The answer block most heroes put under the field: reading, See all, cards. */
export function Answer({ answer, layout = "grid" }: { answer: FixtureAnswer; layout?: "grid" | "row" }) {
	return (
		<div className="mt-4">
			<div className="mb-3 flex min-w-0 items-center gap-3">
				<ReadingLine answer={answer} className="min-w-0 flex-1" />
				<SeeAll q={answer.q} className="ml-auto -mr-3" />
			</div>
			{layout === "grid" ? <ResultGrid cards={answer.titles} /> : <ResultRow cards={answer.titles} />}
		</div>
	)
}

export const CHIP =
	"inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
export const chipTone = (on: boolean) =>
	on ? "bg-amber-400 text-gray-950 ring-amber-400" : "bg-white/[0.06] text-gray-200 ring-white/10 hover:bg-white/10 hover:text-white"
