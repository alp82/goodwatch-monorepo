// PROTOTYPE (Discover lab, titles g): pieces from round 7 (g, h, i shared them; g is the locked pick).
// - STEER: the three ways a title steers this list (Like this = Similar to, More like = Loved, Less like = Disliked),
//   drawn as session filter chips (pill, colored thumb, ×), never as a rating.
// - useListNav: ↑ ↓ Enter over a list while focus stays in the bar's field.
import { HandThumbDownIcon, HandThumbUpIcon, Square2StackIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import type { TitleCard } from "~/server/title-cards.server"
import type { TitleKey } from "~/utils/title-key"
import { type FoundTitle, POSTER_SM } from "../../shell-parts"
import type { Use } from "./shared"

// ---------------------------------------------------------------------------------------------------------------
// Steering

export const STEER: Record<
	Use,
	{ label: string; word: string; icon: ReactNode; color: string; text: string; idle: string }
> = {
	similarTo: {
		label: "Like this",
		word: "like",
		icon: <Square2StackIcon />,
		color: "#fb7185",
		text: "text-rose-200",
		idle: "hover:text-rose-200 hover:bg-rose-400/[0.12]",
	},
	loved: {
		label: "More like",
		word: "more like",
		icon: <HandThumbUpIcon />,
		color: "#34d399",
		text: "text-emerald-200",
		idle: "hover:text-emerald-200 hover:bg-emerald-400/[0.12]",
	},
	disliked: {
		label: "Less like",
		word: "less like",
		icon: <HandThumbDownIcon />,
		color: "#f87171",
		text: "text-red-200",
		idle: "hover:text-red-200 hover:bg-red-400/[0.12]",
	},
}
export const STEER_ORDER: Use[] = ["loved", "disliked", "similarTo"]

export const chipStyle = (color: string) => ({ background: `${color}26`, boxShadow: `inset 0 0 0 1px ${color}99` })

/** A steering pick as a session filter chip: colored thumb, tiny poster, name, ×. */
export function SteerChip({
	use,
	title,
	poster,
	onRemove,
	prefix,
	size = "md",
}: {
	use: Use
	title: string
	poster?: string | null
	onRemove: () => void
	/** Words before the name, e.g. "more like". */
	prefix?: string
	size?: "md" | "sm"
}) {
	const s = STEER[use]
	const h = size === "md" ? "h-9 text-[14px]" : "h-8 text-[13px]"
	return (
		<motion.span
			layout="position"
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className={`inline-flex max-w-full shrink-0 items-center rounded-full font-semibold whitespace-nowrap text-white ${h}`}
			style={chipStyle(s.color)}
		>
			<span className={`flex min-w-0 items-center gap-1.5 pl-1.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 ${s.text}`}>
				{poster !== undefined && <MiniPoster poster={poster} />}
				{s.icon}
				{prefix && <span className="font-normal">{prefix}</span>}
				<span className="truncate text-white">{title}</span>
			</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${title}`}
				className="grid h-full w-8 shrink-0 place-items-center rounded-r-full text-white/50 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

function MiniPoster({ poster, w = 20 }: { poster: string | null; w?: number }) {
	return (
		<span className="block shrink-0 overflow-hidden rounded-[4px] bg-white/10" style={{ width: w, height: Math.round(w * 1.5) }}>
			{poster && <img src={`${POSTER_SM}${poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />}
		</span>
	)
}

/**
 * One steering toggle for one title. Off: a quiet round thumb. On: the same thumb inside a colored chip with ×, the
 * look of an active filter, so it reads as "on for this list" rather than a saved vote.
 */
export function SteerToggle({ use, on, onToggle, wide = false }: { use: Use; on: boolean; onToggle: () => void; wide?: boolean }) {
	const s = STEER[use]
	if (on)
		return (
			<motion.button
				type="button"
				whileTap={TAP}
				aria-pressed
				onClick={onToggle}
				title={`Remove ${s.label}`}
				className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full pr-2 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${s.text}`}
				style={chipStyle(s.color)}
			>
				{s.icon}
				<span className="text-white">{s.label}</span>
				<XMarkIcon className="!h-3 !w-3 text-white/60" />
			</motion.button>
		)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={false}
			aria-label={s.label}
			title={s.label}
			onClick={onToggle}
			className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap text-gray-400 ring-1 ring-inset ring-white/10 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${s.idle} ${wide ? "px-3" : "w-8"}`}
		>
			{s.icon}
			{wide && s.label}
		</motion.button>
	)
}

/** A result card as a found title (to steer with). */
export const cardTitle = (c: TitleCard): FoundTitle => ({
	key: c.key,
	title: c.title,
	year: c.release_year ? String(c.release_year) : "",
	poster: c.poster_path,
	mediaType: c.media_type === "movie" ? "movie" : "show",
	tmdbId: c.tmdb_id,
})

// ---------------------------------------------------------------------------------------------------------------
// Filters the text points at

// ---------------------------------------------------------------------------------------------------------------
// Keyboard: ↑ ↓ Enter over a list while the bar's field keeps focus

const inBar = () => {
	const el = document.activeElement
	return el instanceof HTMLInputElement && el.getAttribute("aria-label") === "Search"
}

/**
 * The highlighted row of a list of `count` rows, moved by ↑ ↓ while typing in the bar. With `firstIsBar`, row 0 is
 * highlighted from the start and Enter on it is left to the bar (it runs the search); otherwise nothing is highlighted
 * until an arrow moves. Enter on a highlighted row calls `onEnter(i)`. Resets when `reset` changes.
 */
export function useListNav(count: number, onEnter: (i: number) => void, reset: unknown, firstIsBar: boolean) {
	const start = firstIsBar ? 0 : -1
	const [active, setActive] = useState(start)
	const live = useRef({ count, onEnter, active, firstIsBar })
	live.current = { count, onEnter, active, firstIsBar }
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset is the trigger
	useEffect(() => setActive(start), [reset, start])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!inBar()) return
			const { count, onEnter, active, firstIsBar } = live.current
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (!count) return
				e.preventDefault()
				e.stopPropagation()
				const step = e.key === "ArrowDown" ? 1 : -1
				setActive((a) => Math.max(firstIsBar ? 0 : -1, Math.min(count - 1, a + step)))
			} else if (e.key === "Enter" && active >= 0 && active < count && !(firstIsBar && active === 0)) {
				e.preventDefault()
				e.stopPropagation()
				onEnter(active)
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
	useEffect(() => {
		if (active >= count) setActive(count - 1)
	}, [active, count])
	return { active, setActive }
}

export type Known = (k: TitleKey) => { title: string; year: string; poster: string | null } | undefined
