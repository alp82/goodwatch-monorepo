// PostHog 1.295 deep-copies own enumerable fields before before_send. Native Event Timing fields are prototype
// getters, so they have already become {} there. Adapt the public capture call before that copy, without another
// observer or metric stream. Keep this adapter when upgrading only if the SDK still needs it.
import type { PostHog } from "posthog-js"

const INP_EVENT = "$web_vitals_INP_event"
const installed = new WeakSet<object>()
const EVENT_NAMES = new Set([
	"click",
	"keydown",
	"keyup",
	"keypress",
	"pointerdown",
	"pointerup",
	"mousedown",
	"mouseup",
	"touchstart",
	"touchend",
])
const TAGS = new Set(["input", "textarea", "button", "a", "select", "summary"])
const PHASES = [
	"inputDelay",
	"processingDuration",
	"presentationDelay",
	"interactionTime",
	"nextPaintTime",
] as const

const record = (value: unknown): Record<string, unknown> | null =>
	value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
		: null

/** Explicit reads are required for native prototype getters. An unavailable getter contributes no data. */
function read(object: Record<string, unknown> | null, key: string): unknown {
	try {
		return object?.[key]
	} catch {
		return undefined
	}
}
const finiteTime = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && value >= 0

/** Only fixed categories leave the browser. Never read text, values, IDs, labels, URLs or raw selector attributes. */
function targetCategory(value: unknown): string {
	const target = record(value)
	try {
		const closest = read(target, "closest")
		if (typeof closest === "function" && closest.call(value, ".start-bar"))
			return "start-search"
		const tagName = read(target, "tagName")
		const tag = typeof tagName === "string" ? tagName.toLowerCase() : ""
		return TAGS.has(tag) ? tag : target ? "other" : "unknown"
	} catch {
		return "unknown"
	}
}

function entryTiming(value: unknown): Record<string, unknown> | null {
	const entry = record(value)
	const startTime = read(entry, "startTime")
	const duration = read(entry, "duration")
	const processingStart = read(entry, "processingStart")
	const processingEnd = read(entry, "processingEnd")
	if (
		!finiteTime(startTime) ||
		!finiteTime(duration) ||
		!finiteTime(processingStart) ||
		!finiteTime(processingEnd) ||
		processingStart < startTime ||
		processingEnd < processingStart
	)
		return null
	const name = read(entry, "name")
	const interactionId = read(entry, "interactionId")
	return {
		name: typeof name === "string" && EVENT_NAMES.has(name) ? name : "other",
		startTime,
		duration,
		processingStart,
		processingEnd,
		...(finiteTime(interactionId) ? { interactionId } : {}),
		targetCategory: targetCategory(read(entry, "target")),
		inputDelay: processingStart - startTime,
		processingDuration: processingEnd - processingStart,
		// duration is rounded to 8ms by Event Timing. This is per entry, not web-vitals' frame-level attribution.
		presentationDelayEstimate: Math.max(
			0,
			startTime + duration - processingEnd,
		),
	}
}

function safeAttribution(value: unknown): Record<string, unknown> | undefined {
	const attribution = record(value)
	if (!attribution) return undefined
	const safe: Record<string, unknown> = {}
	for (const field of PHASES) {
		const time = read(attribution, field)
		if (finiteTime(time)) safe[field] = time
	}
	const type = read(attribution, "interactionType")
	if (type === "keyboard" || type === "pointer") safe.interactionType = type
	return Object.keys(safe).length ? safe : undefined
}

export function serializeInpEntries<T extends Record<string, unknown>>(
	properties: T,
): T {
	const metric = record(read(properties, INP_EVENT))
	if (!metric) return properties
	const entries = read(metric, "entries")
	return {
		...properties,
		[INP_EVENT]: {
			...metric,
			entries: Array.isArray(entries)
				? entries
						.slice(0, 20)
						.map(entryTiming)
						.filter((entry) => entry !== null)
				: [],
			// Raw attribution may contain DOM references, selectors and script URLs. Keep only its numerical phases.
			attribution: safeAttribution(read(metric, "attribution")),
		},
	}
}

/** Adapt only the SDK's existing INP payload; preserve the original call's receiver, arguments and result. */
export function installWebVitalsAttribution(
	client: Pick<PostHog, "capture">,
): void {
	if (installed.has(client)) return
	const capture = client.capture
	client.capture = function (
		this: unknown,
		...args: Parameters<typeof capture>
	) {
		if (args[0] === "$web_vitals" && args[1])
			args[1] = serializeInpEntries(args[1])
		return capture.apply(this, args)
	}
	installed.add(client)
}
