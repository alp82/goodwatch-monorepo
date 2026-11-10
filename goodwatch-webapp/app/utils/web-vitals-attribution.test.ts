import assert from "node:assert/strict"
import { test } from "node:test"
import type { PostHog } from "posthog-js"
import { _copyAndTruncateStrings } from "posthog-js/lib/src/utils/index.js"
import { redactSearchTelemetry } from "./search-telemetry.ts"
import {
	installWebVitalsAttribution,
	serializeInpEntries,
} from "./web-vitals-attribution.ts"

const secret = "PRIVATE query /secret?query=hidden"
function getterEntry(overrides: Record<string, unknown> = {}) {
	const values = {
		name: "keydown",
		startTime: 100,
		duration: 208,
		processingStart: 120,
		processingEnd: 230,
		interactionId: 7,
		target: {
			tagName: "INPUT",
			closest: (selector: string) => (selector === ".start-bar" ? {} : null),
			get value() {
				throw new Error("Must never read input values")
			},
			get textContent() {
				throw new Error("Must never read text")
			},
			get id() {
				throw new Error("Must never read IDs")
			},
			get attributes() {
				throw new Error("Must never read attributes")
			},
		},
		...overrides,
	}
	// PerformanceEventTiming exposes getters on the prototype, not enumerable instance properties.
	const prototype = Object.create(null)
	for (const [key, value] of Object.entries(values))
		Object.defineProperty(prototype, key, { get: () => value })
	return Object.create(prototype) as object
}
const metric = (entries: unknown[], attribution?: unknown) => ({
	$web_vitals_INP_value: 208,
	$web_vitals_INP_event: {
		name: "INP",
		id: "metric-id",
		value: 208,
		entries,
		attribution,
	},
})

test("native getter fields survive the installed SDK copy only through the capture adapter", () => {
	const entry = getterEntry()
	const properties = metric([entry])
	assert.deepEqual(
		_copyAndTruncateStrings(properties, null).$web_vitals_INP_event.entries,
		[{}],
	)
	const options = { send_instantly: true }
	const receiver = { marker: "original receiver" }
	let calls = 0
	const capture: PostHog["capture"] = function (this: unknown, ...args) {
		calls++
		assert.equal(this, receiver)
		assert.equal(args[0], "$web_vitals")
		assert.equal(args[2], options)
		// This is the SDK's actual capture serialization seam, before before_send runs.
		return _copyAndTruncateStrings(
			{ uuid: "test-id", event: args[0], properties: args[1] ?? {} },
			null,
		)
	}
	const client = { capture }
	installWebVitalsAttribution(client)
	const once = client.capture
	installWebVitalsAttribution(client)
	assert.equal(client.capture, once)
	const sent = client.capture.call(receiver, "$web_vitals", properties, options)
	assert.equal(calls, 1, "there is no second metric capture")
	assert.ok(sent)
	assert.equal(sent.event, "$web_vitals")
	assert.deepEqual(
		sent.properties,
		metric([
			{
				name: "keydown",
				startTime: 100,
				duration: 208,
				processingStart: 120,
				processingEnd: 230,
				interactionId: 7,
				targetCategory: "start-search",
				inputDelay: 20,
				processingDuration: 110,
				presentationDelayEstimate: 78,
			},
		]),
	)
	assert.equal(properties.$web_vitals_INP_event.entries[0], entry)
	assert.deepEqual(
		Object.keys(entry),
		[],
		"the original native entry stays intact",
	)
})

test("only numerical library attribution survives; raw selectors, DOM, scripts and queries never leave", () => {
	const attribution = {
		inputDelay: 10,
		processingDuration: 120,
		presentationDelay: 78,
		interactionTime: 100,
		nextPaintTime: 308,
		interactionType: "keyboard",
		interactionTarget: secret,
		interactionTargetElement: { textContent: secret },
		processedEventEntries: [{ name: secret }],
		longAnimationFrameEntries: [{ scripts: [{ sourceURL: secret }] }],
	}
	const properties = metric([getterEntry()], attribution)
	const safe = serializeInpEntries(properties)
	assert.deepEqual(safe.$web_vitals_INP_event.attribution, {
		inputDelay: 10,
		processingDuration: 120,
		presentationDelay: 78,
		interactionTime: 100,
		nextPaintTime: 308,
		interactionType: "keyboard",
	})
	const json = JSON.stringify(redactSearchTelemetry(safe))
	assert.ok(!json.includes(secret))
	assert.ok(!json.includes("interactionTarget"))
	assert.ok(!json.includes("sourceURL"))
	assert.equal(properties.$web_vitals_INP_event.attribution, attribution)
})

test("unrelated events and options pass through by identity and capture return values stay intact", () => {
	const properties = { value: secret }
	const result = { uuid: "test-id", event: "$pageview", properties: {} }
	const options = {}
	const capture: PostHog["capture"] = (...args) => {
		assert.deepEqual(args, ["$pageview", properties, options])
		assert.equal(args[1], properties)
		return result
	}
	const client = { capture }
	installWebVitalsAttribution(client)
	assert.equal(client.capture("$pageview", properties, options), result)
	assert.equal(serializeInpEntries(properties), properties)
})

test("odd timing entries are omitted, negative rounded presentation estimates clamp, categories stay allowlisted", () => {
	const safe = serializeInpEntries(
		metric([
			getterEntry({ duration: 120 }),
			getterEntry({ processingEnd: 110 }),
			getterEntry({ duration: Number.NaN }),
			getterEntry({ target: { tagName: "BUTTON", closest: () => null } }),
			getterEntry({
				name: secret,
				target: { tagName: secret, closest: () => null },
			}),
			getterEntry({ target: null }),
			{},
			null,
		]),
	)
	const entries = safe.$web_vitals_INP_event.entries as Record<
		string,
		unknown
	>[]
	assert.equal(entries.length, 4)
	assert.equal(entries[0].presentationDelayEstimate, 0)
	assert.deepEqual(
		entries.map((entry) => entry.targetCategory),
		["start-search", "button", "other", "unknown"],
	)
	assert.equal(entries[2].name, "other")
	const broken = Object.create(null, {
		startTime: {
			get() {
				throw new Error("unavailable")
			},
		},
	})
	assert.deepEqual(
		serializeInpEntries(metric([broken])).$web_vitals_INP_event.entries,
		[],
	)
	assert.equal(
		serializeInpEntries(
			metric(Array.from({ length: 100 }, () => getterEntry())),
		).$web_vitals_INP_event.entries.length,
		20,
	)
})
