// The thin title bar fixed under the site header. It shows once the opener's title has left the screen, sliding in
// with transform and opacity over the page, so nothing below moves. The bar is one button back to the top, with Top at
// its right edge; on a phone it also carries the member's score state, which leads to the "You" block. Its meta line
// (years · type · seasons · episodes · age) is the longest version that fits, so no word is ever cut off.
// While the opener's stage plays and the reader is down the page, a split button takes the right side: Pause/Play at
// one fixed width, then "Now playing · Trailer 2 ↑", the way back to the video.
import { ArrowUpIcon, StarIcon } from "@heroicons/react/24/outline"
import {
	PauseIcon,
	PlayIcon,
	StarIcon as StarSolid,
} from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Bars } from "~/ui/details/opener/Bars"
import { useNowPlaying } from "~/ui/details/opener/videos"
import { onFirstInteraction } from "~/utils/first-interaction"
import { scrollToTop, useOnScreen } from "~/ui/details/reading"
import { fitMeta } from "~/ui/details/title-words"
import MediaText from "~/ui/media-text/MediaText"
import type { MediaTextValue } from "~/ui/media-text/media-text"
import { useTitleActions } from "~/ui/title-actions/useTitleActions"

type Media = MovieResult | ShowResult

/** Shows the first of `options` that fits its box on one line (measured, again on resize and font load). */
function FitLine({
	options,
	className = "",
}: { options: string[]; className?: string }) {
	const box = useRef<HTMLSpanElement>(null)
	const [pick, setPick] = useState(0)
	const key = options.join("|")
	useEffect(() => {
		const el = box.current
		if (!el) return
		const measure = () => {
			const width = el.clientWidth
			if (!width) return
			const probes = [...el.querySelectorAll<HTMLElement>("[data-fit]")]
			const i = probes.findIndex((p) => p.offsetWidth <= width + 0.5)
			setPick(i < 0 ? probes.length - 1 : i)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		document.fonts?.ready.then(measure).catch(() => {})
		return () => ro.disconnect()
	}, [key])
	return (
		<span
			ref={box}
			className={`relative block min-w-0 overflow-hidden whitespace-nowrap ${className}`}
		>
			{options[pick] ?? ""}
			{options.map((o) => (
				<span
					key={o}
					data-fit
					aria-hidden="true"
					className="invisible absolute left-0 top-0 whitespace-nowrap"
				>
					{o}
				</span>
			))}
		</span>
	)
}

/** The member's own state in a word or two, for the phone's title bar: "Rate", "Seen", or "★ 8". */
function YouChip({ media, onClick }: { media: Media; onClick: () => void }) {
	const a = useTitleActions(media)
	const scored = a.score != null
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={
				scored
					? `Your score ${a.score}. Change it`
					: a.seen
						? "Seen. Rate it"
						: "Rate it"
			}
			className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-xs font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
		>
			{scored ? (
				<StarSolid className="h-3.5 w-3.5 text-amber-400" />
			) : (
				<StarIcon className="h-3.5 w-3.5 text-amber-400" />
			)}
			{scored ? (
				<span className="tabular-nums">{a.score}</span>
			) : (
				<span>{a.seen ? "Seen" : "Rate"}</span>
			)}
		</button>
	)
}

