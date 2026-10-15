// The settings page's pair, run for real in happy-dom: SettingsPair inside MediaPreferenceProvider, with the provider's
// own save effect, the real save adapter and the real undo toast. A pick saves at once, the toast's Undo saves the pair
// from before through the same call, a save without an answer in 10 s is given up as not confirmed, and a conflict
// says so. Only the network, the router's revalidation, the signed-in user and the countries list are stand-ins.
import "react"
import "react-dom/client"
import "@tanstack/react-query"
import "@heroicons/react/24/solid"
import "framer-motion"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { beforeEach, test } from "node:test"
import { Window } from "happy-dom"
import ts from "typescript"
import "../../server/title-filter/test-alias.ts"

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/node_modules/@remix-run/react/dist/index.js"))
			source =
				"export const useRevalidator=()=>({state:'idle',revalidate:()=>{globalThis.__revalidations+=1}})"
		else if (url.endsWith("/app/utils/auth.ts"))
			source = "export const useUser=()=>({user:null,loading:false})"
		else if (url.endsWith("/app/routes/api.countries.tsx"))
			source = `export const useCountries=()=>({data:[{code:"DE",name:"Germany"},{code:"JP",name:"Japan"}],isPending:false,isError:false})`
		else if (url.includes("/goodwatch-webapp/app/") && url.endsWith(".tsx"))
			// Classic JSX: Node finds no named `Fragment` export in React's CommonJS jsx-runtime.
			source = `import * as React from "react";${readFileSync(new URL(url), "utf8")}`
		if (source === undefined) return next(url, context)
		return {
			format: "module",
			shortCircuit: true,
			source: fromCommonJs(
				ts.transpileModule(source, {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
						jsx: ts.JsxEmit.React,
					},
				}).outputText,
			),
		}
	},
})

/** Node can't always find the named exports of React's CommonJS builds: take them from the default export instead. */
function fromCommonJs(code: string) {
	let n = 0
	return code.replace(
		/import\s*\{([^}]*)\}\s*from\s*"(react|react-dom)";/g,
		(_, names: string, from: string) => {
			n += 1
			const fields = names.replace(/\s+as\s+/g, ": ")
			return `import __cjs${n} from "${from}";const {${fields}} = __cjs${n};`
		},
	)
}

// A browser for React to render into. The network stays Node's: each test answers it itself.
const window = new Window({ url: "https://goodwatch.app/settings" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLButtonElement",
	"Node",
	"Event",
	"MouseEvent",
	"requestAnimationFrame",
	"cancelAnimationFrame",
	"getComputedStyle",
	"matchMedia",
	"sessionStorage",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
	__revalidations: 0,
})

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider, notifyManager } = await import(
	"@tanstack/react-query"
)
const { MediaPreferenceProvider } = await import("./MediaPreference.tsx")
const { default: SettingsPair } = await import("./SettingsPair.tsx")
const { SAVE_TIMEOUT_MS, endpointSaver } = await import("./save-adapter.ts")

// Query updates on a microtask, not on setTimeout, which the timeout test mocks.
notifyManager.setScheduler(queueMicrotask)

type Body = { pair: { country: string; language: string }; sequence: number }
type Call = { body: Body; answer: (r: Response) => void }

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status })
/** What is saved on this device before each test: Germany, titles following the browser. */
const onRecord = {
	effectiveContext: {
		country: "DE",
		countryProvenance: "cookie",
		language: "de",
		languageProvenance: "browser",
		languageSetting: "browser",
	},
	mediaPreferences: {
		country: "DE",
		language: "browser",
		schemaVersion: 1,
		version: "v0",
	},
	destination: "device",
}
const saved = (b: Body, version: string) =>
	json({
		pair: b.pair,
		version,
		sequence: b.sequence,
		destination: "device",
		effectiveContext: {
			...onRecord.effectiveContext,
			language: b.pair.language === "browser" ? "de" : b.pair.language,
			languageProvenance:
				b.pair.language === "browser" ? "browser" : "explicit",
			languageSetting: b.pair.language,
		},
	})

/** Answers the private read at once and each save when the test says; a save aborted by its timeout fails as fetch does. */
function fakeFetch() {
	const saves: Call[] = []
	globalThis.fetch = ((path: string, init: RequestInit = {}) => {
		if (path === "/api/media-preferences")
			return Promise.resolve(json(onRecord))
		return new Promise<Response>((answer, fail) => {
			init.signal?.addEventListener("abort", () =>
				fail(new DOMException("aborted", "AbortError")),
			)
			saves.push({ body: JSON.parse(String(init.body)), answer })
		})
	}) as typeof fetch
	return saves
}

// Not setTimeout, which the timeout test mocks.
const settle = () =>
	act(async () => {
		for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r))
	})
const $ = (selector: string) => document.querySelector(selector)
const click = (element: Element | null | undefined) => {
	assert.ok(element, "the button is on the page")
	return act(async () => {
		;(element as HTMLElement).click()
	})
}
const button = (text: string) =>
	[...document.querySelectorAll("button")].find(
		(b) => b.textContent?.trim() === text,
	)
const status = () => $("[data-settings-pair] output")?.textContent ?? ""
const titlesHeading = () =>
	$("[data-settings-pair] section:nth-of-type(2) h3")?.textContent ?? ""
const listsOff = () =>
	($("[data-settings-pair] fieldset") as HTMLFieldSetElement).disabled
