// A spoiler in the open band: covered text in a button with no links inside, then, once uncovered, the text and its
// links in a wrapper that takes the focus, so keyboard and screen reader users don't fall back to the page body.
// Packages load before the alias hook, which resolves only the app's own files.
import "react"
import "react-dom/client"
import "@heroicons/react/20/solid"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import { Window } from "happy-dom"
import ts from "typescript"
import "../../../server/title-filter/test-alias.ts"

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
const app = new URL("../../../", import.meta.url).href
registerHooks({
	load(url, context, next) {
		if (!url.startsWith(app) || !url.endsWith(".tsx")) return next(url, context)
		return {
			format: "module",
			shortCircuit: true,
			source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
					jsx: ts.JsxEmit.ReactJSX,
				},
			}).outputText,
		}
	},
})

const window = new Window({ url: "https://goodwatch.app/u/x/tropes" })
for (const key of ["window", "document", "navigator", "HTMLElement", "Node"])
	Object.defineProperty(globalThis, key, {
		value: key === "window" ? window : Reflect.get(window, key),
		configurable: true,
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { DescriptionOpening } = await import("./Opening.tsx")

const WIKI = "https://tvtropes.org/pmwiki/pmwiki.php/"

test("uncovering a spoiler keeps the focus on the uncovered text, and links only appear once it is uncovered", async () => {
	const container = window.document.createElement("div")
	window.document.body.appendChild(container)
	const root = createRoot(container as unknown as Element)
	await act(async () =>
		root.render(
			h(DescriptionOpening, {
				opening: {
					blocks: [
						{
							kind: "p",
							text: "He was the father all along.",
							links: [[11, 17, "Main/LukeIAmYourFather"]],
							spoilers: [[0, 28]],
						},
					],
					more: 0,
				},
				url: `${WIKI}Main/X`,
			}),
		),
	)
	const button = container.querySelector("button")
	assert.ok(button)
	assert.equal(button.getAttribute("aria-label"), "Spoiler, tap to show")
	assert.equal(button.querySelector("a"), null, "no link inside the button")
	assert.ok(
		!button.className.includes("blur"),
		"the button, and its focus ring, stay sharp",
	)
	assert.ok(button.querySelector("[aria-hidden]")?.className.includes("blur"))
	const wrapper = button.parentElement
	assert.ok(wrapper)
	;(button as unknown as HTMLElement).focus()
	await act(async () => {
		;(button as unknown as HTMLElement).click()
	})
	assert.equal(container.querySelector("button"), null)
	assert.equal(
		window.document.activeElement,
		wrapper,
		"the wrapper takes the focus",
	)
	assert.equal(wrapper.getAttribute("tabindex"), "-1")
	assert.match(wrapper.textContent ?? "", /^Spoiler: He was the father/)
	const link = wrapper.querySelector("a")
	assert.equal(link?.getAttribute("href"), `${WIKI}Main/LukeIAmYourFather`)
	await act(async () => root.unmount())
})
