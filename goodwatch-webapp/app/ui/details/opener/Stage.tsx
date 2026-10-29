// The opener's stage, loaded on the first press of the trailer card (TrailerBand.tsx owns its state). The player sits
// over the page with a deck under it: Close, "‹ Trailer 2 of 3 ›" (steps through every video across kinds and wraps;
// the label opens the list), and "3 trailers · 6 clips · 21 behind the scenes ⌄", which opens every video in place
// under the deck, grouped by kind (the player scales down so the list fits the screen too). A pick plays here.
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FilmIcon,
	QueueListIcon,
	ScissorsIcon,
	VideoCameraIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline"
import { PlayIcon } from "@heroicons/react/24/solid"
import {
	type CSSProperties,
	type ComponentType,
	type RefObject,
	useEffect,
} from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { Bars } from "~/ui/details/opener/Bars"
import { Still } from "~/ui/details/opener/Still"
import {
	EASE,
	type Geo,
	MS,
	type Phase,
} from "~/ui/details/opener/stage-geometry"
import {
	type PlayerState,
	type Video,
	type VideoKind,
	countsLine,
	nameOf,
	spokenName,
} from "~/ui/details/opener/videos"
import { REFERRER_POLICY } from "~/ui/social-embed/YouTubeFrame"

type Media = MovieResult | ShowResult

const KIND_LIST: {
	kind: VideoKind
	label: string
	icon: ComponentType<{ className?: string }>
}[] = [
	{ kind: "Trailer", label: "Trailers", icon: FilmIcon },
	{ kind: "Clip", label: "Clips", icon: ScissorsIcon },
	{
		kind: "Behind the scenes",
		label: "Behind the scenes",
		icon: VideoCameraIcon,
	},
]

