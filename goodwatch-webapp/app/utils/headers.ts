import type { HeadersFunction } from "@remix-run/node"

// Child routes must not replace the root's authenticated-response policy.
// A child can shorten the shared lifetime. Only inherit Cache-Control; the final response policy owns Vary.
// Remix preserves Set-Cookie from loaders and parent routes automatically.
export const pageHeaders: HeadersFunction = ({
	parentHeaders,
	loaderHeaders,
	actionHeaders,
	errorHeaders,
}) => {
	const headers = new Headers(parentHeaders)
	const parent = parentHeaders.get("Cache-Control")
	const loader = loaderHeaders.get("Cache-Control")
	const maxAge = (policy: string | null) =>
		/(?:^|,)\s*s-maxage=(\d+)\s*(?:,|$)/i.exec(policy ?? "")?.[1]
	const parentAge = maxAge(parent)
	const loaderAge = maxAge(loader)
	if (
		loader !== null &&
		(parent === null ||
			(parentAge !== undefined &&
				loaderAge !== undefined &&
				Number(loaderAge) < Number(parentAge)))
	)
		headers.set("Cache-Control", loader)
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
