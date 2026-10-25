// contact.ts: the /support contact form's checks, the request it sends, and how refusals read.
import "../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { webcrypto } from "node:crypto"
import { test } from "node:test"

const {
	buildContactRequest,
	contactFailure,
	contactProblems,
	holdBeforeSend,
	newIdempotencyKey,
	MESSAGE_MAX,
} = await import("./contact.ts")
const { feedbackSchema } = await import("../../server/feedback/schema.ts")

const KEY = "0b8a3c1e-5d2f-4a6b-9c7d-1e2f3a4b5c6d"
const draft = {
	topic: "account" as const,
	message: "  I can't change my email.  ",
	email: " sam@example.com ",
	title: "",
}

test("a contact request carries the topic, the trimmed text, and the honeypot left empty", () => {
	const request = buildContactRequest(draft, {
		idempotencyKey: KEY,
		startedAt: 1_000,
	})
	assert.deepEqual(request, {
		kind: "contact",
		message: "Topic: My account\n\nI can't change my email.",
		email: "sam@example.com",
		idempotencyKey: KEY,
		website: "",
		startedAt: 1_000,
	})
	// The endpoint's own schema accepts it.
	assert.equal(feedbackSchema.safeParse(request).success, true)
})

test("a data question names the title; other topics drop a stale title", () => {
	const data = buildContactRequest(
		{
			...draft,
			topic: "data",
			title: " https://goodwatch.app/movie/603-the-matrix ",
		},
		{ idempotencyKey: KEY, startedAt: 1 },
	)
	assert.equal(
		data.message,
		"Topic: A title's data\nTitle: https://goodwatch.app/movie/603-the-matrix\n\nI can't change my email.",
	)
	// Data questions go as contact messages: kind data needs ids the form doesn't have.
	assert.equal(data.kind, "contact")
	assert.equal(feedbackSchema.safeParse(data).success, true)

	const bug = buildContactRequest(
		{ ...draft, topic: "bug", title: "The Matrix" },
		{ idempotencyKey: KEY, startedAt: 1 },
	)
	assert.equal(
		bug.message,
		"Topic: Something's broken\n\nI can't change my email.",
	)
})

test("metadata passes through only when given", () => {
	const metadata = { url: "/support", locale: "en-US" }
	const request = buildContactRequest(draft, {
		idempotencyKey: KEY,
		startedAt: 1,
		metadata,
	})
	assert.deepEqual(request.metadata, metadata)
	assert.equal(feedbackSchema.safeParse(request).success, true)
})

test("an empty message or a bad email stops the send", () => {
	assert.deepEqual(contactProblems(draft), [])
	assert.deepEqual(contactProblems({ ...draft, message: "   " }), ["message"])
	assert.deepEqual(
		contactProblems({ ...draft, message: "x".repeat(MESSAGE_MAX + 1) }),
		["message"],
	)
	assert.deepEqual(contactProblems({ ...draft, email: "sam@" }), ["email"])
	assert.deepEqual(contactProblems({ ...draft, message: "", email: "" }), [
		"message",
		"email",
	])
})

test("a send right after the form opened waits for the endpoint's minimum", () => {
	assert.equal(holdBeforeSend(10_000, 10_500), 1_500)
	assert.equal(holdBeforeSend(10_000, 12_000), 0)
	assert.equal(holdBeforeSend(10_000, 99_000), 0)
})

test("refusals read as busy, rejected, or worth a retry", () => {
	assert.equal(contactFailure(429), "busy")
	assert.equal(contactFailure(400), "rejected")
	assert.equal(contactFailure(413), "rejected")
	assert.equal(contactFailure(503), "retry")
	assert.equal(contactFailure(500), "retry")
	assert.equal(contactFailure(0), "retry")
})

test("idempotency keys are v4 UUIDs with or without randomUUID", () => {
	const uuid =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
	assert.match(newIdempotencyKey(webcrypto), uuid)
	const fallback = newIdempotencyKey({
		getRandomValues: (array: Uint8Array) => webcrypto.getRandomValues(array),
	})
	assert.match(fallback, uuid)
	assert.equal(
		feedbackSchema.safeParse(
			buildContactRequest(draft, { idempotencyKey: fallback, startedAt: 1 }),
		).success,
		true,
	)
})

test("maximum data draft fits the endpoint and email checks match its schema", () => {
	const large = {
		...draft,
		topic: "data" as const,
		title: "t".repeat(500),
		message: "m".repeat(MESSAGE_MAX),
	}
	assert.equal(
		feedbackSchema.safeParse(
			buildContactRequest(large, { idempotencyKey: KEY, startedAt: 1 }),
		).success,
		true,
	)
	for (const email of [
		"",
		"a..b@example.com",
		".sam@example.com",
		"sam@example.c",
		"sam+help@example.com",
		"x".repeat(255) + "@example.com",
	]) {
		const value = { ...draft, email }
		assert.equal(
			contactProblems(value).includes("email"),
			!feedbackSchema.safeParse(
				buildContactRequest(value, { idempotencyKey: KEY, startedAt: 1 }),
			).success,
		)
	}
	assert.equal(
		buildContactRequest(draft, {
			idempotencyKey: KEY,
			startedAt: 1,
			website: "bot",
		}).website,
		"bot",
	)
})

