// A form posted before the page loaded goes back to the form, not to a 405 error page.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { backToForm } from "./form-fallback.server.ts"

test("a post goes back to the same form with its return page", () => {
	const response = backToForm(
		new Request("https://goodwatch.app/sign-in?redirectTo=%2Ftaste", { method: "POST", body: "password=secret" }),
	)
	assert.equal(response.status, 303)
	assert.equal(response.headers.get("Location"), "/sign-in?redirectTo=%2Ftaste")
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
})

test("every account page whose form posts handles the post", () => {
	for (const page of ["sign-in", "sign-up", "verify-email", "forgot-password", "reset-password"]) {
		const source = readFileSync(new URL(`../../routes/${page}.tsx`, import.meta.url), "utf8")
		if (!/method="post"/.test(source)) continue
		assert.match(source, /^export (const|async function|function) action\b/m, `${page} posts but has no action`)
	}
})
