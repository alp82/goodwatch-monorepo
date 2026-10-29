// How it works on the start page (docs/implementation/start-page-redesign.md, "How it works and the intro"): the
// room's TV corner as one "Watch the intro" button beside the three essentials and one real link to /how-it-works.
//
// - The crop is placed by CSS from the first paint (how-it-works.css, with the numbers from intro-push.ts): the TV in
//   the middle, about a third of the crop's width. The picture is below the fold and joins once the page has started.
// - Pressing it loads the theater (IntroTheater.tsx, which brings the film's code and intro.css) and pushes the camera
//   into the TV from where the corner is on screen. Nothing of the film is on the page's first load. A tab opened
//   before a deploy reloads once for the new build's chunk (reloadOnStaleChunk); when the code still doesn't come, the
//   pill says so and the next press tries again.
// - Close gives the focus back to the corner; Try it hands the guest to the search (hand-off.ts).
import { Link } from "@remix-run/react"
import {
	type CSSProperties,
	type ComponentType,
	useCallback,
	useRef,
	useState,
} from "react"
import { assetUrl } from "~/utils/asset-url"
import { useHydrated } from "~/utils/hydrated"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { TV_CORNER_ART } from "../room/room-pictures"
import { TV_CORNER } from "../room/scene"
import type { IntroTheaterProps } from "./IntroTheater"
import { bringToSearch } from "./hand-off"
import {
	CORNER_FOCUS,
	CORNER_TV,
	CORNER_ZOOM,
	type IntroFrom,
	introFrom,
} from "./intro-push"

/** The three essentials beside the corner. */
export const ESSENTIALS = [
	{
		id: "score",
		title: "One score from all the big sites",
		line: "IMDb, Rotten Tomatoes, Metacritic and TMDB in one score for every movie and show.",
	},
	{
		id: "search",
		title: "Search by mood or anything",
		line: "Type what you're in the mood for and get the titles that fit.",
	},
	{
		id: "picks",
		title: "Picks for your taste",
		line: "Rate a few titles you loved, and GoodWatch picks what you'll love next.",
	},
] as const

/** The crop's numbers for how-it-works.css. */
const CORNER_STYLE = {
	"--how-aspect": TV_CORNER.width / TV_CORNER.height,
	"--how-zoom": CORNER_ZOOM,
	"--how-fx": CORNER_FOCUS.x,
	"--how-fy": CORNER_FOCUS.y,
	"--how-tv-bottom": CORNER_TV.top + CORNER_TV.height,
} as CSSProperties

const rectOf = (el: Element) => {
	const r = el.getBoundingClientRect()
	return { left: r.left, top: r.top, width: r.width, height: r.height }
}

type Theater = ComponentType<IntroTheaterProps>

const loadIntroTheater = reloadOnStaleChunk(() =>
	import("./IntroTheater").then((m) => m.IntroTheater),
)

export function HowItWorksCorner({
	loadTheater = loadIntroTheater,
}: {
	/** The theater's code: the lazy chunk; tests pass their own. */
	loadTheater?: () => Promise<Theater>
}) {
	const button = useRef<HTMLButtonElement>(null)
	const picture = useRef<HTMLImageElement>(null)
	const hydrated = useHydrated()
	const [Theater, setTheater] = useState<Theater | null>(null)
	const [from, setFrom] = useState<IntroFrom | null>(null)
	const loading = useRef<Promise<Theater> | null>(null)
	const [failed, setFailed] = useState(false)

	// The theater's code (and the film's) loads on the press itself: a finger or mouse going down starts it, so it is
	// often there by the click. A load that fails is forgotten, so the next press asks again.
	const load = useCallback(() => {
		if (!loading.current) {
			const next = loadTheater()
			loading.current = next
			next.catch(() => {
				if (loading.current === next) loading.current = null
			})
		}
		return loading.current
	}, [loadTheater])
	// The early start on pointerdown: its failure shows when the click asks for the same load.
	const prefetch = useCallback(() => {
		load().catch(() => {})
	}, [load])
	const play = useCallback(() => {
		load()
			.then((C) => {
				// Measured once the code is there: where the TV is on screen now is where the camera starts.
				const box = button.current
				const img = picture.current
				setFrom(
					box && img
						? introFrom(rectOf(box), rectOf(img), img.currentSrc || img.src)
						: null,
				)
				setFailed(false)
				setTheater(() => C)
			})
			.catch((error) => {
				console.error("The intro couldn't be loaded", error)
				setFailed(true)
			})
	}, [load])
	const close = useCallback(() => {
		setTheater(null)
		button.current?.focus({ preventScroll: true })
	}, [])
	const tryIt = useCallback(() => {
		setTheater(null)
		bringToSearch()
	}, [])

	return (
		<section aria-labelledby="start-how-heading" className="start-how">
			<div className="start-how-grid">
				<button
					ref={button}
					type="button"
					className="start-how-room"
					style={CORNER_STYLE}
					onPointerDown={prefetch}
					onClick={play}
				>
					<span className="start-how-scene">
						{/* After the page has started, not from the HTML: a lazy picture this near the first view is fetched with
						    the room, and 136 KB of it delays the room's paint on a slow phone. The box is the same either way. */}
						{hydrated && (
							<picture>
								<source
									type="image/avif"
									srcSet={assetUrl(TV_CORNER_ART.avif)}
								/>
								<img
									ref={picture}
									src={assetUrl(TV_CORNER_ART.webp)}
									alt=""
									width={TV_CORNER.width}
									height={TV_CORNER.height}
									loading="lazy"
									decoding="async"
									draggable={false}
									className="start-how-picture"
								/>
							</picture>
						)}
						<span className="start-how-pill">
							<span aria-hidden className="start-how-pill-dot">
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
								</svg>
							</span>
							{failed ? "Couldn't load. Try again" : "Watch the intro"}
						</span>
					</span>
				</button>
				<output className="sr-only">
					{failed
						? "The intro couldn't load. Press the button to try again."
						: ""}
				</output>
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/85">
						How it works
					</p>
					<h2
						id="start-how-heading"
						className="mt-1 text-2xl font-extrabold text-white md:text-4xl"
					>
						How GoodWatch works
					</h2>
					<ul className="mt-3 space-y-1.5 text-[15px] leading-snug text-gray-300 md:mt-4 md:space-y-2 md:text-base">
						{ESSENTIALS.map((e) => (
							<li key={e.id} className="flex gap-2">
								<span aria-hidden className="text-amber-400">
									•
								</span>
								<span>
									<b className="font-bold text-white">{e.title}.</b> {e.line}
								</span>
							</li>
						))}
					</ul>
					<Link
						to="/how-it-works"
						className="group mt-5 inline-flex items-center gap-2 text-base font-bold text-amber-300 hover:underline md:mt-7 md:text-lg"
					>
						Read how it works
						<span
							aria-hidden
							className="inline-block transition-transform duration-200 group-hover:translate-x-1"
						>
							→
						</span>
					</Link>
				</div>
			</div>
			{Theater ? <Theater from={from} onClose={close} onTryIt={tryIt} /> : null}
		</section>
	)
}
