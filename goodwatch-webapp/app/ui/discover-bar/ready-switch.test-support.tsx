import assert from "node:assert/strict"
import { mock } from "node:test"
import {
	type HTMLButtonElement as BrowserButton,
	type HTMLElement as BrowserElement,
	Window,
} from "happy-dom"
const browser = new Window({ url: "https://goodwatch.app/" })
const { act, useState } = await import("react")
const { createRoot } = await import("react-dom/client")
const { renderToString } = await import("react-dom/server")
const { ReadySwitch } = await import("./OrderControls")

// The SSR relationship is the CSS contract: the named peer is the described tooltip's previous sibling.
for (const member of [false, true])
	for (const field of [false, true])
		for (const on of [false, true]) {
			const sample = browser.document.createElement("div")
			sample.innerHTML = renderToString(
				<ReadySwitch
					on={on}
					member={member}
					field={field}
					onChange={() => {}}
				/>,
			)
			const button = sample.querySelector<BrowserButton>(
				'button[role="switch"]',
			)
			const tip = sample.querySelector<BrowserElement>('[role="tooltip"]')
			assert.ok(button && tip)
			assert.equal(button.type, "button")
			assert.equal(button.getAttribute("aria-checked"), String(on))
			assert.equal(button.getAttribute("aria-label"), "Ready to watch")
			assert.equal(button.getAttribute("aria-describedby"), tip.id)
			assert.equal(tip.previousElementSibling, button)
			assert.ok(
				button.classList.contains("peer/ready"),
				"the actual switch is the focus peer",
			)
			assert.ok(
				button.parentElement?.classList.contains("group"),
				"mouse hover still uses the wrapper",
			)
			for (const token of [
				"peer-focus-visible/ready:opacity-100",
				"peer-focus-visible/ready:translate-y-0",
				"group-hover:opacity-100",
				"group-hover:translate-y-0",
			])
				assert.ok(tip.classList.contains(token), token)
			assert.ok(!tip.className.includes("group-has-"))
			assert.ok(
				tip.textContent?.includes(
					member ? "Not seen yet" : "Not seen yet, with an account",
				),
			)
		}

for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"SVGElement",
	"Node",
	"requestAnimationFrame",
	"cancelAnimationFrame",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		value: browser[key as keyof Window],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
// Verify the actual installed Tailwind output uses a focus-visible sibling peer, with no relational :has rule.
const { compile, optimize } = await import("@tailwindcss/node")
const css = await compile('@import "tailwindcss";', {
	base: process.cwd(),
	onDependency() {},
})
const generated = optimize(
	css.build([
		"peer-focus-visible/ready:opacity-100",
		"peer-focus-visible/ready:translate-y-0",
	]),
)
assert.ok(generated.includes(".peer\\/ready):focus-visible ~ *"))
assert.ok(!generated.includes(":has("))
// Happy DOM cannot match a complex sibling selector nested inside :is(). Check its equivalent direct peer selector;
// the generated-selector assertion and SSR sibling contract above cover how Tailwind connects it to the real markup.
const focusedPeer = (tip: Element) =>
	tip.matches('.peer\\/ready:focus-visible ~ [role="tooltip"]')
function Page() {
	const [on, setOn] = useState(false)
	return (
		<>
			<button type="button" id="before">
				Before
			</button>
			<ReadySwitch on={on} onChange={setOn} member />
			<ReadySwitch on={false} onChange={() => {}} member={false} />
		</>
	)
}
const host = document.createElement("div")
document.body.append(host)
const root = createRoot(host)
const buttons = () =>
	Array.from(host.querySelectorAll<HTMLButtonElement>('button[role="switch"]'))
const tips = () =>
	Array.from(host.querySelectorAll<HTMLElement>('[role="tooltip"]'))
try {
	await act(async () => root.render(<Page />))
	assert.equal(focusedPeer(tips()[0]), false)
	await act(async () => buttons()[0].focus())
	assert.equal(document.activeElement, buttons()[0])
	assert.equal(
		focusedPeer(tips()[0]),
		true,
		"keyboard-visible focus reaches its own tooltip",
	)
	assert.equal(
		focusedPeer(tips()[1]),
		false,
		"a focused switch does not reach the next control's tooltip",
	)
	await act(async () => buttons()[0].click())
	assert.equal(
		buttons()[0].getAttribute("aria-checked"),
		"true",
		"native button activation toggles the switch",
	)
	assert.equal(
		document.activeElement,
		buttons()[0],
		"activation retains keyboard focus",
	)
	await act(async () =>
		host.querySelector<HTMLButtonElement>("#before")?.focus(),
	)
	assert.equal(
		focusedPeer(tips()[0]),
		false,
		"leaving the switch removes the focus-visible tooltip trigger",
	)
	mock.timers.enable({ apis: ["setTimeout"] })
	await act(async () => {
		buttons()[0].dispatchEvent(
			new browser.PointerEvent("pointerdown", {
				pointerType: "touch",
				bubbles: true,
			}) as unknown as Event,
		)
		buttons()[0].click()
	})
	assert.ok(
		tips()[0].classList.contains("opacity-100"),
		"touch still peeks without hover or focus",
	)
	await act(async () => mock.timers.tick(2800))
	assert.ok(tips()[0].classList.contains("opacity-0"), "touch peek expires")
	await act(async () => root.unmount())
	console.log("__READY_SWITCH_PASSED__")
} finally {
	mock.timers.reset()
	await browser.happyDOM.close()
}
