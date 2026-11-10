// Offline SSR -> pre-paint script -> hydration seam. No application server or data services.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { act } from "react"
import { renderToString } from "react-dom/server"
import { hydrateRoot, createRoot } from "react-dom/client"
import { Window } from "happy-dom"
import { OpeningBoot, OpeningCover } from "./OpeningBoot"
import { OpeningGate } from "./OpeningGate"
import {
	BOOT_GATE_ID,
	BOOT_SEEN_KEY,
	GATE_MARK,
	GATE_SCRIPT,
} from "./boot-gate"

function Page({ member = false }: { member?: boolean }) {
	return (
		<>
			{!member && <OpeningGate />}
			<div data-site-header>
				<div className="backdrop-blur-md" />
			</div>
			<main>
				<section className="start-stage">
					{!member && <OpeningBoot />}
					<div className="start-camera">
						<div className="start-night" />
					</div>
					<div className="start-content">
						<input className="start-search" />
					</div>
				</section>
				{!member && <OpeningCover />}
			</main>
		</>
	)
}

const html = renderToString(<Page />)
assert.equal(html, renderToString(<Page />), "the cache has one guest HTML")
const css = readFileSync(new URL("./opening.css", import.meta.url), "utf8")
assert.doesNotMatch(
	css.replace(/\/\*[\s\S]*?\*\//g, ""),
	/:has\(/,
	"the opening must not observe descendant interaction state",
)
const browser = new Window({ url: "https://goodwatch.app/" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLInputElement",
	"Node",
	"sessionStorage",
]) {
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (browser as unknown as Record<string, unknown>)[key],
	})
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

// React normalizes script innerHTML while hydrating; use the browser's raw-text behavior here too.
Object.defineProperty(browser.HTMLScriptElement.prototype, "innerHTML", {
	configurable: true,
	get() {
		return this.textContent
	},
	set(value: string) {
		this.textContent = value
	},
})

const recoveries: unknown[] = []
const warnings: unknown[][] = []
const originalError = console.error
console.error = (...args) => warnings.push(args)
try {
	for (const reduced of [false, true]) {
		for (const returning of [false, true]) {
			browser.happyDOM.settings.device.prefersReducedMotion = reduced
				? "reduce"
				: "no-preference"
			const style = document.createElement("style")
			style.textContent = css
			document.head.append(style)
			browser.sessionStorage.clear()
			if (returning) browser.sessionStorage.setItem(BOOT_SEEN_KEY, "1")
			const container = document.createElement("div")
			// Happy DOM's raw-text parser truncates at script bodies; restore the exact server script as a text node.
			container.innerHTML = html.replace(GATE_SCRIPT, "")
			container.querySelector("script")!.textContent = GATE_SCRIPT
			document.body.append(container)
			const gate = container.querySelector<HTMLInputElement>(
				`#${BOOT_GATE_ID}`,
			)!
			const originalAttributes = gate.outerHTML
			const script = gate.nextElementSibling!
			Object.defineProperty(browser.document, "currentScript", {
				configurable: true,
				value: script,
			})
			// This browser has no animation engine; script decisions and selectors remain real DOM operations.
			browser.eval(script.textContent!)
			assert.equal(gate.checked, returning)
			assert.equal(
				gate.outerHTML,
				originalAttributes,
				"pre-paint script changes no React attributes",
			)
			const header = container.querySelector("[data-site-header]")!
			const boot = container.querySelector(".start-opening")!
			const cover = container.querySelector(".start-opening-cover")!
			assert.equal(
				window.getComputedStyle(boot).display,
				returning ? "none" : "block",
			)
			assert.equal(
				window.getComputedStyle(cover).display,
				returning ? "none" : "block",
			)
			if (returning) assert.equal(window.getComputedStyle(header).animation, "")
			else
				assert.match(
					window.getComputedStyle(header).animation,
					reduced ? /0\.3s linear 0\.6s/ : /start-open-header-slide/,
				)
			const root = hydrateRoot(container, <Page />, {
				onRecoverableError: (error) => recoveries.push(error),
			})
			await act(async () => {})
			assert.equal(
				container.querySelector(`#${BOOT_GATE_ID}`),
				gate,
				"hydration retains server markup",
			)
			assert.equal(
				gate.checked,
				returning,
				"hydration keeps the pre-paint decision",
			)
			assert.equal(
				(gate as unknown as Record<string, unknown>)[GATE_MARK],
				returning ? "skip" : "play",
			)
			await act(() => root.render(<Page member />))
			assert.equal(container.querySelector(`#${BOOT_GATE_ID}`), null)
			assert.equal(container.querySelector(".start-opening"), null)
			assert.equal(
				window.getComputedStyle(header).animation,
				"",
				"member header has no boot animation",
			)
			await act(() => root.unmount())
			container.remove()
			style.remove()
		}
	}
	const container = document.createElement("div")
	document.body.append(container)
	browser.sessionStorage.clear()
	const root = createRoot(container)
	await act(() => root.render(<Page />))
	assert.equal(
		container.querySelector<HTMLInputElement>(`#${BOOT_GATE_ID}`)!.checked,
		true,
		"client-side navigation skips",
	)
	assert.equal(browser.sessionStorage.getItem(BOOT_SEEN_KEY), "1")
	await act(() => root.unmount())
	assert.deepEqual(recoveries, [])
	assert.deepEqual(warnings, [], "no hydration warnings")
} finally {
	console.error = originalError
	await browser.happyDOM.close()
}
console.log("__OPENING_HYDRATION_OK__")
