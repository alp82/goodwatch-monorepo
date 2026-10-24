// Matching wishlist entries by hand in happy-dom: the real import flow, query hooks, and lazy panel, with a stand-in
// network that answers the list (50 a page), entry, search, resolve, confirm, and item APIs with synthetic data. Each scenario acts like a member
// and records what was sent, what the screen said, and where focus went, for WishlistImport.test.ts.
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
	"KeyboardEvent",
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

import type { ImportItem, ImportSummary } from "~/domain/imports"

const PARENT = "00000000-0000-4000-8000-0000000000a1"
const CHILD = "00000000-0000-4000-8000-0000000000b2"

const summary = (
	id: string,
	counts: Partial<ImportSummary["counts"]>,
	wishlistMatchCount: number,
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
		id,
		source: "wishlist",
		fileName: "netflix-wishlist.json",
		status: "preview",
		createdAt: "2026-10-18T10:00:00.000Z",
		finishedAt: null,
		counts: { ...all, rows: Object.values(all).reduce((a, b) => a + b, 0) },
		kinds: {
			rating: 0,
			watch: 0,
			want: 5,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		warnings: [],
		options: null,
		processed: 0,
		total: 0,
		applied: { added: 0, updated: 0, kept: 0, failed: 0 },
		stalled: false,
		canUndo: false,
		error: null,
		wishlistMatchCount,
	}
}

const evidence = (sourceId: string) => ({
	source: "netflix",
	completeness: "partial" as const,
	mediaType: "unknown" as const,
	sourceId,
	sourceUrl: `https://www.netflix.com/title/${sourceId}`,
})
const unknownRow = (
	index: number,
	title: string,
	sourceId: string,
	patch: Partial<ImportItem> = {},
): ImportItem => ({
	index,
	key: `wishlist:want:${sourceId}`,
	kind: "want",
	mediaType: "movie",
	title,
	year: null,
	tmdbId: null,
	imdbId: null,
	outcome: "unmatched",
	reason: "Your file doesn't say whether this is a movie or a show.",
	wishlistEvidence: evidence(sourceId),
	wishlistOriginal: {
		key: `wishlist:want:${sourceId}`,
		kind: "want",
		mediaType: "unknown",
		title,
		year: null,
		tmdbId: null,
		imdbId: null,
		wishlistEvidence: evidence(sourceId),
	},
	...patch,
})
const resolvedRow = unknownRow(9, "GoT", "70305903", {
	outcome: "new",
	reason: null,
	mediaType: "show",
	tmdbId: 1399,
	wishlistResolution: {
		basis: "member",
		mediaType: "show",
		tmdbId: 1399,
		title: "Game of Thrones",
		year: 2011,
		selectedAt: "2026-10-18T10:00:00.000Z",
		parentImportId: "00000000-0000-4000-8000-0000000000a0",
		parentRowIndex: 9,
	},
})
const groups = {
	office: {
		representativeIndex: 4,
		item: unknownRow(4, "The Office", "70136120"),
		entryCount: 3,
		evidenceVariants: [
			{ title: "The Office", year: null, sourceId: "70136120" },
			{ title: "The Office (U.S.)", year: null, sourceId: "70136120" },
		],
		hasMoreEvidence: false,
	},
	dark: {
		representativeIndex: 7,
		item: unknownRow(7, "Dark", "80100172"),
		entryCount: 1,
		evidenceVariants: [{ title: "Dark", year: null, sourceId: "80100172" }],
		hasMoreEvidence: false,
	},
	got: {
		representativeIndex: 9,
		item: resolvedRow,
		entryCount: 1,
		evidenceVariants: [{ title: "GoT", year: null, sourceId: "70305903" }],
		hasMoreEvidence: false,
	},
}
const matchedRow = (
	index: number,
	title: string,
	sourceId: string,
	target: {
		mediaType: "movie" | "show"
		tmdbId: number
		title: string
		year: number
	},
) =>
	unknownRow(index, title, sourceId, {
		outcome: "new",
		reason: null,
		mediaType: target.mediaType,
		tmdbId: target.tmdbId,
		wishlistResolution: {
			basis: "member",
			...target,
			selectedAt: "2026-10-18T10:00:00.000Z",
			parentImportId: "00000000-0000-4000-8000-0000000000a0",
			parentRowIndex: index,
		},
	})
