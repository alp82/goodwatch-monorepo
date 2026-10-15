// The Imports page in happy-dom: the real page, query hooks and file recognition, with a stand-in network that
// answers the import APIs. Each scenario renders a fresh page, acts like a member, and records what was sent and
// what the screen said.
import { Window } from "happy-dom"

const window = new Window({ url: "https://goodwatch.app/settings/imports" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLInputElement",
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

import type { ImdbImportSummary } from "~/domain/imdb-import"
import type { ImportSource, ImportSummary } from "~/domain/imports"
import { zipFixture } from "../../server/imports/zip-fixture.test-support"

const PREVIEW_ID = "00000000-0000-4000-8000-0000000000aa"
const summary = (
	source: ImportSource,
	status: ImportSummary["status"],
	finishedAt: string | null,
	id = `00000000-0000-4000-8000-0000000000${source.length}${status.length}`,
): ImportSummary => ({
	id,
	source,
	fileName: `${source}-export`,
	status,
	createdAt: finishedAt ?? "2026-10-15T12:00:00.000Z",
	finishedAt,
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
		rating: 1,
		watch: 0,
		want: 0,
		favorite: 0,
		review: 0,
		show_status: 0,
	},
	warnings: [],
	options: null,
	processed: 0,
	total: 1,
	applied: { added: 1, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: status === "done",
	error: null,
})
const imdbSummary = (
	status: ImdbImportSummary["status"],
	finishedAt: string | null,
	id = "00000000-0000-4000-8000-0000000000bb",
): ImdbImportSummary => ({
	id,
	status,
	fileName: "ratings.csv",
	createdAt: finishedAt ?? "2026-10-15T12:00:00.000Z",
	finishedAt,
	counts: {
		rows: 1,
		new: 1,
		update: 0,
		unchanged: 0,
		conflict: 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
	},
	conflictChoice: null,
	processed: 0,
	total: 1,
	applied: { added: 1, updated: 0, kept: 0, failed: 0 },
	withoutFingerprint: null,
	stalled: false,
	canUndo: status === "done",
	error: null,
})

type Sent = { url: string; body: unknown }
let sent: Sent[] = []
const json = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	})
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	const url = String(input)
	const body =
		init?.body instanceof FormData
			? Object.fromEntries(
					[...init.body.entries()].map(([key, value]) => [
						key,
						typeof value === "string" ? value : `file:${value.name}`,
					]),
				)
			: init?.body
				? JSON.parse(String(init.body))
				: null
	sent.push({ url, body })
	if (url === "/api/imports/preview") {
		const source = (body as { source: ImportSource }).source
		return json({ import: summary(source, "preview", null, PREVIEW_ID) })
	}
	if (url === "/api/imdb-import/preview")
		return json({ import: imdbSummary("preview", null, PREVIEW_ID) })
	if (url.includes("/items")) return json({ items: [], total: 0 })
	if (url === "/api/imports" || url === "/api/imdb-import")
		return json({ imports: [] })
	return json({ error: "not stubbed" })
}) as typeof fetch

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { MemoryRouter } = await import("react-router-dom")
const { ImportSourcesPage } = await import("./ImportSourcesPage")

type PageProps = Parameters<typeof ImportSourcesPage>[0]
const settle = () =>
	act(async () => new Promise((resolve) => setTimeout(resolve, 30)))