export function TitleBar({
	media,
	title,
	country,
	watchId,
	youId,
}: {
	media: Media
	title: MediaTextValue
	country: string
	/** The opener element whose leaving the screen shows the bar (the h1's header). */
	watchId: string
	/** The "You" block's id; the phone's score chip scrolls to it. */
	youId: string
}) {
	const titleOnScreen = useOnScreen(watchId, 64)
	const shown = !titleOnScreen
	// The bar's poster is a picture of its own (another size than the opener's). It comes at the first sign of use, before
	// the bar can show, so a visitor who only reads the first screen never loads it.
	const [poster, setPoster] = useState(false)
	useEffect(() => {
		if (shown) setPoster(true)
		else onFirstInteraction(() => setPoster(true))
	}, [shown])
	const toYou = () =>
		document.getElementById(youId)?.scrollIntoView({
			block: "center",
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? "auto"
				: "smooth",
		})
	const meta = fitMeta(media, country)
	const now = useNowPlaying()
	const running = now
		? now.state === "playing" || now.state === "loading"
		: false
	return (
		<div
			data-title-bar
			aria-hidden={!shown}
			{...(shown ? {} : { inert: "" })}
			className={`follow-phone-bar fixed inset-x-0 top-16 z-30 border-b border-white/10 bg-stone-950 shadow-[0_8px_24px_rgba(0,0,0,.45)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
				shown
					? "translate-y-0 opacity-100"
					: "pointer-events-none -translate-y-2 opacity-0"
			}`}
		>
			<div className="mx-auto flex h-[52px] max-w-[88rem] items-center gap-2 pl-3 pr-2 lg:h-12 lg:gap-3 lg:px-8">
				<button
					type="button"
					onClick={scrollToTop}
					aria-description="Back to the top"
					className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
				>
					{media.details.poster_path && poster ? (
						<TmdbImage
							kind="poster"
							path={media.details.poster_path}
							width={28}
							alt=""
							// On a phone the poster makes room for "Now playing" while something plays.
							className={`h-10 w-[27px] shrink-0 rounded-[4px] object-cover ring-1 ring-white/10 lg:h-9 lg:w-6 ${now ? "max-lg:hidden" : ""}`}
						/>
					) : null}
					<span className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-baseline lg:gap-3">
						<MediaText
							value={title}
							className="truncate text-sm font-semibold text-white lg:max-w-[50%] lg:shrink-0 lg:text-[15px]"
						/>
						<FitLine
							options={meta}
							className="flex-1 text-[11px] text-gray-400 lg:text-[13px]"
						/>
					</span>
					<span className={`shrink-0 ${now ? "max-lg:hidden" : ""}`}>
						<ScoreRing media={media} size={30} label={false} />
					</span>
				</button>
				{now ? (
					// One split button: Play/Pause at a fixed width, a hairline, then the way back to the stage.
					<div className="flex h-10 shrink-0 items-stretch overflow-hidden rounded-md bg-amber-300 text-black lg:h-9">
						<button
							type="button"
							onClick={now.toggle}
							aria-label={`${running ? "Pause" : "Play"} ${now.spoken}`}
							// One width for both words (and icon only on a phone), so the button beside it never moves.
							className="flex h-full w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 text-xs font-semibold text-black transition-colors duration-150 hover:bg-black/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black active:bg-black/20 lg:w-[5.5rem] lg:justify-start lg:pl-3"
						>
							{running ? (
								<PauseIcon className="h-4 w-4 shrink-0" />
							) : (
								<PlayIcon className="h-4 w-4 shrink-0" />
							)}
							<span className="max-lg:sr-only">
								{running ? "Pause" : "Play"}
							</span>
						</button>
						<span
							aria-hidden="true"
							className="my-2 w-px shrink-0 bg-black/20"
						/>
						<button
							type="button"
							onClick={now.back}
							aria-description="Back to the video"
							className="group flex h-full max-w-[11rem] shrink-0 cursor-pointer items-center gap-2 pl-2.5 pr-1.5 text-left text-black transition-colors duration-150 hover:bg-black/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black active:bg-black/20 lg:max-w-[22rem] lg:pl-3"
						>
							<Bars on={running} />
							<span className="flex min-w-0 flex-col leading-none lg:flex-row lg:items-baseline lg:gap-1">
								<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-black/70 lg:text-[13px] lg:normal-case lg:tracking-normal lg:text-black">
									Now playing
								</span>
								<span className="truncate pt-0.5 text-[12px] font-semibold lg:pt-0 lg:text-[13px] lg:font-normal">
									<span aria-hidden="true" className="max-lg:hidden">
										·{" "}
									</span>
									{now.name}
								</span>
							</span>
							<span
								aria-hidden="true"
								className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-black/10 transition-transform duration-150 group-hover:-translate-y-0.5"
							>
								<ArrowUpIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
							</span>
						</button>
					</div>
				) : (
					<span className="lg:hidden">
						<YouChip media={media} onClick={toYou} />
					</span>
				)}
				<button
					type="button"
					onClick={scrollToTop}
					aria-label="Back to the top"
					title="Back to the top (T)"
					className={`flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/[0.06] hover:text-white lg:ml-2 lg:ring-1 lg:ring-white/10 ${now ? "hidden" : ""}`}
				>
					<ArrowUpIcon className="h-4 w-4" />
					<span className="max-lg:sr-only">Top</span>
				</button>
			</div>
		</div>
	)
}