const groupOf = (item: ImportItem, entryCount = 1) => ({
	representativeIndex: item.index,
	item,
	entryCount,
	evidenceVariants: [
		{
			title: item.title,
			year: null,
			sourceId: item.wishlistEvidence?.sourceId ?? "",
		},
	],
	hasMoreEvidence: false,
})
const candidates: Record<string, unknown[]> = {
	"The Office": [
		{
			mediaType: "show",
			tmdbId: 2316,
			title: "The Office",
			year: 2005,
			posterPath: "/office.jpg",
		},
	],
	Dark: [
		{
			mediaType: "show",
			tmdbId: 70523,
			title: "Dark",
			year: 2017,
			posterPath: null,
		},
		{
			mediaType: "movie",
			tmdbId: 9999,
			title: "Dark",
			year: 2005,
			posterPath: null,
		},
	],
}

type Reply = { status: number; body: unknown } | "offline"
type Group = (typeof groups)["office"]
type Net = {
	groups: Group[] | { status: number; body: unknown }
	/** "hold" never answers, so the update stays running. */
	resolve: (Reply | "hold")[]
	/** Answers to entry lookups, used first. After them, a row finds its group by `leaves` or its own index. */
	entry?: Reply[]
	/** Rows that repeat an entry: row index to the entry's representative index. */
	leaves?: Record<number, number>
	/** Rows in the New to your Wishlist list. */
	items?: ImportItem[]
	/** Confirm never answers, so the preview stays in its importing state. */
	holdConfirm?: boolean
	/** GoodWatch's suggestion for an entry. Entries without one come back as `manual`. */
	suggest?: Record<number, Suggestion>
	/** Answers to suggestion pages, used first, in order. "hold" never answers until the request is aborted. */
	suggestions?: (Reply | "hold" | "default")[]
	/** Entries the suggestion pages leave out, as a partial answer would. */
	omit?: number[]
}
type Suggestion = {
	state: "suggested" | "manual" | "unavailable" | "already_resolved"
	proposal?: {
		mediaType: "movie" | "show"
		tmdbId: number
		title: string
		year: number | null
		posterPath: string | null
	}
	reason?: string
}
const proposal = (
	mediaType: "movie" | "show",
	tmdbId: number,
	title: string,
	year: number | null,
	posterPath: string | null = null,
): Suggestion => ({
	state: "suggested",
	proposal: { mediaType, tmdbId, title, year, posterPath },
})
let net: Net = { groups: [], resolve: [] }
let sent: { method: string; url: string; body: unknown; signal: boolean }[] = []
/** Suggestion requests whose signal aborted before they answered. */
let aborted: string[] = []
const respond = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	const url = String(input)
	const method = init?.method ?? "GET"
	sent.push({
		method,
		url,
		body: init?.body ? JSON.parse(String(init.body)) : null,
		signal: init?.signal instanceof AbortSignal,
	})
	const parsed = new URL(url, "https://goodwatch.app")
	if (parsed.pathname.endsWith("/suggestions")) {
		const queued = net.suggestions?.shift()
		const reply = queued === "default" ? undefined : queued
		if (reply === "offline") throw new TypeError("Failed to fetch")
		if (reply === "hold")
			return new Promise<Response>((_, reject) => {
				init?.signal?.addEventListener("abort", () => {
					aborted.push(url)
					reject(new DOMException("Aborted", "AbortError"))
				})
			})
		if (reply) return respond(reply.status, reply.body)
		const list = Array.isArray(net.groups) ? net.groups : []
		const offset = Number(parsed.searchParams.get("offset") ?? 0)
		const page = list.slice(offset, offset + 10)
		return respond(200, {
			groups: page
				.filter((group) => !net.omit?.includes(group.representativeIndex))
				.map((group) => ({
					representativeIndex: group.representativeIndex,
					...(net.suggest?.[group.representativeIndex] ??
						(group.item.wishlistResolution
							? { state: "already_resolved" }
							: { state: "manual", reason: "no_native_id_match" })),
				})),
			total: list.length,
			offset,
			hasMore: offset + 10 < list.length,
			nextOffset: offset + 10 < list.length ? offset + 10 : null,
		})
	}
	if (parsed.pathname.endsWith("/resolve")) {
		const reply = net.resolve.shift() ?? "offline"
		if (reply === "offline") throw new TypeError("Failed to fetch")
		if (reply === "hold") return new Promise<Response>(() => {})
		return respond(reply.status, reply.body)
	}
	if (parsed.pathname.endsWith("/confirm") && net.holdConfirm)
		return new Promise<Response>(() => {})
	if (parsed.pathname.endsWith("/matches")) {
		const entry = parsed.searchParams.get("entry")
		if (entry !== null) {
			const reply = net.entry?.shift()
			if (reply === "offline") throw new TypeError("Failed to fetch")
			if (reply) return respond(reply.status, reply.body)
			const at = net.leaves?.[Number(entry)] ?? Number(entry)
			const group = Array.isArray(net.groups)
				? net.groups.find((item) => item.representativeIndex === at)
				: undefined
			return group
				? respond(200, { group })
				: respond(400, {
						error: "Server text",
						code: "wishlist_row_not_resolvable",
					})
		}
		const q = parsed.searchParams.get("q")
		if (q !== null) {
			const type = parsed.searchParams.get("type")
			return respond(200, {
				index: Number(parsed.searchParams.get("index")),
				candidates: (candidates[q] ?? []).filter(
					(item) => !type || (item as { mediaType: string }).mediaType === type,
				),
			})
		}
		if (!Array.isArray(net.groups))
			return respond(net.groups.status, net.groups.body)
		const offset = Number(parsed.searchParams.get("offset") ?? 0)
		return respond(200, {
			groups: net.groups.slice(offset, offset + 50),
			total: net.groups.length,
			offset,
			hasMore: offset + 50 < net.groups.length,
		})
	}
	if (parsed.pathname.endsWith("/items")) {
		const outcome = parsed.searchParams.get("outcome")
		const items = outcome === "new" ? (net.items ?? [resolvedRow]) : []
		return respond(200, { items, total: items.length })
	}
	if (url === "/api/imports") return respond(200, { imports: [] })
	return respond(404, { error: "not stubbed" })
}) as typeof fetch

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { SourceImportFlow } = await import("./SourceImportFlow")

