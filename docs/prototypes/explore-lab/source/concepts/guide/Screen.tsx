// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). The screen: the title in focus, large. Its backdrop,
// its name, one sentence of GoodWatch's title analysis, the GoodWatch score beside each source's own score, and where
// it streams. It follows the guide's focus with a cross-fade (opacity only). The look is the Watch next hero's, and
// the service tiles and the Watch button are that page's own components.
import { Link } from "@remix-run/react"
import { type ReactNode, useRef } from "react"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { runtimeLabel } from "~/ui/watch-next/labels"
import { offersOf } from "~/ui/watch-next/services"
import { WatchButton } from "~/ui/watch-next/WatchNextHero"
import { logoUrl } from "~/ui/watch-next/style"
import { DISPLAY } from "~/ui/my-pages/style"
import { FOLLOW_PHONE_BAR } from "~/ui/layers"
import { SourceScores, WRAP, poster } from "../../kit/ui"
import { AnimatePresence } from "framer-motion"
import { motion, useReducedMotion } from "../../kit/ui/motion"
import type { Cell } from "./types"

const EASE = [0.22, 1, 0.36, 1] as const

/** Where the screen pins: under the site header and both rows on a desktop, under the top bar on a phone. */
export const SCREEN_STICK = "top-16 lg:top-[calc(4rem+93px)]"

/** The desktop screen's height: the guide's rows need the rest of the window. */
export const SCREEN_H = "lg:h-[clamp(20rem,39vh,23rem)]"

const titleSize = (title: string) =>
	title.length > 34
		? "text-xl sm:text-2xl lg:text-3xl"
		: title.length > 20
			? "text-2xl sm:text-3xl lg:text-4xl"
			: "text-2xl sm:text-4xl lg:text-5xl"

/**
 * The title in focus. `eyebrow` says where it comes from (the channel, or "Now showing" on a channel's own page);
 * `corner` sits in the top-left over the picture (the page's kicker); `action` is the second button, beside Watch.
 */
export function NowShowing({
	cell,
	eyebrow,
	corner,
	action,
	phone = "eyebrow",
	className = "",
}: {
	cell: Cell | null
	eyebrow?: ReactNode
	corner?: ReactNode
	action?: ReactNode
	/** A phone's screen has room for one of the two lines above the title. */
	phone?: "corner" | "eyebrow"
	className?: string
}) {
	const reduce = useReducedMotion()
	const card = cell?.card
	const first = useRef(card?.key)
	// One tile per service: a title often lists the same service twice (its own app and a channel inside another).
	const offers = card
		? (offersOf(card, [])?.filter((o, i, all) => all.findIndex((x) => x.name === o.name) === i) ??
			null)
		: null
	const facts = card ? [card.release_year, runtimeLabel(card, "")].filter(Boolean).join(" · ") : ""
	return (
		<div
			data-screen={card?.key ?? ""}
			className={`relative isolate flex min-w-0 flex-col justify-end overflow-hidden bg-gray-950 ${className}`}
		>
			<AnimatePresence initial={false}>
				{card?.backdrop_path && (
					<motion.img
						key={card.key}
						src={poster(card.backdrop_path, "w1280")}
						alt=""
						decoding="async"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
						className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_22%]"
					/>
				)}
			</AnimatePresence>
			{/* Enough dark behind the words to read them over any picture; the right half stays clear. */}
			<div
				aria-hidden
				className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/80 to-gray-950/10 sm:bg-linear-to-r sm:from-gray-950/95 sm:via-gray-950/55 sm:to-transparent"
			/>
			<div
				aria-hidden
				className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-linear-to-t from-gray-950/80 to-transparent"
			/>
			{cell && card && (
				<motion.div
					key={card.key}
					// The first title is in the server's HTML as it is; only later ones arrive with a fade.
					initial={reduce || card.key === first.current ? false : { opacity: 0, x: 10 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.28, ease: EASE }}
					className="min-w-0 p-4 sm:p-6"
				>
					{/* One line above the title, in the flow: it can't run into anything. */}
					{(corner || eyebrow) && (
						<div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold text-gray-200">
							{corner && (
								<span className={phone === "corner" || !eyebrow ? "" : "max-sm:hidden"}>
									{corner}
								</span>
							)}
							{eyebrow && (
								<span
									className={`flex min-w-0 items-center gap-2 ${
										phone === "corner" && corner ? "max-sm:hidden" : ""
									}`}
								>
									{eyebrow}
								</span>
							)}
						</div>
					)}
					<Link
						to={cell.to}
						prefetch="intent"
						className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<h2
							className={`${DISPLAY} line-clamp-2 max-w-[38rem] leading-[1.02] text-balance text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] ${titleSize(
								card.title,
							)}`}
						>
							{card.title}
						</h2>
					</Link>
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:mt-3">
						<span className="flex items-center gap-2.5">
							<ScorePill
								goodwatch={card.goodwatch_overall_score_normalized_percent}
								score={null}
								mark={null}
								size="L"
							/>
							<span className="text-sm text-gray-300">{facts}</span>
						</span>
						<SourceScores
							sources={cell.sources}
							only={["imdb", "letterboxd", "rtCritics", "metacritic"]}
							className="max-sm:hidden"
						/>
					</div>
					{(cell.line || card.tagline) && (
						<p className="mt-2 line-clamp-2 max-w-xl text-sm leading-snug text-pretty text-gray-200 sm:mt-3 sm:text-base sm:leading-snug">
							{cell.line || card.tagline}
						</p>
					)}
					{/* A phone has room for one line about where it streams; the buttons need a wider screen. */}
					<p className="mt-1.5 text-xs font-semibold text-gray-300 sm:hidden">
						{offers?.[0] ? `On ${offers[0].name}` : offers ? "Not streaming here" : ""}
					</p>
					<div className="mt-4 flex flex-wrap items-center gap-2 max-sm:hidden">
						<WatchButton title={card} offers={offers} />
						{action}
						{offers && offers.length > 1 && (
							<span className="ml-1 flex items-center gap-1.5 max-lg:hidden">
								<span className="text-xs font-semibold text-gray-400">Also on</span>
								{offers.slice(1, 4).map((o) => (
									<img
										key={o.id}
										src={logoUrl(o.logo_path)}
										alt={o.name}
										title={o.name}
										className="h-8 w-8 rounded-md ring-1 ring-white/15"
									/>
								))}
							</span>
						)}
					</div>
				</motion.div>
			)}
		</div>
	)
}

