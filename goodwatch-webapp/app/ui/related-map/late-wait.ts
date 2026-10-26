// When a late related map (RelatedMap.tsx: its page title's pack came too late for the server) asks for the pack: once
// the reader comes near the section and the page's own navigation work is done (`wait`, afterNavigationWork in
// navigation/instant-navigation.ts, #753), or at once when the reader taps the section's placeholder. It asks once.

type Wait = (run: () => void) => () => void

/** Starts `start` when the section is wanted; returns the cleanup, after which nothing starts. */
export function whenSectionWanted(
	section: Element | null,
	start: () => void,
	wait: Wait,
	Observer:
		| typeof IntersectionObserver
		| undefined = globalThis.IntersectionObserver,
): () => void {
	let done = false
	let cancel = () => {}
	let observer: IntersectionObserver | null = null
	const stop = () => {
		done = true
		cancel()
		observer?.disconnect()
		section?.removeEventListener("pointerdown", now, true)
	}
	function now() {
		if (done) return
		stop()
		start()
	}
	if (!section || !Observer) {
		cancel = wait(now)
		return stop
	}
	section.addEventListener("pointerdown", now, true)
	observer = new Observer(
		(entries) => {
			if (done || !entries.some((entry) => entry.isIntersecting)) return
			observer?.disconnect()
			cancel = wait(now)
		},
		{ rootMargin: "800px 0px" },
	)
	observer.observe(section)
	return stop
}
