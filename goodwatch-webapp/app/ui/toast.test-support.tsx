import assert from "node:assert/strict"
import { Window } from "happy-dom"

const browser = new Window({ url: "https://goodwatch.app/" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Event",
	"Node",
	"MutationObserver",
])
	Object.defineProperty(globalThis, key, {
		value: (browser as unknown as Record<string, unknown>)[key],
		configurable: true,
	})
globalThis.requestAnimationFrame = (cb) =>
	setTimeout(() => cb(performance.now()), 0) as unknown as number
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

const { toast } = await import("./toast")
assert.equal(
	document.querySelector("[data-toast-host]"),
	null,
	"reading a page mounts no notification runtime",
)

Object.defineProperty(navigator, "onLine", { configurable: true, value: false })

toast.error("First failure", { autoClose: false })
toast.success("Saved", { autoClose: false })
let undo = 0
toast(
	({ closeToast }) => (
		<button
			onClick={() => {
				undo++
				closeToast?.()
			}}
		>
			Undo
		</button>
	),
	{ autoClose: false },
)

await new Promise((resolve) => setTimeout(resolve, 10))
assert.equal(
	document.querySelector("[data-toast-host]"),
	null,
	"offline notifications wait without loading or reloading",
)
Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
window.dispatchEvent(new Event("online"))

for (let i = 0; i < 200 && !document.body.textContent?.includes("Undo"); i++)
	await new Promise((resolve) => setTimeout(resolve, 10))
assert.equal(
	document.querySelectorAll("[data-toast-host]").length,
	1,
	"concurrent first notifications share one container",
)
assert.match(document.body.textContent ?? "", /First failure/)
assert.match(document.body.textContent ?? "", /Saved/)
const button = [...document.querySelectorAll("button")].find(
	(b) => b.textContent === "Undo",
)
assert.ok(button)
button.click()
assert.equal(undo, 1, "rich notification actions survive the lazy boundary")
toast.info("Another message", { autoClose: false })
for (
	let i = 0;
	i < 100 && !document.body.textContent?.includes("Another message");
	i++
)
	await new Promise((resolve) => setTimeout(resolve, 10))
assert.match(document.body.textContent ?? "", /Another message/)
assert.equal(document.querySelectorAll("[data-toast-host]").length, 1)
// The root error boundary can replace the document body and remove the runtime's separate host.
document.querySelector("[data-toast-host]")!.remove()
toast.info("After document recovery", { autoClose: false })
for (
	let i = 0;
	i < 100 && !document.body.textContent?.includes("After document recovery");
	i++
)
	await new Promise((resolve) => setTimeout(resolve, 10))
assert.match(document.body.textContent ?? "", /After document recovery/)
assert.equal(
	document.querySelectorAll("[data-toast-host]").length,
	1,
	"document recovery creates one replacement host",
)
console.log("__TOAST_LAZY_OK__")
await browser.happyDOM.close()
process.exit(0)