// Render the actual component, following the existing happy-dom/node:test convention.
const React = (await import("react")).default
await import("@heroicons/react/24/outline")
const { Window } = await import("happy-dom")
const { readFileSync } = await import("node:fs")
const ts = (await import("typescript")).default
const nodeModule = await import("node:module")
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
		let source: string
		if (url.endsWith("/app/utils/auth.ts"))
			source =
				"export const useUser=()=>({user:globalThis.__contactUser,loading:false})"
		else if (url.endsWith(".tsx") && url.includes("/app/"))
			source = `import * as React from "react";${readFileSync(new URL(url), "utf8")}`
		else return next(url, context)
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
const browser = new Window({ url: "https://goodwatch.app/support" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"Event",
	"MouseEvent",
]) {
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (browser as unknown as Record<string, unknown>)[key],
	})
}
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
	__contactUser: null,
})
const { createRoot } = await import("react-dom/client")
const { ContactSection } = await import("./ContactSection.tsx")

test("form preserves failed drafts, retries unchanged keys, and focuses success", async () => {
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	const originalFetch = globalThis.fetch
	const originalNow = Date.now
	let now = 10000
	Date.now = () => now
	const requests: Array<Record<string, unknown>> = []
	let status = 400
	globalThis.fetch = async (_url, options) => {
		requests.push(JSON.parse(String(options?.body)))
		assert.equal(container.querySelector("fieldset")?.disabled, true)
		if (status === 0) throw new TypeError("offline")
		return new Response(JSON.stringify({ reportId: "accepted" }), { status })
	}
	const input = async (selector: string, value: string) => {
		const element = container.querySelector<
			HTMLInputElement | HTMLTextAreaElement
		>(selector)!
		const proto =
			element.tagName === "TEXTAREA"
				? browser.HTMLTextAreaElement.prototype
				: browser.HTMLInputElement.prototype
		await React.act(async () => {
			Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value)
			element.dispatchEvent(
				new browser.Event("input", { bubbles: true }) as unknown as Event,
			)
			element.dispatchEvent(
				new browser.Event("change", { bubbles: true }) as unknown as Event,
			)
		})
	}
	const send = async () => {
		await React.act(async () => {
			container.querySelector("form")!.dispatchEvent(
				new browser.Event("submit", {
					bubbles: true,
					cancelable: true,
				}) as unknown as Event,
			)
		})
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
	}
	try {
		await React.act(async () =>
			root.render(React.createElement(ContactSection)),
		)
		assert.equal(container.querySelectorAll('input[type="radio"]').length, 6)
		await React.act(async () =>
			container.querySelector<HTMLInputElement>('input[value="data"]')!.click(),
		)
		now += 3000
		await input('input[type="text"]', "The Matrix")
		await input("textarea", "Please fix this title.")
		await input('input[type="email"]', "sam@example.com")
		for (status of [400, 429, 503, 0]) {
			await send()
			assert.equal(
				container.querySelector("textarea")!.value,
				"Please fix this title.",
			)
			assert.ok(container.querySelector('[role="alert"]'))
		}
		assert.equal(requests.length, 4)
		assert.equal(new Set(requests.map((r) => r.idempotencyKey)).size, 1)
		assert.equal(requests[0].kind, "contact")
		assert.match(String(requests[0].message), /Title: The Matrix/)
		await input("textarea", "Updated details.")
		status = 200
		await send()
		assert.notEqual(requests[4].idempotencyKey, requests[0].idempotencyKey)
		assert.match(document.activeElement!.textContent!, /Sent/)
		await React.act(async () =>
			container.querySelector<HTMLButtonElement>("button")!.click(),
		)
		assert.equal(document.activeElement?.tagName, "TEXTAREA")
		assert.equal(container.querySelector("textarea")!.value, "")
	} finally {
		globalThis.fetch = originalFetch
		Date.now = originalNow
		await React.act(async () => root.unmount())
		container.remove()
	}
})

test("members use their current email; a missing email stays editable", async () => {
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	try {
		Object.assign(globalThis, {
			__contactUser: { id: "member-a", email: "a@example.com" },
		})
		await React.act(async () =>
			root.render(React.createElement(ContactSection)),
		)
		await React.act(async () =>
			container.querySelector<HTMLInputElement>('input[type="radio"]')!.click(),
		)
		for (const email of ["a@example.com", "b@example.com", undefined]) {
			Object.assign(globalThis, {
				__contactUser: { id: email ?? "no-email", email },
			})
			await React.act(async () =>
				root.render(React.createElement(ContactSection)),
			)
			const input = container.querySelector<HTMLInputElement>(
				'input[type="email"]',
			)!
			assert.equal(input.value, email ?? "")
			assert.equal(input.readOnly, Boolean(email))
			assert.equal(input.required, true)
		}
	} finally {
		Object.assign(globalThis, { __contactUser: null })
		await React.act(async () => root.unmount())
		container.remove()
	}
})
