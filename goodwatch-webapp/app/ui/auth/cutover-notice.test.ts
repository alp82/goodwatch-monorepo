// The cut-over notice on the account pages and their actions (#552 step 2.2): with AUTH_MAINTENANCE=on the pages show
// the notice in the poster-spotlight card instead of their forms, the password actions refuse, and the sign-in client
// never calls Supabase. With it off, nothing changes.
// Packages load before the alias hook, which resolves only the app's own files.
import "react"
import "react-dom/server"
import "react-router-dom"
import "framer-motion"
import "@remix-run/react"
import "@remix-run/node"
import "@supabase/ssr"
import "ioredis"
import "node-crate"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, test } from "node:test"
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
const { renderToStaticMarkup } = await import("react-dom/server")
const { createMemoryRouter, RouterProvider } = await import("react-router-dom")
const { AuthContext } = await import("~/utils/auth")

const pages = {
	"sign-in": await import("../../routes/sign-in.tsx"),
	"sign-up": await import("../../routes/sign-up.tsx"),
	"forgot-password": await import("../../routes/forgot-password.tsx"),
	"reset-password": await import("../../routes/reset-password.tsx"),
	"verify-email": await import("../../routes/verify-email.tsx"),
}

// The router warns about layout effects on the server; the test renders on the server only to read the markup.
const warn = console.error
console.error = (...args: unknown[]) => {
	// The loaders ask for posters, which a test has no catalog for: the pages show without them.
	if (!/useLayoutEffect|Auth posters not loaded/.test(String(args[0]))) warn(...args)
}

// What the browser keeps while a sign-in begins (the guest's choices, the way back).
const memory = () => {
	const items = new Map<string, string>()
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key),
		clear: () => items.clear(),
		key: (index: number) => [...items.keys()][index] ?? null,
		get length() {
			return items.size
		},
	}
}
// A sign-in begins in the browser: it notes the way back, announces it and clears the old Supabase sign-in cookie.
const browser = () => {
	const events = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {}, location: { origin: "http://localhost", assign: () => {} } }
	Object.assign(globalThis, { localStorage: memory(), sessionStorage: memory(), window: events, document: { cookie: "" } })
}

afterEach(() => {
	delete process.env.AUTH_MAINTENANCE
	delete process.env.BETTER_AUTH_ENABLED
	delete process.env.SUPABASE_URL
	delete process.env.SUPABASE_ANON_KEY
})

const TITLE = "We&#x27;re moving sign-in to a new home"
const render = (page: keyof typeof pages, url: string, data: Record<string, unknown>, context: Record<string, unknown> = {}) => {
	const router = createMemoryRouter([{ path: `/${page}`, Component: pages[page].default, loader: () => data }], {
		initialEntries: [url],
		hydrationData: { loaderData: { "0": data } },
	})
	const value = { ...useAuthDefaults(), ...context }
	return renderToStaticMarkup(h(AuthContext.Provider, { value }, h(RouterProvider, { router })))
}
// Runs a hook inside the auth context, the way a component would, and hands back what it returned.
function renderHook<T>(hook: () => T, value: ReturnType<typeof useAuthDefaults>): T {
	let result: T | undefined
	const Probe = () => {
		result = hook()
		return null
	}
	renderToStaticMarkup(h(AuthContext.Provider, { value }, h(Probe)))
	return result as T
}
function useAuthDefaults() {
	return { supabase: undefined, getSupabase: () => Promise.reject(new Error("none")), user: null, loading: false, betterAuth: false, maintenance: false, refreshUser: () => {} }
}

const PAGES: [keyof typeof pages, string][] = [
	["sign-in", "/sign-in"],
	["sign-up", "/sign-up"],
	["forgot-password", "/forgot-password"],
	["reset-password", "/reset-password?token=abc"],
	["verify-email", "/verify-email?state=resend"],
	["verify-email", "/verify-email?state=sent"],
	["verify-email", "/verify-email?state=expired"],
]

