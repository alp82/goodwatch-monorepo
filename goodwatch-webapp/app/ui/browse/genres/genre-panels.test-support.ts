import assert from "node:assert/strict"
import { setTimeout as delay } from "node:timers/promises"
import { Window } from "happy-dom"
import type { AtlasData, AtlasGenre } from "~/server/browse/genres.server"

const window = new Window()
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = await import("react-dom/client")
const { act, createElement } = await import("react")
const { useGenrePanels } = await import("./use-genre-panels")
const panel = (slug: string): AtlasGenre => ({
	place: { family: "genre", slug, label: slug },
	short: null,
	plural: slug,
	n: 1,
	color: "",
	words: [],
	kinds: [],
	picks: [],
	titles: [],
})
const genres = ["comedy", "drama", "action"].map(panel)
const data: AtlasData = { genres, initial: genres[0], total: 3, copy: null }
let current: ReturnType<typeof useGenrePanels>
const view = () => current
function Harness({ data }: { data: AtlasData }) {
	current = useGenrePanels(data, "movie")
	return null
}

const requests: Array<{
	url: string
	signal: AbortSignal | null | undefined
	reply(response: Response): void
}> = []
globalThis.fetch = (url, init) =>
	new Promise((reply) => requests.push({ url: String(url), signal: init?.signal, reply }))
const root = createRoot(document.createElement("div"))
const render = (data: AtlasData) => act(() => root.render(createElement(Harness, { data })))
const select = (slug: string) => act(() => view().pick(slug))
const reply = (index: number, slug: string, status = 200) =>
	act(async () => {
		requests[index].reply(Response.json({ panel: panel(slug) }, { status }))
	})

await render(data)
assert.equal(view().panel?.place.slug, "comedy")
assert.equal(requests.length, 0)
view().intent("drama")
view().cancelIntent()
await delay(110)
assert.equal(requests.length, 0)
view().intent("drama")
await delay(110)
await select("drama")
assert.equal(requests.length, 1)
assert.equal(requests[0].url, "/api/browse/genre-panel/movies/drama")
await select("action")
assert.equal(requests[0].signal?.aborted, true)
await reply(0, "drama")
assert.equal(view().at, "action")
assert.equal(view().panel, undefined)
await reply(1, "action", 503)
assert.equal(view().failed, true)
await select("action")
await reply(2, "action")
assert.equal(view().failed, false)
await select("comedy")
await select("action")
assert.equal(view().panel?.place.slug, "action")
assert.equal(requests.length, 3)
await select("drama")
await render({ ...data })
assert.equal(requests[3].signal?.aborted, true)
await reply(3, "drama")
assert.equal(view().panel?.place.slug, "comedy")
await select("action")
assert.equal(requests.length, 5)
// Rolling deployments can return a full legacy loader result to the new client.
const legacy = { ...data }
Reflect.deleteProperty(legacy, "initial")
await render(legacy)
assert.equal(requests[4].signal?.aborted, true)
await select("drama")
assert.equal(view().panel?.place.slug, "drama")
assert.equal(requests.length, 5)
await act(() => root.unmount())
await window.happyDOM.close()
