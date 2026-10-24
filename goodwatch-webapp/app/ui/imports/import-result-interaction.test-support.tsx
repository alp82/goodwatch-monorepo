// The Done step in happy-dom: a signed-in member, the real query and mutation hooks, and a stand-in network that
// answers the item API's pages and the list writers. Prints what was sent and what the screen said.
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
/** Titles a long lists_cleared section took off Want to See, and the page offsets the stand-in server fails. */
const CLEARED_TOTAL = 175
const clearedRow = (i: number) => ({
	key: `movie:${5000 + i}`,
	title: {
		tmdbId: 5000 + i,
		mediaType: "movie",
		title: `Cleared ${i}`,
		year: 2020,
		posterPath: null,
	},
	changes: [
		{
			type: "list-cleared",
			list: "want_to_see",
			because: "watched",
			undoRestores: false,
		},
	],
})
const failing = new Set<number>()
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	const url = String(input)
	sent.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
	if (url.includes("section=lists_cleared")) {
		const params = new URL(url, "https://goodwatch.app").searchParams
		const offset = Number(params.get("offset"))
		const limit = Number(params.get("limit"))
		if (failing.has(offset))
			return new Response(JSON.stringify({ error: "The server is busy." }), {
				status: 503,
				headers: { "Content-Type": "application/json" },
			})
		const rows = Array.from(
			{ length: Math.max(0, Math.min(limit, CLEARED_TOTAL - offset)) },
			(_, i) => clearedRow(offset + i),
		)
		return new Response(JSON.stringify({ rows, total: CLEARED_TOTAL }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}
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
const { ImportDone } = await import("./ImportDone")
const { ANSWER_LOCK_MS } = await import("./ImportFlowParts")

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
const doneResult = groupImportResult("import", [
	{
		key: "movie:1",
		title: title(1, "One"),
		change: { type: "rating-added", score: 8 },
	},
	{
		key: "movie:3",
		title: title(3, "Three"),
		change: { type: "rating-replaced", from: 5, to: 7 },
	},
	{
		key: "movie:4",
		title: title(4, "Four"),
		change: { type: "list-added", list: "want_to_see" },
	},
	{
		key: "movie:5",
		title: title(5, "Five"),
		change: {
			type: "list-cleared",
			list: "want_to_see",
			because: "watched",
			undoRestores: false,
		},
	},
	{
		key: "movie:6",
		title: title(6, "Six"),
		change: {
			type: "list-cleared",
			list: "not_interested",
			because: "want",
			undoRestores: false,
		},
	},
	{
		key: "movie:7",
		title: title(7, "Seven"),
		change: {
			type: "kept",
			kind: "rating",
			reason: "Already the same in GoodWatch.",
		},
	},
	{
		key: "row:20",
		title: null,
		change: {
			type: "skipped",
			kind: "rating",
			label: "Lost (1999)",
			row: 21,
			reason: "Not found.",
		},
	},
	{
		key: "row:21",
		title: null,
		change: {
			type: "skipped",
			kind: "rating",
			label: "Gone (2001)",
			row: 22,
			reason: "Not found.",
		},
	},
])
client.setQueryData(
	["import-result", "/api/imports", "done-id", "done"],
	doneResult,
)
client.setQueryData(
	["import-result", "/api/imports", "plain-id", "done"],
	doneResult,
)
// The member already marked Anora Not interested again, in another tab.
client.setQueryData(getQueryKeyUserData(user.id), {
	scores: {
		"movie-1": { score: 8, review: null, updatedAt: new Date() },
		"movie-3": { score: 7, review: null, updatedAt: new Date() },
		"movie-9": { score: 6, review: null, updatedAt: new Date() },
	},
	wishlist: { "movie-4": { createdAt: new Date(), updatedAt: new Date() } },
	watchState: {},
	favorites: {},
	skipped: {},
	notInterested: { "movie-1064213": { updatedAt: new Date() } },
})

const container = document.createElement("div")
document.body.appendChild(container)
const root = createRoot(container as unknown as Element)
const wrap = (child: unknown) =>
	h(
		AuthContext.Provider,
		{
			value: {
				user,
				loading: false,
				getSupabase: () => Promise.reject(new Error("none")),
			} as never,
		},
		h(QueryClientProvider, { client }, h(MemoryRouter, null, child as never)),
	)
const render = (id: string, status: string, canUndo = true) =>
	act(async () =>
		root.render(
			wrap(
				h(ImportDone, {
					key: `${id}:${status}:${canUndo}`,
					api: "/api/imports",
					summary: { id, status, canUndo },
					source: "Trakt",
					posters: [],
					focus: false,
					openedHere: true,
					undo: { pending: false, error: null, run: () => {} },
					undoQuestion: "Undo this import?",
					onUploadAnother: () => {},
					skippedUrl: `/api/imports/${id}/skipped`,
					notes: ["Trakt", ""],
				}),
			),
		),
	)
const text = () => (container.textContent ?? "").replace(/\s+/g, " ")
const button = (label: string) =>
	[...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes(label),
	) as unknown as HTMLButtonElement | undefined
const settle = (ms = 20) =>
	act(async () => new Promise((resolve) => setTimeout(resolve, ms)))

await render("done-id", "done")
await settle()
const answers = () =>
	[...container.querySelectorAll("[data-cleared-question] [data-answer]")].map(
		(b) => ({
			text: (b.textContent ?? "").trim(),
			pressed: b.getAttribute("aria-pressed"),
			suggested: b.hasAttribute("data-suggested"),
		}),
	)
const done = {
	heading: container.querySelector("h2")?.textContent ?? "",
	tiles: [...container.querySelectorAll("[data-tile]")].map((li) => ({
		tile: li.getAttribute("data-tile") ?? "",
		text: (li.textContent ?? "").trim(),
		added: li.querySelector("[data-marker=added]")?.textContent ?? null,
		removed: li.querySelector("[data-marker=removed]")?.textContent ?? null,
	})),
	text: text(),
	answers: answers(),
	undo: !!button("Undo this import"),
	lockedPressed: [] as string[],
	afterPutAll: "",
	putAllSent: [] as { url: string; body: unknown }[],
	noUndo: false,
}
const before = sent.length
await act(async () => button("Yes, put them back")?.click())
done.lockedPressed = answers().map((answer) => answer.pressed ?? "")
await settle(ANSWER_LOCK_MS + 100)
await settle()
done.putAllSent = sent
	.slice(before)
	.filter((call) => call.url.startsWith("/api/update-"))
done.afterPutAll = text()
await render("plain-id", "done", false)
await settle()
done.noUndo = !button("Undo this import")

await render("undo-id", "undone", false)
await settle()
const undoneText = text()
const buttons = [...container.querySelectorAll("button")].map(
	(b) => b.textContent ?? "",
)
await act(async () => button("Add back to Want to See")?.click())
await settle()
const afterPutBack = text()

await render("kept-id", "done")
await settle()
await act(async () => button("Every change, title by title")?.click())
await act(async () => button("Show all 26")?.click())
await settle()
const afterMore = text()

// A long lists_cleared section whose extra pages fail: loading stops, the question says so, and Try again resumes.
const clearedPages: Record<string, unknown> = {}
for (const [name, failAt] of [
	["first", 25],
	["second", 125],
] as const) {
	failing.clear()
	failing.add(failAt)
	const id = `cleared-${name}`
	client.setQueryData(["import-result", "/api/imports", id, "done"], {
		operation: "import",
		titles: CLEARED_TOTAL,
		sections: [
			{
				key: "lists_cleared",
				count: CLEARED_TOTAL,
				total: CLEARED_TOTAL,
				rows: Array.from({ length: IMPORT_RESULT_FIRST_ROWS }, (_, i) =>
					clearedRow(i),
				),
			},
		],
	})
	const pageCalls = () =>
		sent.filter(
			(call) =>
				call.url.includes(`/${id}/`) &&
				call.url.includes("section=lists_cleared"),
		).length
	await render(id, "done")
	for (let i = 0; i < 5; i++) await settle(30)
	const failed = {
		calls: pageCalls(),
		text: text(),
		live: !!container.querySelector("[data-cleared-load][aria-live]"),
		disabled: !!container.querySelector(
			"[data-cleared-question] fieldset[disabled]",
		),
	}
	failing.clear()
	await act(async () => button("Try again")?.click())
	for (let i = 0; i < 5; i++) await settle(30)
	clearedPages[name] = {
		failed,
		after: {
			calls: pageCalls(),
			text: text(),
			disabled: !!container.querySelector(
				"[data-cleared-question] fieldset[disabled]",
			),
		},
	}
}

const { SourceImportCurrent } = await import("./SourceImportCurrent")
const { sourceImportKeys } = await import("./SourceImportHooks")
const plexPrompts: string[] = []
for (const watches of [1, 0]) {
	client.setQueryData(sourceImportKeys.detail("plex-id"), {
		import: {
			id: "plex-id",
			source: "plex",
			fileName: "Plex",
			status: "done",
			createdAt: "2026-10-24T00:00:00Z",
			finishedAt: "2026-10-24T00:00:00Z",
			counts: {
				new: 1,
				unchanged: 0,
				conflict: 0,
				unmatched: 0,
				unsupported: 0,
				invalid: 0,
				rows: 1,
			},
			kinds: {
				rating: 0,
				watch: watches,
				want: 1,
				favorite: 0,
				review: 0,
				show_status: 0,
			},
			warnings: [],
			options: null,
			processed: 1,
			total: 1,
			applied: { added: 1, updated: 0, kept: 0, failed: 0 },
			stalled: false,
			canUndo: true,
			error: null,
		},
	})
	client.setQueryData(
		["import-result", "/api/imports", "plex-id", "done"],
		groupImportResult("import", []),
	)
	await act(async () =>
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
						h(SourceImportCurrent, {
							key: `plex-${watches}`,
							id: "plex-id",
							focus: false,
							onUploadAnother: () => {},
						}),
					),
				),
			),
		),
	)
	await settle()
	await act(async () => button("Undo this import")?.click())
	plexPrompts.push(text())
}

await act(async () => root.unmount())
process.stdout.write(
	`__IMPORT_RESULT_INTERACTION__${JSON.stringify({ sent, undone: undoneText, buttons, afterPutBack, afterMore, plexPrompts, done, clearedPages })}`,
)
process.exit(0)