test("with the flag on, every account page shows the notice in the poster card instead of its form", () => {
	for (const [page, url] of PAGES) {
		const html = render(page, url, { maintenance: true, posters: [], redirectUri: "", connecting: null })
		assert.match(html, /Somewhere/, `${url} keeps the scene`)
		assert.ok(html.includes(TITLE), `${url} says what is happening`)
		assert.match(html, /Back in about 30 minutes/, url)
		assert.match(html, /href="\/"[^>]*>Keep browsing/, `${url} offers to keep browsing`)
		assert.doesNotMatch(html, /<form|<input|type="password"|Continue with Google/, `${url} has no form`)
	}
})

test("with the flag off, every account page shows its form and no notice", () => {
	for (const [page, url] of PAGES) {
		for (const data of [{ maintenance: false }, {}]) {
			const html = render(page, url, { ...data, posters: [], redirectUri: "", connecting: null })
			assert.ok(!html.includes(TITLE), `${url} has no notice`)
			assert.match(html, /<form|Resend link/, `${url} has its form`)
		}
	}
})

test("a page cached before the flag flipped still tells the member when a press runs into it", async () => {
	const { ServiceNotice } = await import("./kit.tsx")
	const html = renderToStaticMarkup(h(ServiceNotice, { failure: "maintenance" }))
	assert.ok(html.includes(TITLE))
})

test("the actions of the password pages refuse with the notice and never build a Supabase client", async () => {
	process.env.AUTH_MAINTENANCE = "on"
	// No Supabase settings at all: reaching the client would throw.
	const post = (path: string, body: Record<string, string>) =>
		new Request(`http://localhost${path}`, { method: "POST", body: new URLSearchParams(body) })
	for (const [page, body] of [
		["forgot-password", { email: "someone@example.com" }],
		["reset-password", { code: "abc", password: "a-long-enough-password" }],
	] as const) {
		const response = (await pages[page].action({ request: post(`/${page}`, body), params: {}, context: {} } as never)) as Response
		assert.equal(response.status, 503, page)
		assert.equal(response.headers.get("Retry-After"), "1800", page)
		assert.equal(response.headers.get("Cache-Control"), "private, no-store", page)
		assert.deepEqual(await response.json(), {
			code: "AUTH_MAINTENANCE",
			message: "We're moving sign-in to a new home. Back in about 30 minutes.",
		})
	}
})

test("with the flag off, the actions of the password pages work as before", async () => {
	process.env.SUPABASE_URL = "http://127.0.0.1:1"
	process.env.SUPABASE_ANON_KEY = "anon"
	const post = (path: string, body: Record<string, string>) =>
		new Request(`http://localhost${path}`, { method: "POST", body: new URLSearchParams(body) })
	const forgot = (await pages["forgot-password"].action({ request: post("/forgot-password", {}), params: {}, context: {} } as never)) as Response
	assert.equal(forgot.status, 400)
	assert.deepEqual(await forgot.json(), { error: "Please enter your email address" })
	const reset = (await pages["reset-password"].action({ request: post("/reset-password", {}), params: {}, context: {} } as never)) as Response
	assert.equal(reset.status, 400)
	assert.equal(((await reset.json()) as { code: string }).code, "missing")
})

test("the form posts of sign-in, sign-up and confirmation go back to the page, which shows the notice or the form", async () => {
	for (const value of [undefined, "on"]) {
		if (value) process.env.AUTH_MAINTENANCE = value
		else delete process.env.AUTH_MAINTENANCE
		for (const page of ["sign-in", "sign-up", "verify-email"] as const) {
			const request = new Request(`http://localhost/${page}?state=sent`, { method: "POST", body: new URLSearchParams({ email: "a@b.c", password: "x" }) })
			const response = (await pages[page].action({ request, params: {}, context: {} } as never)) as Response
			assert.equal(response.status, 303, `${page} ${value}`)
			assert.equal(response.headers.get("Location"), `/${page}?state=sent`)
		}
	}
})

test("the loaders of the account pages carry the flag, and a page with the notice is never shared by a cache", async () => {
	const ask = async (page: keyof typeof pages, url: string) => {
		const loader = (pages[page] as { loader: (args: unknown) => Promise<Response> }).loader
		return loader({ request: new Request(`http://localhost${url}`), params: {}, context: {} })
	}
	for (const [page, url] of [
		["sign-in", "/sign-in"],
		["sign-up", "/sign-up"],
		["forgot-password", "/forgot-password"],
		["reset-password", "/reset-password"],
		["verify-email", "/verify-email"],
	] as const) {
		process.env.AUTH_MAINTENANCE = "on"
		const on = await ask(page, url)
		assert.equal(((await on.json()) as { maintenance: boolean }).maintenance, true, page)
		assert.equal(on.headers.get("Cache-Control"), "private, no-store", page)
		delete process.env.AUTH_MAINTENANCE
		const off = await ask(page, url)
		assert.equal(((await off.json()) as { maintenance: boolean }).maintenance, false, page)
		assert.notEqual(off.headers.get("Cache-Control"), "private, no-store", page)
	}
})

