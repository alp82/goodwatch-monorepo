// Decides when analytics and error tracking load. They cost main-thread time, so they wait until the page is
// interactive. The caller starts the trigger after hydration. The rule:
// 1. The first tap, click, key press, wheel turn or scroll runs the tools at once. A visitor who uses the page is
//    counted.
// 2. A page that is hidden (a background tab, or the visitor switches away) runs the tools at once: nobody is waiting
//    for that page.
// 3. Otherwise the trigger waits for the load event, and then until the page has been quiet for `quietMs`: no long
//    task on the main thread and no finished request in that time. That is the lab definition of "interactive" with a
//    longer window: Lighthouse ends its measurement after 1 second of quiet, so the tools' start-up work stays out of
//    its Total Blocking Time.
// 4. A page that never gets quiet runs the tools `maxWaitMs` after the load event.

export interface LoadTriggerEnv {
	/** `document.readyState === "complete"`. */
	isLoaded: () => boolean
	/** `document.visibilityState === "hidden"`. */
	isHidden: () => boolean
	addEventListener: (
		type: string,
		listener: () => void,
		options?: AddEventListenerOptions,
	) => void
	removeEventListener: (
		type: string,
		listener: () => void,
		options?: AddEventListenerOptions,
	) => void
	setTimeout: (callback: () => void, ms: number) => unknown
	clearTimeout: (handle: unknown) => void
	/**
	 * Calls `onActivity` after every long task and every finished request, and returns a function that stops it.
	 * Absent in browsers that can't observe either: there the load event starts the quiet time and nothing restarts it.
	 */
	observeActivity?: (onActivity: () => void) => () => void
}

export interface LoadTriggerOptions {
	quietMs: number
	maxWaitMs: number
}

/** What made the tools load. Sent nowhere; tests and debugging read it. */
export type LoadReason = "interaction" | "hidden" | "quiet" | "timeout"

export const INTERACTION_EVENTS = [
	"pointerdown",
	"touchstart",
	"keydown",
	"wheel",
	"scroll",
]

// Capture, so that a handler of the page that stops the event doesn't hide it. Scroll is the exception: in the capture
// phase the window also sees scrolling inside elements, which a carousel can cause without a visitor.
const listenerOptions = (type: string): AddEventListenerOptions => ({
	capture: type !== "scroll",
	passive: true,
})

/**
 * Calls `run` once, by the rule above. Returns a function that cancels a trigger that hasn't fired.
 */
export function whenPageIsInteractive(
	run: (reason: LoadReason) => void,
	env: LoadTriggerEnv,
	{ quietMs, maxWaitMs }: LoadTriggerOptions,
): () => void {
	let done = false
	let quietTimer: unknown
	let maxTimer: unknown
	let stopObserving: (() => void) | undefined

	const cleanup = () => {
		for (const type of INTERACTION_EVENTS)
			env.removeEventListener(type, onInteraction, listenerOptions(type))
		env.removeEventListener("visibilitychange", onVisibility)
		env.removeEventListener("load", onLoad)
		if (quietTimer !== undefined) env.clearTimeout(quietTimer)
		if (maxTimer !== undefined) env.clearTimeout(maxTimer)
		stopObserving?.()
		quietTimer = undefined
		maxTimer = undefined
		stopObserving = undefined
	}
	const fire = (reason: LoadReason) => {
		if (done) return
		done = true
		cleanup()
		run(reason)
	}
	const onInteraction = () => fire("interaction")
	const onVisibility = () => {
		if (env.isHidden()) fire("hidden")
	}
	const restartQuietTime = () => {
		if (done) return
		if (quietTimer !== undefined) env.clearTimeout(quietTimer)
		quietTimer = env.setTimeout(() => fire("quiet"), quietMs)
	}
	const onLoad = () => {
		env.removeEventListener("load", onLoad)
		if (done) return
		maxTimer = env.setTimeout(() => fire("timeout"), maxWaitMs)
		stopObserving = env.observeActivity?.(restartQuietTime)
		restartQuietTime()
	}

	if (env.isHidden()) {
		fire("hidden")
		return () => {}
	}
	for (const type of INTERACTION_EVENTS)
		env.addEventListener(type, onInteraction, listenerOptions(type))
	env.addEventListener("visibilitychange", onVisibility)
	if (env.isLoaded()) onLoad()
	else env.addEventListener("load", onLoad)

	return () => {
		if (done) return
		done = true
		cleanup()
	}
}

/** The trigger's environment in a browser. */
export function browserLoadTriggerEnv(win: Window): LoadTriggerEnv {
	return {
		isLoaded: () => win.document.readyState === "complete",
		isHidden: () => win.document.visibilityState === "hidden",
		addEventListener: (type, listener, options) =>
			win.addEventListener(type, listener, options),
		removeEventListener: (type, listener, options) =>
			win.removeEventListener(type, listener, options),
		setTimeout: (callback, ms) => win.setTimeout(callback, ms),
		clearTimeout: (handle) => win.clearTimeout(handle as number),
		observeActivity: browserActivityObserver(win),
	}
}

function browserActivityObserver(
	win: Window,
): LoadTriggerEnv["observeActivity"] {
	const Observer = (
		win as unknown as { PerformanceObserver?: typeof PerformanceObserver }
	).PerformanceObserver
	if (typeof Observer !== "function") return undefined
	const supported = Observer.supportedEntryTypes ?? []
	const entryTypes = ["longtask", "resource"].filter((type) =>
		supported.includes(type),
	)
	if (entryTypes.length === 0) return undefined
	return (onActivity) => {
		try {
			const observer = new Observer(() => onActivity())
			observer.observe({ entryTypes })
			return () => observer.disconnect()
		} catch {
			return () => {}
		}
	}
}
