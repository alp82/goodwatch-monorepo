import { createHash } from "node:crypto"
import type { IncomingHttpHeaders } from "node:http"
import {
	canonicalAddress,
	verifySearchBot,
	type SearchBot,
} from "./search-bot-verification.server.ts"
import { personTarget } from "./person-query.server.ts"
import { counter } from "./metrics/registry.server.ts"

export type PersonAnswer = {
	kind: "limited" | "normalized"
	status: number
	headers: Record<string, string>
	body: string
}
type RequestHead = {
	method?: string
	url?: string
	headers: IncomingHttpHeaders
}
type Window = { until: number; count: number; people: Set<string> }
const outcomes = counter(
	"goodwatch_person_policy_total",
	"Person request policy outcomes before rendering.",
	["outcome"],
	8,
)
const hash = (value: string) =>
	createHash("sha256").update(value).digest("hex").slice(0, 32)
// A household's IPv6 addresses share a budget. Verification still checks the exact original address.
const clientKey = (address: string) => {
	if (!address.includes(":")) return hash(address)
	const [head, tail] = address.split("::")
	const first = head ? head.split(":") : [],
		last = tail ? tail.split(":") : []
	const groups =
		tail === undefined
			? first
			: [...first, ...Array(8 - first.length - last.length).fill("0"), ...last]
	return hash(groups.slice(0, 4).join(":"))
}

/** Process-local budgets, bounded in memory. No shared database call is made on this early HTTP path. */
export function createPersonRequestPolicy(
	options: {
		env?: Record<string, string | undefined>
		now?: () => number
		verify?: (address: string) => Promise<SearchBot>
	} = {},
) {
	const now = options.now ?? Date.now
	const clients = new Map<string, { short: Window; minute: Window }>()
	let cohort = {
		until: 0,
		count: 0,
		clients: new Set<string>(),
		people: new Set<string>(),
	}
	const fresh = (seconds: number): Window => ({
		until: now() + seconds * 1000,
		count: 0,
		people: new Set(),
	})
	return async function check(
		request: RequestHead,
	): Promise<PersonAnswer | null> {
		if (request.method !== "GET" && request.method !== "HEAD") return null
		const target = personTarget(request.url ?? "")
		if (!target) return null
		const env = options.env ?? process.env
		// Explicit deployment contract: the ingress must overwrite this single-address header and own access to the app.
		// Never use arbitrary X-Forwarded-For, or combine everyone behind a proxy into one client.
		const header = (
			env.PERSON_TRUSTED_IP_HEADER || env.SEARCH_TRUSTED_IP_HEADER
		)?.toLowerCase()
		const raw = header ? request.headers[header] : undefined
		const address =
			typeof raw === "string" ? canonicalAddress(raw.trim()) : null
		if (target.filters && address) {
			const at = now(),
				key = clientKey(address)
			let windows = clients.get(key)
			if (!windows) {
				// Expired or oldest counters may be evicted; bookkeeping cannot grow with a rotating address pool.
				if (clients.size >= 10_000) {
					for (const [k, v] of clients)
						if (v.minute.until <= at) clients.delete(k)
					if (clients.size >= 10_000)
						clients.delete(clients.keys().next().value!)
				}
				windows = { short: fresh(10), minute: fresh(60) }
				clients.set(key, windows)
			}
			if (windows.short.until <= at) windows.short = fresh(10)
			if (windows.minute.until <= at) windows.minute = fresh(60)
			const person = target.pathname.split("/")[2].split("-")[0]
			const distinct = !windows.minute.people.has(person)
			let retry = 0
			if (windows.short.count >= 30) retry = windows.short.until - at
			if (
				windows.minute.count >= 120 ||
				(distinct && windows.minute.people.size >= 20)
			)
				retry = Math.max(retry, windows.minute.until - at)
			// The observed attack rotates addresses and enumerates deeply combined filters across many people. Give this
			// behavior its own budget, not a global budget on ordinary single-filter navigation or canonical person pages.
			if (cohort.until <= at)
				cohort = {
					until: at + 10_000,
					count: 0,
					clients: new Set(),
					people: new Set(),
				}
			const complex = target.filters >= 3
			if (
				complex &&
				cohort.count >= 60 &&
				cohort.clients.size >= 20 &&
				cohort.people.size >= 20
			)
				retry = Math.max(retry, cohort.until - at)
			if (retry) {
				// Only potential denials need DNS. Coalesced/cache-backed verification is independent of the claimed UA.
				// Inconclusive DNS fails open: an outage or verifier saturation must not throttle a real search crawler.
				const bot = await (options.verify ?? verifySearchBot)(address).catch(
					() => "unknown" as const,
				)
				if (bot === "unverified") {
					outcomes.inc(["limited"])
					return {
						kind: "limited",
						status: 429,
						headers: {
							"Content-Type": "text/plain; charset=utf-8",
							"Cache-Control": "private, no-store",
							"Retry-After": String(Math.max(1, Math.ceil(retry / 1000))),
							"X-Robots-Tag": "noindex",
							...(target.query.has("_data") ? { "X-Remix-Catch": "yes" } : {}),
						},
						body: "Too many person filter requests. Please try again shortly.",
					}
				}
				outcomes.inc([bot === "unknown" ? "dns-unavailable" : "verified-bot"])
			} else {
				windows.short.count++
				windows.minute.count++
				windows.minute.people.add(person)
				if (complex) {
					cohort.count++
					if (cohort.clients.size < 20) cohort.clients.add(key)
					if (cohort.people.size < 20) cohort.people.add(person)
				}
				outcomes.inc(["allowed"])
			}
		} else if (target.filters) outcomes.inc(["unkeyed"])
		if (target.target !== request.url) {
			outcomes.inc(["normalized"])
			// Remix loader fetches need its redirect protocol so navigation updates the address without parsing HTML as JSON.
			const data = target.query.has("_data")
			const location = data
				? target.pathname +
					(() => {
						const p = new URLSearchParams(target.query)
						p.delete("_data")
						const q = p.toString()
						return q ? "?" + q : ""
					})()
				: target.target
			return {
				kind: "normalized",
				status: data ? 204 : 308,
				headers: {
					"Cache-Control": "private, no-store",
					...(data
						? { "X-Remix-Redirect": location, "X-Remix-Status": "308" }
						: { Location: location }),
				},
				body: "",
			}
		}
		return null
	}
}
export const checkPersonRequest = createPersonRequestPolicy()