// The sign-in client: with the notice on, no method that signs in, signs up or changes a password reaches Supabase
// or Better Auth. Sign-out and the read of the sign-in methods still work.
test("the sign-in client refuses every credential call with the notice on, and still signs out", async () => {
	const { useAuthClient } = await import("~/utils/auth-client")
	browser()
	const calls: string[] = []
	const supabase = new Proxy({}, { get: (_t, namespace) => new Proxy({}, { get: (_u, method) => async () => (calls.push(`${String(namespace)}.${String(method)}`), { data: { user: null }, error: null }) }) })
	const fetched: string[] = []
	const realFetch = globalThis.fetch
	globalThis.fetch = (async (input: string | URL | Request) => {
		fetched.push(String(input))
		return new Response(JSON.stringify({ maintenance: true }), { status: 200 })
	}) as typeof fetch
	try {
		for (const betterAuth of [false, true]) {
			calls.length = 0
			fetched.length = 0
			const auth = renderHook(useAuthClient, {
				supabase: supabase as never,
				getSupabase: async () => supabase as never,
				user: null,
				loading: false,
				betterAuth,
				maintenance: true,
				refreshUser: () => {},
			})
			const refused = { ok: false, failure: "maintenance" }
			assert.deepEqual(await auth.signIn({ email: "a@b.c", password: "x", remember: true, returnTo: "/" }), refused)
			assert.deepEqual(await auth.signUp({ email: "a@b.c", password: "x", returnTo: "/" }), refused)
			assert.deepEqual(await auth.google("/"), refused)
			assert.deepEqual(await auth.signInToConnect({ email: "a@b.c", password: "x", remember: true, oauthQuery: "q" }), refused)
			assert.deepEqual(await auth.resendConfirmation("a@b.c", "/"), refused)
			assert.deepEqual(await auth.requestPasswordReset("a@b.c"), refused)
			assert.deepEqual(await auth.resetPassword("t", "a-long-enough-password"), refused)
			assert.deepEqual(await auth.changePassword("old", "a-long-enough-password"), refused)
			assert.equal(calls.length, 0, `betterAuth ${betterAuth}: nothing reached Supabase`)
			assert.ok(fetched.every((url): boolean => url === "/api/auth-maintenance"), `betterAuth ${betterAuth}: only the flag was asked, got ${fetched}`)
			await auth.signOut()
			assert.ok(betterAuth ? fetched.includes("/api/auth/sign-out") : calls.includes("auth.signOut"), `betterAuth ${betterAuth}: sign-out still goes out`)
		}
	} finally {
		globalThis.fetch = realFetch
	}
})

test("a page that was cached before the flag flipped asks the server before a Supabase call", async () => {
	const { useAuthClient } = await import("~/utils/auth-client")
	browser()
	const calls: string[] = []
	const supabase = { auth: { signInWithPassword: async () => (calls.push("signIn"), { error: null }) } }
	const context = { supabase: supabase as never, getSupabase: async () => supabase as never, user: null, loading: false, betterAuth: false, maintenance: false, refreshUser: () => {} }
	const realFetch = globalThis.fetch
	try {
		globalThis.fetch = (async () => new Response(JSON.stringify({ maintenance: true }), { status: 200 })) as typeof fetch
		const closed = await renderHook(useAuthClient, context).signIn({ email: "a@b.c", password: "x", remember: true, returnTo: "/" })
		assert.deepEqual(closed, { ok: false, failure: "maintenance" })
		assert.deepEqual(calls, [])
		// Off on the server, or the server not answering: the sign-in goes on as before.
		for (const answer of [() => new Response(JSON.stringify({ maintenance: false }), { status: 200 }), () => Promise.reject(new Error("offline"))]) {
			globalThis.fetch = (async () => answer()) as typeof fetch
			const open = await renderHook(useAuthClient, context).signIn({ email: "a@b.c", password: "x", remember: true, returnTo: "/" })
			assert.deepEqual(open, { ok: true })
		}
		assert.deepEqual(calls, ["signIn", "signIn"])
	} finally {
		globalThis.fetch = realFetch
	}
})

