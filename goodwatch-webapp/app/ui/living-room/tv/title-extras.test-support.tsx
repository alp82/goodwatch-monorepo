import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"
import { matrix } from "~/ui/details/fingerprint/titles.test-support"
import { composeHeadline, segmentText } from "~/ui/details/fingerprint/headline"
import { SCALE_GROUPS, readScale } from "~/ui/details/fingerprint/scales"
import { directOffers, primaryOffer } from "./title-extras"
import { TvViewProvider } from "./kit"
import TitlePanel from "./screens/TitlePanel"
import Title from "./screens/Title"
import { readTvState, transition, tvItems, writeTvParams } from "./tv-machine"
import { tvContextOf } from "./tv-home"

const ctx = tvContextOf(
	{
		member: false,
		startTitles: [],
		picture: null,
		tonight: [],
		shows: null,
		services: [],
	},
	null,
)
const state = readTvState(
	new URLSearchParams("tv=title&title=movie-603"),
	ctx,
	1,
)
for (const panel of ["fingerprint", "trailer"] as const) {
	const opened = transition(state, { type: "choose", item: panel }, ctx)
	assert.equal(opened.history, "push")
	assert.deepEqual(opened.effects, [])
	assert.deepEqual(
		readTvState(writeTvParams(opened.state.screen, new URLSearchParams()), ctx)
			.screen,
		opened.state.screen,
	)
	assert.equal(transition(opened.state, { type: "back" }, ctx).history, "back")
	const linked = readTvState(
		new URLSearchParams(`tv=title&title=movie-603&panel=${panel}`),
		ctx,
	)
	const closed = transition(linked, { type: "choose", item: "close" }, ctx)
	assert.equal(closed.history, "replace")
	assert.equal(closed.state.focus, panel)
	assert.deepEqual(closed.state.screen, { name: "title", title: "movie-603" })
}

const offer = {
	id: 8,
	name: "Netflix",
	url: "https://www.netflix.com/title/60004480",
	type: "flatrate",
}
const rent = { ...offer, id: 2, type: "rent" }
assert.equal(primaryOffer([rent], [{ id: 2 }]), null)
assert.equal(primaryOffer([{ ...offer, id: 9 }, offer], [{ id: 8 }]), offer)
assert.equal(primaryOffer([{ ...offer, type: "ads" }], [])?.type, "ads")
const details = {
	streaming_services: [
		{ tmdb_id: 8, name: "Netflix", logo: "", order_default: 0 },
	],
	streaming_availabilities: [
		"",
		"javascript:alert(1)",
		"/invented",
		offer.url,
	].map((stream_url) => ({
		streaming_service_id: 8,
		streaming_type: "flatrate" as const,
		stream_url,
		tmdb_link: "",
		price_dollar: 0,
		quality: "HD",
	})),
}
assert.deepEqual(directOffers(details), [offer])

const title = {
	key: "movie-603",
	title: { title: "The Matrix", media_type: "movie" as const, tmdb_id: 603 },
	missing: false,
	mine: [],
	want: false,
	seen: false,
	score: null,
	extras: {
		country: "DE",
		offers: [offer],
		trailer: null,
		fingerprint: matrix,
	},
}
const canvas = { edition: "desktop" as const, w: 1200, h: 648, scale: 1 }
const wrap = (children: React.ReactNode) =>
	renderToStaticMarkup(
		<TvViewProvider value={{ canvas, focused: "close", dispatch: () => {} }}>
			{children}
		</TvViewProvider>,
	)
const html = wrap(<Title title={title} items={tvItems(state.screen, ctx)} />)
assert.match(
	html,
	/<a href="https:\/\/www.netflix.com\/title\/60004480" target="_blank" rel="noreferrer"/,
)
assert.match(html, /data-product-event="streaming service clicked"/)
assert.match(html, /data-country="DE"/)
assert.match(html, /data-offer-type="flatrate"/)
assert.match(html, /Watch on Netflix/)

const fingerprint = wrap(
	<TitlePanel title={{ ...title, panel: "fingerprint" }} items={["close"]} />,
)
assert.ok(!/role="slider"|type="range"/.test(fingerprint))
const text = fingerprint.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'")
assert.ok(text.includes(segmentText(composeHeadline(matrix))))
for (const group of SCALE_GROUPS)
	for (const sc of group.scales)
		assert.ok(text.includes(readScale(sc, matrix).word), sc.name)
for (const area of ["Energy", "Heart", "Humor", "World", "Craft", "Style"])
	assert.ok(text.includes(area))

// A phone must remain readable even if malformed state reaches it without the URL parser.
const phonePanel = (group: number | undefined) => renderToStaticMarkup(
	<TvViewProvider value={{ canvas: { edition: "phone", w: 390, h: 600, scale: 1 }, focused: "close", dispatch: () => {} }}>
		<TitlePanel title={{ ...title, panel: "fingerprint", group }} items={["close", "group:-1", "group:0", "group:1", "group:2"]} />
	</TvViewProvider>,
)
for (const group of [undefined, -1, 0.5, -0.5, Number.NaN, Infinity, -2, 3, 99]) {
	const rendered = phonePanel(group)
	assert.match(rendered, /data-tv-item="group:-1"[^>]*aria-pressed="true"/)
	assert.ok(rendered.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").includes(segmentText(composeHeadline(matrix))))
	assert.ok(!rendered.includes("<dl"))
}
for (const group of [0, 1, 2]) {
	const rendered = phonePanel(group)
	assert.match(rendered, new RegExp(`data-tv-item="group:${group}"[^>]*aria-pressed="true"`))
	assert.ok(rendered.includes(`aria-label="${SCALE_GROUPS[group].name}"`))
	for (const sc of SCALE_GROUPS[group].scales)
		assert.ok(rendered.includes(readScale(sc, matrix).word), sc.name)
}
