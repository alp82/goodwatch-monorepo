// The card's For you step: the first pick large on its backdrop (title, ScoreRing, where it streams, Keep my taste to
// sign-up, Details), and the others as "Also for you" (small whole posters; a tap features one, the two swap places)
// with Start over. Phones: the row sits over the backdrop's foot. Wider: the row is a column beside it.
//
// Until the picks arrive the box shows a skeleton; with nothing to pick it says so plainly.
import { InformationCircleIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { titlePath } from "~/utils/helpers"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { ForYouSkeleton } from "./ForYouSkeleton"
import { SmallArrows, usePager } from "./PosterPager"
import type { ForYouPicks } from "./useLovedThree"

const hrefOf = (c: TitleCard) => titlePath(c.media_type, c.tmdb_id, c.title)
const kindOf = (c: TitleCard) => (c.media_type === "show" ? "Show" : "Movie")

export function ForYouPanel({
	picks,
	onStartOver,
}: {
	picks: ForYouPicks | null
	onStartOver: () => void
}) {
	if (!picks || picks.status === "loading") return <ForYouSkeleton />
	const { top, more } = picks.pick
	if (!top)
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
				<p className="text-[15px] font-semibold text-white sm:text-lg">
					No picks for these three yet.
				</p>
				<StartOverButton onStartOver={onStartOver} solid />
			</div>
		)
	return <Featured cards={[top, ...more]} onStartOver={onStartOver} />
}

function StartOverButton({
	onStartOver,
	solid = false,
}: {
	onStartOver: () => void
	solid?: boolean
}) {
	return (
		<button
			type="button"
			onClick={onStartOver}
			className={
				solid
					? "inline-flex h-9 cursor-pointer items-center rounded-full bg-gray-800 px-4 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-gray-700"
					: "-my-1 h-7 shrink-0 cursor-pointer rounded-md px-1.5 text-xs font-semibold text-gray-400 hover:text-white sm:text-sm"
			}
		>
			Start over
		</button>
	)
}