// The newest toast: one that has gone may still be animating out.
const toast = () => [...document.querySelectorAll("[data-toast]")].at(-1)
const toastText = () => toast()?.textContent ?? ""
const toastUndo = () =>
	[...(toast()?.querySelectorAll("button") ?? [])].find(
		(b) => b.textContent === "Undo",
	)
const revalidations = () =>
	(globalThis as unknown as { __revalidations: number }).__revalidations

/** The settings pair as the settings page mounts it, read and ready. */
async function mountSettings() {
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	await act(async () => {
		root.render(
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(MediaPreferenceProvider, {
					country: "DE",
					// One saver per page load, as the page's default one.
					saver: endpointSaver(),
					children: createElement(SettingsPair),
				}),
			),
		)
	})
	await settle()
	assert.equal(status(), "", "the private read arrived")
	assert.equal(listsOff(), false)
	return () => act(async () => root.unmount())
}

beforeEach(() => {
	document.body.innerHTML = ""
	Object.assign(globalThis, { __revalidations: 0 })
})

const FAILED =
	"Couldn't confirm the save. It may have gone through; Retry to make sure."

test("a pick saves at once, with the lists off while it saves", async () => {
	const saves = fakeFetch()
	const unmount = await mountSettings()
	await click($('[data-language="ja"]'))
	await settle()
	assert.equal(saves.length, 1, "the pick is saved without a Keep")
	assert.deepEqual(saves[0].body.pair, { country: "DE", language: "ja" })
	assert.equal(status(), "Saving on this device…")
	assert.equal(listsOff(), true)
	assert.equal($("fieldset")?.getAttribute("aria-busy"), "true")

	saves[0].answer(saved(saves[0].body, "v1"))
	await settle()
	assert.equal(status(), "")
	assert.equal(listsOff(), false)
	assert.match(titlesHeading(), /^TitlesJapanese$/)
	assert.match(toastText(), /^Saved on this device: titles in JapaneseUndo$/)
	assert.equal(revalidations(), 1, "the page reads the saved pair again")
	await unmount()
})

test("the toast's Undo saves the pair from before through the same call", async () => {
	const saves = fakeFetch()
	const unmount = await mountSettings()
	await click($('[data-language="ja"]'))
	await settle()
	saves[0].answer(saved(saves[0].body, "v1"))
	await settle()

	await click(toastUndo())
	await settle()
	assert.equal(saves.length, 2)
	assert.deepEqual(saves[1].body.pair, { country: "DE", language: "browser" })
	assert.equal(saves[1].body.sequence, 2)
	assert.equal(status(), "Saving on this device…")

	saves[1].answer(saved(saves[1].body, "v2"))
	await settle()
	assert.match(titlesHeading(), /Follow browser \(currently German\)/)
	assert.match(toastText(), /^Restored on this device: /)
	assert.equal(toastUndo(), undefined, "no Undo of the Undo")
	await unmount()
})

test("a save without an answer in 10 s shows that it couldn't be confirmed, with Retry and Cancel", async (t) => {
	const saves = fakeFetch()
	const unmount = await mountSettings()
	t.mock.timers.enable({ apis: ["setTimeout"] })
	await click($('[data-language="ja"]'))
	await settle()
	assert.equal(saves.length, 1)
	assert.equal(SAVE_TIMEOUT_MS, 10_000)
	t.mock.timers.tick(SAVE_TIMEOUT_MS - 1)
	await settle()
	assert.equal(status(), "Saving on this device…", "still waiting before 10 s")

	t.mock.timers.tick(1)
	await settle()
	assert.equal($('[role="alert"]')?.textContent, FAILED)
	assert.ok(button("Retry"))
	assert.ok(button("Cancel"))
	assert.match(titlesHeading(), /Japanese · not saved/, "the pick stays shown")
	assert.equal(listsOff(), false, "the lists are on again")
	assert.equal(toastText(), "")

	// Retry sends the same pair again; this time it is confirmed.
	await click(button("Retry"))
	await settle()
	assert.equal(saves.length, 2)
	assert.deepEqual(saves[1].body.pair, { country: "DE", language: "ja" })
	saves[1].answer(saved(saves[1].body, "v1"))
	await settle()
	assert.equal($('[role="alert"]'), null)
	assert.match(titlesHeading(), /^TitlesJapanese$/)
	await unmount()
})

test("Cancel after a failed save goes back to what is saved", async () => {
	const saves = fakeFetch()
	const unmount = await mountSettings()
	await click($('[data-language="ja"]'))
	await settle()
	saves[0].answer(json({ error: "Could not confirm save" }, 503))
	await settle()
	assert.equal($('[role="alert"]')?.textContent, FAILED)

	await click(button("Cancel"))
	await settle()
	assert.equal($('[role="alert"]'), null)
	assert.match(titlesHeading(), /Follow browser \(currently German\)/)
	assert.doesNotMatch(titlesHeading(), /not saved/)
	assert.equal(saves.length, 1, "Cancel saves nothing")
	await unmount()
})

test("a conflict says it was saved elsewhere, not that the save may have gone through", async () => {
	const saves = fakeFetch()
	const unmount = await mountSettings()
	await click($('[data-language="ja"]'))
	await settle()
	saves[0].answer(
		json(
			{
				error: "conflict",
				sequence: saves[0].body.sequence,
				current: {
					pair: { country: "DE", language: "fr" },
					version: "v9",
					sequence: 4,
				},
			},
			409,
		),
	)
	await settle()
	assert.equal(
		$('[role="alert"]')?.textContent,
		"Saved elsewhere meanwhile. Retry keeps titles in Japanese.",
	)
	await unmount()
})
