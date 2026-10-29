// Taps on the related map before its engine can do them (early-taps.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import { inlineRecorder, missed, recordEarlyTaps } from "./early-taps.ts"

/** An element that matches by its own attributes only, inside a section (or not). */
function element(attrs: string[], inSection: boolean) {
	const el = {
		attrs,
		inSection,
		matches: (selector: string) =>
			selector
				.split(",")
				.some((one) =>
					attrs.includes(one.trim().slice(1, -1).replace(/=.*$/, "")),
				),
		closest: (selector: string) => (el.matches(selector) ? el : null),
	}
	return el
}

function harness() {
	const listeners: ((event: Event) => void)[] = []
	const win = {
		__gwRelatedMap: undefined as { open?: unknown } | undefined,
		__gwRelatedMapTap: undefined as
			| { el: unknown; on: (event: Event) => void }
			| undefined,
		addEventListener: (_: string, run: (event: Event) => void) => {
			listeners.push(run)
		},
		removeEventListener: (_: string, run: (event: Event) => void) => {
			const at = listeners.indexOf(run)
			if (at >= 0) listeners.splice(at, 1)
		},
	}
	const section = {
		contains: (el: { inSection?: boolean }) => Boolean(el?.inSection),
	}
	const click = (target: unknown) => {
		for (const run of [...listeners]) run({ target } as unknown as Event)
	}
	return { win, section, click, listeners }
}

test("a tap before the engine is handed over once", () => {
	const { win, section, click } = harness()
	const recorder = recordEarlyTaps(win as never, () => section as never)
	const poster = element(["data-pl-step"], true)
	click(poster)
	assert.equal(recorder.take(), poster)
	assert.equal(recorder.take(), null)
})

test("the last tap counts, and taps outside the section don't", () => {
	const { win, section, click } = harness()
	const recorder = recordEarlyTaps(win as never, () => section as never)
	const chip = element(["data-pl-act"], true)
	click(chip)
	click(element(["data-pl-step"], false))
	click(element(["data-other"], true))
	assert.equal(recorder.take(), chip)
})

test("the title in the middle is remembered until the app wires the quick view", () => {
	const { win, section, click } = harness()
	const recorder = recordEarlyTaps(win as never, () => section as never)
	win.__gwRelatedMap = {}
	click(element(["data-pl-step"], true))
	assert.equal(recorder.take(), null, "the engine does a poster tap itself")
	const center = element(["data-pl-center"], true)
	click(center)
	assert.equal(recorder.take(), center)
	win.__gwRelatedMap.open = () => {}
	click(center)
	assert.equal(recorder.take(), null)
})

test("the inline script's tap is taken over and its listener removed", () => {
	const { win, section, listeners } = harness()
	const back = element(["data-pl-back"], true)
	const on = () => {}
	listeners.push(on)
	win.__gwRelatedMapTap = { el: back, on }
	const recorder = recordEarlyTaps(win as never, () => section as never)
	assert.equal(win.__gwRelatedMapTap, undefined)
	assert.ok(!listeners.includes(on))
	assert.equal(recorder.take(), back)
})

test("stop ends the recording", () => {
	const { win, section, click, listeners } = harness()
	const recorder = recordEarlyTaps(win as never, () => section as never)
	recorder.stop()
	assert.equal(listeners.length, 0)
	click(element(["data-pl-step"], true))
	assert.equal(recorder.take(), null)
})

test("missed and the inline recorder agree on what the engine can't do", () => {
	const center = element(["data-pl-center"], true)
	const poster = element(["data-pl-step"], true)
	assert.ok(missed(poster as never, undefined))
	assert.ok(!missed(poster as never, {}))
	assert.ok(missed(center as never, {}))
	assert.ok(!missed(center as never, { open: () => {} }))
	assert.match(inlineRecorder, /data-pl-center/)
	assert.doesNotMatch(inlineRecorder, /</)
})