/** YouTube's nocookie embed with its JS API on, so the page can listen and pause. */
function Frame({
	video,
	frame,
}: { video: Video; frame: RefObject<HTMLIFrameElement> }) {
	const origin = typeof window === "undefined" ? "" : window.location.origin
	const listen = () => {
		const say = () =>
			frame.current?.contentWindow?.postMessage(
				JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
				"*",
			)
		say()
		window.setTimeout(say, 600)
		window.setTimeout(say, 1600)
	}
	return (
		<iframe
			ref={frame}
			onLoad={listen}
			src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`}
			title={`${nameOf(video)} (YouTube)`}
			allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
			referrerPolicy={REFERRER_POLICY}
			allowFullScreen
			className="absolute inset-0 block h-full w-full border-0 bg-black"
		/>
	)
}

export default function Stage({
	media,
	videos,
	geo,
	phase,
	from,
	k,
	current,
	state,
	listOpen,
	listH,
	onListH,
	onList,
	onPlay,
	onClose,
	onEnd,
	onLaidOut,
	refs,
	oneKind,
}: {
	media: Media
	videos: Video[]
	geo: Geo
	phase: Phase
	from: string
	k: number
	current: Video | null
	state: PlayerState
	listOpen: boolean
	listH: number
	onListH: (height: number) => void
	onList: (open: boolean) => void
	onPlay: (v: Video) => void
	onClose: () => void
	onEnd: (e: React.TransitionEvent) => void
	/** Called on the frame after the stage is laid out over the card, so it can start growing. */
	onLaidOut: () => void
	refs: {
		stage: RefObject<HTMLDivElement>
		list: RefObject<HTMLDivElement>
		frame: RefObject<HTMLIFrameElement>
		closeButton: RefObject<HTMLButtonElement>
	}
	oneKind: boolean
}) {
	// Laid out over the card: grow on the next frame.
	useEffect(() => {
		if (phase !== "pre") return
		let b = 0
		const a = requestAnimationFrame(() => {
			b = requestAnimationFrame(onLaidOut)
		})
		return () => {
			cancelAnimationFrame(a)
			cancelAnimationFrame(b)
		}
	}, [phase, onLaidOut])
	// The list's height decides the player's scale.
	useEffect(() => {
		const el = refs.list.current
		if (!el) return
		const ro = new ResizeObserver(() => onListH(el.offsetHeight))
		ro.observe(el)
		onListH(el.offsetHeight)
		return () => ro.disconnect()
	}, [refs.list, onListH])

	const atCard = phase === "pre" || phase === "closing"
	const open = phase === "open"
	const shown = current ?? videos[0]
	// ‹ › step through every video in order, across kinds (Trailer 3 → Clip 1 → …), wrapping at both ends.
	const at = Math.max(
		0,
		videos.findIndex((v) => v.key === shown.key && v.kind === shown.kind),
	)
	const near = (by: 1 | -1) => videos[(at + by + videos.length) % videos.length]
	const step = (by: 1 | -1) => onPlay(near(by))
	const many = videos.length > 1
	const running = state === "playing" || state === "loading"
	const deckH = geo.phone ? 52 : 60

	const stageStyle: CSSProperties = {
		top: geo.top,
		left: geo.left,
		width: geo.W,
		transformOrigin: "0 0",
		transform: atCard ? from : "none",
		opacity: atCard ? 0 : 1,
		transition:
			phase === "pre"
				? "none"
				: phase === "closing"
					? `transform ${MS}ms ${EASE}, opacity 170ms ease ${MS - 170}ms`
					: `transform ${MS}ms ${EASE}, opacity 180ms ease`,
	}
	const shift = -(1 - k) * geo.H
	// While the player is scaled down, the deck's ends move in with its edges (transform), and the list keeps to them.
	const pad = ((1 - k) * geo.W) / 2
	const slide = (x: number): CSSProperties => ({
		transform: `translateX(${x}px)`,
		transition: `transform 420ms ${EASE}`,
	})
	return (
		<>
			{/* Lights down: the whole first screen (at least) and the stage, fading out below so the page under still
			    reads as a page when you scroll on while it plays. */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: a mouse nicety; Escape and Close are the keyboard ways */}
			<div
				aria-hidden="true"
				onClick={onClose}
				className="absolute z-[28] cursor-zoom-out transition-opacity motion-reduce:transition-none"
				style={{
					top: -geo.wrapTop,
					left: -geo.wrapLeft,
					width: geo.vw,
					height:
						Math.max(
							geo.wrapTop +
								geo.top +
								geo.H +
								shift +
								deckH +
								(listOpen ? listH : 0) +
								24,
							geo.vh - 80,
						) + 220,
					opacity: phase === "opening" || open ? 1 : 0,
					transitionDuration: `${MS}ms`,
					background:
						"linear-gradient(to bottom, rgb(12 10 9 / .97) 0, rgb(12 10 9 / .97) calc(100% - 220px), rgb(12 10 9 / 0) 100%)",
				}}
			/>

			<section
				ref={refs.stage}
				aria-label={`Videos of ${media.details.title}`}
				onTransitionEnd={onEnd}
				style={stageStyle}
				className="absolute z-[29] will-change-transform motion-reduce:!transition-none"
			>
				{/* The player. It scales down (from its top) while the list is open, so the list fits the screen too. */}
				<div
					className={`relative w-full overflow-hidden bg-black shadow-[0_24px_80px_rgba(0,0,0,.7)] ${geo.phone ? "" : "rounded-xl ring-1 ring-white/10"}`}
					style={{
						height: geo.H,
						transform: `scale(${k})`,
						transformOrigin: "50% 0",
						transition: `transform 420ms ${EASE}`,
					}}
				>
					<div
						className={`absolute inset-0 transition-opacity duration-300 ${open && current ? "opacity-0" : "opacity-100"}`}
					>
						<Still media={media} />
					</div>
					{open && current ? (
						<>
							<span
								aria-hidden="true"
								className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/15 border-t-amber-300"
							/>
							<Frame key={current.key} video={current} frame={refs.frame} />
						</>
					) : (
						// Nothing chosen yet ("+29 videos"): play the first from here.
						<button
							type="button"
							tabIndex={open ? 0 : -1}
							onClick={() => onPlay(shown)}
							aria-label={`Play ${spokenName(shown)}`}
							className={`group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
						>
							<span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_40px_rgba(0,0,0,.6)] transition-transform duration-150 group-hover:scale-105 sm:h-24 sm:w-24">
								<PlayIcon className="h-9 w-9 translate-x-0.5 sm:h-11 sm:w-11" />
							</span>
							<span className="max-w-[80%] truncate text-base font-semibold text-white sm:text-lg">
								Play {spokenName(shown)}
							</span>
						</button>
					)}
				</div>

				{/* The deck: Close, the stops, every video. */}
				<div
					{...(open ? {} : { inert: "" })}
					className={open ? "opacity-100" : "opacity-0"}
					style={{
						transform: `translateY(${shift}px)`,
						transition: `transform 420ms ${EASE}, opacity 200ms ease ${open ? 120 : 0}ms`,
					}}
				>
					<div
						className={`flex items-center bg-stone-950 ${geo.phone ? "h-[52px] gap-1.5 px-3" : "h-[60px] gap-3"}`}
					>
						<div
							className="flex min-w-0 items-center gap-1.5 sm:gap-3"
							style={slide(pad)}
						>
							<button
								ref={refs.closeButton}
								type="button"
								onClick={onClose}
								aria-label="Close the player (Escape)"
								className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/20 sm:pl-3 sm:pr-4"
							>
								<XMarkIcon className="h-5 w-5" />
								<span className="max-sm:sr-only">Close</span>
							</button>

							{/* "‹ Trailer 2 of 3 ›": every video in turn, across kinds. The label opens the list of them all,
							    as the counts button at the right does; its width is fixed so the arrows never move. */}
							<div className="flex min-w-0 items-center gap-1 sm:ml-2">
								{many && (
									<button
										type="button"
										onClick={() => step(-1)}
										aria-label={`Previous: ${nameOf(near(-1))}`}
										className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white ring-1 ring-white/15 hover:bg-white/10 sm:h-10 sm:w-10"
									>
										<ChevronLeftIcon className="h-5 w-5" strokeWidth={2} />
									</button>
								)}
								<Label
									shown={shown}
									playing={!!current}
									running={running}
									phone={geo.phone}
									listOpen={listOpen}
									count={many ? videos.length : 0}
									onList={() => onList(!listOpen)}
								/>
								{many && (
									<button
										type="button"
										onClick={() => step(1)}
										aria-label={`Next: ${nameOf(near(1))}`}
										className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 transition-colors sm:h-10 sm:w-10 ${
											state === "ended"
												? "bg-amber-300 text-black ring-amber-300"
												: "text-white ring-white/15 hover:bg-white/10"
										}`}
									>
										<ChevronRightIcon className="h-5 w-5" strokeWidth={2} />
									</button>
								)}
							</div>
						</div>

						{!oneKind && (
							<button
								type="button"
								aria-expanded={listOpen}
								aria-label={`All ${videos.length} videos: ${countsLine(videos)}`}
								onClick={() => onList(!listOpen)}
								style={slide(-pad)}
								className={`ml-auto flex h-10 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 transition-colors sm:gap-2 sm:px-3.5 sm:text-sm ${
									listOpen
										? "bg-white text-black ring-white"
										: "bg-white/10 text-white ring-white/15 hover:bg-white/20"
								}`}
							>
								{geo.phone && <QueueListIcon className="h-4 w-4 shrink-0" />}
								<span className="truncate tabular-nums">
									{geo.phone ? videos.length : countsLine(videos)}
								</span>
								<ChevronDownIcon
									className={`h-4 w-4 shrink-0 transition-transform duration-200 ${listOpen ? "rotate-180" : ""}`}
									strokeWidth={2.5}
								/>
							</button>
						)}
					</div>

					{/* Every video, by kind; a press plays it here. Always laid out (measured), shown when open. */}
					<div
						ref={refs.list}
						{...(listOpen ? {} : { inert: "" })}
						aria-hidden={!listOpen}
						style={geo.phone ? undefined : { paddingInline: pad }}
						className={`bg-stone-950 transition-[opacity,transform] duration-200 ${geo.phone ? "px-3" : ""} ${listOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
					>
						<div
							className={`flex flex-col border-t border-white/10 pb-4 pt-4 ${geo.phone ? "gap-3" : "gap-2.5"}`}
						>
							{KIND_LIST.map((kind) => {
								const of = videos.filter((v) => v.kind === kind.kind)
								if (!of.length) return null
								const Icon = kind.icon
								return (
									<div
										key={kind.kind}
										className={
											geo.phone
												? "flex flex-col gap-2"
												: "flex items-start gap-4"
										}
									>
										<p
											className={`flex shrink-0 items-center gap-2 text-[13px] font-semibold text-gray-300 ${geo.phone ? "" : "h-9 w-48"}`}
										>
											<Icon className="h-4 w-4 text-gray-500" />
											{kind.label}
											<span className="font-normal tabular-nums text-gray-500">
												{of.length}
											</span>
										</p>
										<div className="flex flex-wrap gap-1.5">
											{of.map((v) => {
												const on = current?.key === v.key
												return (
													<button
														key={v.key}
														type="button"
														aria-current={on || undefined}
														aria-label={
															on
																? `${nameOf(v)}, playing`
																: `Play ${spokenName(v)}`
														}
														onClick={() => {
															onPlay(v)
															onList(false)
														}}
														className={`flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-[13px] font-semibold tabular-nums transition-colors duration-150 ${
															on
																? "bg-amber-300 text-black"
																: "text-gray-200 ring-1 ring-white/15 hover:bg-white/10 hover:text-white"
														}`}
													>
														{on && <Bars on={running} />}
														{of.length > 1
															? v.n
															: !on && <PlayIcon className="h-3.5 w-3.5" />}
													</button>
												)
											})}
										</div>
									</div>
								)
							})}
						</div>
					</div>
				</div>
			</section>
		</>
	)
}

/**
 * Between the arrows: what's on ("Trailer 2 of 3"), a button that opens the list of every video when there's more
 * than one. A fixed width (the longest, "Behind the scenes 21 of 21"), so stepping never moves the arrows.
 */
function Label({
	shown,
	playing,
	running,
	phone,
	listOpen,
	count,
	onList,
}: {
	shown: Video
	playing: boolean
	running: boolean
	phone: boolean
	listOpen: boolean
	/** All the videos, when more than one (the label then opens their list), else 0. */
	count: number
	onList: () => void
}) {
	const place =
		shown.of > 1 ? (
			<>
				{shown.n}{" "}
				<span className="font-normal text-gray-400">of {shown.of}</span>
			</>
		) : null
	const chevron = count > 0 && (
		<ChevronDownIcon
			aria-hidden="true"
			className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:text-white ${listOpen ? "rotate-180" : ""}`}
			strokeWidth={2.5}
		/>
	)
	const body = phone ? (
		// Phone: the kind small over its place, so "Behind the scenes 14 of 21" fits.
		<span className="flex min-w-0 flex-col items-center leading-tight">
			<span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-[.08em] text-gray-400">
				{shown.kind}
			</span>
			<span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold tabular-nums text-white">
				{playing && <Bars on={running} className="text-amber-300" />}
				{place ?? (playing ? "Playing" : "Ready")}
				{chevron}
			</span>
		</span>
	) : (
		<span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-white">
			{playing && <Bars on={running} className="text-amber-300" />}
			<span className="truncate tabular-nums">
				{shown.kind}
				{place && <> {place}</>}
			</span>
			{chevron}
		</span>
	)
	// A single video has no arrows to keep still: its label just sits after Close.
	const box = `flex h-10 shrink-0 items-center rounded-full px-2 ${count === 0 ? "" : phone ? "w-[8.75rem] justify-center" : "w-[16.5rem] justify-center"}`
	return (
		<span aria-live="polite" className="contents">
			{count > 0 ? (
				<button
					type="button"
					aria-expanded={listOpen}
					onClick={onList}
					aria-label={`${nameOf(shown)}${shown.name ? "" : shown.of > 1 ? ` of ${shown.of}` : ""}. ${listOpen ? "Hide" : "Show"} all ${count} videos`}
					className={`group ${box} cursor-pointer ring-1 transition-colors duration-150 hover:bg-white/10 ${listOpen ? "bg-white/10 ring-white/20" : "bg-white/[0.04] ring-white/[0.08]"}`}
				>
					{body}
				</button>
			) : (
				<span className={box}>{body}</span>
			)}
		</span>
	)
}