const settle = async (times = 3) => {
	for (let i = 0; i < times; i++)
		await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
}

async function flow(start: ImportSummary, setup: Net) {
	net = setup
	sent = []
	aborted = []
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	const container = document.createElement("div")
	document.body.appendChild(container)
	let root = createRoot(container as unknown as Element)
	const render = () =>
		act(async () =>
			root.render(
				h(
					QueryClientProvider,
					{ client },
					h(SourceImportFlow, {
						source: "wishlist",
						initial: { imports: [start] },
						initialId: start.id,
					}),
				),
			),
		)
	await render()
	await settle()
	const all = <T,>(selector: string) =>
		[...container.querySelectorAll(selector)] as unknown as T[]
	// A member can't reach a control inside a hidden panel, so a click looks only at visible buttons.
	const button = (name: string) => {
		const names = all<HTMLButtonElement>("button")
			.filter((item) => !item.closest("[hidden]"))
			.map((item) => ({
				item,
				text: (item.textContent ?? "").replace(/\s+/g, " ").trim(),
			}))
		const found = (
			names.find(({ text }) => text === name) ??
			names.find(({ text }) => text.startsWith(name))
		)?.item
		if (!found) throw new Error(`No button "${name}"`)
		return found
	}
	const radio = (label: string) => {
		const found = all<HTMLInputElement>('input[type="radio"]').find((input) =>
			input.closest("label")?.textContent?.includes(label),
		)
		if (!found) throw new Error(`No radio "${label}"`)
		return found
	}
	const describeFocus = () => {
		const active = document.activeElement as unknown as HTMLElement | null
		if (!active || active === (document.body as unknown)) return null
		return {
			tag: active.tagName.toLowerCase(),
			text: (active.textContent ?? "").replace(/\s+/g, " ").trim(),
			type: active.getAttribute("type"),
		}
	}
	return {
		text: () => (container.textContent ?? "").replace(/\s+/g, " "),
		focus: describeFocus,
		sent: () => sent.map((item) => ({ ...item })),
		aborted: () => [...aborted],
		/** Poster sources shown in the panel's entries, outside any open editor. */
		posters: () =>
			all<HTMLImageElement>("li img")
				.filter((img) => !img.closest("fieldset"))
				.map((img) => img.getAttribute("src") ?? ""),
		has: (name: string) => {
			try {
				button(name)
				return true
			} catch {
				return false
			}
		},
		disabled: (name: string) => button(name).disabled,
		/** Whether each button with exactly this name is off. */
		allDisabled: (name: string) =>
			all<HTMLButtonElement>("button")
				.filter(
					(item) =>
						(item.textContent ?? "").replace(/\s+/g, " ").trim() === name,
				)
				.map((item) => item.disabled),
		searchDisabled: () =>
			(
				container.querySelector(
					'input[type="search"]',
				) as unknown as HTMLInputElement | null
			)?.disabled ?? null,
		describedBy: (name: string) =>
			button(name).getAttribute("aria-describedby"),
		checked: (label: string) => radio(label).checked,
		titleRadios: () =>
			all<HTMLInputElement>('input[type="radio"]')
				.filter((input) => input.name.endsWith("-title"))
				.map((input) => input.checked),
		click: async (name: string) => {
			const target = button(name)
			await act(async () => target.click())
			await settle()
		},
		/** A keyboard press: focus the button, activate it, and say whether focus is still on that same button. */
		press: async (name: string) => {
			const target = button(name)
			await act(async () => {
				target.focus()
				target.click()
			})
			await settle()
			return document.activeElement === (target as unknown)
		},
		/** A click on a control that needs no network, without waiting. */
		tap: async (name: string) => {
			const target = button(name)
			await act(async () => target.click())
		},
		toggleShowChoice: async () => {
			const target = container.querySelector(
				'input[type="checkbox"]',
			) as unknown as HTMLInputElement
			await act(async () => target.click())
			await settle()
		},
		pick: async (label: string) => {
			const target = radio(label)
			await act(async () => target.click())
			await settle()
		},
		type: async (value: string) => {
			const input = container.querySelector(
				'input[type="search"]',
			) as unknown as HTMLInputElement
			const setValue = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				"value",
			)?.set
			await act(async () => {
				setValue?.call(input, value)
				input.dispatchEvent(
					new window.Event("input", { bubbles: true }) as unknown as Event,
				)
			})
			await settle()
		},
		escape: async () => {
			const active = document.activeElement as unknown as HTMLElement
			await act(async () => {
				active.dispatchEvent(
					new window.KeyboardEvent("keydown", {
						key: "Escape",
						bubbles: true,
					}) as unknown as Event,
				)
			})
			await settle()
		},
		/**
		 * Goes to the matching question and opens its panel: Import on Choose, then each question before it answered
		 * with the given answer or its suggested one, waiting for each answer to lock in.
		 */
		review: async (given: Record<string, string> = {}) => {
			const answerButtons = () =>
				all<HTMLButtonElement>("[data-answer]").filter(
					(item) => !item.closest("[hidden]"),
				)
			const heading = () =>
				(container.querySelector("h2")?.textContent ?? "").replace(/\s+/g, " ")
			if (heading() === "What should come in?") {
				await act(async () => button("Import").click())
				await settle()
			}
			for (let step = 0; step < 5; step++) {
				const answers = answerButtons()
				if (!answers.length) return
				const check = answers.find((item) =>
					/^Yes, check (it|them)/.test(item.textContent ?? ""),
				)
				if (check) {
					if (check.getAttribute("aria-pressed") !== "true")
						await act(async () => check.click())
					await settle(5)
					return
				}
				const wanted = Object.entries(given).find(([question]) =>
					heading().includes(question),
				)?.[1]
				const pick =
					answers.find(
						(item) => wanted && item.textContent?.startsWith(wanted),
					) ?? answers.find((item) => item.hasAttribute("data-suggested"))
				if (!pick) throw new Error(`No answer on "${heading()}"`)
				const on = heading()
				await act(async () => pick.click())
				await act(
					async () => new Promise((resolve) => setTimeout(resolve, 800)),
				)
				await settle()
				// The last answer starts the import; the screen stays while it starts.
				if (heading() === on) return
			}
		},
		/** Leaves the matching question: Back to the question or step before it. */
		hide: async () => {
			await act(async () => button("Back").click())
			await settle()
		},
		/** The question's answer that moves on without checking. */
		leave: () =>
			all<HTMLButtonElement>("[data-answer]").find((item) =>
				/^No, leave (it|them) out/.test(item.textContent ?? ""),
			) ?? null,
		/** The member comes back to the tab, then the connection drops and returns. */
		refocusAndReconnect: async () => {
			await act(async () => {
				window.dispatchEvent(new window.Event("visibilitychange"))
				window.dispatchEvent(new window.Event("offline"))
				window.dispatchEvent(new window.Event("online"))
			})
			await settle(8)
		},
		/** The member leaves the page and comes back: a new render that keeps the same query cache. */
		remount: async () => {
			await act(async () => root.unmount())
			root = createRoot(container as unknown as Element)
			await render()
			await settle()
		},
		unmount: async () => {
			await act(async () => root.unmount())
			container.remove()
		},
	}
}