test("a page left open from before the notice went off asks the server, and goes on when it says off", async () => {
	browser()
	const { useAuthClient } = await import("~/utils/auth-client")
	const calls: string[] = []
	const supabase = { auth: { signInWithPassword: async () => (calls.push("signIn"), { error: null }) } }
	const context = { supabase: supabase as never, getSupabase: async () => supabase as never, user: null, loading: false, betterAuth: false, maintenance: true, refreshUser: () => {} }
	const signIn = () => renderHook(useAuthClient, context).signIn({ email: "a@b.c", password: "x", remember: true, returnTo: "/" })
	const realFetch = globalThis.fetch
	try {
		globalThis.fetch = (async () => new Response(JSON.stringify({ maintenance: false }), { status: 200 })) as typeof fetch
		assert.deepEqual(await signIn(), { ok: true })
		assert.deepEqual(calls, ["signIn"])
		// The server doesn't answer: the page's own flag stands.
		globalThis.fetch = (async () => Promise.reject(new Error("offline"))) as typeof fetch
		assert.deepEqual(await signIn(), { ok: false, failure: "maintenance" })
		assert.deepEqual(calls, ["signIn"])
	} finally {
		globalThis.fetch = realFetch
	}
})

test("a member who is signed in leaves the sign-in and sign-up pages even while the notice is on", () => {
	for (const page of ["sign-in", "sign-up"]) {
		const source = readFileSync(new URL(`../../routes/${page}.tsx`, import.meta.url), "utf8")
		assert.match(source, /function SignedInMovesOn[\s\S]*?useEffect\([\s\S]*?navigate\(discoveryReturnTo\(redirectUri\)\)[\s\S]*?<MaintenanceCard \/>/, page)
	}
})

test("with the notice on, the browser's Supabase client doesn't read a code or tokens from the address", async () => {
	const source = readFileSync(new URL("../../utils/supabase-browser.ts", import.meta.url), "utf8")
	assert.match(source, /maintenance \? \{ auth: \{ detectSessionInUrl: false \} \}/)
	assert.match(readFileSync(new URL("./AuthProvider.tsx", import.meta.url), "utf8"), /loadSupabaseClient\(supabaseUrl, supabaseAnonKey, maintenance\)/)
})

test("Better Auth's refusal reads as the notice", async () => {
	browser()
	const { useAuthClient } = await import("~/utils/auth-client")
	const realFetch = globalThis.fetch
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ code: "AUTH_MAINTENANCE", message: "x" }), { status: 503 })) as typeof fetch
	try {
		const auth = renderHook(useAuthClient, { supabase: undefined, getSupabase: () => Promise.reject(new Error("off")), user: null, loading: false, betterAuth: true, maintenance: false, refreshUser: () => {} })
		assert.deepEqual(await auth.signUp({ email: "a@b.c", password: "a-long-enough-password", returnTo: "/" }), { ok: false, failure: "maintenance" })
	} finally {
		globalThis.fetch = realFetch
	}
})

test("settings: the change-password section shows the notice and no fields with the flag on", async () => {
	const { ChangePasswordSection } = await import("../settings/ChangePasswordSection.tsx")
	for (const [maintenance, betterAuth] of [
		[true, false],
		[true, true],
	] as const) {
		const html = renderToStaticMarkup(h(AuthContext.Provider, { value: { ...useAuthDefaults(), maintenance, betterAuth } }, h(ChangePasswordSection)))
		assert.ok(html.includes(TITLE), `maintenance ${maintenance}`)
		assert.doesNotMatch(html, /<input|Change Password/)
	}
	const open = renderToStaticMarkup(h(AuthContext.Provider, { value: useAuthDefaults() }, h(ChangePasswordSection)))
	assert.match(open, /Change password/)
	assert.match(open, /<input/)
	assert.ok(!open.includes(TITLE))
})
