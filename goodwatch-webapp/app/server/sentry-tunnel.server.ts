// The Sentry tunnel: the browser's SDK posts its envelopes here, and the server forwards them to Sentry.
// Anyone can post to this route, so every step has a bound: the body's size, the time the upstream may take,
// and the number of requests in flight. No answer is cacheable.

export const SENTRY_HOST = "o4507456417169408.ingest.de.sentry.io"
export const SENTRY_PROJECT_IDS = ["4507456420184144"]

// For tests and benchmarks only: another base URL for the upstream, so that the route's cost can be measured
// against a local sink without creating events. The envelope's DSN is still checked against the real host and
// project id.
export const UPSTREAM_ENV = "SENTRY_TUNNEL_UPSTREAM_URL"

// A pageload transaction is 50 to 100 KB and a replay segment is up to a few hundred KB, so 1 MB leaves room
// for the largest real envelope. With the bound on requests in flight, the bodies held in memory stay under
// 50 MB.
const MAX_BODY_BYTES = 1024 * 1024
// Sentry answers an envelope in well under a second. After 5 seconds the upstream counts as stalled.
const UPSTREAM_TIMEOUT_MS = 5_000
// Real traffic keeps a handful of requests in flight. 50 is only reached when the upstream stalls or the
// route is flooded.
const MAX_IN_FLIGHT = 50
// The SDK stops sending for this long. 60 seconds is also what the SDK assumes for a 429 without the header.
const RETRY_AFTER_SECONDS = 60
const LOG_INTERVAL_MS = 60_000

// What the SDK's transports send: a string body goes out as text/plain, a binary body without a type.
const CONTENT_TYPES = [
	"text/plain",
	"application/x-sentry-envelope",
	"application/octet-stream",
]
// The headers that tell the SDK which categories to hold back, and for how long.
const RATE_LIMIT_HEADERS = ["Retry-After", "X-Sentry-Rate-Limits"]

export interface SentryTunnelOptions {
	host?: string
	projectIds?: string[]
	upstreamBaseUrl?: string
	maxBodyBytes?: number
	upstreamTimeoutMs?: number
	maxInFlight?: number
	retryAfterSeconds?: number
	fetch?: typeof fetch
	log?: (line: string) => void
	now?: () => number
}

type Outcome =
	| "bad-envelope"
	| "too-large"
	| "busy"
	| "upstream-timeout"
	| "upstream-error"
	| "upstream-5xx"
	| "misconfigured"

