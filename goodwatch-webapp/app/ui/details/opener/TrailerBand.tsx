// The opener's band: the backdrop with the page's settings (country and language, share) and a player card in its
// corner: a 16:9 "screen" with a frame of the title, a big play glyph, the first video's kind and an empty track, and
// "+29 videos" when there's more than one.
//
// Pressing the card opens the stage (Stage.tsx, loaded on first use): the card grows into the largest 16:9 player that
// fits the window under the site header, with its deck below it. The rest of the page dims; the dark or Escape
// closes it, and the stage shrinks back into the card. "+29 videos" opens the stage with every video listed and
// nothing playing yet. The stage lies over the page, so scrolling on while it plays leaves it behind and the title bar
// says "Now playing". Nothing asks YouTube for anything before a press.
import { ChevronDownIcon } from "@heroicons/react/24/outline"
import { PlayIcon } from "@heroicons/react/24/solid"
import {
	type CSSProperties,
	type ReactNode,
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { HeroBackdropImage } from "~/ui/details/hero/Trailer"
import { Still } from "~/ui/details/opener/Still"
import {
	EASE,
	type Geo,
	MS,
	type Phase,
	fromCard,
	measure,
	reducedMotion,
} from "~/ui/details/opener/stage-geometry"
import {
	type PlayerState,
	VIDEO_KINDS,
	type Video,
	countsLine,
	nameOf,
	setNowPlaying,
	spokenName,
	videosOf,
} from "~/ui/details/opener/videos"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { useReplayedTap } from "~/utils/useReplayedTap"

type Media = MovieResult | ShowResult

const loadStage = reloadOnStaleChunk(() => import("~/ui/details/opener/Stage"))
const Stage = lazy(loadStage)
const preloadStage = () => void loadStage().catch(() => {})

/** Whether the title has a video for the band's card. */
export const hasVideo = (media: Media) => videosOf(media).length > 0

/**
 * Classes for the opener's header (poster and title) under the band. With a card it doesn't overlap the band on a
 * phone (the screen is full width there) and keeps clear of the card on a desktop; without one it overlaps the band.
 */
export const openerHeaderClass = (withCard: boolean) =>
	withCard ? "mt-5 lg:-mt-28 lg:mr-48 xl:mr-52" : "-mt-16 sm:-mt-20 lg:-mt-28"

export function TrailerBand({
	media,
	controls,
}: { media: Media; controls: ReactNode }) {
	const videos = useMemo(() => videosOf(media), [media])
	return (
		// "media" was the videos section's id before: old links land on the band, where every video plays now.
		<div id="media" data-feedback-area="media" className="scroll-mt-20">
			{videos.length ? (
				<WithStage media={media} videos={videos} controls={controls} />
			) : (
				<div className="relative isolate -mx-4 h-44 overflow-hidden sm:mx-0 sm:h-64 sm:rounded-2xl sm:border sm:border-white/10 lg:h-[19rem] xl:h-[21rem]">
					<Backdrop media={media} />
					<div className="flex items-center justify-end gap-2 px-4 pt-3 sm:gap-3 lg:px-5 lg:pt-4">
						{controls}
					</div>
				</div>
			)}
		</div>
	)
}

function Backdrop({ media }: { media: Media }) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 -z-10"
		>
			<HeroBackdropImage
				media={media}
				className="h-full w-full object-cover object-[center_22%]"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-stone-950/5" />
			<div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-stone-950/60 to-transparent" />
		</div>
	)
}

