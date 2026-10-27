import assert from "node:assert/strict"
import React, { act } from "react"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { MemoryRouter, useLocation } from "react-router-dom"
import { Window } from "happy-dom"
import { PersonFilterButton } from "./filter-button"
function Example() {
	const at = useLocation()
	return (
		<>
			<PersonFilterButton to="?minScore=70#titles" preventScrollReset>
				70+
			</PersonFilterButton>
			<output>{at.pathname + at.search + at.hash}</output>
		</>
	)
}
const tree = (
	<MemoryRouter initialEntries={["/person/287-brad-pitt"]}>
		<Example />
	</MemoryRouter>
)
const html = renderToString(tree)
assert.match(html, /<button[^>]*disabled/)
assert.doesNotMatch(html, /href=/)
const dom = new Window({ url: "http://localhost/person/287-brad-pitt" })
dom.document.write('<div id="root">' + html + "</div>")
Object.assign(globalThis, {
	window: dom,
	document: dom.document,
	IS_REACT_ACT_ENVIRONMENT: true,
})
const container = document.querySelector("#root")!
let root: ReturnType<typeof hydrateRoot>
await act(async () => {
	root = hydrateRoot(container, tree)
})
const button = container.querySelector("button")!
assert.equal(button.disabled, false)
assert.equal(button.type, "button")
assert.equal(container.querySelector("a"), null)
await act(async () => button.click())
assert.equal(
	container.querySelector("output")!.textContent,
	"/person/287-brad-pitt?minScore=70#titles",
)
await act(async () => root!.unmount())
await dom.happyDOM.close()
