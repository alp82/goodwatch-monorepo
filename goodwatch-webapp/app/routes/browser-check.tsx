// Where a filtered view sends a visitor without the browser cookie (see ~/utils/browser-cookie). A browser sets the
// cookie here and goes on to the page it asked for, without the visitor noticing. A crawler that doesn't run scripts
// gets this page, which is a few hundred bytes and has no link to a filtered view.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { BROWSER_COOKIE, SET_BROWSER_COOKIE } from "~/utils/browser-cookie"

// For a script inside HTML: "<" can't close the script element.
const inScript = (value: string) =>
	JSON.stringify(value).replace(/</g, "\\u003c")

const inAttribute = (value: string) =>
	value.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`)

export async function loader({ request }: LoaderFunctionArgs) {
	const to = new URL(request.url).searchParams.get("to") ?? ""
	// Only a path on this site: "//host" and "/\host" would leave it.
	const target = /^\/(?![/\\])/.test(to) ? to : "/"
	const unfiltered = target.split(/[?#]/)[0]
	// With cookies switched off the cookie doesn't stick, and the filtered view would send the visitor back here; they
	// get the unfiltered page instead.
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>GoodWatch</title>
<script>${SET_BROWSER_COOKIE};location.replace(document.cookie.includes("${BROWSER_COOKIE}=1")?${inScript(target)}:${inScript(unfiltered)})</script>
</head><body><noscript><a href="${inAttribute(unfiltered)}">Continue to GoodWatch</a></noscript></body></html>`
	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
		},
	})
}
