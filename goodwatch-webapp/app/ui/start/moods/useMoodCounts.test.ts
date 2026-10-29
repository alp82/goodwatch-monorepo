// The mood counts in a browser-like DOM with fetch stubbed: a change of the guest's progress asks again (Discover leaves
// out what they have seen or hidden), an unrelated render asks for nothing, and an answer that arrives after the picks
// moved on is dropped.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../test-dom.ts"

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { useMoodCounts } = await import("./useMoodCounts.ts")
type Props = Parameters<typeof useMoodCounts>[0]
type Counts = ReturnType<typeof useMoodCounts>

type Asked = {
	url: string
	body: { guest: { interactions: unknown[] } } | null
	signal: AbortSignal
	answer: (total: number) => Promise<void>
}

function stubFetch(t: import("node:test").TestContext) {
	const asked: Asked[] = []
	t.mock.method(
		globalThis,
		"fetch",
		(url: string, init: RequestInit) =>
			new Promise<Response>((resolve) => {
				asked.push({
					url,
					body: init.body ? JSON.parse(String(init.body)) : null,
					signal: init.signal as AbortSignal,
					answer: (total) =>
						act(async () => {
							resolve({
								ok: true,
								status: 200,
								headers: new Headers(),
								json: async () => ({
									total,
									optionCounts: { moods: { funny: total } },
								}),
							} as Response)
							// The body's read and the query's update settle.
							for (let i = 0; i < 5; i++)
								await new Promise((r) => setTimeout(r, 0))
						}),
				})
			}),
	)
	return asked
}

function mount() {
	const client = new QueryClient({
		defaultOptions: { queries: { staleTime: 60_000 } },
	})
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	let seen: Counts = null
	function Probe(props: Props) {
		seen = useMoodCounts(props)
		return null
	}
	return {
		render: (props: Props) =>
			act(async () =>
				root.render(
					createElement(
						QueryClientProvider,
						{ client },
						createElement(Probe, props),
					),
				),
			),
		counts: () => seen,
		unmount: () => act(async () => root.unmount()),
	}
}

const guest = (n: number) => ({
	interactions: Array.from({ length: n }, (_, i) => ({
		tmdb_id: i + 1,
		media_type: "movie" as const,
		type: "dislike",
		timestamp: 1000 + i,
	})),
	country: "DE",
	services: null,
})
const props = (over: Partial<Props>): Props => ({
	picks: [],
	ranked: null,
	guest: guest(0) as Props["guest"],
	scope: "any",
	active: true,
	...over,
})

test("a change of the guest's progress asks again; a render with the same progress doesn't", async (t) => {
	const asked = stubFetch(t)
	const view = mount()
	await view.render(props({ guest: undefined }))
	assert.equal(asked.length, 0, "nothing until the guest's browser is read")
	await view.render(props({}))
	assert.equal(asked.length, 1)
	await asked[0].answer(40)
	assert.equal(view.counts()?.total, 40)
	// A new body with the same progress (useGuestBody makes one per render): no request.
	await view.render(props({}))
	assert.equal(asked.length, 1)
	// The guest hides a title: asked again with it, the old numbers kept meanwhile.
	await view.render(props({ guest: guest(1) as Props["guest"] }))
	assert.equal(asked.length, 2)
	assert.equal(asked[1].body?.guest.interactions.length, 1)
	assert.equal(view.counts()?.total, 40)
	await asked[1].answer(39)
	assert.equal(view.counts()?.total, 39)
	await view.unmount()
})

test("an answer for picks that moved on is dropped and its request cancelled", async (t) => {
	const asked = stubFetch(t)
	const view = mount()
	await view.render(props({}))
	await asked[0].answer(100)
	await view.render(props({ picks: ["m:funny"] }))
	await view.render(props({ picks: ["m:funny", "m:scary"] }))
	assert.equal(asked.length, 3)
	assert.match(asked[1].url, /moods=funny&/)
	assert.match(asked[2].url, /moods=funny%2Cscary/)
	assert.equal(asked[1].signal.aborted, true)
	await asked[2].answer(7)
	await asked[1].answer(50)
	assert.equal(view.counts()?.total, 7)
	// Taking the last pick back answers from the cache.
	await view.render(props({ picks: ["m:funny"] }))
	await view.render(props({ picks: [] }))
	assert.equal(view.counts()?.total, 100)
	await view.unmount()
})
