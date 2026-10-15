// The settings page's pair above the reducer: a pick saves at once through the real save adapter, the toast's Undo saves
// the pair from before through the same call, a save without an answer in 10 s is given up, and SettingsPair renders
// each of those states. SettingsPair reads its state from MediaPreference.tsx, which needs the browser, the router and
// the auth client; here a stand-in context runs the same events through the real machine and saver, the way
// MediaPreferenceProvider's save effect does.
import "react"
import "react-dom/server"
import "@heroicons/react/24/solid"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
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
		if (url.endsWith("/ui/media-preference/MediaPreference.tsx"))
			source = `export const useMediaPreference=()=>globalThis.__settingsPair;export const describePair=(pair,_b,parts={country:true,language:true})=>[parts.country&&pair.country,parts.language&&pair.language].filter(Boolean).join(", ")`
		else if (url.endsWith("/ui/media-preference/TitlesList.tsx"))
			// The list's buttons can't be clicked in server HTML: it hands over what a pick calls instead.
			source =
				"export const TitlesList=({onPick})=>{globalThis.__pickLanguage=onPick;return null}"
		else if (url.endsWith("/routes/api.countries.tsx"))
			source = `export const useCountries=()=>({data:[{code:"DE",name:"Germany"},{code:"JP",name:"Japan"}],isPending:false,isError:false})`
		else if (url.endsWith("/ui/media-preference/SettingsPair.tsx"))
			// Classic JSX: Node finds no named `Fragment` export in React's CommonJS jsx-runtime.
			source = `import * as React from "react";${readFileSync(new URL(url), "utf8")}`
		if (source === undefined) return next(url, context)
		return {
			format: "module",
			shortCircuit: true,
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
					jsx: ts.JsxEmit.React,
				},
			}).outputText,
		}
	},
})

const { createElement } = await import("react")
const { renderToStaticMarkup } = await import("react-dom/server")
const { default: SettingsPair } = await import("./SettingsPair.tsx")
const machine = await import("./machine.ts")
const { PreferenceConflict, SAVE_TIMEOUT_MS, endpointSaver } = await import(
	"./save-adapter.ts"
)
type PreferenceEvent = import("./machine.ts").PreferenceEvent
type PreferenceState = import("./machine.ts").PreferenceState

type Body = { pair: { country: string; language: string }; sequence: number }
type Call = { body: Body; answer: (r: Response) => void }

/** Answers each save when the test says; a save aborted by its timeout fails as fetch does. */
function fakeFetch() {
	const calls: Call[] = []
	globalThis.fetch = ((_: string, init: RequestInit) =>
		new Promise<Response>((answer, fail) => {
			init.signal?.addEventListener("abort", () =>
				fail(new DOMException("aborted", "AbortError")),
			)
			calls.push({ body: JSON.parse(String(init.body)), answer })
		})) as typeof fetch
	return calls
}
const saved = (b: Body, version: string) =>
	new Response(
		JSON.stringify({
			pair: b.pair,
			version,
			sequence: b.sequence,
			destination: "device",
			effectiveContext: {},
		}),
	)
