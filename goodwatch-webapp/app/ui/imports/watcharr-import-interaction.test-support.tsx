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
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { SourceImportPreview } = await import("./SourceImportPreview")
import type { ImportOptions, ImportSummary } from "~/domain/imports"
const summary: ImportSummary = {
	id: "00000000-0000-4000-8000-000000000001",
	source: "wishlist",
	fileName: "watcharr-export.json",
	status: "preview",
	createdAt: "2026-01-01T00:00:00Z",
	finishedAt: null,
	counts: {
		rows: 4,
		new: 1,
		conflict: 3,
		unchanged: 0,
		invalid: 0,
		unsupported: 0,
		unmatched: 0,
	},
	kinds: {
		want: 1,
		watch: 1,
		rating: 1,
		review: 1,
		show_status: 0,
		favorite: 0,
	},
	warnings: [],
	wishlistRewatchChoiceCount: 1,
	options: null,
	processed: 0,
	total: 4,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
}
const runs: {
	conflictChoice: string
	rewatch: boolean
	sent: ImportOptions | null
}[] = []
for (const conflictChoice of ["keep", "source"] as const)
	for (const rewatch of [false, true]) {
		const client = new QueryClient()
		const container = document.createElement("div")
		document.body.append(container)
		const root = createRoot(container)
		let sent: ImportOptions | null = null
		await act(async () =>
			root.render(
				createElement(
					QueryClientProvider,
					{ client },
					createElement(SourceImportPreview, {
						summary,
						focus: false,
						confirming: false,
						error: null,
						onConfirm: (options: ImportOptions) => {
							sent = options
						},
						onBack: () => {},
					}),
				),
			),
		)
		const radios = (name: string) =>
			Array.from(
				container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
			)
		await act(async () => radios("watch-dates")[0].click())
		await act(async () =>
			radios("source-conflict")[conflictChoice === "keep" ? 0 : 1].click(),
		)
		await act(async () => radios("wishlist-rewatch")[rewatch ? 1 : 0]?.click())
		const button = Array.from(container.querySelectorAll("button")).find(
			(b) => b.textContent === "Start import",
		)
		if (!button) throw new Error("No confirm button")
		await act(async () => button.click())
		runs.push({ conflictChoice, rewatch, sent })
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	}
process.stdout.write(`__WATCHARR_CHOICES__${JSON.stringify(runs)}`)
process.exit(0)
