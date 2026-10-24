import { readFileSync } from "node:fs"
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
	"sessionStorage",
	"localStorage",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { ImdbImportFlow } = await import("./ImdbImportFlow")
import type { ImportSummary } from "~/domain/imports"
const summary: ImportSummary = {
	id: "00000000-0000-4000-8000-000000000001",
	source: "imdb_list",
	fileName: "watchlist.csv",
	status: "preview",
	createdAt: "2026-01-01",
	finishedAt: null,
	counts: {
		rows: 3,
		new: 2,
		conflict: 1,
		unchanged: 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
	},
	kinds: {
		want: 2,
		rating: 1,
		watch: 0,
		favorite: 0,
		review: 0,
		show_status: 0,
	},
	warnings: [],
	wishlistRewatchChoiceCount: 1,
	options: null,
	processed: 0,
	total: 3,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
}
const sent: { url: string; body: Record<string, unknown> }[] = []
Object.defineProperty(globalThis, "fetch", {
	configurable: true,
	writable: true,
	value: async (url: string, init?: RequestInit) => {
		if (init?.method === "POST")
			sent.push({ url: String(url), body: JSON.parse(String(init.body)) })
		// The one conflict is the Seen title, which waits on Want to rewatch: no row follows the conflict choice.
		const body = String(url).includes("/items?")
			? { items: [], total: 0 }
			: String(url).endsWith("/preview") || String(url).includes(summary.id)
				? { import: summary }
				: { imports: [] }
		return new Response(JSON.stringify(body), {
			headers: { "Content-Type": "application/json" },
		})
	},
})
const client = new QueryClient({
	defaultOptions: { queries: { retry: false } },
})
const host = document.createElement("div")
document.body.append(host)
const root = createRoot(host)
await act(async () => {
	root.render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(ImdbImportFlow, {
				initial: { imports: [] },
				initialLists: [],
			}),
		),
	)
	await new Promise((r) => setTimeout(r, 30))
})
const file = new window.File(
	[
		readFileSync(
			new URL(
				`../../server/imdb-import/fixtures/imdb-${process.env.IMDB_UI_LEGACY ? "legacy" : "watchlist"}-synthetic.csv`,
				import.meta.url,
			),
			"utf8",
		),
	],
	process.env.IMDB_UI_FILENAME ?? "renamed.csv",
	{ type: "text/csv" },
)
const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
Object.defineProperty(input, "files", { configurable: true, value: [file] })
await act(async () => {
	input.dispatchEvent(new Event("change", { bubbles: true }))
	await new Promise((r) => setTimeout(r, 50))
})
const before = sent.length
const answers = () =>
	Array.from(host.querySelectorAll<HTMLButtonElement>("[data-answer]"))
const initiallySelected = answers()
	.filter((answer) => answer.getAttribute("aria-pressed") === "true")
	.map((answer) => answer.textContent)
const suggested = answers()
	.filter((answer) => answer.hasAttribute("data-suggested"))
	.map((answer) => answer.textContent)
const chooserText = host.textContent
const wait = (ms: number) =>
	act(async () => {
		await new Promise((r) => setTimeout(r, ms))
	})
const choice = answers().find((answer) =>
	answer.textContent?.includes(process.env.IMDB_UI_CHOICE ?? "My Watchlist"),
)
if (!choice) throw new Error("Missing explicit IMDb list choice")
await act(async () => choice.click())
const customListName = host.querySelector<HTMLInputElement>(
	'input[name="imdb-list-name"]',
)?.value
if (process.env.IMDB_UI_CHOICE === "A custom list") {
	const go = Array.from(host.querySelectorAll("button")).find(
		(b) => b.textContent === "Continue",
	)
	if (!go) throw new Error("Missing Continue")
	await act(async () => go.click())
}
// An answer locks in before the preview is asked for.
await wait(800)
await wait(50)
if (
	!process.env.IMDB_UI_CHOICE ||
	process.env.IMDB_UI_CHOICE === "My Watchlist"
) {
	const start = Array.from(host.querySelectorAll("button")).find(
		(b) => b.textContent === "Import",
	)
	if (!start) throw new Error("Missing Import")
	await act(async () => start.click())
	await wait(30)
	const rewatch = answers().find((answer) =>
		answer.textContent?.startsWith("Yes, add to Want to rewatch"),
	)
	if (!rewatch) throw new Error("Missing the rewatch question")
	await act(async () => rewatch.click())
	await wait(800)
	await wait(30)
}
process.stdout.write(
	`__IMDB_LIST_UI__${JSON.stringify({ before, sent, initiallySelected, suggested, customListName, chooserText, text: host.textContent })}`,
)
await act(async () => root.unmount())
client.clear()
await window.happyDOM.close()
process.exit(0)