type View = Awaited<ReturnType<typeof flow>>
const results: Record<string, unknown> = {}
const snap = (view: View, extra: Record<string, unknown> = {}) => ({
	text: view.text(),
	focus: view.focus(),
	sent: view.sent(),
	...extra,
})

// Open, choose, fail, retry, and get a new preview.
{
	const parent = summary(PARENT, { new: 1, conflict: 1, unmatched: 2 }, 3)
	const child = summary(CHILD, { new: 2, conflict: 2, unmatched: 1 }, 3)
	const view = await flow(parent, {
		groups: [groups.office, groups.dark, groups.got],
		resolve: [
			"offline",
			{ status: 201, body: { import: child, parentImportId: PARENT } },
		],
	})
	results.closed = snap(view)
	await view.click("Import")
	// The Seen title's question comes first; the member adds it as Want to rewatch.
	results.rewatchAsked = snap(view)
	await view.review({ "already Seen": "Yes, add to Want to rewatch" })
	results.opened = snap(view)
	await view.click("Find a match for The Office")
	results.entry = snap(view, {
		radios: view.titleRadios(),
		useDisabled: view.disabled("Use this match"),
	})
	await view.escape()
	results.escaped = snap(view)
	await view.click("Find a match for The Office")
	await view.pick("2005 · Show")
	results.picked = snap(view, {
		useDisabled: view.disabled("Use this match"),
		confirmDisabled: view.leave()?.disabled ?? null,
	})
	await view.click("Use this match")
	results.used = snap(view, {
		confirmDisabled: view.leave()?.disabled ?? null,
		confirmReason: view.leave()?.getAttribute("aria-describedby") ?? null,
	})
	await view.click("Clear the match for GoT")
	results.cleared = snap(view)
	await view.hide()
	await view.review({ "already Seen": "Yes, add to Want to rewatch" })
	results.reshown = snap(view)
	await view.click("Update preview")
	results.failed = snap(view, {
		confirmDisabled: view.leave()?.disabled ?? null,
		updateDisabled: view.disabled("Update preview"),
	})
	await view.click("Update preview")
	await settle(3)
	results.updated = snap(view, {
		confirmDisabled: view.disabled("Import"),
	})
	await view.unmount()
}

