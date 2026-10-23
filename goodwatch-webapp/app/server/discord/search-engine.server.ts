// The page role calls the same proxy path as the website. Only a signed server request may supply a Discord identity.
import { createHmac, timingSafeEqual } from "node:crypto"
import type { combinedSearch } from "../combined-search/search.server.ts"
import type { GuestTitle } from "./cards.ts"
import { drain, fetchWithTimeout } from "./fetch-timeout.ts"

export const SEARCH_LIMIT_NOTE =
	"Showing title matches. Mood searches reset tomorrow."
export const SEARCH_TIMEOUT_NOTE =
	"Showing title matches. Mood search is temporarily unavailable."
const headers = {
	"Content-Type": "application/json",
	"Cache-Control": "private, no-store",
}
const signingKey = () => {
	const key = process.env.SEARCH_STORAGE_KEY ?? ""
	if (!/^[a-f\d]{64}$/i.test(key)) throw new Error("Search is unavailable")
	return Buffer.from(key, "hex")
}
const signature = (at: string, user: string, body: string) =>
	createHmac("sha256", signingKey())
		.update(`discord-search-v1\n${at}\n${user}\n${body}`)
		.digest("hex")

export function searchHeaders(user: string, body: string, now = Date.now()) {
	const at = String(now)
	return {
		"Content-Type": "application/json",
		"X-Goodwatch-Discord": user,
		"X-Goodwatch-Discord-Time": at,
		"X-Goodwatch-Discord-Signature": signature(at, user, body),
	}
}

/** Runs on the search role, under the website's existing admission, reading cache, spending limits and deadlines. */
export async function discordSearchResponse(
	request: Request,
	run: typeof combinedSearch,
	take?: (user: string) => Promise<{ allowed: boolean }>,
): Promise<Response> {
	let limited = false
	try {
		const user = request.headers.get("X-Goodwatch-Discord") ?? ""
		const at = request.headers.get("X-Goodwatch-Discord-Time") ?? ""
		const sent = request.headers.get("X-Goodwatch-Discord-Signature") ?? ""
		if (
			!/^\d{1,20}$/.test(user) ||
			!/^\d{13}$/.test(at) ||
			Math.abs(Date.now() - Number(at)) > 30_000 ||
			!/^[a-f\d]{64}$/.test(sent)
		)
			return new Response(null, { status: 403, headers })
		const reader = request.body?.getReader()
		if (!reader) return new Response(null, { status: 400, headers })
		const decoder = new TextDecoder()
		let bytes = 0,
			raw = ""
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			bytes += value.byteLength
			if (bytes > 8192) {
				await reader.cancel()
				return new Response(null, { status: 413, headers })
			}
			raw += decoder.decode(value, { stream: true })
		}
		raw += decoder.decode()
		if (
			!timingSafeEqual(
				Buffer.from(sent, "hex"),
				Buffer.from(signature(at, user, raw), "hex"),
			)
		)
			return new Response(null, { status: 403, headers })
		const { q } = JSON.parse(raw)
		if (
			typeof q !== "string" ||
			q.trim().length < 2 ||
			Buffer.byteLength(q) > 4096
		)
			return new Response(null, { status: 400, headers })
		const { searchAdmission } = await import(
			"../search-runtime/admission.server.ts"
		)
		const release = searchAdmission.enter()
		if (!release) return new Response(null, { status: 503, headers })
		const controller = new AbortController()
		const stop = () => controller.abort()
		const timer = setTimeout(stop, 4500)
		if (request.signal.aborted) stop()
		request.signal.addEventListener("abort", stop, { once: true })
		const signal = controller.signal
		try {
			const batch = await run(
				q.trim(),
				{ includeAdult: false, lesserKnown: false },
				{
					accountId: null,
					networkIdentity: `discord:${user}`,
					allowTranslation: false,
					beforeUncachedReading: async () => {
						if (signal.aborted) throw new Error("Search timed out")
						const verdict = take
							? await take(user)
							: await (
									await import("../rate-limit.server.ts")
							  ).rateLimiter.take("discord-search", user, [
									{ limit: 20, seconds: 86400 },
							  ])
						if (!verdict.allowed) {
							limited = true
							throw new Error("Search limit reached")
						}
					},
				},
				signal,
				undefined,
				{ rows: 100 },
			)
			if (batch.errors.includes("Showing basic search results."))
				throw new Error("Ranked search is unavailable")
			const titles: GuestTitle[] = batch.rows.map((row) => ({
				id: row.key,
				name: row.title,
				year: Number(row.year) || null,
				poster_url: row.poster
					? `https://image.tmdb.org/t/p/w342${row.poster}`
					: null,
			}))
			return new Response(JSON.stringify({ titles }), { headers })
		} finally {
			clearTimeout(timer)
			request.signal.removeEventListener("abort", stop)
			release()
		}
	} catch {
		return new Response(null, { status: limited ? 429 : 503, headers })
	}
}

/** The caller's signal usually ends the request sooner; this bound keeps a forgotten signal from hanging it. */
const SEARCH_FETCH_MS = 6000

export async function websiteSearch(
	query: string,
	user: string,
	signal: AbortSignal,
	send?: typeof fetch,
): Promise<{ titles: GuestTitle[] | null; note?: string }> {
	const { appOrigin } = await import("./oauth.server.ts")
	const body = JSON.stringify({ q: query })
	const { nativeFetch } = await import("../native-fetch.server.ts")
	return fetchWithTimeout(
		send ?? nativeFetch,
		new URL("/api/combined-search", appOrigin()).href,
		{ method: "POST", headers: searchHeaders(user, body), body, signal },
		SEARCH_FETCH_MS,
		async (response) => {
			if (response.status === 429) {
				await drain(response)
				return { titles: null, note: SEARCH_LIMIT_NOTE }
			}
			if (!response.ok) {
				await drain(response)
				throw new Error("Search is unavailable")
			}
			return (await response.json()) as {
				titles: GuestTitle[]
				note?: string
			}
		},
	)
}
