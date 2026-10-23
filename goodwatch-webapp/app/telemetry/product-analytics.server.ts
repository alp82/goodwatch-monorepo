import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import { onShutdown } from "../server/lifecycle.server.ts"
import { nativeFetch } from "../server/native-fetch.server.ts"
import { type AnalyticsUser, personProperties } from "./person-properties.ts"
import {
	type EventProperties,
	INTERNAL_USER_IDS,
	type ProductEvent,
	discoveryProperties,
	productProperties,
} from "./product-events.ts"

let analyticsFetch: typeof fetch | null = null
/** Tests swap the transport here; production always uses Node's own fetch. */
export function setAnalyticsFetch(send: typeof fetch | null) {
	analyticsFetch = send
}

interface Context {
	properties: EventProperties
	sessionId?: string
}
const context = new AsyncLocalStorage<Context>()
export function withProductContext<T>(
	properties: EventProperties,
	run: () => T,
): T {
	return context.run(
		{
			...context.getStore(),
			properties: { ...context.getStore()?.properties, ...properties },
		},
		run,
	)
}
/** Wrap an action, never a prefetched loader. Authenticated identity comes from the writer, not headers. */
export function analyticsAction<A extends { request: Request }, R>(
	action: (args: A) => R,
) {
	return (args: A): R => {
		const request = args.request
		let source = "web"
		let properties: EventProperties = {}
		try {
			const ref = new URL(request.headers.get("referer") ?? request.url)
			source = ref.pathname.split("/")[1] || "home"
			properties = discoveryProperties(ref.searchParams)
			if (ref.searchParams.has("tv")) {
				source = "living_room"
				properties.surface = ref.searchParams.get("tv") ?? undefined
			}
			const raw = request.headers.get("X-GOODWATCH-ANALYTICS")
			if (raw && raw.length <= 4096) {
				const supplied = productProperties(JSON.parse(raw))
				for (const key of [
					"result_position",
					"sort",
					"country",
					"service_ids",
					"moods",
					"on_my_services",
					"for_you",
					"has_query",
					"query_length",
				]) {
					if (supplied[key] !== undefined) properties[key] = supplied[key]
				}
			}
		} catch {}
		const session = request.headers.get("X-POSTHOG-SESSION-ID")
		return context.run(
			{
				properties: { ...properties, source, request_id: randomUUID() },
				sessionId:
					session && /^[a-zA-Z0-9-]{1,80}$/.test(session) ? session : undefined,
			},
			() => action(args),
		)
	}
}
export interface ProductEnvelope {
	event: string
	uuid: string
	timestamp: string
	properties: Record<string, unknown>
}
export function productEnvelope(
	userId: string,
	event: ProductEvent,
	properties: EventProperties = {},
	options: { timestamp?: Date; uuid?: string; user?: AnalyticsUser } = {},
): ProductEnvelope {
	const current = context.getStore()
	return {
		event,
		uuid: options.uuid ?? randomUUID(),
		timestamp: (options.timestamp ?? new Date()).toISOString(),
		properties: {
			...productProperties(current?.properties ?? {}),
			...productProperties(properties),
			...(options.user?.id === userId
				? { $set: personProperties(options.user) }
				: {}),
			distinct_id: userId,
			user_id: userId,
			$user_id: userId,
			is_guest: false,
			is_internal: INTERNAL_USER_IDS.has(userId),
			origin: properties.origin ?? current?.properties.origin ?? "manual",
			source: properties.source ?? current?.properties.source ?? "server",
			$session_id: current?.sessionId,
			$geoip_disable: true,
			$process_person_profile: true,
			environment: process.env.NODE_ENV ?? "development",
			release: process.env.GIT_COMMIT ?? process.env.SOURCE_COMMIT,
			$lib: "goodwatch-server",
			schema_version: 1,
		},
	}
}
const profiles = new Map<string, { signature: string; at: number }>()
/** Refresh a signed-in person's profile without recording a product action. */
export function identifyProductUser(user: AnalyticsUser): void {
	if (
		!user.id ||
		process.env.NODE_ENV !== "production" ||
		process.env.POSTHOG_DISABLED === "true"
	)
		return
	const signature = createHash("sha256")
		.update(JSON.stringify(personProperties(user)))
		.digest("hex")
	const previous = profiles.get(user.id)
	if (previous?.signature === signature && Date.now() - previous.at < 300_000)
		return
	const envelope = productEnvelope(user.id, "sign in succeeded", {}, { user })
	envelope.event = "$set"
	if (enqueue(envelope)) {
		if (profiles.size >= 5000) {
			const oldest = profiles.keys().next().value
			if (oldest !== undefined) profiles.delete(oldest)
		}
		profiles.set(user.id, { signature, at: Date.now() })
	}
}
export function eventUuid(key: string): string {
	const hex = createHash("sha256").update(key).digest("hex").slice(0, 32)
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}
const queue: ProductEnvelope[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let sending: Promise<void> | undefined
let dropped = 0
/** Analytics failure never fails a saved member action. Bounded queue; retried once with identical UUIDs. */
export function captureProductEvent(
	userId: string,
	event: ProductEvent,
	properties: EventProperties = {},
	options: { timestamp?: Date; uuid?: string; user?: AnalyticsUser } = {},
): void {
	if (!userId) return
	enqueue(productEnvelope(userId, event, properties, options))
}
function enqueue(envelope: ProductEnvelope): boolean {
	if (
		process.env.NODE_ENV !== "production" ||
		process.env.POSTHOG_DISABLED === "true"
	)
		return false

	if (queue.length >= 2000) {
		if (++dropped % 100 === 1)
			console.warn("Product analytics queue full", { dropped })
		return false
	}
	queue.push(envelope)
	if (!timer) {
		timer = setTimeout(() => {
			timer = undefined
			void flushProductEvents()
		}, 250)
		timer.unref()
	}
	return true
}
export async function flushProductEvents(): Promise<void> {
	if (sending) {
		await sending
		if (queue.length) return flushProductEvents()
		return
	}
	if (!queue.length) return
	if (timer) {
		clearTimeout(timer)
		timer = undefined
	}
	sending = (async () => {
		const batch = queue.splice(0, 100)
		const api_key = process.env.POSTHOG_API_KEY
		if (!api_key) {
			console.warn("Product analytics disabled: POSTHOG_API_KEY missing")
			return
		}
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const response = await (analyticsFetch ?? nativeFetch)(
					`${process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com"}/batch/`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ api_key, batch }),
						signal: AbortSignal.timeout(750),
					},
				)
				// Read the body so the connection is released.
				await response.text().catch(() => "")
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				return
			} catch {
				if (attempt === 1)
					console.warn("Product analytics batch delivery failed", {
						events: batch.length,
					})
			}
		}
	})().finally(() => {
		sending = undefined
	})
	await sending
	if (queue.length) return flushProductEvents()
}
onShutdown("product analytics", flushProductEvents)