function Featured({
	cards,
	onStartOver,
}: {
	cards: TitleCard[]
	onStartOver: () => void
}) {
	const sig = cards.map((c) => c.key).join(",")
	// Keyed by the titles.
	const initial = useMemo(() => cards, [sig])
	const [order, setOrder] = useState(initial)
	useEffect(() => setOrder(initial), [initial])
	const top = order[0]
	const rest = order.slice(1)
	if (!top) return null
	const feature = (i: number) =>
		setOrder((o) => {
			const next = [...o]
			const a = next[0]
			const b = next[i + 1]
			if (!a || !b) return o
			next[0] = b
			next[i + 1] = a
			return next
		})
	const services = top.services?.slice(0, 3).map((s) => s.name) ?? []
	const ring = {
		details: {
			goodwatch_overall_score_normalized_percent:
				top.goodwatch_overall_score_normalized_percent,
		},
	}
	return (
		<div className="spotlight-pad absolute inset-0 flex gap-4 pt-2.5 pb-3 sm:pt-3 sm:pb-4 lg:gap-6">
			<div className="relative min-w-0 flex-1 overflow-clip rounded-xl bg-gray-900 ring-1 ring-white/10 sm:flex-[1.3] sm:rounded-2xl lg:flex-1">
				{top.backdrop_path ? (
					<img
						key={top.key}
						src={tmdbImageUrl(top.backdrop_path, "w1280")}
						alt=""
						draggable={false}
						className="spotlight-fade absolute inset-0 h-full w-full object-cover"
					/>
				) : null}
				<div aria-hidden className="spotlight-scrim absolute inset-0" />
				<div
					key={top.key}
					className="spotlight-in absolute inset-x-0 top-0 px-3 pt-2.5 sm:top-auto sm:bottom-0 sm:max-w-[min(100%,460px)] sm:px-5 sm:pb-4 lg:px-6 lg:pb-5"
				>
					<div className="flex items-start gap-2">
						<h3 className="spotlight-pick-title min-w-0 flex-1 truncate font-extrabold tracking-tight text-white sm:line-clamp-2 sm:whitespace-normal [text-shadow:0_2px_12px_rgb(0_0_0/.7)]">
							{top.title}
						</h3>
						<Link
							to={hrefOf(top)}
							prefetch="none"
							aria-label={`Open ${top.title}`}
							className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-950/80 text-gray-100 ring-1 ring-white/25 outline-none hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 sm:hidden"
						>
							<InformationCircleIcon className="h-5 w-5" aria-hidden />
						</Link>
					</div>
					<div className="mt-1 flex items-center gap-2.5 sm:mt-2 sm:gap-3">
						<span className="sm:hidden">
							<ScoreRing media={ring} size={30} label={false} />
						</span>
						<span className="max-sm:hidden">
							<ScoreRing media={ring} size={42} />
						</span>
						<span className="min-w-0 truncate text-xs text-gray-300 sm:text-sm">
							{top.release_year ? `${top.release_year} · ` : ""}
							{kindOf(top)}
						</span>
						<Link
							to="/sign-up"
							className="ml-auto inline-flex h-7 shrink-0 items-center rounded-full bg-amber-400 px-3 text-xs font-bold text-gray-950 hover:bg-amber-300 sm:hidden"
						>
							Keep my taste
						</Link>
					</div>
					{services.length ? (
						<p className="mt-2 truncate text-sm text-gray-300 max-sm:hidden">
							On {services.join(", ")}
						</p>
					) : null}
					<div className="mt-3 flex items-center gap-2 max-sm:hidden">
						<Link
							to="/sign-up"
							className="inline-flex h-9 items-center rounded-full bg-amber-400 px-4 text-sm font-bold text-gray-950 shadow-[0_6px_20px_rgb(251_191_36/.25)] hover:bg-amber-300"
						>
							Keep my taste
						</Link>
						<Link
							to={hrefOf(top)}
							prefetch="none"
							className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-950/70 px-3.5 text-sm font-semibold text-gray-100 ring-1 ring-white/20 hover:text-amber-400"
						>
							<InformationCircleIcon className="h-4 w-4" aria-hidden />
							Details
						</Link>
					</div>
				</div>
				{/* Phones: the other picks over the backdrop's foot. */}
				<div className="absolute inset-x-0 bottom-0 px-3 pb-2 sm:hidden">
					<AlsoForYou
						cards={rest}
						onFeature={feature}
						onStartOver={onStartOver}
					/>
				</div>
			</div>
			{/* Wider: the other picks in a column beside it. */}
			<div className="flex min-w-0 flex-1 flex-col justify-center max-sm:hidden">
				<AlsoForYou
					cards={rest}
					onFeature={feature}
					onStartOver={onStartOver}
					titles
				/>
			</div>
		</div>
	)
}

/** "Also for you": small whole posters (poster-fit.ts ALSO_FIT); a tap features one. */
function AlsoForYou({
	cards,
	onFeature,
	onStartOver,
	titles = false,
}: {
	cards: TitleCard[]
	onFeature: (i: number) => void
	onStartOver: () => void
	/** Names under the posters (wider screens). */
	titles?: boolean
}) {
	const nav = usePager()
	return (
		<div className="min-w-0">
			<div className="mb-1 flex items-center justify-between gap-3 sm:mb-2.5">
				<h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300 sm:text-xs">
					Also for you
				</h3>
				<span className="flex items-center gap-2 sm:gap-3">
					<SmallArrows
						nav={nav}
						name="Also for you"
						size="h-6 w-6 sm:h-7 sm:w-7"
						className="-my-1"
					/>
					<StartOverButton onStartOver={onStartOver} />
				</span>
			</div>
			<div className="start-also -mx-1">
				<ul
					ref={nav.ref}
					className="start-also-box start-also-row flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{cards.slice(0, nav.cap()).map((c, i) => (
						<li key={c.key} className="start-also-c snap-start">
							<button
								type="button"
								onClick={() => onFeature(i)}
								aria-label={`Show ${c.title}`}
								title={c.title}
								className="loved-toggle block w-full cursor-pointer rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="loved-lift block">
									{c.poster_path ? (
										<img
											src={tmdbImageUrl(c.poster_path, "w185")}
											alt=""
											loading="lazy"
											draggable={false}
											className="block aspect-[2/3] w-full rounded-md object-cover shadow-[0_6px_16px_rgb(0_0_0/.5)] ring-1 ring-white/10"
										/>
									) : (
										<span className="block aspect-[2/3] w-full rounded-md bg-gray-800" />
									)}
								</span>
								{titles ? (
									<span className="mt-1.5 block truncate text-xs text-gray-300">
										{c.title}
									</span>
								) : null}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}
