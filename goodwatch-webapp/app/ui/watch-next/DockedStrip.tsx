// The glass strip docked on the hero's top edge: moods, how many titles fit, On my services, and the sort. Once it
// scrolls away, the same line pins under the site header. From the large breakpoint up; phones use PhoneControls.
import { PlusIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { WatchNextSort } from "~/domain/watch-next"
import type { WatchNext } from "~/server/watch-next.server"
import { ServicesControl } from "~/ui/filter-bar/controls"
import { SHELL } from "~/ui/filter-bar/motion"
import {
	MoodButton,
	type MoodControl,
	MoodPanel,
	PickedMoods,
} from "./MoodPicker"
import { SortMenu } from "./SortMenu"
import { useMoviesPage } from "./WatchNextHero"
import { EASE, WRAP } from "./style"

export interface StripProps {
	data: WatchNext
	moods: MoodControl
	setOnMyServices: (on: boolean) => void
	setSort: (sort: WatchNextSort) => void
	/** One more control before On my services: My movies' "How long?". */
	extra?: ReactNode
}

// The site header's height: the pinned line sits right under it.
const HEADER_PX = 64

/**
 * On my services, with Everywhere one tap away: the filter bar's services control at the strip's height. Here it puts
 * what the person can play first instead of hiding the rest, which the tooltips say. Without saved services a link
 * to add them stands in its place: Everywhere is all there is then.
 */
function ServicesToggle({
	data,
	setOnMyServices,
	compact,
}: {
	data: WatchNext
	setOnMyServices: (on: boolean) => void
	compact: boolean
}) {
	if (!data.hasServices)
		return (
			<Link
				to="/settings/streaming"
				className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap pl-2.5 pr-3 text-sm font-bold text-gray-200 outline-none transition-colors hover:text-white hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL}`}
			>
				<PlusIcon className="h-4 w-4 shrink-0" aria-hidden />
				Add my services
			</Link>
		)
	return (
		<ServicesControl
			size="sm"
			on={data.onMyServices}
			hasServices
			providers={data.myServices}
			onChange={setOnMyServices}
			onAddServices={() => {}}
			labels={compact ? { mine: "My services", everywhere: "All" } : undefined}
			titles={{
				mine: "What you can play on your services comes first.",
				everywhere: "Titles on any service count the same.",
			}}
		/>
	)
}

// "23 fit" with moods, "151 on your services" without, or the Wishlist's size with no filter.
function FitCount({
	data,
	className = "",
}: { data: WatchNext; className?: string }) {
	const word = useMoviesPage() ? "movie" : "title"
	const timed = Boolean(data.time)
	const filtered = data.moods.length > 0 || data.onMyServices || timed
	if (!filtered)
		return (
			<span
				className={`whitespace-nowrap text-sm tabular-nums text-gray-400 ${className}`}
			>
				{data.total} {data.total === 1 ? word : `${word}s`}
			</span>
		)
	return (
		<span
			className={`whitespace-nowrap text-sm tabular-nums text-gray-400 ${className}`}
			data-count
		>
			<motion.span
				key={data.fitting}
				initial={{ opacity: 0.4 }}
				animate={{ opacity: 1 }}
				className="font-semibold text-white"
			>
				{data.fitting}
			</motion.span>{" "}
			{data.moods.length || timed ? "fit" : "on your services"}
		</span>
	)
}

function StripBody({
	data,
	moods,
	setOnMyServices,
	setSort,
	extra,
	pinned,
}: StripProps & { pinned: boolean }) {
	const anchor = useRef<HTMLDivElement>(null)
	const moodButton = useRef<HTMLButtonElement>(null)
	const picked = moods.moods.length > 0
	return (
		<div
			ref={anchor}
			className="relative"
			data-strip={pinned ? "pinned" : "docked"}
		>
			<div
				className={`flex flex-wrap items-center gap-2 ${pinned ? "min-h-12 py-1.5" : "min-h-14 rounded-2xl bg-black/45 p-2 ring-1 ring-white/10 backdrop-blur-md md:flex-nowrap md:py-0"}`}
			>
				<div className="flex min-w-0 flex-1 items-center gap-1.5">
					{picked && (
						<div
							className="-my-1 flex min-w-0 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]"
							// biome-ignore lint/a11y/useSemanticElements: a fieldset can't scroll sideways as a flex row
							role="group"
							aria-label="Picked moods"
						>
							<PickedMoods control={moods} pinned={pinned} />
						</div>
					)}
					<MoodButton control={moods} buttonRef={moodButton} />
					<FitCount
						data={data}
						className={`shrink-0 pl-1 pr-1.5 ${pinned ? "hidden lg:inline" : ""}`}
					/>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{extra}
					<ServicesToggle
						data={data}
						setOnMyServices={setOnMyServices}
						compact={pinned}
					/>
					<SortMenu
						sort={data.sort}
						bestMatch={data.bestMatch}
						onPick={setSort}
					/>
				</div>
			</div>
			<MoodPanel control={moods} anchor={anchor} returnFocus={moodButton} />
		</div>
	)
}

/** The strip on the hero's top edge; after it scrolls away, the same line waits under the header. */
export function DockedStrip(props: StripProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [pinned, setPinned] = useState(false)
	const [height, setHeight] = useState(56)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new IntersectionObserver(
			([entry]) =>
				setPinned(
					!entry.isIntersecting &&
						entry.boundingClientRect.top < HEADER_PX + 16,
				),
			{ rootMargin: `-${HEADER_PX}px 0px 0px 0px` },
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	// Switching between the docked and the pinned line closes an open dropdown so it never jumps.
	const { setOpen } = props.moods
	useEffect(() => setOpen(false), [pinned, setOpen])
	useEffect(() => {
		if (!pinned && ref.current) setHeight(ref.current.offsetHeight)
	})
	return (
		<>
			<div ref={ref} data-docked>
				{pinned ? (
					<div style={{ height }} />
				) : (
					<StripBody {...props} pinned={false} />
				)}
			</div>
			{pinned &&
				typeof document !== "undefined" &&
				createPortal(
					<motion.div
						data-pinned
						initial={{ opacity: 0, y: -12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.22, ease: EASE }}
						className="fixed inset-x-0 top-16 z-40 hidden border-b lg:block border-white/10 bg-gray-900/90 backdrop-blur-md"
					>
						<div className={WRAP}>
							<StripBody {...props} pinned />
						</div>
					</motion.div>,
					document.body,
				)}
		</>
	)
}
