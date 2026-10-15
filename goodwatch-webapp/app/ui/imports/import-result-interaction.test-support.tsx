// The result container in happy-dom: a signed-in member, the real query and mutation hooks, and a stand-in network
// that answers the item API's pages and the list writers. Prints what was sent and what the screen said.
import { Window } from "happy-dom"

const window = new Window({ url: "https://goodwatch.app/settings/imports" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"Event",
	"MouseEvent",
	"getComputedStyle",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const sent: { url: string; body: unknown }[] = []
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	const url = String(input)
	sent.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
	const page = url.includes("section=kept")
		? {
				rows: [
					{
						key: "movie:157336",
						title: {
							tmdbId: 157336,
							mediaType: "movie",
							title: "Interstellar",
							year: 2014,
							posterPath: null,
						},
						changes: [
							{
								type: "kept",
								kind: "watch",
								reason: "Already in your watch log.",
							},
						],
					},
				],
				total: 26,
			}
		: { status: "success" }
	return new Response(JSON.stringify(page), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	})
}) as typeof fetch

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { MemoryRouter } = await import("react-router-dom")
const { AuthContext } = await import("~/utils/auth")
const { getQueryKeyUserData } = await import("~/routes/api.user-data")
const { groupImportResult, IMPORT_RESULT_FIRST_ROWS } = await import(
	"~/domain/import-result"
)
const { ImportResult } = await import("./ImportResult")

const title = (tmdbId: number, name: string) => ({
	tmdbId,
	mediaType: "movie" as const,
	title: name,
	year: 2024,
	posterPath: null,
})
const dune = title(693134, "Dune: Part Two")
const anora = title(1064213, "Anora")
const undone = groupImportResult("undo", [
	{
		key: "movie:693134",
		title: dune,
		change: { type: "not-restored", list: "want_to_see" },
	},
	{
		key: "movie:1064213",
		title: anora,
		change: { type: "not-restored", list: "not_interested" },
	},
])
const kept = groupImportResult(
	"import",
	Array.from({ length: 26 }, (_, i) => ({
		key: `movie:${i + 1}`,
		title: title(i + 1, `Film ${i + 1}`),
		change: {
			type: "kept" as const,
			kind: "rating" as const,
			reason: "Already the same in GoodWatch.",
		},
	})),
)
const firstRows = (result: typeof kept) => ({
	...result,
	sections: result.sections.map((s) => ({
		...s,
		rows: s.rows.slice(0, IMPORT_RESULT_FIRST_ROWS),
	})),
})

const user = { id: "member" }
const client = new QueryClient({
	defaultOptions: {
		queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
	},
})
client.setQueryData(
	["import-result", "/api/imports", "undo-id", "undone"],
	undone,
)
client.setQueryData(
	["import-result", "/api/imports", "kept-id", "done"],
	firstRows(kept),
)
// The member already marked Anora Not interested again, in another tab.
client.setQueryData(getQueryKeyUserData(user.id), {
	scores: {},
	wishlist: {},
	watchState: {},
	favorites: {},
	skipped: {},
	notInterested: { "movie-1064213": { updatedAt: new Date() } },
})

const container = document.createElement("div")
document.body.appendChild(container)
const root = createRoot(container as unknown as Element)
const render = (id: string, status: string) =>
	act(async () =>
		root.render(
			h(
				AuthContext.Provider,
				{
					value: {
						user,
						loading: false,
						getSupabase: () => Promise.reject(new Error("none")),
					} as never,
				},
				h(
					QueryClientProvider,
					{ client },
					h(
						MemoryRouter,
						null,
						h(ImportResult, {
							api: "/api/imports",
							id,
							status,
							from: "ratings.csv",
							focus: false,
						}),
					),
				),
			),
		),
	)
const text = () => (container.textContent ?? "").replace(/\s+/g, " ")
const button = (label: string) =>
	[...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes(label),
	) as unknown as HTMLButtonElement | undefined
const settle = () =>
	act(async () => new Promise((resolve) => setTimeout(resolve, 20)))

await render("undo-id", "undone")
const buttons = [...container.querySelectorAll("button")].map(
	(b) => b.textContent,
)
await act(async () => button("Add back to Want to See")?.click())
await settle()
const afterPutBack = text()

await render("kept-id", "done")
await act(async () => button("Show all 26")?.click())
await settle()
const afterMore = text()

await act(async () => root.unmount())
process.stdout.write(
	`__IMPORT_RESULT_INTERACTION__${JSON.stringify({ sent, buttons, afterPutBack, afterMore })}`,
)
process.exit(0)
