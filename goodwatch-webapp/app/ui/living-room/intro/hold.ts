// The dark hold over the TV's picture (HomeIntro.tsx, `.film-hold` in boot.css): it hides the TV's own screens while
// the film is asked for and not yet on the picture, so nothing of them flashes before the film (the owner,
// 2026-10-22). It rises in the render that asks for the film and falls once the film's stage is on the picture
// (FilmScreen's `onShown`), when its data is there: no delay of its own.

/** What the TV shows, as far as the hold is concerned. */
export type HoldShowing =
	| { kind: "film"; held: boolean }
	| { kind: "home" }
	| { kind: "off" }

export type HoldInput = {
	member: boolean
	/** The server's boot screen is still playing (or the page hasn't hydrated). */
	boot: boolean
	/** Null until the tab's progress decided what the TV shows. */
	showing: HoldShowing | null
	/**
	 * The address asks for the film now ("What is GoodWatch?" put `tv=about` there), in the very render that asks:
	 * the effect that starts the film runs only after that render has painted.
	 */
	asked: boolean
	/** The run's film stage is on the picture. */
	shown: boolean
	/** The film never came within the hold's longest wait: the TV's home shows. */
	gaveUp: boolean
}

/**
 * Whether the hold is up:
 * - a guest's first paint, while the boot screen plays and the tab hasn't decided yet;
 * - the render that asks for the film, for a member or a guest;
 * - a film run that is held (the first film after the boot screen, a replay, a chapter link, power on) until its
 *   stage is on the picture.
 * Not for a film that resumes in a returning tab: it fades in over the TV's home, as before.
 */
export function holdState(input: HoldInput): boolean {
	if (input.gaveUp) return false
	if (input.asked) return true
	if (input.showing === null) return !input.member && input.boot
	return input.showing.kind === "film" && input.showing.held && !input.shown
}

/**
 * Which hold it is: the start's (`start`: a guest's first paint, before the tab decided), which a returning tab's
 * mark hides with the boot screen (boot.css), or a film's (`run`: asked for, or a held run until it shows), which
 * shows in a returning tab too. A member who reloads and asks for "What is GoodWatch?" is in a returning tab.
 */
export function holdKind(
	showing: HoldShowing | null,
	asked: boolean,
): "start" | "run" {
	return showing === null && !asked ? "start" : "run"
}
