// The film's fast-forward: while a visitor holds a press on the picture (or holds the space bar), the film speeds up
// to twice its pace within a moment, to 3x after 3 s held and 4x after 6 s, and eases back to 1x when they let go
// (the owner, 2026-10-25). Two things follow the speed:
// - the player's own timers (when a scene hands over), through `filmClock`;
// - every CSS animation on the stage, through its `playbackRate` (player.tsx).

/** The paces while held, one more every `STEP_MS`. */
export const HOLD_RATES = [2, 3, 4] as const
export const STEP_MS = 3000
/** How long the speed takes to reach a faster pace, and to come back to 1x, in ms. */
export const RAMP_UP_MS = 260
export const RAMP_DOWN_MS = 200
/** A finger has to stay this long before the film speeds up: a tap or the start of a scroll doesn't. */
export const TOUCH_HOLD_MS = 180

/** The pace after `heldMs` of holding: 2x, then 3x after 3 s, then 4x after 6 s. */
export function holdRate(heldMs: number): number {
	const step = Math.floor(Math.max(0, heldMs) / STEP_MS)
	return HOLD_RATES[Math.min(step, HOLD_RATES.length - 1)]
}

/** The speed `elapsed` ms into a ramp from `from` to `to`: quick at first, settling into the new pace. */
export function rampRate(from: number, to: number, elapsed: number): number {
	const ms = to > from ? RAMP_UP_MS : RAMP_DOWN_MS
	const t = Math.min(1, Math.max(0, elapsed / ms))
	const eased = 1 - (1 - t) ** 3
	return t >= 1 ? to : from + (to - from) * eased
}

export type FilmClock = {
	/** Runs `fn` once `ms` of film time have passed, at whatever speeds the film plays meanwhile. Returns a cancel. */
	after: (ms: number, fn: () => void) => () => void
	setRate: (rate: number) => void
	readonly rate: number
}

/** Timers that run on the film's time: at 2x, a scene's 4 s pass in 2 s of the visitor's. */
export function filmClock(
	now: () => number = () => performance.now(),
): FilmClock {
	type Timer = {
		at: number
		fn: () => void
		handle?: ReturnType<typeof setTimeout>
	}
	let rate = 1
	let realBase = now()
	let filmBase = 0
	const timers = new Set<Timer>()
	const filmNow = () => filmBase + (now() - realBase) * rate
	const arm = (timer: Timer) => {
		clearTimeout(timer.handle)
		timer.handle = setTimeout(
			() => {
				timers.delete(timer)
				timer.fn()
			},
			Math.max(0, (timer.at - filmNow()) / rate),
		)
	}
	return {
		after(ms, fn) {
			const timer: Timer = { at: filmNow() + ms, fn }
			timers.add(timer)
			arm(timer)
			return () => {
				clearTimeout(timer.handle)
				timers.delete(timer)
			}
		},
		setRate(next) {
			if (next === rate || next <= 0) return
			filmBase = filmNow()
			realBase = now()
			rate = next
			for (const timer of timers) arm(timer)
		},
		get rate() {
			return rate
		},
	}
}
