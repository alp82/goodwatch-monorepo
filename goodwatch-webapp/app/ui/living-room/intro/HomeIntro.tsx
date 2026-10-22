// The intro on the start page's TV (docs/implementation/home-intro.md): the boot screen as the page opens, then for
// a guest the film (FilmScreen.tsx, loaded on demand) and "How GoodWatch works" below the room. What a visitor gets
// follows their progress in this tab (progress.ts), so coming back never starts the film over.
//
// - The boot screen is in the server's HTML and plays from the first paint. It plays once per tab: Just look around,
//   the TV's screens and the Remote never bring it back. A reload before the film is done starts it over (progress.ts).
// - The TV's power key: off stops the film; on plays the boot screen again, then a guest's film from its first scene.
// - "What is GoodWatch?" in the TV's menu (its About screen) plays the film again from its first scene, for anyone.
// - Opening another TV screen, or Just look around in the quiz, steps the film aside for the TV.
import { useSearchParams } from "@remix-run/react"
import {
	type ReactNode,
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { HowGoodWatchWorks } from "../HowGoodWatchWorks"
import type { HomeHeadingTag } from "../tv/screens/Home"
import type { TvPower } from "../tv/tv-machine"
import { BOOT_MS, Boot } from "./boot"
import { FILM_CHAPTER_EVENT, FILM_LEAVE_EVENT } from "./events"
import { holdKind, holdState } from "./hold"
import {
	type IntroStart,
	hasTaps,
	introStart,
	readProgress,
	unhideBoot,
	writeProgress,
} from "./progress"
import { CHAPTERS, type ChapterId, type Enter } from "./scene"

const FilmScreen = lazy(() => import("./FilmScreen"))

/** The film's first scene deals in this long into the boot screen, as the boot screen fades. */
const FILM_AFTER_BOOT = BOOT_MS - 350
/**
 * The longest the picture stays dark after the boot screen for a film that doesn't come (its code or data is slow):
 * then the TV's home shows.
 */
const HOLD_MS = 9000

/**
 * How long ago the page painted first, or 0 without paint timing. The server's boot screen plays from the first paint,
 * and the page's scripts start after it (utils/start-after-paint.ts), so the film's wait counts from the paint, not
 * from hydration.
 */
const sinceFirstPaint = () => {
	const paint = performance.getEntriesByName?.("first-contentful-paint")[0]
	return paint ? Math.max(0, performance.now() - paint.startTime) : 0
}
export const QUIZ_SCENE = CHAPTERS.findIndex(
	(chapter) => chapter.id === "closer",
)

const noop = () => () => {}
/** False while the server renders and while the page hydrates; true after, and at once on a client navigation. */
const useHydrated = () =>
	useSyncExternalStore(
		noop,
		() => true,
		() => false,
	)

/** What the TV shows: the film from a scene (`run` starts it again), or its home. */
type Showing =
	/** `held`: the dark hold stays up until the film's stage is on the picture (hold.ts). */
	| {
			kind: "film"
			scene: number
			enter: Enter
			wait: number
			run: number
			held: boolean
	  }
	| { kind: "home" }
	/** The TV is off: nothing of the intro shows or plays. */
	| { kind: "off" }

export type HomeIntro = {
	/** Over the TV's picture. */
	screen: ReactNode
	/** At the top of the section below the room. */
	below?: ReactNode
	/** The TV home headline's tag. */
	homeHeadingAs: HomeHeadingTag
	/** The TV's power, as it changes (TvLivingRoom.tsx reports it). */
	onPower: (power: TvPower) => void
}

export function useHomeIntro({ member }: { member: boolean }): HomeIntro {
	const hydrated = useHydrated()
	const [params, setParams] = useSearchParams()
	const tvScreen = params.get("tv")
	const [showing, setShowing] = useState<Showing | null>(null)
	const [boot, setBoot] = useState(true)
	// The film after the boot screen is on the picture: the dark hold under the boot screen can go. Until then the
	// TV's home, under everything, must not show between the boot screen fading and the film's first scene (the owner
	// saw it flash there, 2026-10-22).
	const [filmShown, setFilmShown] = useState(false)
	/** The film didn't come within the hold's longest wait: the hold falls and the TV's home shows. */
	const [gaveUp, setGaveUp] = useState(false)
	/** Counts the boots: each power-on mounts a new boot screen, so its animation plays from the start. */
	const [boots, setBoots] = useState(0)
	const runs = useRef(0)

	// Once the browser is in charge, the tab's progress decides. Until then the server's boot screen shows (hidden
	// before it paints when this tab has progress, by the start page's inline script and boot.css).
	const decided = useRef(false)
	useEffect(() => {
		if (!hydrated || decided.current) return
		decided.current = true
		const start: IntroStart = introStart({
			progress: readProgress(),
			tapped: hasTaps(),
			member,
			replay: tvScreen === "about",
			quizScene: QUIZ_SCENE,
			scenes: CHAPTERS.length,
		})
		setBoot(start.boot)
		if (start.kind === "home") {
			// A member's boot screen, once: the tab won't show it again.
			writeProgress({ left: true })
			setShowing({ kind: "home" })
			return
		}
		// Kept at once, so leaving during the boot screen and coming back doesn't start the film over.
		writeProgress({ scene: start.scene })
		setShowing({
			kind: "film",
			scene: start.scene,
			enter: start.boot ? "deal" : "fade",
			wait: start.boot ? Math.max(0, FILM_AFTER_BOOT - sinceFirstPaint()) : 0,
			run: runs.current,
			// After the boot screen, or asked for by the address: dark until it shows. A film that resumes fades in.
			held: start.boot || tvScreen === "about",
		})
	}, [hydrated, member, tvScreen])

	// The boot screen leaves the page once it has played (it has faded out by itself by then).
	useEffect(() => {
		if (!hydrated || !boot) return
		const timer = setTimeout(() => setBoot(false), BOOT_MS)
		return () => clearTimeout(timer)
	}, [hydrated, boot, boots])

	const leave = useCallback(() => {
		writeProgress({ left: true })
		setShowing({ kind: "home" })
	}, [])
	// Auth can finish resolving after the intro chose its guest screen. A member should not remain on that quiz.
	// Only react to becoming a member: members can still explicitly replay "What is GoodWatch?" afterwards.
	const previousMember = useRef(member)
	useEffect(() => {
		if (member && !previousMember.current) leave()
		previousMember.current = member
	}, [member, leave])
	// Asked for by a person (What is GoodWatch?, a chapter link): the hold covers the TV until the film is there.
	const play = useCallback((scene: number) => {
		runs.current += 1
		setFilmShown(false)
		setGaveUp(false)
		writeProgress({ scene })
		setShowing({
			kind: "film",
			scene,
			enter: "fade",
			wait: 0,
			run: runs.current,
			held: true,
		})
	}, [])

	// The power key. Off: the film stops and the boot screen goes. On (from off): the boot screen plays again, then a
	// guest's film from its first scene; a member gets the TV's home.
	const power = useRef<TvPower>("on")
	const onPower = useCallback(
		(next: TvPower) => {
			const was = power.current
			power.current = next
			if (next === was) return
			if (next === "off") {
				setBoot(false)
				setShowing({ kind: "off" })
				return
			}
			if (was !== "off") return
			unhideBoot()
			setBoot(true)
			setBoots((n) => n + 1)
			runs.current += 1
			setFilmShown(false)
			setGaveUp(false)
			if (member) {
				setShowing({ kind: "home" })
				return
			}
			writeProgress({ scene: 0 })
			setShowing({
				kind: "film",
				scene: 0,
				enter: "deal",
				wait: FILM_AFTER_BOOT,
				run: runs.current,
				held: true,
			})
		},
		[member],
	)

	// "What is GoodWatch?" in the TV's menu: the film from its first scene, and the TV's own About screen goes.
	useEffect(() => {
		if (tvScreen !== "about" || !hydrated || !decided.current) return
		play(0)
		const next = new URLSearchParams(params)
		next.delete("tv")
		setParams(next, { replace: true, preventScrollReset: true })
	}, [tvScreen, hydrated, params, setParams, play])
	// Another TV screen opened from the Remote or a link: the visitor is using the TV.
	useEffect(() => {
		if (tvScreen && tvScreen !== "about" && showing?.kind === "film") leave()
	}, [tvScreen, showing, leave])
	// "Just look around" in the quiz, and "Watch in the intro" below the room.
	useEffect(() => {
		const onChapter = (e: Event) => {
			const at = CHAPTERS.findIndex(
				(chapter) => chapter.id === (e as CustomEvent<ChapterId>).detail,
			)
			if (at >= 0) play(at)
		}
		addEventListener(FILM_LEAVE_EVENT, leave)
		addEventListener(FILM_CHAPTER_EVENT, onChapter)
		return () => {
			removeEventListener(FILM_LEAVE_EVENT, leave)
			removeEventListener(FILM_CHAPTER_EVENT, onChapter)
		}
	}, [leave, play])

	const onAt = useCallback((scene: number) => writeProgress({ scene }), [])
	const onShown = useCallback(() => setFilmShown(true), [])
	// Dark from a guest's first paint (a returning tab hides it before it paints, boot.css), from the render that asks
	// for the film (the TV's About screen and its home never show for a frame), and for a held run until the film's
	// stage is on the picture (hold.ts). The film's stage is dark itself, so the hold falls with nothing between.
	const asked = hydrated && decided.current && tvScreen === "about"
	const holding = holdState({
		member,
		boot: !hydrated || boot,
		showing,
		asked,
		shown: filmShown,
		gaveUp,
	})
	// Only a safety net for a film that never comes (its code or data is very slow): then the TV's home shows.
	useEffect(() => {
		if (!holding || !hydrated) return
		const timer = setTimeout(() => setGaveUp(true), HOLD_MS)
		return () => clearTimeout(timer)
	}, [holding, hydrated])
	const film = showing?.kind === "film" &&
		(!tvScreen || tvScreen === "about") && (
			<Suspense fallback={null}>
				<FilmScreen
					key={showing.run}
					startAt={showing.scene}
					firstEnter={showing.enter}
					waitMs={showing.wait}
					onAt={onAt}
					onShown={onShown}
					onFail={leave}
				/>
			</Suspense>
		)
	return {
		screen: (
			<>
				{film}
				{/* The desktop's white G over the film, where the TV's own G stands on its screens: it leaves the film for
				    the TV's home, as Look around does (the owner, 2026-10-22: the G always there). The phone keeps its film
				    as it is (intro.css). */}
				{film && (
					<button
						type="button"
						className="film-home"
						aria-label={member ? "Start" : "Home"}
						onClick={leave}
					>
						<GoodWatchG height={28} />
					</button>
				)}
				{holding && (
					<div
						className="film-hold"
						aria-hidden="true"
						// A hold for a film asked for or playing (`run`) shows in a returning tab too: the tab's mark hides only
						// the start's boot screen and the hold under it (boot.css).
						data-film-hold={holdKind(showing, asked)}
					/>
				)}
				{(!hydrated || boot) && <Boot key={boots} />}
			</>
		),
		below: member ? undefined : <HowGoodWatchWorks />,
		homeHeadingAs: member ? "h1" : "p",
		onPower,
	}
}
