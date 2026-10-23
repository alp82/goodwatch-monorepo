// Request checks the profile's write endpoints share.

/** Whether a browser request comes from the site itself. A request without Origin (a server, curl) passes, as on
 * /api/user-settings/set; a form posted from another site carries its own Origin and is refused. */
export function sameOrigin(request: Request): boolean {
	const origin = request.headers.get("Origin")
	if (!origin) return true
	// Coolify terminates TLS, so compare with the public origin rather than the internal HTTP URL.
	const expected =
		process.env.APP_ORIGIN ||
		(process.env.NODE_ENV === "production"
			? "https://goodwatch.app"
			: new URL(request.url).origin)
	return origin === expected
}

/** Whether the browser says the request comes from another site (Sec-Fetch-Site). Older browsers don't send it. */
export function crossSite(request: Request): boolean {
	return request.headers.get("Sec-Fetch-Site") === "cross-site"
}

/** The profile's write endpoints take requests from the site itself only: same Origin, not marked cross-site. */
export const fromThisSite = (request: Request) =>
	sameOrigin(request) && !crossSite(request)

/** Reads at most `max` bytes of a request body; null when it is larger. */
export async function readLimited(
	request: Request,
	max: number,
): Promise<Uint8Array | null> {
	const length = Number(request.headers.get("Content-Length"))
	if (Number.isFinite(length) && length > max) return null
	const reader = request.body?.getReader()
	if (!reader) return new Uint8Array()
	const chunks: Uint8Array[] = []
	let total = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		total += value.byteLength
		if (total > max) {
			await reader.cancel()
			return null
		}
		chunks.push(value)
	}
	const out = new Uint8Array(total)
	let at = 0
	for (const chunk of chunks) {
		out.set(chunk, at)
		at += chunk.byteLength
	}
	return out
}

/** Parses a JSON body of at most `max` bytes; "too-large" or "invalid" otherwise. */
export async function readJsonLimited(
	request: Request,
	max: number,
): Promise<
	{ ok: true; value: unknown } | { ok: false; problem: "too-large" | "invalid" }
> {
	const bytes = await readLimited(request, max)
	if (!bytes) return { ok: false, problem: "too-large" }
	try {
		return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }
	} catch {
		return { ok: false, problem: "invalid" }
	}
}
