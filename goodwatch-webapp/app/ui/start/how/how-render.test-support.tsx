// Run by how-render.test.ts through vite-node: How it works in the server's HTML, and Try it's hand-off on a stage
// in happy-dom.
import assert from "node:assert/strict"
import { Window } from "happy-dom"
import { renderToString } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { HowItWorksCorner } from "./HowItWorksCorner"
import { bringToSearch } from "./hand-off"

const html = renderToString(
	<MemoryRouter>
		<HowItWorksCorner />
	</MemoryRouter>,
)

// Try it on a stage whose card is still hidden, then on one where the guest has asked.
const browser = new Window({
	url: "https://goodwatch.app/",
	width: 390,
	height: 844,
})
const doc = browser.document as unknown as Document
const scrolled: unknown[] = []
browser.scrollTo = ((options: unknown) => {
	scrolled.push(options)
}) as typeof browser.scrollTo
doc.body.innerHTML = `
	<section class="start-stage" data-centered>
		<div class="start-search"><input id="field" /></div>
		<div id="start-card" class="start-card" data-hidden inert><button id="first">Surprise me</button></div>
	</section>`
bringToSearch(doc)
assert.equal(doc.activeElement?.id, "field")
assert.deepEqual(scrolled.at(-1), { top: 0, behavior: "smooth" })
const card = doc.getElementById("start-card")
assert.ok(card)
card.removeAttribute("data-hidden")
card.removeAttribute("inert")
bringToSearch(doc)
assert.equal(doc.activeElement?.id, "first")
await new Promise((resolve) => setTimeout(resolve, 500))
assert.ok(card.hasAttribute("data-pulse"), "the card's ring pulses")
await new Promise((resolve) => setTimeout(resolve, 1600))
assert.ok(!card.hasAttribute("data-pulse"), "and stops")
await browser.happyDOM.close()

console.log(`__HOW_RENDER__${JSON.stringify({ html })}`)
