// The streaming block's highlight on arrival from the TV's "Watch on <service>" key (ui/living-room/tv): the amber
// tint and ring of the Explorer tutorial (`ex-tut-glow` in ui/explorer/explorer.css), around the whole block, for
// three pulses. Its rules are here because the Explorer's stylesheet is not loaded on a title page.
//
// The wish to highlight travels in the history entry's state, never in the address: a shared link, a bookmark or a
// typed address with `#streaming` scrolls and does not glow. The block reads the wish once and clears it from the
// entry, so a reload and a Back or Forward to the page do not glow again.
//
// The title page is a landing surface, where nothing animates at rest (#190): the pulse plays three times and
// stops, or sooner at the first press or key inside the block. It starts once the transition from the TV has ended
// (`html[data-tv-transition]`, ui/living-room/tv-transition.ts), so the growing frame does not cut the ring. With
// reduced motion there is no pulse: a still amber outline for the same time.
import { useLocation } from "@remix-run/react"
import { type RefObject, useCallback, useEffect, useState } from "react"

/** The history entry state with which a navigation asks the title page to highlight its streaming block. */
export type StreamingArrival = { highlight: "streaming" }

const PULSE_MS = 1300
const PULSES = 3
/** The pulse waits for the transition from the TV, which waits for the page; past this the tint ends anyway. */
const LATEST_END_MS = 10_000

const RULES = `@keyframes gw-watch-glow{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,.9),0 0 18px rgba(251,191,36,.5)}60%{box-shadow:0 0 0 12px rgba(251,191,36,0),0 0 30px rgba(251,191,36,.8)}}.gw-watch-glow{background-color:rgba(251,191,36,.28)!important}html:not([data-tv-transition]) .gw-watch-glow{animation:gw-watch-glow ${PULSE_MS}ms ease-in-out ${PULSES}}@media (prefers-reduced-motion:reduce){.gw-watch-glow{outline:2px solid #fbbf24;outline-offset:2px}html:not([data-tv-transition]) .gw-watch-glow{animation:none}}`

const wishOf = (state: unknown) =>
	(state as Partial<StreamingArrival> | null)?.highlight === "streaming"

/**
 * Whether the block glows, and what it needs for it: `block` is spread on the block's element, `rules` is drawn
 * inside it.
 */
export function useStreamingGlow(ref: RefObject<HTMLElement>) {
	const location = useLocation()
	const arrived = wishOf(location.state)
	const [glow, setGlow] = useState(false)
	const stop = useCallback(() => setGlow(false), [])

	// Once per arrival, which is a history entry (`location.key`): the wish leaves the entry before it is carried out.
	useEffect(() => {
		if (!arrived) return
		const entry = window.history.state
		if (!wishOf(entry?.usr)) return
		window.history.replaceState(
			{ ...entry, usr: { ...entry.usr, highlight: undefined } },
			"",
		)
		setGlow(true)
		// For a screen reader the block is where the person arrived; its heading says "Where to watch".
		ref.current?.focus({ preventScroll: true })
	}, [arrived, location.key])

	useEffect(() => {
		if (!glow) return
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const timer = setTimeout(stop, still ? PULSE_MS * PULSES : LATEST_END_MS)
		return () => clearTimeout(timer)
	}, [glow, stop])

	return {
		glow,
		/** The rules, while they are needed. */
		rules: glow ? <style>{RULES}</style> : null,
		block: {
			// The block takes the focus on arrival; it is no stop of the Tab key.
			...(arrived && { tabIndex: -1 }),
			...(glow && {
				onPointerDown: stop,
				onKeyDown: stop,
				onAnimationEnd: (e: React.AnimationEvent) => {
					if (e.animationName === "gw-watch-glow") stop()
				},
			}),
		},
		/** Appended to the block's classes; empty on every other visit, so the page's HTML stays as it was. */
		className: `${arrived ? " outline-none" : ""}${glow ? " gw-watch-glow" : ""}`,
	}
}
