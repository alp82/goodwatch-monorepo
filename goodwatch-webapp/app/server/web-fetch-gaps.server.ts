// remix-serve installs @remix-run/web-fetch as the global fetch, Request, Response and Headers, because the app has no
// v3_singleFetch (the dev server does the same in vite.config.js). That Response has no static json() and those
// Headers no getSetCookie(). Code that expects them throws; the MCP SDK calls Response.json() while it answers, so
// its request never settled. The server entry fills both gaps before the first request. Native classes are left alone.
export function fillWebFetchGaps(): void {
	if (typeof Response.json !== "function")
		Object.defineProperty(Response, "json", {
			configurable: true,
			writable: true,
			value: (data: unknown, init: ResponseInit = {}) => {
				const headers = new Headers(init.headers)
				if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
				return new Response(JSON.stringify(data), { ...init, headers })
			},
		})
	if (typeof Headers.prototype.getSetCookie !== "function")
		Object.defineProperty(Headers.prototype, "getSetCookie", {
			configurable: true,
			writable: true,
			value(this: Headers & { raw?: () => Record<string, string[]> }) {
				return this.raw?.()["set-cookie"] ?? []
			},
		})
}

fillWebFetchGaps()
