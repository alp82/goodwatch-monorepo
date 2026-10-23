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
		const body =
			String(url).endsWith("/preview") || String(url).includes(summary.id)
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
const initiallySelected = Array.from(
	host.querySelectorAll<HTMLInputElement>('input[name="imdb-list-kind"]'),
)
	.filter((input) => input.checked)
	.map((input) => input.closest("label")?.textContent)
const chooserText = host.textContent
const radio = Array.from(
	host.querySelectorAll<HTMLInputElement>('input[name="imdb-list-kind"]'),
).find((input) =>
	input
		.closest("label")
		?.textContent?.includes(process.env.IMDB_UI_CHOICE ?? "My Watchlist"),
)
if (!radio) throw new Error("Missing explicit IMDb list choice")
await act(async () => radio.click())
const customListName = host.querySelector<HTMLInputElement>(
	'input[name="imdb-list-name"]',
)?.value
const preview = Array.from(host.querySelectorAll("button")).find(
	(b) => b.textContent === "Preview import",
)!
await act(async () => {
	preview.click()
	await new Promise((r) => setTimeout(r, 50))
})
if (
	!process.env.IMDB_UI_CHOICE ||
	process.env.IMDB_UI_CHOICE === "My Watchlist"
) {
	const rewatch = Array.from(
		host.querySelectorAll<HTMLInputElement>('input[name="wishlist-rewatch"]'),
	)[1]
	if (!rewatch) throw new Error("Missing independent rewatch choice")
	await act(async () => rewatch.click())
	const confirm = Array.from(host.querySelectorAll("button")).find(
		(b) => b.textContent === "Start import",
	)!
	await act(async () => {
		confirm.click()
		await new Promise((r) => setTimeout(r, 25))
	})
}
process.stdout.write(
	`__IMDB_LIST_UI__${JSON.stringify({ before, sent, initiallySelected, customListName, chooserText, text: host.textContent })}`,
)
await act(async () => root.unmount())
client.clear()
await window.happyDOM.close()
process.exit(0)
