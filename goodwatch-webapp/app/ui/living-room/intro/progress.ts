// How far a visitor got with the intro, kept for the browser tab (sessionStorage), so coming back to the start page
// in the same tab never starts the film over: not after a title page and Back, not after sign-up and Back. A reload
// before the film is done (the visitor neither left it nor reached the quiz) starts it over, boot screen and all
// (`introStartScript`). A new tab starts fresh. Nothing here leaves the browser.
//
// The rules (`introStart`):
// - Nothing kept (a new tab): a guest gets the boot screen, then the film from its first scene; a member the boot
//   screen and the TV's home.
// - The visitor left the film (Just look around, a member's boot): the TV's home, no boot.
// - The film was playing: it goes on from that scene, no boot.
// - The visitor has tapped titles in the quiz: the quiz, as they left it, no boot.
// - "What is GoodWatch?" in the TV's menu (`replay`): the film from its first scene, no boot, for anyone.
// - The TV's power key (HomeIntro.tsx): off stops the film; on plays the boot screen, then a guest's film from its
//   first scene.

/** The sessionStorage key; also read by the start page's inline script, which hides the boot before it paints. */
export const PROGRESS_KEY = "gw-intro"
/** The quiz's taps and pick (quiz/taste-quiz.tsx). */
export const TAPS_KEY = "gw-intro-taps"

export type IntroProgress = { left: true } | { scene: number }

export type IntroStart =
	/** The TV's home, with or without the boot screen. */
	| { kind: "home"; boot: boolean }
	/** The film from `scene`; `boot` when it follows the boot screen. */
	| { kind: "film"; scene: number; boot: boolean }

export function introStart({
	progress,
	tapped,
	member,
	replay = false,
	quizScene,
	scenes,
}: {
	progress: IntroProgress | null
	/** Whether the quiz holds taps from this tab. */
	tapped: boolean
	member: boolean
	replay?: boolean
	/** The quiz's place in the film. */
	quizScene: number
	/** How many scenes the film has. */
	scenes: number
}): IntroStart {
	if (replay) return { kind: "film", scene: 0, boot: false }
	if (!progress)
		return member
			? { kind: "home", boot: true }
			: { kind: "film", scene: 0, boot: true }
	if ("left" in progress) return { kind: "home", boot: false }
	if (tapped) return { kind: "film", scene: quizScene, boot: false }
	const scene =
		Number.isInteger(progress.scene) &&
		progress.scene >= 0 &&
		progress.scene < scenes
			? progress.scene
			: 0
	return { kind: "film", scene, boot: false }
}

/** Reads what a value kept under PROGRESS_KEY says, or null for nothing (or something unreadable). */
export function parseProgress(raw: string | null): IntroProgress | null {
	if (!raw) return null
	try {
		const value = JSON.parse(raw) as unknown
		if (value && typeof value === "object") {
			if ("left" in value && value.left === true) return { left: true }
			if ("scene" in value && typeof value.scene === "number")
				return { scene: value.scene }
		}
	} catch {}
	return null
}

const storage = () => {
	try {
		return typeof window === "undefined" ? null : window.sessionStorage
	} catch {
		return null
	}
}

export function readProgress(): IntroProgress | null {
	try {
		return parseProgress(storage()?.getItem(PROGRESS_KEY) ?? null)
	} catch {
		return null
	}
}

export function writeProgress(progress: IntroProgress) {
	try {
		storage()?.setItem(PROGRESS_KEY, JSON.stringify(progress))
	} catch {}
}

export function hasTaps(): boolean {
	try {
		return Boolean(storage()?.getItem(TAPS_KEY))
	} catch {
		return false
	}
}

/**
 * The inline script the start page runs before the room paints. A reload of a film that isn't done forgets the
 * tab's progress, so the film starts over with its boot screen. Any other progress kept in this tab hides the boot
 * screen at once (boot.css), so coming back doesn't flash it. Runs before React; keep it tiny and self-contained.
 * `quizScene` is the quiz's place in the film: reaching it counts as done.
 */
export const introStartScript = (quizScene: number) =>
	`try{var s=sessionStorage,v=s.getItem(${JSON.stringify(PROGRESS_KEY)}),n=performance.getEntriesByType("navigation")[0],p=v&&JSON.parse(v);if(p&&n&&n.type==="reload"&&!p.left&&!(p.scene>=${quizScene})){s.removeItem(${JSON.stringify(PROGRESS_KEY)});s.removeItem(${JSON.stringify(TAPS_KEY)});v=null}if(v)document.documentElement.setAttribute("data-gw-intro","seen")}catch(e){}`

/** The TV's power key turned the set on: the boot screen may show again, whatever the inline script said. */
export function unhideBoot() {
	try {
		document.documentElement.removeAttribute("data-gw-intro")
	} catch {}
}
