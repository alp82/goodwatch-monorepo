import assert from "node:assert/strict"
import { Window } from "happy-dom"
import type { StartBrowseData } from "./browse-data"
const browser = new Window({ url: "https://goodwatch.app/" })
// Touch interactions open a peek before following a genre link.
browser.matchMedia = ((media: string) => ({
	matches: false,
	media,
})) as typeof browser.matchMedia
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"requestAnimationFrame",
	"cancelAnimationFrame",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		value: browser[key as keyof Window],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { MemoryRouter } = await import("react-router-dom")
const { StartBrowse } = await import("./StartBrowse")
const { EMPTY_BROWSE } = await import("./browse-data")
let reads = 0
const data: StartBrowseData = {
	...EMPTY_BROWSE,
	get top() {
		reads++
		return EMPTY_BROWSE.top
	},
	genres: {
		movie: [{ name: "Drama", path: "drama", titles: [] }],
		show: [{ name: "Crime", path: "crime", titles: [] }],
	},
}
const host = document.createElement("div")
document.body.append(host)
const root = createRoot(host)
const draw = (browse: StartBrowseData, tick: number) =>
	act(async () =>
		root.render(
			<MemoryRouter>
				<div data-parent-tick={tick}>
					<StartBrowse data={browse} />
				</div>
			</MemoryRouter>,
		),
	)
try {
	await draw(data, 0)
	const initialReads = reads
	assert.ok(initialReads > 0)
	await draw(data, 1)
	await draw(data, 2)
	assert.equal(
		reads,
		initialReads,
		"parent updates don't render unchanged Browse",
	)
	const crime = host.querySelector<HTMLAnchorElement>(
		'a[href="/shows/genres/crime"]',
	)
	assert.ok(crime)
	await act(async () => crime.click())
	assert.ok(
		crime.hasAttribute("data-on"),
		"Browse's own genre control still updates",
	)
	assert.equal(host.querySelector("#sb-peek")?.textContent, "Open Crime →")
	await draw(
		{
			...data,
			genres: {
				movie: [{ name: "Comedy", path: "comedy", titles: [] }],
				show: [],
			},
		},
		3,
	)
	assert.ok(
		host.querySelector('a[href="/movies/genres/comedy"]'),
		"fresh browse data renders",
	)
	assert.equal(host.querySelector('a[href="/movies/genres/drama"]'), null)
	await act(async () => root.unmount())
	console.log("__BROWSE_INTERACTION_PASSED__")
} finally {
	await browser.happyDOM.close()
}