// The preview was imported elsewhere: the server's answer and a way to start again.
{
	const view = await flow(summary(PARENT, { new: 1, unmatched: 1 }, 1), {
		groups: [groups.dark],
		resolve: [
			{
				status: 409,
				body: {
					error: "Server message for an imported preview.",
					code: "wishlist_preview_required",
				},
			},
		],
	})
	await view.review()
	await settle(5)
	await view.click("Find a match for Dark")
	await view.pick("2017 · Show")
	await view.click("Use this match")
	await view.click("Update preview")
	results.restart = snap(view, {
		chooseAgain: view.has("Choose the file again"),
	})
	await view.click("Choose the file again")
	results.restarted = snap(view)
	await view.unmount()
}

// Every entry already matched: the block stays, and matches can change from the panel and from the outcome list.
{
	const view = await flow(summary(PARENT, { new: 1 }, 1), {
		groups: [groups.got],
		resolve: [],
	})
	await view.review()
	results.allResolved = snap(view)
	await view.click("Change the match for GoT")
	await settle(5)
	results.changeFromRow = snap(view)
	await view.unmount()
}

// Searching only when asked, and a type filter with no results.
{
	const view = await flow(summary(PARENT, { unmatched: 1 }, 1), {
		groups: [groups.dark],
		resolve: [],
	})
	await view.review()
	await settle(5)
	await view.click("Find a match for Dark")
	const before = view.sent().length
	await view.type("Dark Matter")
	results.typed = { sentWhileTyping: view.sent().length - before }
	await view.pick("Shows")
	await view.click("Search")
	results.noResults = snap(view, {
		widen: view.has("Search movies and shows"),
	})
	await view.type("D")
	await view.click("Search")
	results.tooShort = snap(view)
	await view.unmount()
}

// A preview made before matching existed.
{
	const view = await flow(summary(PARENT, { unmatched: 1 }, 1), {
		groups: {
			status: 409,
			body: {
				error: "Server message for an old preview.",
				code: "wishlist_snapshot_required",
			},
		},
		resolve: [],
	})
	await view.review()
	await settle(5)
	results.oldPreview = snap(view, {
		chooseAgain: view.has("Choose the file again"),
	})
	await view.unmount()
}

// Leaving the rest out starts the import: the panel goes, so no match can change while it starts.
{
	const view = await flow(summary(PARENT, { new: 1, unmatched: 1 }, 2), {
		groups: [groups.dark, groups.got],
		resolve: [],
		holdConfirm: true,
	})
	await view.review()
	await view.click("Find a match for Dark")
	await view.pick("2017 · Show")
	const leave = view.leave()
	if (!leave) throw new Error("No leave answer")
	await act(async () => leave.click())
	await act(async () => new Promise((resolve) => setTimeout(resolve, 800)))
	await settle()
	results.locked = snap(view, {
		use: view.has("Use this match"),
		clear: view.has("Clear the match for GoT"),
	})
	await view.unmount()
}

