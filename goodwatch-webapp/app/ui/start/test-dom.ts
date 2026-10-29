// For the start page's component tests under `node --test`: a happy-dom window on globalThis, React's act mode, the
// app's `~/` alias, and `.tsx` files transpiled on load (as auth-card.test.ts does). Import it first, then load the
// modules under test with `await import(...)`.
import "react"
import "react-dom/client"
import "framer-motion"
import "@tanstack/react-query"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { Window } from "happy-dom"
import ts from "typescript"
import "../../server/title-filter/test-alias.ts"

const browser = new Window({ url: "https://goodwatch.app/" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"localStorage",
]) {
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (browser as unknown as Record<string, unknown>)[key],
	})
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
const app = new URL("../../", import.meta.url).href
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

/** Frames run by hand: requestAnimationFrame queues, `runFrame` runs what was queued before it. */
export function manualFrames() {
	let frames = new Map<number, FrameRequestCallback>()
	let next = 1
	Object.assign(globalThis, {
		requestAnimationFrame: (cb: FrameRequestCallback) => {
			frames.set(next, cb)
			return next++
		},
		cancelAnimationFrame: (id: number) => frames.delete(id),
	})
	return {
		pending: () => frames.size,
		runFrame: () => {
			const due = frames
			frames = new Map()
			for (const cb of due.values()) cb(0)
		},
	}
}