// Not setTimeout, which the timeout test mocks.
const settle = async () => {
	for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

/** The settings pair's context, as MediaPreferenceProvider builds it, over the real machine and save adapter. */
function settingsPair(saved: { country: string; language: string }) {
	const saver = endpointSaver("/save")
	let state = machine.initialState(saved)
	let version: string | null = "v0"
	let started = 0
	const pending: Promise<void>[] = []
	const toasts: { text: string; undo?: () => void }[] = []
	const dispatch = (event: PreferenceEvent) => {
		state = machine.reduce(state, event)
		save()
		return state
	}
	// The provider's save effect: one save per request number, its answer back into the machine, an Undo on the toast.
	const save = () => {
		const request = state.status === "saving" ? state.request : null
		if (!request || started >= request.seq) return
		started = request.seq
		const { seq, pair, kind } = request
		pending.push(
			saver.save(pair, { expectedVersion: version }).then(
				(answer) => {
					const before = state
					if (
						dispatch({ type: "saveSucceeded", seq, pair: answer.pair }) ===
						before
					)
						return
					version = answer.version
					toasts.push({
						text: `${kind === "undo" ? "Restored" : "Saved"} on this device`,
						undo:
							kind === "keep"
								? () => void dispatch({ type: "undoSaved" })
								: undefined,
					})
				},
				(error) => {
					const conflict = error instanceof PreferenceConflict ? error : null
					dispatch({
						type: "saveFailed",
						seq,
						conflict: conflict
							? { current: conflict.current?.pair ?? null }
							: undefined,
					})
				},
			),
		)
	}
	const value = () => ({
		state,
		saving: state.status === "saving",
		changed: machine.changes(state),
		browserLanguage: "de",
		destination: "on this device",
		known: true,
		readFailed: false,
		warm: () => {},
		retryRead: () => {},
		pickCountry: (country: string) =>
			void dispatch({ type: "pickCountry", country }),
		pickLanguage: (language: string) =>
			void dispatch({ type: "pickLanguage", language }),
		keep: () => void dispatch({ type: "keep" }),
		discard: () => void dispatch({ type: "discard" }),
	})
	return {
		get state(): PreferenceState {
			return state
		},
		toasts,
		/** The page's HTML now. */
		render() {
			Object.assign(globalThis, { __settingsPair: value() })
			return renderToStaticMarkup(createElement(SettingsPair))
		},
		/** A pick in the titles list, as its button calls it. */
		pickLanguage(language: string) {
			this.render()
			;(
				globalThis as unknown as { __pickLanguage: (l: string) => void }
			).__pickLanguage(language)
		},
		retry: () => value().keep(),
		cancel: () => value().discard(),
		settled: () => Promise.all(pending),
	}
}

const FAILED =
	"Couldn&#x27;t confirm the save. It may have gone through; Retry to make sure."

test("a pick saves at once, with the lists off while it saves", async () => {
	const calls = fakeFetch()
	const pair = settingsPair({ country: "DE", language: "browser" })
	pair.pickLanguage("ja")
	assert.equal(pair.state.status, "saving")
	const html = pair.render()
	assert.match(html, /Saving on this device…/)
	assert.match(html, /<fieldset disabled="" aria-busy="true"/)
	await settle()
	assert.equal(calls.length, 1, "the pick is saved without a Keep")
	assert.deepEqual(calls[0].body.pair, { country: "DE", language: "ja" })
	calls[0].answer(saved(calls[0].body, "v1"))
	await pair.settled()
	assert.equal(pair.state.status, "saved")
	assert.deepEqual(pair.state.saved, { country: "DE", language: "ja" })
	const after = pair.render()
	assert.doesNotMatch(after, /Saving|Couldn/)
	assert.match(after, /<fieldset class=/, "the lists are on again")
	assert.equal(pair.toasts.length, 1)
	assert.equal(pair.toasts[0].text, "Saved on this device")
})

test("the toast's Undo saves the pair from before through the same call", async () => {
	const calls = fakeFetch()
	const pair = settingsPair({ country: "DE", language: "browser" })
	pair.pickLanguage("ja")
	await settle()
	calls[0].answer(saved(calls[0].body, "v1"))
	await pair.settled()
	const undo = pair.toasts[0].undo
	assert.ok(undo, "a kept pick's toast offers Undo")
	undo()
	assert.match(pair.render(), /Saving on this device…/)
	await settle()
	assert.equal(calls.length, 2)
	assert.deepEqual(calls[1].body.pair, { country: "DE", language: "browser" })
	assert.equal(calls[1].body.sequence, 2)
	calls[1].answer(saved(calls[1].body, "v2"))
	await pair.settled()
	assert.deepEqual(pair.state.saved, { country: "DE", language: "browser" })
	assert.equal(pair.toasts[1].text, "Restored on this device")
	assert.equal(pair.toasts[1].undo, undefined, "no Undo of the Undo")
})

test("a save without an answer in 10 s shows that it couldn't be confirmed, with Retry and Cancel", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const calls = fakeFetch()
	const pair = settingsPair({ country: "DE", language: "browser" })
	pair.pickLanguage("ja")
	await settle()
	assert.equal(calls.length, 1)
	t.mock.timers.tick(SAVE_TIMEOUT_MS - 1)
	await settle()
	assert.equal(pair.state.status, "saving", "still waiting just before 10 s")
	assert.equal(SAVE_TIMEOUT_MS, 10_000)
	t.mock.timers.tick(1)
	await pair.settled()
	assert.equal(pair.state.status, "failed")
	assert.equal(pair.state.conflict, false)
	const html = pair.render()
	assert.ok(html.includes(FAILED), html)
	assert.match(html, /role="alert"/)
	assert.match(html, /data-retry="true"[^>]*>Retry</)
	assert.match(html, /data-cancel="true"[^>]*>Cancel</)
	assert.match(
		html,
		/Japanese · not saved/,
		"the pick stays shown, as not saved",
	)
	assert.doesNotMatch(html, /<fieldset disabled/, "the lists are on again")
	assert.equal(pair.toasts.length, 0)

	// Retry sends the same pair again; this time it is confirmed.
	pair.retry()
	await settle()
	assert.equal(calls.length, 2)
	assert.deepEqual(calls[1].body.pair, { country: "DE", language: "ja" })
	calls[1].answer(saved(calls[1].body, "v1"))
	await pair.settled()
	assert.equal(pair.state.status, "saved")
	assert.ok(!pair.render().includes(FAILED))
})

test("Cancel after a failed save goes back to what is saved", async () => {
	const calls = fakeFetch()
	const pair = settingsPair({ country: "DE", language: "browser" })
	pair.pickLanguage("ja")
	await settle()
	calls[0].answer(new Response(JSON.stringify({ error: "x" }), { status: 503 }))
	await pair.settled()
	assert.ok(pair.render().includes(FAILED))
	pair.cancel()
	assert.equal(pair.state.status, "idle")
	const html = pair.render()
	assert.ok(!html.includes(FAILED))
	assert.doesNotMatch(html, /not saved/)
	assert.match(html, /Follow browser \(currently German\)/)
	assert.equal(calls.length, 1, "Cancel saves nothing")
})

test("a conflict says it was saved elsewhere, not that the save may have gone through", async () => {
	const calls = fakeFetch()
	const pair = settingsPair({ country: "DE", language: "browser" })
	pair.pickLanguage("ja")
	await settle()
	calls[0].answer(
		new Response(
			JSON.stringify({
				error: "conflict",
				sequence: calls[0].body.sequence,
				current: {
					pair: { country: "DE", language: "fr" },
					version: "v9",
					sequence: 4,
				},
			}),
			{ status: 409 },
		),
	)
	await pair.settled()
	assert.equal(pair.state.conflict, true)
	const html = pair.render()
	assert.match(html, /Saved elsewhere meanwhile\. Retry keeps/)
	assert.ok(!html.includes(FAILED))
})