// At 100 changes, Clear and Use stop for entries without a change; entries with one can still change.
{
	const saved = Array.from({ length: 101 }, (_, at) =>
		groupOf(
			matchedRow(1000 + at, `Saved ${at}`, `5000${at}`, {
				mediaType: "movie",
				tmdbId: 10000 + at,
				title: `Saved title ${at}`,
				year: 2000,
			}),
		),
	)
	for (const at of [0, 100])
		candidates[`Saved ${at}`] = [
			{
				mediaType: "movie",
				tmdbId: 20000 + at,
				title: `Other ${at}`,
				year: 2001,
				posterPath: null,
			},
		]
	const view = await flow(summary(PARENT, { new: 101 }, 101), {
		groups: saved,
		resolve: [
			{
				status: 201,
				body: {
					import: summary(CHILD, { new: 101 }, 101),
					parentImportId: PARENT,
				},
			},
		],
	})
	await view.review()
	await settle(5)
	await view.click("Show more")
	await view.click("Show more")
	for (let at = 0; at < 100; at++)
		await view.tap(`Clear the match for Saved ${at}`)
	await settle()
	const text = view.text()
	results.capFull = {
		changes: /100 changes aren't in this preview yet/.test(text),
		full: /That's the most changes for one update\./.test(text),
		clear: view.disabled("Clear the match for Saved 100"),
		reason: view.describedBy("Clear the match for Saved 100"),
		discard: view.disabled("Discard changes"),
	}
	await view.click("Change the match for Saved 100")
	await view.pick("Other 100")
	results.capBlocked = {
		use: view.disabled("Use this match"),
		full: /match more\.Use this match/.test(view.text()),
	}
	await view.click("Cancel")
	await view.click("Find a match for Saved 0")
	await view.pick("Other 0")
	results.capChanged = { use: view.disabled("Use this match") }
	await view.click("Use this match")
	results.capChanged = {
		...(results.capChanged as object),
		changes: /100 changes aren't in this preview yet/.test(view.text()),
		match:
			/Your match: Other 0 \(2001\) · Movie · Not in this preview yet/.test(
				view.text(),
			),
	}
	await view.click("Update preview")
	await settle(3)
	const [sentResolve] = view
		.sent()
		.filter((item) => item.url.endsWith("/resolve"))
	const choices = (
		sentResolve.body as { choices: { index: number; target: unknown }[] }
	).choices
	results.capSent = {
		count: choices.length,
		first: choices.find((choice) => choice.index === 1000),
		hasLast: choices.some((choice) => choice.index === 1100),
	}
	await view.unmount()
}

// GoodWatch suggests a match by the file's Netflix ID; the member checks it and accepts it.
{
	const view = await flow(summary(PARENT, { new: 1, unmatched: 2 }, 3), {
		groups: [groups.office, groups.dark, groups.got],
		suggest: {
			4: proposal("show", 2316, "The Office", 2005, "/office.jpg"),
		},
		resolve: [
			{
				status: 201,
				body: {
					import: summary(CHILD, { new: 2, unmatched: 1 }, 3),
					parentImportId: PARENT,
				},
			},
		],
	})
	await view.review()
	await settle(5)
	results.suggested = snap(view, {
		posters: view.posters(),
		confirmDisabled: view.leave()?.disabled ?? null,
	})
	await view.click("Match Dark yourself")
	results.exceptionOpened = snap(view)
	await view.click("Cancel")
	await view.click("Accept the suggestion for The Office")
	results.accepted = snap(view, {
		confirmDisabled: view.leave()?.disabled ?? null,
	})
	await view.click("Undo accept for The Office")
	results.acceptUndone = snap(view, {
		confirmDisabled: view.leave()?.disabled ?? null,
	})
	await view.click("Accept the suggestion for The Office")
	await view.click("Update preview")
	await settle(3)
	results.acceptedSent = snap(view)
	await view.unmount()
}

