import type { HeadersFunction } from "@remix-run/node"

// Child routes must not replace the root's authenticated-response policy.
// Remix preserves Set-Cookie from loaders and parent routes automatically.
export const pageHeaders: HeadersFunction = ({
	parentHeaders,
	loaderHeaders,
	actionHeaders,
	errorHeaders,
}) => {
	const headers = new Headers(parentHeaders)
	for (const name of ["Cache-Control", "Vary"]) {
		if (!headers.has(name) && loaderHeaders.has(name)) {
			headers.set(name, loaderHeaders.get(name)!)
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
