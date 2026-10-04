// The server's HTML must not carry a sign-in or sign-up link with a return page: crawlers follow every one of them.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { useAuthHref } from "./auth-href.ts"
import { authReturnQuery } from "./auth-return.ts"

// The router that @remix-run/react itself uses: another copy of the package has its own context.
const require = createRequire(import.meta.url)
const { MemoryRouter } = createRequire(require.resolve("@remix-run/react"))(
	"react-router-dom",
) as typeof import("react-router-dom")

function Links() {
	const authHref = useAuthHref()
	return createElement(
		"nav",
		null,
		createElement("a", { href: authHref("sign-up") }, "Sign up"),
		createElement("a", { href: authHref("sign-in") }, "Sign in"),
		createElement("a", { href: authHref("sign-up", "/taste") }, "Save"),
	)
}

const hrefs = (html: string) =>
	[...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])

test("server HTML links to the bare sign-up and sign-in pages", () => {
	for (const page of [
		"/person/287-brad-pitt?genre=Drama&trait=crime#titles",
		"/movie/603-the-matrix",
		"/sign-in?redirectTo=%2Ftaste",
	]) {
		const html = renderToString(
			createElement(
				MemoryRouter,
				{ initialEntries: [page] },
				createElement(Links),
			),
		)
		assert.deepEqual(hrefs(html), ["/sign-up", "/sign-in", "/sign-up"], page)
		assert.doesNotMatch(html, /redirectTo/)
	}
})

test("the return page a browser adds is the page the person is on", () => {
	assert.equal(
		authReturnQuery({
			pathname: "/person/287-brad-pitt",
			search: "?genre=Drama",
			hash: "#titles",
		}),
		`?redirectTo=${encodeURIComponent("/person/287-brad-pitt?genre=Drama#titles")}`,
	)
	// On the sign-in and sign-up pages the existing return page is passed on, not wrapped again.
	assert.equal(
		authReturnQuery({
			pathname: "/sign-in",
			search: "?redirectTo=%2Ftaste",
			hash: "",
		}),
		"?redirectTo=%2Ftaste",
	)
	assert.equal(
		authReturnQuery({ pathname: "/sign-up", search: "", hash: "" }),
		"",
	)
})