function WithStage({
	media,
	videos,
	controls,
}: { media: Media; videos: Video[]; controls: ReactNode }) {
	const [phase, setPhaseState] = useState<Phase>("idle")
	const phaseRef = useRef<Phase>("idle")
	const setPhase = useCallback((p: Phase) => {
		phaseRef.current = p
		setPhaseState(p)
	}, [])
	const [geo, setGeo] = useState<Geo | null>(null)
	const [from, setFrom] = useState("none")
	/** What the player holds; null: nothing loaded yet (the still with a play button). */
	const [current, setCurrent] = useState<Video | null>(null)
	const [state, setState] = useState<PlayerState>("loading")
	const [listOpen, setListOpen] = useState(false)
	const [listH, setListH] = useState(0)
	const pendingList = useRef(false)

	const wrap = useRef<HTMLDivElement>(null)
	const card = useRef<HTMLDivElement>(null)
	const stage = useRef<HTMLDivElement>(null)
	const list = useRef<HTMLDivElement>(null)
	const frame = useRef<HTMLIFrameElement>(null)
	const closeButton = useRef<HTMLButtonElement>(null)
	const playButton = useRef<HTMLButtonElement>(null)
	// A tap from before the app was there plays once the card is ready (utils/replay-tap.ts).
	useReplayedTap("trailer", (el) => el === playButton.current)

	const first = videos[0]
	const kinds = new Set(videos.map((v) => v.kind)).size
	const title = media.details.title

	// The player's scale while the list is open: small enough that the list fits the screen too.
	const k =
		geo && listOpen
			? Math.min(1, Math.max(0.42, (geo.room - listH - 12) / geo.H))
			: 1
	const kRef = useRef(k)
	kRef.current = k

	const open = useCallback(
		({
			video = null,
			list: withList = false,
		}: { video?: Video | null; list?: boolean }) => {
			if (phaseRef.current !== "idle" || !wrap.current || !card.current) return
			const g = measure(wrap.current)
			setGeo(g)
			setFrom(fromCard(card.current, wrap.current, g, 1))
			setCurrent(video)
			setState("loading")
			pendingList.current = withList
			setPhase(reducedMotion() ? "open" : "pre")
			if (window.scrollY > 0)
				window.scrollTo({
					top: 0,
					behavior: reducedMotion() ? "auto" : "smooth",
				})
		},
		[setPhase],
	)
	// The stage's code first, so it grows from the card instead of appearing at full size.
	const press = (how: { video?: Video | null; list?: boolean }) =>
		void loadStage()
			.then(() => open(how))
			.catch(() => {})
	const close = useCallback(() => {
		const p = phaseRef.current
		if (p === "idle" || p === "closing") return
		if (reducedMotion() || p === "pre") {
			setPhase("idle")
			return
		}
		if (wrap.current && card.current && geo)
			setFrom(fromCard(card.current, wrap.current, geo, kRef.current))
		setPhase("closing")
	}, [setPhase, geo])
	const play = useCallback((v: Video) => {
		setCurrent(v)
		setState("loading")
	}, [])

	// pre → opening once the stage is laid out over the card: the stage says so (Stage.tsx), as its code may still load.
	const onLaidOut = useCallback(() => {
		if (phaseRef.current === "pre") setPhase("opening")
	}, [setPhase])
	// The transform's end moves the phase on; a timer covers a missed transitionend.
	useEffect(() => {
		if (phase !== "opening" && phase !== "closing") return
		const id = window.setTimeout(
			() => setPhase(phase === "opening" ? "open" : "idle"),
			MS + 80,
		)
		return () => window.clearTimeout(id)
	}, [phase, setPhase])
	const onEnd = (e: React.TransitionEvent) => {
		if (e.target !== stage.current || e.propertyName !== "transform") return
		if (phaseRef.current === "opening") setPhase("open")
		else if (phaseRef.current === "closing") setPhase("idle")
	}

	// Focus follows: to Close once open, back to the card after closing (not on the first render).
	const was = useRef<Phase>("idle")
	useEffect(() => {
		if (phase === "open" && was.current !== "open") {
			closeButton.current?.focus({ preventScroll: true })
			if (pendingList.current) setListOpen(true)
			pendingList.current = false
		}
		if (phase === "idle" && was.current !== "idle") {
			setCurrent(null)
			setListOpen(false)
			setGeo(null)
			playButton.current?.focus({ preventScroll: true })
		}
		was.current = phase
	}, [phase])

	// Keep the stage fitted to the window while it's up.
	const up = phase !== "idle"
	useEffect(() => {
		if (!up) return
		const on = () => wrap.current && setGeo(measure(wrap.current))
		window.addEventListener("resize", on)
		return () => window.removeEventListener("resize", on)
	}, [up])

	// Escape closes.
	useEffect(() => {
		if (phase !== "open" && phase !== "opening") return
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented) return
			if ((e.target as HTMLElement | null)?.closest("input, textarea, select"))
				return
			close()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [phase, close])

	// YouTube's player reports its state to a page that says it's listening (enablejsapi=1); no script of theirs.
	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			if (e.source !== frame.current?.contentWindow) return
			let data: { event?: string; info?: unknown }
			try {
				data = typeof e.data === "string" ? JSON.parse(e.data) : e.data
			} catch {
				return
			}
			const info = data?.info as
				| { playerState?: unknown }
				| number
				| null
				| undefined
			const code =
				data?.event === "onStateChange" && typeof info === "number"
					? info
					: data?.event === "infoDelivery" &&
							info &&
							typeof info === "object" &&
							typeof info.playerState === "number"
						? info.playerState
						: null
			if (code === 1) setState("playing")
			else if (code === 2) setState("paused")
			else if (code === 0) setState("ended")
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [])

	// What plays, for the title bar.
	const live = phase === "open" && current
	useEffect(() => {
		if (!live || !current) {
			setNowPlaying(null)
			return
		}
		const command = (func: string) =>
			frame.current?.contentWindow?.postMessage(
				JSON.stringify({ event: "command", func, args: [] }),
				"*",
			)
		setNowPlaying({
			name: nameOf(current),
			spoken: spokenName(current),
			state,
			toggle: () => {
				if (state === "playing" || state === "loading") {
					command("pauseVideo")
					setState("paused")
				} else {
					command("playVideo")
					setState("playing")
				}
			},
			back: () =>
				window.scrollTo({
					top: 0,
					behavior: reducedMotion() ? "auto" : "smooth",
				}),
		})
	}, [live, current, state])
	useEffect(() => () => setNowPlaying(null), [])

	const others = videos.length - 1
	const oneKind = kinds === 1
	const kindWords = VIDEO_KINDS.find((x) => x.kind === first.kind)
	const hint =
		others > 0
			? `+${others} ${oneKind ? (others === 1 ? kindWords?.one : kindWords?.many) : others === 1 ? "video" : "videos"}`
			: null

	// The card: the screen laid out at the band's player size, sitting scaled down in the corner (--s, --i). --h: hover.
	const cardStyle: CSSProperties = {
		transform:
			"translate(var(--i), var(--i)) scale(calc(var(--s) * var(--h, 1)))",
		// Hidden while the stage is up; back as the stage shrinks onto it.
		opacity: phase === "opening" || phase === "open" ? 0 : 1,
		transition: `transform ${MS}ms ${EASE}, opacity 170ms ease ${phase === "closing" ? MS - 170 : 0}ms`,
	}

	return (
		<div ref={wrap} className="relative">
			<div className="relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-2xl sm:border sm:border-white/10 lg:h-[19rem] xl:h-[21rem]">
				<Backdrop media={media} />

				{/* The settings strip. On a desktop it lies over the band's top. */}
				<div className="relative z-10 flex h-12 items-center gap-2 px-4 sm:gap-3 lg:absolute lg:inset-x-0 lg:top-0 lg:h-auto lg:px-5 lg:pt-4">
					<div className="ml-auto flex items-center gap-2 sm:gap-3">
						{controls}
					</div>
				</div>

				{/* The card's place: full width 16:9 under the strip (phone), 28rem at the right (tablet), the band's right
				    side at full height (desktop). */}
				<div className="pointer-events-none relative z-20 aspect-video w-full [--i:-12px] [--s:.5] sm:mb-4 sm:ml-auto sm:mr-4 sm:w-[28rem] sm:[--i:0px] lg:absolute lg:right-4 lg:top-4 lg:m-0 lg:h-[17rem] lg:w-auto lg:[--s:.6] xl:h-[19rem] xl:[--s:.58]">
					<div
						ref={card}
						style={cardStyle}
						{...(up ? { inert: "" } : {})}
						onPointerEnter={preloadStage}
						onPointerDown={preloadStage}
						onFocus={preloadStage}
						className="pointer-events-auto absolute inset-0 origin-bottom-right overflow-hidden rounded-2xl bg-black shadow-[0_18px_50px_rgba(0,0,0,.65)] ring-2 ring-white/25 will-change-transform hover:[--h:1.03] active:[--h:.985] motion-reduce:!transition-none"
					>
						<Still media={media} small />
						<span
							aria-hidden="true"
							className="absolute left-1/2 top-[42%] flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_40px_rgba(0,0,0,.6)]"
						>
							<PlayIcon className="h-11 w-11 translate-x-1" />
						</span>
						<button
							ref={playButton}
							type="button"
							data-trailer
							data-replay-tap="trailer"
							onClick={() => press({ video: first })}
							aria-label={`Play the ${first.kind.toLowerCase()} for ${title} here`}
							className="absolute inset-0 cursor-pointer focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-amber-300"
						/>
						{/* The player's bar: play mark, the kind, an empty track, and "+29 videos" (opens them all). */}
						<span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-4 px-7 pb-6">
							{/* On a phone the card is narrow: with "+29 videos" the bar keeps just the kind and that. */}
							<PlayIcon
								className={`h-8 w-8 shrink-0 text-white ${hint ? "max-sm:hidden" : ""}`}
							/>
							<span className="shrink-0 text-[1.75rem] font-semibold leading-none text-white">
								{first.kind}
							</span>
							<span
								className={`relative ml-1 block h-1.5 min-w-8 flex-1 rounded-full bg-white/30 ${hint ? "max-sm:hidden" : ""}`}
							>
								<span className="absolute -top-[7px] left-0 h-5 w-5 rounded-full bg-amber-300" />
							</span>
							{hint &&
								(oneKind ? (
									<span className="shrink-0 text-[1.5rem] font-semibold leading-none text-white/80">
										{hint}
									</span>
								) : (
									<button
										type="button"
										onClick={() => press({ list: true })}
										aria-label={`All ${videos.length} videos: ${countsLine(videos)}`}
										className="pointer-events-auto relative ml-auto flex h-14 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/15 pl-5 pr-4 text-[1.5rem] font-semibold leading-none text-white ring-2 ring-white/30 hover:bg-white/25 focus-visible:outline-4 focus-visible:outline-amber-300"
									>
										{hint}
										<ChevronDownIcon className="h-6 w-6" strokeWidth={2.5} />
									</button>
								))}
						</span>
					</div>
				</div>
			</div>

			{up && geo && (
				<Suspense fallback={null}>
					<Stage
						media={media}
						videos={videos}
						geo={geo}
						phase={phase}
						from={from}
						k={k}
						current={current}
						state={state}
						listOpen={listOpen}
						listH={listH}
						onListH={setListH}
						onList={setListOpen}
						onPlay={play}
						onClose={close}
						onEnd={onEnd}
						onLaidOut={onLaidOut}
						refs={{ stage, list, frame, closeButton }}
						oneKind={oneKind}
					/>
				</Suspense>
			)}
		</div>
	)
}
