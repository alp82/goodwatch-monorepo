// Taps on the related map that come before its engine can do them (RelatedMap.tsx). The engine loads when the reader
// nears the section or presses it, so the first tap often lands before it runs: the press starts the load, and the
// click would be lost. A recorder remembers the last poster, control or title in the middle that was activated, by a
// pointer or a key (both arrive as a click on these buttons), and the section does it once the engine is there and
// the app's handlers (`nav`, `open`) are wired.
// A document's inline script records from the first paint, before the app runs (`inlineRecorder`); the section takes
// over its tap when it mounts. A page opened inside the app has no inline script: the section's recorder is all.

/** Everything in the section that a tap does something with. The title in the middle has no data-pl-step. */
export const TAPPABLE =
	"[data-pl-step],[data-pl-act],[data-pl-center],[data-pl-to],[data-pl-back]"
const IN_MAP = TAPPABLE.split(",")
	.map((one) => `[data-related-map] ${one}`)
	.join(",")

interface Engine {
	open?: unknown
}
interface TapWindow {
	__gwRelatedMap?: Engine
	__gwRelatedMapTap?: { el: Element | null; on: (event: Event) => void }
	addEventListener: (
		type: string,
		run: (event: Event) => void,
		capture: boolean,
	) => void
	removeEventListener: (
		type: string,
		run: (event: Event) => void,
		capture: boolean,
	) => void
}

/**
 * Whether a click on `el` is one the engine can't do yet: no engine, or the title in the middle before the app wired
 * the quick view (the engine does every other tap itself once it runs).
 */
export function missed(el: Element, engine: Engine | undefined): boolean {
	if (!engine) return true
	return !engine.open && el.matches("[data-pl-center]")
}

/** The inline script's recorder, as source: it runs while the document is parsed, before the app. */
export const inlineRecorder = `if(!w.__gwRelatedMapTap){var q=w.__gwRelatedMapTap={el:null,on:function(e){var m=w.__gwRelatedMap,t=e.target&&e.target.closest&&e.target.closest(${JSON.stringify(
	IN_MAP,
)});if(t&&(!m||!m.open&&t.matches("[data-pl-center]")))q.el=t}};w.addEventListener("click",q.on,true)}`

/**
 * Records the last tap on `section` that the engine can't do yet, from now until `stop`. Takes over the inline
 * script's tap, when it was on this section. `take` hands the tap over once (null when there is none).
 */
export function recordEarlyTaps(
	win: TapWindow,
	section: () => Element | null,
): { take: () => Element | null; stop: () => void } {
	let el: Element | null = null
	const inline = win.__gwRelatedMapTap
	if (inline) {
		win.removeEventListener("click", inline.on, true)
		win.__gwRelatedMapTap = undefined
		if (inline.el && section()?.contains(inline.el)) el = inline.el
	}
	const on = (event: Event) => {
		const target = event.target as Element | null
		const tapped = target?.closest ? target.closest(TAPPABLE) : null
		if (!tapped || !section()?.contains(tapped)) return
		if (missed(tapped, win.__gwRelatedMap)) el = tapped
	}
	win.addEventListener("click", on, true)
	return {
		take: () => {
			const tapped = el
			el = null
			return tapped
		},
		stop: () => {
			win.removeEventListener("click", on, true)
			el = null
		},
	}
}
