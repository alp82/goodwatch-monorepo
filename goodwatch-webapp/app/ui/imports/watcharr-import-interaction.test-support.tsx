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
const { SourceImportChoose } = await import("./SourceImportChoose")
const { MemoryRouter } = await import("react-router-dom")
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
type Screen = {
	counter: string | null
	heading: string
	highlighted: string[]
	answers: { text: string; pressed: string | null; suggested: boolean }[]
}
/**
 * Renders Choose for a preview, presses Import, and answers each question with the first answer that starts with
 * one of `picks`. Records every screen it saw and the options the import would start with.
 */
async function answer(item: ImportSummary, picks: string[]) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	let sent: ImportOptions | null = null
	await act(async () =>
		root.render(
			createElement(
				QueryClientProvider,
				{ client },
				createElement(
					MemoryRouter,
					null,
					createElement(SourceImportChoose, {
						summary: item,
						focus: false,
						confirming: false,
						error: null,
						onConfirm: (options: ImportOptions) => {
							sent = options
						},
						onBack: () => {},
						posters: [],
					}),
				),
			),
		),
	)
	const wait = (ms: number) =>
		act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
	await wait(30)
	const choose = (container.textContent ?? "").replace(/\s+/g, " ")
	const start = Array.from(container.querySelectorAll("button")).find(
		(b) => b.textContent === "Import",
	)
	if (start) await act(async () => start.click())
	await wait(30)
	const screens: Screen[] = []
	for (let step = 0; step < 6; step++) {
		const buttons = Array.from(
			container.querySelectorAll<HTMLButtonElement>("[data-answer]"),
		)
		if (!buttons.length) break
		screens.push({
			counter:
				container.querySelector("[data-question-counter]")?.textContent ?? null,
			heading: container.querySelector("h2")?.textContent ?? "",
			highlighted: Array.from(
				container.querySelectorAll("h2 .text-amber-200"),
			).map((span) => span.textContent ?? ""),
			answers: buttons.map((b) => ({
				text: (b.textContent ?? "").replace("Suggested", ""),
				pressed: b.getAttribute("aria-pressed"),
				suggested: b.hasAttribute("data-suggested"),
			})),
		})
		const pick = buttons.find((b) =>
			picks.some((wanted) => b.textContent?.startsWith(wanted)),
		)
		if (!pick) break
		await act(async () => pick.click())
		await wait(800)
		await wait(30)
	}
	const after = (container.textContent ?? "").replace(/\s+/g, " ")
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	return { choose, screens, sent: sent as ImportOptions | null, after }
}

const runs: {
	conflictChoice: string
	rewatch: boolean
	sent: ImportOptions | null
}[] = []
for (const conflictChoice of ["keep", "source"] as const)
	for (const rewatch of [false, true]) {
		const run = await answer(summary, [
			conflictChoice === "keep" ? "Yes, keep" : "No, use",
			rewatch ? "Yes, add to Want to rewatch" : "No, leave",
		])
		runs.push({ conflictChoice, rewatch, sent: run.sent })
	}

const wishlist = (
	counts: Partial<ImportSummary["counts"]>,
	extra: Partial<ImportSummary> = {},
): ImportSummary => {
	const all = {
		new: 0,
		unchanged: 0,
		conflict: 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
		...counts,
	}
	return {
		...summary,
		counts: { ...all, rows: Object.values(all).reduce((a, b) => a + b, 0) },
		kinds: {
			rating: 0,
			watch: 0,
			want: all.new + all.unchanged + all.conflict,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		wishlistRewatchChoiceCount: undefined,
		...extra,
	}
}
const questions = {
	mixed: await answer(wishlist({ new: 3, conflict: 2 }), []),
	oneSeen: await answer(wishlist({ conflict: 1 }), ["No, leave it as Seen"]),
	seasonChoice: await answer(
		wishlist(
			{ conflict: 1 },
			{ wishlistShowChoiceCount: 1, wishlistRewatchChoiceCount: 0 },
		),
		[],
	),
	sourceSeen: await answer(
		wishlist(
			{ conflict: 1 },
			{ wishlistShowChoiceCount: 0, wishlistRewatchChoiceCount: 1 },
		),
		["Yes, add to Want to rewatch"],
	),
}
process.stdout.write(
	`__WATCHARR_CHOICES__${JSON.stringify({ runs, questions })}`,
)
process.exit(0)
