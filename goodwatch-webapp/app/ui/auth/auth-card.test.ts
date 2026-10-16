// The account pages keep the poster spotlight redesign: the scene with its headline, the card under the wordmark, and
// the card's own fields and buttons, not the older flat ones.
// Packages load before the alias hook, which resolves only the app's own files.
import "react"
import "react-dom/server"
import "framer-motion"
import "@remix-run/react"
import "@supabase/ssr"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import "../../server/title-filter/test-alias.ts"

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(url: string, context: unknown, next: (url: string, context: unknown) => unknown): unknown
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
				compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
			}).outputText,
		}
	},
})

const { createElement: h } = await import("react")
type ReactNode = import("react").ReactNode
const { renderToStaticMarkup } = await import("react-dom/server")
const { AUTH_SUBMIT_CLASS, AuthScene } = await import("./AuthScene.tsx")
const kit = await import("./kit.tsx")

const noop = () => {}
const card = (...children: ReactNode[]) => renderToStaticMarkup(h(AuthScene, { posters: [], children }))

test("the scene keeps the headline, the wordmark and the turning aurora around the forms", () => {
	const html = card(h(kit.EmailField, { value: "", onChange: noop }))
	assert.match(html, /Somewhere/)
	assert.match(html, /auth-aurora/)
	assert.match(html, /GoodWatch/)
})

test("the fields and buttons use the card's styling", () => {
	const html = card(
		h(kit.EmailField, { value: "", onChange: noop }),
		h(kit.PasswordField, { value: "", onChange: noop, error: true }),
		h(kit.GoogleButton, { onClick: noop }),
		h(kit.OrDivider, {}),
		h(kit.PrimaryButton, { children: "Sign in" }),
	)
	assert.ok(html.includes(`class="${AUTH_SUBMIT_CLASS}"`), "the main button is the card's gradient button")
	assert.match(html, /id="auth-email"[^>]*class="[^"]*bg-white\/\[0\.06\][^"]*border-white\/10/)
	assert.match(html, /id="auth-password"[^>]*class="[^"]*bg-white\/\[0\.06\][^"]*border-red-500/)
	// The older flat look: gray fields, a solid divider label that shows as a patch on the card.
	assert.doesNotMatch(html, /bg-gray-800|bg-gray-900|bg-amber-700/)
})

test("on sign-in and sign-up the wordmark heads the card and the heading is for screen readers", () => {
	const html = renderToStaticMarkup(h(kit.Heading, { srOnly: true, title: "Sign in", sub: "Welcome back" }))
	assert.match(html, /^<div class="sr-only"><h1>Sign in<\/h1>/)
	for (const page of ["sign-in", "sign-up"]) {
		const source = readFileSync(new URL(`../../routes/${page}.tsx`, import.meta.url), "utf8")
		assert.match(source, /<Heading\s+srOnly\b/, page)
	}
})

test("the button that deletes the account keeps the card's shape in red", () => {
	const html = renderToStaticMarkup(h(kit.PrimaryButton, { danger: true, children: "Delete" }))
	assert.match(html, /rounded-xl[^"]*bg-red-700/)
	assert.ok(!html.includes(AUTH_SUBMIT_CLASS))
})