// Accepting every suggestion shown at once keeps the member's own choices, and Undo takes back only the bulk accepts.
const films = Array.from({ length: 10 }, (_, at) =>
	groupOf(unknownRow(100 + at, `Filler ${at}`, `9100${at}`)),
)
const filmSuggestions = Object.fromEntries(
	films.map((group, at) => [
		group.representativeIndex,
		proposal("movie", 30000 + at, `Film ${at}`, 2001),
	]),
)
{
	candidates["Filler 0"] = [
		{
			mediaType: "movie",
			tmdbId: 40000,
			title: "Other film",
			year: 1999,
			posterPath: null,
		},
	]
	const view = await flow(summary(PARENT, { unmatched: 12 }, 12), {
		groups: [groups.office, groups.dark, ...films],
		suggest: {
			4: proposal("show", 2316, "The Office", 2005, "/office.jpg"),
			7: proposal("show", 70523, "Dark", 2017),
			...filmSuggestions,
		},
		resolve: [
			{
				status: 201,
				body: {
					import: summary(CHILD, { new: 2, unmatched: 10 }, 12),
					parentImportId: PARENT,
				},
			},
		],
	})
	await view.review()
	await settle(8)
	await view.click("Change the match for Dark")
	await view.pick("2005 · Movie")
	await view.click("Use this match")
	results.bulkBefore = snap(view)
	const keptOnAccept = await view.press("Accept the 11 suggestions shown")
	results.bulkAccepted = snap(view, {
		confirmDisabled: view.leave()?.disabled ?? null,
		keptFocus: keptOnAccept,
	})
	await view.click("Change the match for Filler 0")
	await view.pick("1999 · Movie")
	await view.click("Use this match")
	const keptOnUndo = await view.press("Undo accept all")
	results.bulkUndone = snap(view, { keptFocus: keptOnUndo })
	await view.click("Update preview")
	await settle(3)
	results.bulkSent = snap(view)
	await view.unmount()
}

// Bulk accept never takes part of the list: past the 100-change limit it stays off and says why.
{
	const saved = Array.from({ length: 95 }, (_, at) =>
		groupOf(
			matchedRow(2000 + at, `Kept ${at}`, `6000${at}`, {
				mediaType: "movie",
				tmdbId: 50000 + at,
				title: `Kept title ${at}`,
				year: 2000,
			}),
		),
	)
	const view = await flow(summary(PARENT, { new: 95, unmatched: 10 }, 105), {
		groups: [...films, ...saved],
		suggest: filmSuggestions,
		resolve: [],
	})
	await view.review()
	await settle(5)
	await view.click("Show more")
	await view.click("Show more")
	await settle(10)
	for (let at = 0; at < 91; at++)
		await view.tap(`Clear the match for Kept ${at}`)
	await settle()
	await view.click("Accept the 10 suggestions shown")
	results.bulkCap = snap(view, {
		bulk: view.disabled("Accept the 10 suggestions shown"),
		reason: view.describedBy("Accept the 10 suggestions shown"),
	})
	await view.click("Accept the suggestion for Filler 3")
	results.bulkCapOne = snap(view)
	await view.unmount()
}

// A suggestion page that fails, and an entry the server couldn't check, read as not checked, never as no match. Try
// again asks only for those pages, and a match the member made meanwhile stays.
{
	const view = await flow(summary(PARENT, { unmatched: 12 }, 12), {
		groups: [groups.dark, groups.office, ...films],
		suggestions: [
			"offline",
			{ status: 500, body: { error: "Internal: catalog lane exploded" } },
		],
		suggest: {
			4: proposal("show", 2316, "The Office", 2005, "/office.jpg"),
			7: proposal("show", 70523, "Dark", 2017),
			...filmSuggestions,
		},
		resolve: [],
	})
	await view.review()
	await settle(8)
	results.suggestFailed = snap(view)
	await view.click("Find a match for Dark")
	await view.pick("2005 · Movie")
	await view.click("Use this match")
	net.omit = [101]
	await view.click("Try again to check titles for a match")
	await settle(8)
	results.suggestRetried = snap(view)
	net.omit = []
	await view.click("Try again to check titles for a match")
	await settle(8)
	results.suggestRetriedAgain = snap(view)
	await view.unmount()
}

// While suggestions load, matching by hand works; hiding the panel doesn't ask again; a new preview cancels the
// request that's still open and asks for nothing more until its own panel opens.
{
	const view = await flow(summary(PARENT, { unmatched: 12 }, 12), {
		groups: [groups.dark, groups.office, ...films],
		suggestions: ["hold"],
		suggest: filmSuggestions,
		resolve: [
			{
				status: 201,
				body: {
					import: summary(CHILD, { new: 1, unmatched: 11 }, 12),
					parentImportId: PARENT,
				},
			},
		],
	})
	await view.review()
	await settle(5)
	results.suggestLoading = snap(view)
	await view.hide()
	await view.review()
	await view.click("Find a match for Dark")
	await view.pick("2017 · Show")
	await view.click("Use this match")
	results.suggestLoadingChosen = snap(view)
	await view.click("Update preview")
	await settle(5)
	results.suggestCancelled = snap(view, { aborted: view.aborted() })
	await view.unmount()
}

