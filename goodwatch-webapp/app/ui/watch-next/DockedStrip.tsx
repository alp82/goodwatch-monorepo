// The glass strip docked on the hero's top edge: moods, how many titles fit, On my services, and the sort. Once it
// scrolls away, the same line pins under the site header.
import { GlobeAltIcon, PlusIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { WatchNextSort } from "~/domain/watch-next"
import type { WatchNext } from "~/server/watch-next.server"
import {
	MoodButton,
	type MoodControl,
	MoodPanel,
	PickedMoods,
} from "./MoodPicker"
import { SortMenu } from "./SortMenu"
import { EASE, WRAP, logoUrl } from "./style"

export interface StripProps {
	data: WatchNext
	moods: MoodControl
	setOnMyServices: (on: boolean) => void
	setSort: (sort: WatchNextSort) => void
}

// The site header's height: the pinned line sits right under it.
const HEADER_PX = 64

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
				className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 pl-2 pr-3 text-sm font-semibold text-gray-100 ring-1 ring-white/15 transition-colors hover:bg-white/20"
			>
				<PlusIcon className="h-4 w-4 text-amber-300" aria-hidden />
				Add my services
			</Link>
		)
	const on = data.onMyServices
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => setOnMyServices(!on)}
			title={
				on
					? "Showing what you can play on your services first. Tap to include everywhere."
					: "Including titles on any service. Tap to put your services first."
			}
			className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full pl-1.5 pr-3 text-sm font-semibold transition-colors ${on ? "bg-white text-black hover:bg-gray-200" : "bg-white/10 text-gray-100 ring-1 ring-white/15 hover:bg-white/20"}`}
		>
			{on ? (
				<span className="flex -space-x-1.5" aria-hidden>
					{data.myServices.slice(0, 3).map((service) => (
						<img
							key={service.id}
							src={logoUrl(service.logo_path)}
							alt=""
							className="h-6 w-6 rounded-full ring-2 ring-white"
						/>
					))}
				</span>
			) : (
				<GlobeAltIcon className="ml-0.5 h-5 w-5 text-gray-300" aria-hidden />
			)}
			{on ? "On my services" : compact ? "All" : "Everywhere"}
		</button>
	)
}

// "23 fit" with moods, "151 on your services" without, or the Wishlist's size with no filter.
function FitCount({
	data,
	className = "",
}: { data: WatchNext; className?: string }) {
	const filtered = data.moods.length > 0 || data.onMyServices
	if (!filtered)
		return (
			<span
				className={`whitespace-nowrap text-sm tabular-nums text-gray-400 ${className}`}
			>
				{data.total} {data.total === 1 ? "title" : "titles"}
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
			{data.moods.length ? "fit" : "on your services"}
		</span>
	)
}

function StripBody({
	data,
	moods,
	setOnMyServices,
	setSort,
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
						className="fixed inset-x-0 top-16 z-40 border-b border-white/10 bg-gray-900/90 backdrop-blur-md"
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
