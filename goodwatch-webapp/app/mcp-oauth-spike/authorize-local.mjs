// Exercise the real HTML form routes for a client's printed loopback OAuth URL.
// npm does not run this automatically. Local test driver only; never for hosted consent.
const start = new URL(process.argv[2])
if (start.origin !== "http://127.0.0.1:3335" || !process.env.MCP_SPIKE_PASSWORD)
	throw new Error("Pass a local authorize URL and MCP_SPIKE_PASSWORD")
const jar = new Map()
async function fetchPage(url, init = {}) {
	const headers = new Headers(init.headers)
	headers.set("Accept", "text/html")
	headers.set("Sec-Fetch-Mode", "navigate")
	headers.set(
		"Cookie",
		[...jar].map(([name, value]) => `${name}=${value}`).join("; "),
	)
	headers.set("Origin", start.origin)
	const response = await fetch(url, { ...init, headers, redirect: "manual" })
	for (const cookie of response.headers.getSetCookie()) {
		const [pair] = cookie.split(";")
		const index = pair.indexOf("=")
		jar.set(pair.slice(0, index), pair.slice(index + 1))
	}
	if (
		response.ok &&
		response.headers.get("Content-Type")?.includes("application/json")
	) {
		const data = await response.clone().json()
		if (data.redirect && data.url)
			return new Response(null, {
				status: 302,
				headers: { Location: data.url },
			})
	}
	return response
}
let url = start
let response = await fetchPage(url)
while (response.status === 302) {
	url = new URL(response.headers.get("Location"), start)
	if (url.origin !== start.origin) break
	response = await fetchPage(url)
}
if (url.pathname === "/login") {
	if (
		response.status !== 200 ||
		!(await response.text()).includes('name="password"')
	)
		throw new Error("Login page failed")
	response = await fetchPage(url, {
		method: "POST",
		body: new URLSearchParams({ password: process.env.MCP_SPIKE_PASSWORD }),
	})
	if (response.status !== 302)
		throw new Error(`Login failed: ${response.status} ${await response.text()}`)
	url = new URL(response.headers.get("Location"), start)
	response = await fetchPage(url)
}
if (url.pathname !== "/consent" || response.status !== 200)
	throw new Error(
		`Consent page failed: ${response.status} ${await response.text()}`,
	)
if (!(await response.text()).includes('value="allow"'))
	throw new Error("Missing Allow form")
response = await fetchPage(url, {
	method: "POST",
	body: new URLSearchParams({
		decision: process.env.MCP_SPIKE_DECISION || "allow",
	}),
})
if (response.status !== 302)
	throw new Error(`Consent failed: ${response.status} ${await response.text()}`)
const callback = new URL(response.headers.get("Location"))
if (callback.searchParams.get("iss") !== `${start.origin}/api/auth`)
	throw new Error("RFC 9207 issuer mismatch")
console.log(
	JSON.stringify({
		login: true,
		consent: true,
		callback: callback.origin + callback.pathname,
		iss: callback.searchParams.get("iss"),
		error: callback.searchParams.get("error"),
	}),
)
if (!["localhost", "127.0.0.1"].includes(callback.hostname))
	throw new Error("Only loopback callbacks may be completed by this driver")
const complete = await fetch(callback)
console.log(`Loopback callback HTTP ${complete.status}`)