// While Update preview runs, no suggestion can be accepted or taken back, one by one or all at once.
{
	const view = await flow(summary(PARENT, { unmatched: 3 }, 3), {
		groups: [groups.office, groups.dark, films[0]],
		suggest: {
			4: proposal("show", 2316, "The Office", 2005),
			7: proposal("show", 70523, "Dark", 2017),
			100: proposal("movie", 30000, "Film 0", 2001),
		},
		resolve: ["hold"],
	})
	await view.review()
	await settle(5)
	await view.click("Accept the suggestion for The Office")
	await view.click("Update preview")
	await view.tap("Accept the suggestion for Dark")
	await view.tap("Accept the 2 suggestions shown")
	await settle()
	results.suggestLocked = snap(view, {
		accept: view.disabled("Accept the suggestion for Dark"),
		bulk: view.disabled("Accept the 2 suggestions shown"),
		undo: view.disabled("Undo accept for The Office"),
		change: view.disabled("Change the match for Dark"),
	})
	await view.unmount()
}

// Suggestions already loaded aren't asked for again when the tab regains focus or the connection returns.
{
	const many = Array.from({ length: 50 }, (_, at) =>
		groupOf(unknownRow(500 + at, `Many ${at}`, `9500${at}`)),
	)
	const view = await flow(summary(PARENT, { unmatched: 50 }, 50), {
		groups: many,
		suggest: Object.fromEntries(
			many.map((group, at) => [
				group.representativeIndex,
				proposal("movie", 60000 + at, `Many film ${at}`, 2003),
			]),
		),
		resolve: [],
	})
	await view.review()
	await settle(10)
	const before = view.sent().length
	await view.refocusAndReconnect()
	await view.hide()
	await view.refocusAndReconnect()
	results.warmCache = snap(view, { before })
	await view.unmount()
}

// Exit only once the pipe took everything: the results are larger than one pipe buffer.
// Try again on pages that aren't next to each other still asks for one page at a time.
const thirty = Array.from({ length: 30 }, (_, at) =>
	groupOf(unknownRow(700 + at, `Thirty ${at}`, `9700${at}`)),
)
{
	const view = await flow(summary(PARENT, { unmatched: 30 }, 30), {
		groups: thirty,
		omit: [700, 720],
		resolve: [],
	})
	await view.review()
	await settle(8)
	results.gapsChecked = snap(view)
	net.omit = []
	net.suggestions = ["hold", "hold"]
	await view.click("Try again to check titles for a match")
	await settle(8)
	results.gapsRetrying = snap(view)
	await view.unmount()
}

// Failed pages in the cache aren't asked for again when the member comes back to the page; only Try again does.
{
	const view = await flow(summary(PARENT, { unmatched: 30 }, 30), {
		groups: thirty,
		suggestions: ["offline", "default", "offline"],
		resolve: [],
	})
	await view.review()
	await settle(8)
	results.cachedFailed = snap(view)
	await view.remount()
	await view.review()
	await settle(8)
	results.cachedRemounted = snap(view)
	net.suggestions = ["hold", "hold"]
	await view.click("Try again to check titles for a match")
	await settle(8)
	results.cachedRetrying = snap(view)
	await view.unmount()
}

// Known-type ID conflicts must not be labelled as an unknown source type.
for (const mediaType of ["movie", "show"] as const) {
	const item = unknownRow(4, "Known conflict", "known")
	item.wishlistEvidence = { ...item.wishlistEvidence!, mediaType }
	item.wishlistOriginal = {
		...item.wishlistOriginal!,
		mediaType,
		wishlistEvidence: item.wishlistEvidence,
	}
	item.mediaType = mediaType
	item.wishlistMatchRequired = "id_conflict"
	const view = await flow(summary(PARENT, { unmatched: 1 }, 1), {
		groups: [groupOf(item)],
		resolve: [],
	})
	await view.review()
	await settle(5)
	results[`knownType_${mediaType}`] = snap(view)
	await view.unmount()
}

// The whole-show conversion stays independent of the choice about Seen titles.
{
	const parent = {
		...summary(PARENT, { conflict: 2 }, 0),
		wishlistShowChoiceCount: 1,
		wishlistRewatchChoiceCount: 1,
	}
	const view = await flow(parent, { groups: [], resolve: [] })
	await view.click("Import")
	results.showChoiceBefore = snap(view)
	await view.review({
		"already Seen": "No, leave it as Seen",
		"whole show": "Yes, add the whole show",
	})
	results.showChoiceConfirmed = snap(view)
	await view.unmount()
}

process.stdout.write(`__WISHLIST_MATCH__${JSON.stringify(results)}`, () =>
	process.exit(0),
)
