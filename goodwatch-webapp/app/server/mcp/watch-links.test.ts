import assert from "node:assert/strict"
import { test } from "node:test"
import type {
	AvailabilityOffer,
	Watchability,
} from "../../utils/availability-evidence.ts"
import { linkedAvailability } from "./watch-links.ts"

const title = { media_type: "show" as const, tmdb_id: 1399 }
const offer: AvailabilityOffer = {
	service_id: 8,
	offer_type: "flatrate",
	snapshot_id: "web",
	source: "tmdb_web",
	checked_at: 1792230000000,
	stream_url: null,
}
const availability: Watchability = {
	state: "watchable",
	reason: "verified_offer",
	evaluatedAt: 1792230000000,
	expiresAt: 1792240000000,
	offers: [offer],
}
const names = new Map([[8, "Netflix"]])
test("verified own-service offers use the same direct URL and provider name as the site", () => {
	const direct = linkedAvailability(availability, title, "DE", names, [
		{
			service_id: 8,
			offer_type: "flatrate",
			stream_url: "https://www.netflix.com/title/123",
		},
	])
	assert.equal(direct.country, "DE")
	assert.equal(direct.offers[0].name, "Netflix")
	assert.equal(direct.offers[0].url, "https://www.netflix.com/title/123")
	assert.equal(direct.offers[0].link_kind, "provider")
	assert.equal(
		direct.offers[0].stream_link,
		"[Netflix](https://www.netflix.com/title/123)",
	)
	const evidence = linkedAvailability(
		{
			...availability,
			offers: [
				{ ...offer, stream_url: "https://www.netflix.com/title/evidence" },
			],
		},
		title,
		"DE",
		names,
		[],
	)
	assert.equal(evidence.offers[0].url, "https://www.netflix.com/title/evidence")
})
test("missing/unsafe links fall back to the country-specific site destination, without inventing playback", () => {
	for (const stream_url of [null, "javascript:alert(1)"]) {
		const result = linkedAvailability(
			{ ...availability, offers: [{ ...offer, stream_url }] },
			title,
			"DE",
			names,
			[
				{
					service_id: 9,
					offer_type: "flatrate",
					stream_url: "https://example.com/unowned",
				},
			],
		)
		assert.equal(
			result.offers[0].url,
			"https://www.themoviedb.org/tv/1399/watch?locale=DE",
		)
		assert.equal(result.offers[0].link_kind, "where_to_watch")
	}
	const unknown = linkedAvailability(
		{ ...availability, state: "unknown", offers: [] },
		title,
		"DE",
		names,
		[
			{
				service_id: 8,
				offer_type: "flatrate",
				stream_url: "https://www.netflix.com/title/123",
			},
		],
	)
	assert.deepEqual(unknown.offers, [])
	assert.equal(unknown.state, "unknown")
})

test("provider aliases resolve to the site's brand and duplicate evidence stays compact", () => {
	const result = linkedAvailability(
		{
			...availability,
			offers: [
				{ ...offer, service_id: 119 },
				{ ...offer, service_id: 9 },
			],
		},
		title,
		"DE",
		new Map([[9, "Amazon Prime Video"]]),
		[
			{
				service_id: 9,
				offer_type: "flatrate",
				stream_url: "https://www.primevideo.com/detail/123",
			},
		],
	)
	assert.equal(result.offers.length, 1)
	assert.equal(result.offers[0].name, "Amazon Prime Video")
	assert.equal(result.offers[0].url, "https://www.primevideo.com/detail/123")
})

test("provider markdown escapes labels and destinations, including unnamed-provider fallback", () => {
	const result = linkedAvailability(
		availability,
		title,
		"DE",
		new Map([[8, "Stream [Plus]\\"]]),
		[
			{
				service_id: 8,
				offer_type: "flatrate",
				stream_url: "https://example.com/watch/(123)",
			},
		],
	)
	assert.equal(
		result.offers[0].stream_link,
		"[Stream \\[Plus\\]\\\\](https://example.com/watch/%28123%29)",
	)
	const fallback = linkedAvailability(availability, title, "DE", new Map(), [])
	assert.equal(
		fallback.offers[0].stream_link,
		"[Service 8](https://www.themoviedb.org/tv/1399/watch?locale=DE)",
	)
})
test("offers carry the provider's TMDB logo for the poster cards when it is known", () => {
	const withLogo = linkedAvailability(
		availability,
		title,
		"DE",
		names,
		[],
		new Map([[8, "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg"]]),
	)
	assert.equal(
		withLogo.offers[0].logo_url,
		"https://image.tmdb.org/t/p/w92/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
	)
	const without = linkedAvailability(availability, title, "DE", names, [])
	assert.equal("logo_url" in without.offers[0], false)
})

test("linked offers use country popularity without changing the offer shape", () => {
	const evidence: Watchability = {
		...availability,
		offers: [
			{ ...offer, service_id: 9 },
			{ ...offer, service_id: 9999 },
			{ ...offer, service_id: 337 },
			{ ...offer, service_id: 11 },
			{ ...offer, service_id: 119, offer_type: "ads" },
			{ ...offer, service_id: 9998 },
		],
	}
	const linked = (ranks: ReadonlyMap<number, number>) =>
		linkedAvailability(evidence, title, "DE", names, [], new Map(), ranks)
	assert.deepEqual(
		linked(
			new Map([
				[9, 3],
				[337, 1],
				[11, 1],
			]),
		).offers.map((o) => o.service_id),
		[337, 11, 9, 119, 9999, 9998],
	)
	assert.deepEqual(
		linked(new Map([[9, 0]])).offers.map((o) => o.service_id),
		[9, 119, 9999, 337, 11, 9998],
	)
	assert.deepEqual(
		linked(new Map()).offers.map((o) => o.service_id),
		evidence.offers.map((o) => o.service_id),
	)
	for (const item of linked(new Map([[9, 0]])).offers)
		assert.equal("display_priority" in item, false)
})
