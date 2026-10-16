import assert from "node:assert/strict"
import { test } from "node:test"
import { servicesNotice } from "./services-notice.ts"

const offeredInJapan = [
	{ id: 8, name: "Netflix" },
	{ id: 9, name: "Amazon Prime Video" },
]

test("no notice when every saved service streams in the country", () => {
	assert.equal(
		servicesNotice({
			saved: ["8", "9"],
			offered: offeredInJapan,
			countryName: "Japan",
		}),
		null,
	)
})

test("no notice without saved services", () => {
	assert.equal(
		servicesNotice({
			saved: [],
			offered: offeredInJapan,
			countryName: "Japan",
		}),
		null,
	)
})

test("a country that offers none of the saved services says the member has none there", () => {
	assert.deepEqual(
		servicesNotice({
			saved: ["337", "283"],
			offered: offeredInJapan,
			countryName: "Japan",
		}),
		{
			empty: true,
			missing: ["337", "283"],
			text: "None of your services stream in Japan, so On my services shows nothing. Pick the ones you have there.",
		},
	)
})

test("a country that lacks some saved services names how many", () => {
	assert.deepEqual(
		servicesNotice({
			saved: ["8", "337"],
			offered: offeredInJapan,
			countryName: "Japan",
		}),
		{
			empty: false,
			missing: ["337"],
			text: "1 of your services doesn't stream in Japan.",
		},
	)
	assert.equal(
		servicesNotice({
			saved: ["8", "337", "283"],
			offered: offeredInJapan,
			countryName: "Japan",
		})?.text,
		"2 of your services don't stream in Japan.",
	)
})