async function page(props: Partial<PageProps> = {}) {
	sent = []
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	})
	const container = document.createElement("div")
	document.body.appendChild(container)
	const root = createRoot(container as unknown as Element)
	await act(async () =>
		root.render(
			h(
				QueryClientProvider,
				{ client },
				h(
					MemoryRouter,
					null,
					h(ImportSourcesPage, {
						imdbImports: [],
						sourceImports: [],
						...props,
					}),
				),
			),
		),
	)
	await settle()
	const buttons = () =>
		[...container.querySelectorAll("button")] as unknown as HTMLButtonElement[]
	return {
		text: () => (container.textContent ?? "").replace(/\s+/g, " "),
		rows: () =>
			buttons()
				.filter((button) => button.hasAttribute("aria-expanded"))
				.map((button) => ({
					name: button.querySelector("[data-source-name]")?.textContent ?? "",
					label:
						button.querySelector("[data-source-label]")?.textContent ?? null,
					open: button.getAttribute("aria-expanded") === "true",
				})),
		click: async (label: string) => {
			const button = buttons().find((b) => b.textContent?.includes(label))
			if (!button) throw new Error(`No button "${label}"`)
			await act(async () => button.click())
			await settle()
		},
		search: async (query: string) => {
			const input = container.querySelector(
				'input[type="search"]',
			) as unknown as HTMLInputElement
			const setValue = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				"value",
			)?.set
			await act(async () => {
				setValue?.call(input, query)
				input.dispatchEvent(
					new window.Event("input", { bubbles: true }) as unknown as Event,
				)
			})
			await settle()
		},
		/** Chooses a file in the file input whose label holds `label`. */
		choose: async (label: string, file: File) => {
			const input = [...container.querySelectorAll('input[type="file"]')].find(
				(element) => element.getAttribute("aria-label")?.includes(label),
			) as unknown as HTMLInputElement | undefined
			if (!input) throw new Error(`No file input "${label}"`)
			Object.defineProperty(input, "files", {
				configurable: true,
				value: [file],
			})
			await act(async () => {
				input.dispatchEvent(
					new window.Event("change", { bubbles: true }) as unknown as Event,
				)
			})
			// Recognition reads the file, then the upload and the preview follow.
			for (let i = 0; i < 5; i++) await settle()
		},
		unmount: () => act(async () => root.unmount()),
	}
}

const traktZip = () =>
	new File(
		[
			zipFixture({
				"watched-history-1.json": "[]",
				"ratings-movies.json": "[]",
			}),
		],
		"trakt-export-alp82.zip",
		{ type: "application/zip" },
	)

const results: Record<string, unknown> = {}

{
	const view = await page({
		imdbImports: [imdbSummary("done", "2026-10-02T12:00:00.000Z")],
		sourceImports: [
			summary("letterboxd", "done", "2026-10-11T12:00:00.000Z"),
			summary("trakt", "undone", "2026-10-11T12:00:00.000Z"),
		],
	})
	results.list = { rows: view.rows(), text: view.text() }
	await view.unmount()
}

{
	const view = await page()
	await view.search("TV Time")
	results.tvTime = { rows: view.rows(), text: view.text() }
	await view.click("Open the Trakt import")
	results.tvTimeOpened = { rows: view.rows(), text: view.text() }
	await view.search("Plex")
	results.noMatch = { rows: view.rows(), text: view.text() }
	await view.unmount()
}

{
	const view = await page()
	await view.choose("any source", traktZip())
	results.oneBoxTrakt = {
		rows: view.rows(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}
{
	const view = await page()
	await view.choose(
		"any source",
		new File(
			[
				"Const,Your Rating,Date Rated,Title,URL,Title Type,Year\ntt0133093,9,2024-01-01,The Matrix,https://www.imdb.com/title/tt0133093/,Movie,1999\n",
			],
			"ratings.csv",
			{ type: "text/csv" },
		),
	)
	results.oneBoxImdb = { rows: view.rows(), text: view.text(), sent: [...sent] }
	await view.unmount()
}

{
	const view = await page()
	await view.choose(
		"any source",
		new File(
			["Title,Date\nDark: Season 1,2024-01-01\n"],
			"NetflixViewingHistory.csv",
		),
	)
	results.oneBoxUnknown = {
		rows: view.rows(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

{
	const view = await page()
	await view.click("Letterboxd")
	await view.choose("Letterboxd", traktZip())
	results.caught = { rows: view.rows(), text: view.text(), sent: [...sent] }
	await view.click("Import it as Trakt")
	for (let i = 0; i < 5; i++) await settle()
	results.importedAs = { rows: view.rows(), text: view.text(), sent: [...sent] }
	await view.unmount()
}

{
	const view = await page()
	await view.choose(
		"any source",
		new File(
			[
				"movie_id,imdb_id,tmdb_id,rating,average_rating,title\n1,0114709,862,4.5,3.9,Toy Story (1995)\n",
			],
			"movielens-ratings.csv",
		),
	)
	results.oneBoxMovieLens = {
		rows: view.rows(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

process.stdout.write(`__IMPORTS_PAGE__${JSON.stringify(results)}`)
process.exit(0)
