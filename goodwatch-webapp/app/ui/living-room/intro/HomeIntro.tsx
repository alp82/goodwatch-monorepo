// The intro on the start page's TV (docs/implementation/home-intro.md): the boot screen as the page opens, then for
// a guest the film (FilmScreen.tsx, loaded on demand) and "How GoodWatch works" below the room. What a visitor gets
// follows their progress in this tab (progress.ts), so coming back never starts the film over.
//
// - The boot screen is in the server's HTML and plays from the first paint. It plays once per tab: Just look around,
//   the TV's screens and the Remote never bring it back (only the TV's own power key boots the TV again).
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
import { HowGoodWatchWorks } from "../HowGoodWatchWorks"
import type { HomeHeadingTag } from "../tv/screens/Home"
import { BOOT_MS, Boot } from "./boot"
import { FILM_CHAPTER_EVENT, FILM_LEAVE_EVENT } from "./events"
import {
	type IntroStart,
	hasTaps,
	introStart,
	readProgress,
	writeProgress,
} from "./progress"
import { CHAPTERS, type ChapterId, type Enter } from "./scene"

const FilmScreen = lazy(() => import("./FilmScreen"))

/** The film's first scene deals in this long into the boot screen, as the boot screen fades. */
const FILM_AFTER_BOOT = BOOT_MS - 350
const QUIZ_SCENE = CHAPTERS.findIndex((chapter) => chapter.id === "closer")

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
	| { kind: "film"; scene: number; enter: Enter; wait: number; run: number }
	| { kind: "home" }

export type HomeIntro = {
	/** Over the TV's picture. */
	screen: ReactNode
	/** At the top of the section below the room. */
	below?: ReactNode
	/** The TV home headline's tag. */
	homeHeadingAs: HomeHeadingTag
}

export function useHomeIntro({ member }: { member: boolean }): HomeIntro {
	const hydrated = useHydrated()
	const [params, setParams] = useSearchParams()
	const tvScreen = params.get("tv")
	const [showing, setShowing] = useState<Showing | null>(null)
	const [boot, setBoot] = useState(true)
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
			wait: start.boot ? FILM_AFTER_BOOT : 0,
			run: runs.current,
		})
	}, [hydrated, member, tvScreen])

	// The boot screen leaves the page once it has played (it has faded out by itself by then).
	useEffect(() => {
		if (!hydrated || !boot) return
		const timer = setTimeout(() => setBoot(false), BOOT_MS)
		return () => clearTimeout(timer)
	}, [hydrated, boot])

	const leave = useCallback(() => {
		writeProgress({ left: true })
		setShowing({ kind: "home" })
	}, [])
	const play = useCallback((scene: number) => {
		runs.current += 1
		writeProgress({ scene })
		setShowing({
			kind: "film",
			scene,
			enter: "fade",
			wait: 0,
			run: runs.current,
		})
	}, [])

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
	const film = showing?.kind === "film" &&
		(!tvScreen || tvScreen === "about") && (
			<Suspense fallback={null}>
				<FilmScreen
					key={showing.run}
					startAt={showing.scene}
					firstEnter={showing.enter}
					waitMs={showing.wait}
					onAt={onAt}
					onFail={leave}
				/>
			</Suspense>
		)
	return {
		screen: (
			<>
				{film}
				{(!hydrated || boot) && <Boot />}
			</>
		),
		below: member ? undefined : <HowGoodWatchWorks />,
		homeHeadingAs: member ? "h1" : "p",
	}
}
