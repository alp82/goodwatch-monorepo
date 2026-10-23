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
const MDBLIST_PREVIEW_ID = "00000000-0000-4000-8000-0000000000ab"
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
		conflict: source === "wishlist" ? 1 : 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
		rows: source === "wishlist" ? 2 : 1,
	},
	kinds: {
		rating: source === "wishlist" ? 0 : 1,
		watch: 0,
		want: source === "wishlist" ? 2 : 0,
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
	if (url.includes("/items?by=title"))
		return json({ operation: "apply", titles: 0, sections: [] })
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
const { MemoryRouter, RouterProvider, createMemoryRouter } = await import(
	"react-router-dom"
)
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
				// A data router, as in the app: the connect panels submit through a fetcher.
				h(RouterProvider, {
					router: createMemoryRouter([
						{
							path: "/",
							element: h(ImportSourcesPage, {
								imdbImports: [],
								sourceImports: [],
								...props,
							}),
						},
					]),
				}),
			),
		),
	)
	await settle()
	const buttons = () =>
		[...container.querySelectorAll("button")] as unknown as HTMLButtonElement[]
	return {
		text: () => (container.textContent ?? "").replace(/\s+/g, " "),
		/** The source open under the drop zone, if any. */
		opened: () =>
			container
				.querySelector("[data-open-source]")
				?.getAttribute("data-open-source") ?? null,
		/** The history's rows: each import's source and date. */
		history: () =>
			[...container.querySelectorAll("[data-import-history] li")].map((li) => ({
				name:
					li.querySelector(".font-semibold")?.firstChild?.textContent?.trim() ??
					"",
				date: li.querySelector("[data-import-date]")?.textContent ?? "",
				line: li.querySelector(".text-sm")?.textContent ?? "",
			})),
		/** Each mark in the logo row: the logo's file, or the letter tile's text. */
		marks: () =>
			buttons()
				.filter((button) => button.hasAttribute("aria-expanded"))
				.map((button) => {
					const name = button.getAttribute("aria-label") ?? ""
					const logo = button.querySelector("img")?.getAttribute("src")
					return logo
						? { name, logo: logo.split("/").at(-1)?.split("?")[0] }
						: { name, tile: button.textContent ?? "" }
				}),
		/** Opens a source from the logo row: its mark, then the pop-out's button. */
		open: async (name: string) => {
			const mark = buttons().find((b) => b.getAttribute("aria-label") === name)
			if (!mark) throw new Error(`No mark "${name}"`)
			await act(async () => mark.click())
			await settle()
			const go = buttons().find(
				(b) =>
					b.textContent === `Import from ${name}` ||
					b.textContent === `Connect ${name}`,
			)
			if (!go) throw new Error(`No pop-out button for "${name}"`)
			await act(async () => go.click())
			await settle()
		},
		/** Ticks the checkbox with this name. */
		tick: async (name: string) => {
			const input = container.querySelector(
				`input[name="${name}"]`,
			) as unknown as HTMLInputElement | null
			if (!input) throw new Error(`No checkbox "${name}"`)
			await act(async () => input.click())
			await settle()
		},
		/** Chooses the radio button whose label holds `label`. */
		pick: async (label: string) => {
			const input = [...container.querySelectorAll('input[type="radio"]')].find(
				(element) => element.closest("label")?.textContent?.includes(label),
			) as unknown as HTMLInputElement | undefined
			if (!input) throw new Error(`No radio "${label}"`)
			await act(async () => input.click())
			await settle()
		},
		click: async (label: string) => {
			const button = buttons().find((b) => b.textContent?.includes(label))
			if (!button) throw new Error(`No button "${label}"`)
			await act(async () => button.click())
			await settle()
		},
		/** Chooses a file in the file input whose label holds `label`. */
		choose: async (label: string, file: File) => {
			const input = [...container.querySelectorAll('input[type="file"]')].find(
				(element) =>
					element.getAttribute("aria-label")?.includes(label) ||
					element.closest("label")?.textContent?.includes(label),
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
		/** Drops a file anywhere on the page, as the page-wide drop takes it. */
		dropOnPage: async (file: File) => {
			const drop = new window.Event("drop", { bubbles: true, cancelable: true })
			Object.defineProperty(drop, "dataTransfer", {
				value: { types: ["Files"], files: [file] },
			})
			await act(async () => {
				window.dispatchEvent(drop)
			})
			for (let i = 0; i < 5; i++) await settle()
		},
		/** The opened source that holds keyboard focus, if any. */
		focused: () =>
			document.activeElement
				?.closest("[data-open-source]")
				?.getAttribute("data-open-source") ?? null,
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
	const { renderToStaticMarkup } = await import("react-dom/server")
	results.serverMarkup = renderToStaticMarkup(
		h(
			QueryClientProvider,
			{ client: new QueryClient() },
			h(
				MemoryRouter,
				null,
				h(ImportSourcesPage, {
					imdbImports: [],
					sourceImports: [
						summary("letterboxd", "done", "2026-10-11T23:30:00.000Z"),
					],
				}),
			),
		),
	)
}

{
	const view = await page({
		imdbImports: [imdbSummary("done", "2026-10-02T12:00:00.000Z")],
		sourceImports: [
			summary("letterboxd", "done", "2026-10-11T12:00:00.000Z"),
			summary("trakt", "undone", "2026-10-11T12:00:00.000Z"),
		],
	})
	results.list = {
		opened: view.opened(),
		history: view.history(),
		text: view.text(),
		marks: view.marks(),
	}
	await view.unmount()
}

{
	const view = await page()
	results.tvTime = { opened: view.opened(), text: view.text() }
	await view.click("Open the TV Time import")
	results.tvTimeOpened = { opened: view.opened(), text: view.text() }
	await view.click("Pick another source")
	await view.click("Open the Trakt import")
	results.tvTimeTrakt = { opened: view.opened(), text: view.text() }
	await view.unmount()
}

{
	const view = await page()
	await view.choose(
		"any source",
		new File(
			[
				zipFixture({
					"gdpr-data/tracking-prod-records-v2.csv": "key,s_id,ep_id\n",
					"gdpr-data/user.csv": "id\n",
				}),
			],
			"gdpr-data.zip",
			{ type: "application/zip" },
		),
	)
	results.oneBoxTvTime = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

{
	const view = await page()
	await view.choose("any source", traktZip())
	results.oneBoxTraktFocus = view.focused()
	results.oneBoxTrakt = {
		opened: view.opened(),
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
	results.oneBoxImdb = {
		opened: view.opened(),
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
			["Title,Date\nDark: Season 1,2024-01-01\n"],
			"NetflixViewingHistory.csv",
		),
	)
	results.oneBoxUnknown = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

{
	// A file both imports read: the source the member chose takes it.
	const view = await page()
	await view.open("Generic CSV")
	await view.choose(
		"Generic CSV",
		new File(
			[
				"title,tvdb_id,imdb_id,is_watched,watched_at,rating\nAlien,1,tt0078748,1,2024-01-01,8\n",
			],
			"mine.csv",
			{ type: "text/csv" },
		),
	)
	results.chosenGeneric = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

{
	const view = await page()
	await view.open("Letterboxd")
	await view.choose("Letterboxd", traktZip())
	results.caught = { opened: view.opened(), text: view.text(), sent: [...sent] }
	await view.click("Import it as Trakt")
	for (let i = 0; i < 5; i++) await settle()
	results.importedAs = {
		opened: view.opened(),
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
				"movie_id,imdb_id,tmdb_id,rating,average_rating,title\n1,0114709,862,4.5,3.9,Toy Story (1995)\n",
			],
			"movielens-ratings.csv",
		),
	)
	results.oneBoxMovieLens = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

const movielens = (wishlist: boolean) =>
	new File(
		[
			wishlist
				? "movie_id,imdb_id,tmdb_id,average_rating,title\n1,0114709,862,3.9,Toy Story (1995)\n"
				: "movie_id,imdb_id,tmdb_id,rating,average_rating,title\n1,0114709,862,4.5,3.9,Toy Story (1995)\n",
		],
		wishlist ? "movielens-wishlist.csv" : "movielens-ratings.csv",
	)

{
	const view = await page()
	await view.choose("any source", movielens(false))
	// MovieLens is open now, so the second file comes by the page-wide drop.
	await view.dropOnPage(movielens(true))
	results.movielensBoth = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.click("Preview import")
	for (let i = 0; i < 5; i++) await settle()
	results.movielensBothSent = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

{
	const view = await page()
	await view.open("MovieLens")
	await view.choose("MovieLens ratings CSV", movielens(true))
	results.movielensSwap = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.click("Use it as the wishlist")
	results.movielensSwapped = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.choose("MovieLens wishlist CSV", traktZip())
	results.movielensWishlistCaught = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

{
	const view = await page()
	await view.open("Trakt")
	await view.choose(
		"Trakt",
		new File(
			['<?xml version="1.0"?><myanimelist></myanimelist>'],
			"kitsu-alp82-anime.xml",
		),
	)
	results.kitsuCaught = {
		opened: view.opened(),
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
				JSON.stringify([
					{
						id: 1,
						status: "PLANNED",
						content: { id: 1, tmdbId: 862, title: "Synthetic", type: "movie" },
					},
				]),
			],
			"watcharr-export.json",
			{ type: "application/json" },
		),
	)
	results.oneBoxWatcharr = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.pick("Add it as Want to rewatch")
	await view.click("Add to Want to See")
	results.wishlistRewatch = {
		opened: view.opened(),
		text: view.text(),
		sent: [...sent],
	}
	await view.unmount()
}

{
	const done = summary("wishlist", "done", "2026-10-18T12:00:00.000Z")
	const view = await page({
		sourceImports: [done],
		initialSource: "wishlist",
		openImport: done.id,
	})
	await view.click("Undo import")
	results.wishlistUndo = { opened: view.opened(), text: view.text() }
	await view.unmount()
}

{
	const view = await page({
		initialSource: "plex",
		connectState: "00000000-0000-4000-8000-0000000000dd",
	})
	results.plexReturn = { opened: view.opened(), text: view.text() }
	await view.click("Pick another source")
	await view.open("TMDB")
	results.plexReturnThenTmdb = { opened: view.opened(), text: view.text() }
	await view.unmount()
}

{
	const done = summary("letterboxd", "done", "2026-10-11T12:00:00.000Z")
	const view = await page({ sourceImports: [done] })
	await view.click("Open the Letterboxd import")
	results.historyOpened = { opened: view.opened(), text: view.text() }
	await view.unmount()
}

{
	const view = await page({
		initialSource: "mdblist",
		connectState: "00000000-0000-4000-8000-0000000000dd",
	})
	results.mdblistOpen = { opened: view.opened(), text: view.text() }
	await view.unmount()
	const done = summary("mdblist", "done", "2026-10-23T12:00:00.000Z")
	const opened = await page({
		sourceImports: [done],
		initialSource: "mdblist",
		openImport: done.id,
	})
	results.mdblistDone = { opened: opened.opened(), text: opened.text() }
	await opened.unmount()
}

{
	const preview: ImportSummary = {
		...summary("mdblist", "preview", null, MDBLIST_PREVIEW_ID),
		kinds: {
			rating: 0,
			watch: 2,
			want: 2,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		wishlistShowChoiceCount: 1,
	}
	const view = await page({
		sourceImports: [preview],
		initialSource: "mdblist",
		openImport: MDBLIST_PREVIEW_ID,
	})
	for (let i = 0; i < 3; i++) await settle()
	await view.tick("wishlist-shows")
	await view.click("Start import")
	results.mdblistShows = {
		text: view.text(),
		confirms: sent
			.filter((call) => call.url.endsWith("/confirm"))
			.map((call) => call.body),
	}
	await view.unmount()
}

process.stdout.write(`__IMPORTS_PAGE__${JSON.stringify(results)}`)
process.exit(0)
