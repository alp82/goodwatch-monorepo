import type { HeadersFunction } from "@remix-run/node"

// Child routes must not replace the root's authenticated-response policy.
// Only inherit Cache-Control; the final response policy owns Vary.
// Remix preserves Set-Cookie from loaders and parent routes automatically.
export const pageHeaders: HeadersFunction = ({
	parentHeaders,
	loaderHeaders,
	actionHeaders,
	errorHeaders,
}) => {
	const headers = new Headers(parentHeaders)
	for (const name of ["Cache-Control"]) {
		const value = loaderHeaders.get(name)
		if (!headers.has(name) && value !== null) {
			headers.set(name, value)
		}
	}
	for (const source of [
		parentHeaders,
		loaderHeaders,
		actionHeaders,
		errorHeaders,
	]) {
		if (
			source?.has("Set-Cookie") ||
			/private|no-store/i.test(source?.get("Cache-Control") ?? "")
		) {
			headers.set("Cache-Control", "private, no-store")
		}
	}
	return headers
}