/** The quiet second button on the screen. */
export const SCREEN_BUTTON =
	"inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white outline-none backdrop-blur transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-amber-400"

/**
 * The screen pinned over its guide rows. On a desktop the whole panel pins (a channel's own page puts its character
 * block, `lead`, in the panel's left half). On a phone `lead` scrolls with the page and only the picture pins, under
 * the top bar. Place it as the first child of the block that holds the rows: it stays for as long as they do.
 */
export function PinnedScreen({
	lead,
	leadClassName = "",
	leadStyle,
	children,
}: {
	lead?: ReactNode
	leadClassName?: string
	leadStyle?: React.CSSProperties
	children: ReactNode
}) {
	return (
		<div
			data-pinned-screen=""
			className={`max-lg:contents lg:sticky lg:z-[15] lg:bg-gray-900 lg:pt-4 lg:pb-3 ${SCREEN_STICK}`}
		>
			<div className={`max-lg:contents lg:block ${WRAP}`}>
				<div
					// No clipping here (a menu in `lead` hangs below the panel); each half rounds its own corners.
					className={`max-lg:contents lg:grid lg:rounded-2xl lg:ring-1 lg:ring-white/10 ${SCREEN_H} ${
						lead
							? "lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:[&_[data-screen]]:rounded-r-2xl"
							: "lg:[&_[data-screen]]:rounded-2xl"
					}`}
				>
					{lead && (
						<div className={`min-w-0 ${leadClassName}`} style={leadStyle}>
							{lead}
						</div>
					)}
					<div
						data-screen-pin=""
						className={`min-w-0 max-lg:sticky max-lg:z-[15] max-lg:bg-gray-900 ${SCREEN_STICK} ${FOLLOW_PHONE_BAR} lg:contents`}
					>
						{children}
						{/* Rows slide under a short fade, not a hard edge. */}
						<div
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-full h-4 bg-linear-to-b from-gray-900 to-transparent lg:hidden"
						/>
					</div>
				</div>
			</div>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-full h-5 bg-linear-to-b from-gray-900 to-transparent max-lg:hidden"
			/>
		</div>
	)
}