export function createSentryTunnel(options: SentryTunnelOptions = {}) {
	const host = options.host ?? SENTRY_HOST
	const projectIds = options.projectIds ?? SENTRY_PROJECT_IDS
	const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES
	const upstreamTimeoutMs = options.upstreamTimeoutMs ?? UPSTREAM_TIMEOUT_MS
	const maxInFlight = options.maxInFlight ?? MAX_IN_FLIGHT
	const retryAfter = String(options.retryAfterSeconds ?? RETRY_AFTER_SECONDS)
	const send = options.fetch ?? fetch
	const log = options.log ?? ((line: string) => console.warn(line))
	const now = options.now ?? Date.now
	// A base URL that doesn't parse turns the tunnel off: falling back to Sentry would create the events that
	// the override is there to avoid.
	const upstreamBase = parseBaseUrl(
		options.upstreamBaseUrl ?? process.env[UPSTREAM_ENV] ?? `https://${host}`,
	)

	let inFlight = 0
	const counts = new Map<Outcome, number>()
	let lastLog = Number.NEGATIVE_INFINITY

	// Counts a failure and writes at most one short line per minute, so that junk requests can't flood the log.
	const note = (outcome: Outcome) => {
		counts.set(outcome, (counts.get(outcome) ?? 0) + 1)
		if (now() - lastLog < LOG_INTERVAL_MS) return
		lastLog = now()
		const summary = [...counts].map(([key, count]) => `${key}=${count}`)
		counts.clear()
		log(`sentry tunnel: ${summary.join(" ")}`)
	}

	const answer = (status: number, headers: Record<string, string> = {}) =>
		new Response(null, {
			status,
			headers: { ...headers, "Cache-Control": "no-store" },
		})
	const retryLater = (status: number, outcome: Outcome) => {
		note(outcome)
		return answer(status, { "Retry-After": retryAfter })
	}

	const forward = async (request: Request) => {
		if (!upstreamBase) return retryLater(503, "misconfigured")

		const contentType = request.headers
			.get("Content-Type")
			?.split(";")[0]
			.trim()
			.toLowerCase()
		if (contentType && !CONTENT_TYPES.includes(contentType)) {
			note("bad-envelope")
			return answer(400)
		}

		// A declared length over the cap is rejected without reading the body.
		const declared = Number(request.headers.get("Content-Length"))
		if (declared > maxBodyBytes) {
			note("too-large")
			return answer(413)
		}

		let envelope: Uint8Array | null
		try {
			envelope = await readCapped(request, maxBodyBytes)
		} catch {
			// The client went away in the middle of the body.
			note("bad-envelope")
			return answer(400)
		}
		if (!envelope) {
			note("too-large")
			return answer(413)
		}

		const projectId = envelopeProjectId(envelope, host)
		if (!projectId || !projectIds.includes(projectId)) {
			note("bad-envelope")
			return answer(400)
		}

		let upstream: Response
		try {
			// The envelope goes out as bytes: a replay segment is compressed, and text decoding would damage it.
			upstream = await send(
				new URL(`api/${projectId}/envelope/`, upstreamBase),
				{
					method: "POST",
					body: envelope,
					headers: { "Content-Type": "application/x-sentry-envelope" },
					signal: AbortSignal.timeout(upstreamTimeoutMs),
				},
			)
		} catch (error) {
			const timedOut = error instanceof Error && error.name === "TimeoutError"
			return retryLater(503, timedOut ? "upstream-timeout" : "upstream-error")
		}
		// Only the status and the headers matter. Cancelling the body frees the connection.
		await upstream.body?.cancel().catch(() => {})

		const headers: Record<string, string> = {}
		for (const name of RATE_LIMIT_HEADERS) {
			const value = upstream.headers.get(name)
			if (value) headers[name] = value
		}
		if (upstream.status === 429) return answer(429, headers)
		if (upstream.status >= 500) {
			note("upstream-5xx")
			return answer(503, { "Retry-After": retryAfter, ...headers })
		}
		// Sentry refused the envelope: the SDK drops it and doesn't retry.
		if (upstream.status >= 400) return answer(upstream.status, headers)
		return answer(200, headers)
	}

	return async (request: Request): Promise<Response> => {
		if (request.method !== "POST") return answer(405, { Allow: "POST" })
		// The bound comes before the body is read: when the upstream stalls, the requests beyond it hold
		// neither a body nor a socket to Sentry.
		if (inFlight >= maxInFlight) return retryLater(429, "busy")
		inFlight++
		try {
			return await forward(request)
		} finally {
			inFlight--
		}
	}
}

function parseBaseUrl(value: string) {
	try {
		const url = new URL(value)
		if (url.protocol !== "https:" && url.protocol !== "http:") return null
		if (!url.pathname.endsWith("/")) url.pathname += "/"
		return url
	} catch {
		return null
	}
}

// Reads the body up to the cap. Returns null when the body is larger, without reading the rest.
async function readCapped(request: Request, maxBytes: number) {
	if (!request.body) return new Uint8Array(0)
	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let size = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.byteLength
		if (size > maxBytes) {
			await reader.cancel().catch(() => {})
			return null
		}
		chunks.push(value)
	}
	const body = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.byteLength
	}
	return body
}

// The project id from the DSN in the envelope's header line, or null when the envelope isn't one of ours.
function envelopeProjectId(envelope: Uint8Array, host: string) {
	try {
		const end = envelope.indexOf(0x0a)
		const line = envelope.subarray(0, end === -1 ? envelope.length : end)
		const header = JSON.parse(new TextDecoder().decode(line))
		if (typeof header?.dsn !== "string") return null
		const dsn = new URL(header.dsn)
		if (dsn.hostname !== host) return null
		return dsn.pathname.replace("/", "") || null
	} catch {
		return null
	}
}

export const sentryTunnel = createSentryTunnel()
