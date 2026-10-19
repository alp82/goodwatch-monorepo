// A TV Time preview in happy-dom: the real import flow, query hooks, and lazy match panel, with a stand-in network
// that answers the preview, match list, search, resolve, and confirm APIs with synthetic data. Each scenario acts like
// a member and records what was sent and what the screen said, for TvTimeImport.test.ts.
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

import type {
	ImportItem,
	ImportSummary,
	WishlistMatchGroup,
} from "~/domain/imports"

const PARENT = "00000000-0000-4000-8000-0000000000a1"
const CHILD = "00000000-0000-4000-8000-0000000000b2"
const RERUN = "00000000-0000-4000-8000-0000000000c3"
const BULK = "00000000-0000-4000-8000-0000000000d4"
const NEXT = "00000000-0000-4000-8000-0000000000e5"

const resolution = (
	patch: Partial<NonNullable<ImportSummary["resolution"]>> = {},
): NonNullable<ImportSummary["resolution"]> => ({
	jobId: "job-1",
	state: "running",
	phase: "episodes",
	total: 8088,
	processed: 2400,
	matched: 1900,
	held: 500,
	pending: 5688,
	failedByCode: {},
	failed: 0,
	heldByCode: {},
	attempts: 120,
	updatedAt: "2026-10-19T10:01:00.000Z",
	deadline: "2026-10-19T10:30:00.000Z",
	replacementId: null,
	...patch,
})
const proof = {
	rule: "tvtime_exact_title_release_date_v1",
	mediaType: "movie",
	tmdbId: 862,
	sourceFingerprint: "f1",
	title: { value: "Toy Story", kind: "primary", locale: "und" },
	date: { value: "1995-11-22", basis: "primary" },
	candidateCount: 1,
	sourceCountry: null,
	verifiedCandidates: 1,
	discoveryBound: { pages: 5, candidates: 100 },
	discoveryComplete: true,
	pages: 1,
	verifiedAt: "2026-10-19T10:00:00.000Z",
}
const suggested = {
	groups: [
		{
			representativeIndex: 2,
			suggestionId: "s1",
			state: "suggested",
			proof,
			proposal: {
				mediaType: "movie",
				tmdbId: 862,
				title: "Toy Story",
				year: 1995,
				posterPath: null,
			},
		},
	],
	total: 1,
	offset: 0,
	hasMore: false,
	nextOffset: null,
	bulkAccept: {
		token: "token-1",
		eligibleCount: 2,
		previewId: PARENT,
		generation: 1,
		expiresAt: "2026-10-19T10:30:00.000Z",
	},
}

const summary = (
	id: string,
	patch: Partial<ImportSummary> = {},
): ImportSummary => ({
	id,
	source: "tvtime",
	fileName: "gdpr-data.zip",
	status: "preview",
	createdAt: "2026-10-19T10:00:00.000Z",
	finishedAt: null,
	counts: {
		new: 4,
		unchanged: 0,
		conflict: 0,
		unmatched: 3,
		unsupported: 0,
		invalid: 0,
		rows: 7,
	},
	kinds: {
		rating: 0,
		watch: 4,
		want: 2,
		favorite: 0,
		review: 0,
		show_status: 1,
	},
	warnings: [],
	options: null,
	processed: 0,
	total: 0,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
	wishlistMatchCount: 1,
	wishlistShowChoiceCount: 0,
	tvtimeLookupLimitCount: 0,
	tvtimeLookupUnavailableCount: 0,
	...patch,
})

const evidence = {
	source: "tvtime",
	mediaType: "movie" as const,
	completeness: "unknown" as const,
	sourceId: "m1",
}
const movieRow: ImportItem = {
	index: 2,
	key: "tvtime:movie:m1:watch-m1-1",
	kind: "watch",
	mediaType: "movie",
	title: "Die Spielzeuggeschichte",
	year: 1995,
	tmdbId: null,
	imdbId: null,
	outcome: "unmatched",
	reason: "This TV Time movie has no catalog ID. Choose a movie to match it.",
	tvtimeMovie: { sourceId: "m1", releaseDate: "1995-11-22" },
	wishlistOriginal: {
		key: "tvtime:movie:m1:watch-m1-1",
		kind: "watch",
		manualMatchScope: "tvtime_movie",
		tvtimeMovie: { sourceId: "m1", releaseDate: "1995-11-22" },
		mediaType: "movie",
		title: "Die Spielzeuggeschichte",
		year: 1995,
		tmdbId: null,
		imdbId: null,
		wishlistEvidence: evidence,
	},
}
const group: WishlistMatchGroup = {
	representativeIndex: 2,
	item: movieRow,
	entryCount: 3,
	evidenceVariants: [
		{
			title: "Die Spielzeuggeschichte",
			year: 1995,
			sourceId: "m1",
			releaseDate: "1995-11-22",
		},
	],
	hasMoreEvidence: false,
	matchScope: "tvtime_movie",
	allowedMediaTypes: ["movie"],
	intentCounts: { watch: 2, want: 1 },
}

type Net = {
	/** Answers to POST /preview, in order. */
	previews?: ImportSummary[]
	/** A refusal to answer POST /preview with instead. */
	previewRefusal?: { status: number; body: unknown }
	/** Answers to GET /api/imports/:id, in order; the last one repeats. */
	summaries?: Record<string, ImportSummary[]>
	/** The suggestions page to answer. */
	suggestions?: unknown
	bulkRefusal?: { status: number; body: unknown }
	discardRefusal?: { status: number; body: unknown }
	/** The import list. */
	list?: ImportSummary[]
	listAfterRefusal?: ImportSummary[]
}
const discarded = new Set<string>()
let net: Net = {}
let refused = false
/** Previews the member confirmed; any other preview stays a preview when asked again. */
const confirmed = new Set<string>()
/** The latest answer for each preview, so a refetch returns what the member saw. */
const known = new Map<string, ImportSummary>()
let sent: { method: string; url: string; body: unknown }[] = []
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
		body:
			init?.body instanceof FormData
				? Object.fromEntries(
						[...init.body.entries()].map(([key, value]) => [
							key,
							typeof value === "string" ? value : `file:${value.name}`,
						]),
					)
				: init?.body
					? JSON.parse(String(init.body))
					: null,
	})
	const parsed = new URL(url, "https://goodwatch.app")
	if (parsed.pathname === "/api/imports/preview") {
		if (net.previewRefusal) {
			refused = true
			return respond(net.previewRefusal.status, net.previewRefusal.body)
		}
		const next = net.previews?.shift()
		if (next) known.set(next.id, next)
		return next
			? respond(200, { import: next })
			: respond(400, { error: "No preview" })
	}
	if (parsed.pathname.endsWith("/accept-suggestions")) {
		if (net.bulkRefusal)
			return respond(net.bulkRefusal.status, net.bulkRefusal.body)
		const child = summary(BULK, { wishlistUnresolvedMatchCount: 1 })
		known.set(BULK, child)
		return respond(201, {
			import: child,
			parentImportId: parsed.pathname.split("/")[3],
			acceptedCount: 2,
			skippedCount: 0,
		})
	}
	if (parsed.pathname.endsWith("/discard")) {
		if (net.discardRefusal)
			return respond(net.discardRefusal.status, net.discardRefusal.body)
		discarded.add(parsed.pathname.split("/")[3])
		return respond(200, { resolution: { state: "cancelled" } })
	}
	if (parsed.pathname.endsWith("/suggestions") && net.suggestions)
		return respond(200, net.suggestions)
	if (parsed.pathname.endsWith("/suggestions"))
		return respond(200, {
			groups: [
				{
					representativeIndex: 2,
					state: "manual",
					reason: "unsupported_source",
				},
			],
			total: 1,
			offset: 0,
			hasMore: false,
			nextOffset: null,
		})
	if (parsed.pathname.endsWith("/resolve")) {
		const child = summary(CHILD, {
			counts: { ...summary(CHILD).counts, new: 5, unmatched: 2 },
			wishlistUnresolvedMatchCount: 0,
		})
		known.set(CHILD, child)
		return respond(200, { import: child, parentImportId: PARENT })
	}
	if (parsed.pathname.endsWith("/confirm")) {
		const id = parsed.pathname.split("/")[3]
		confirmed.add(id)
		return respond(200, { import: summary(id, { status: "running" }) })
	}
	if (parsed.pathname.endsWith("/matches")) {
		if (parsed.searchParams.get("q") !== null)
			return respond(200, {
				index: Number(parsed.searchParams.get("index")),
				candidates: [
					{
						mediaType: "movie",
						tmdbId: 862,
						title: "Toy Story",
						year: 1995,
						posterPath: null,
					},
				],
			})
		return respond(200, {
			groups: [group],
			total: 1,
			offset: 0,
			hasMore: false,
		})
	}
	if (parsed.pathname.endsWith("/items"))
		return respond(200, { items: [], total: 0 })
	if (parsed.pathname === "/api/imports")
		return respond(200, {
			imports: (refused ? net.listAfterRefusal : undefined) ?? net.list ?? [],
		})
	const id = /^\/api\/imports\/([^/]+)$/.exec(parsed.pathname)?.[1]
	if (id && discarded.has(id))
		return respond(404, {
			error: "This preview was discarded. Upload the file again.",
			code: "tvtime_preview_discarded",
		})
	const queued = id ? net.summaries?.[id] : undefined
	if (queued?.length)
		return respond(200, {
			import: queued.length > 1 ? queued.shift() : queued[0],
		})
	if (id)
		return respond(200, {
			import: confirmed.has(id)
				? summary(id, { status: "running" })
				: (known.get(id) ?? summary(id)),
		})
	return respond(404, { error: "not stubbed" })
}) as typeof fetch

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { SourceImportFlow } = await import("./SourceImportFlow")

const settle = async (times = 4) => {
	for (let i = 0; i < times; i++)
		await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
}

const gdprZip = () =>
	new File(["PK"], "gdpr-data.zip", { type: "application/zip" })

/** Waits long enough for the preview's 1.5-second progress poll to run. */
const poll = async () => {
	await act(async () => new Promise((resolve) => setTimeout(resolve, 1700)))
	await settle()
}

async function flow(
	props: { start?: ImportSummary; handoff?: boolean; open?: boolean },
	setup: Net = {},
) {
	net = setup
	refused = false
	sent = []
	known.clear()
	confirmed.clear()
	discarded.clear()
	if (props.start) known.set(props.start.id, props.start)
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	const container = document.createElement("div")
	document.body.appendChild(container)
	const root = createRoot(container as unknown as Element)
	await act(async () =>
		root.render(
			h(
				QueryClientProvider,
				{ client },
				h(SourceImportFlow, {
					source: "tvtime",
					initial: {
						imports: setup.list ?? (props.start ? [props.start] : []),
					},
					initialId: props.open === false ? undefined : props.start?.id,
					handoff: props.handoff
						? {
								file: gdprZip(),
								recognition: { source: "tvtime", label: "TV Time export" },
							}
						: undefined,
				}),
			),
		),
	)
	await settle()
	const all = <T,>(selector: string) =>
		[...container.querySelectorAll(selector)] as unknown as T[]
	const visible = () =>
		all<HTMLButtonElement>("button")
			.filter((item) => !item.closest("[hidden]"))
			.map((item) => ({
				item,
				text: (item.textContent ?? "").replace(/\s+/g, " ").trim(),
			}))
	const button = (name: string) => {
		const names = visible()
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
	return {
		text: () => (container.textContent ?? "").replace(/\s+/g, " "),
		sent: () => sent.map((item) => ({ ...item })),
		buttons: () => visible().map(({ text }) => text),
		disabled: (name: string) => button(name).disabled,
		radios: () =>
			all<HTMLInputElement>('input[type="radio"]').map(
				(input) =>
					input.closest("label")?.textContent?.replace(/\s+/g, " ").trim() ??
					"",
			),
		click: async (name: string) => {
			const target = button(name)
			await act(async () => target.click())
			await settle()
		},
		pick: async (label: string) => {
			const target = radio(label)
			await act(async () => target.click())
			await settle()
		},
		unmount: () => act(async () => root.unmount()),
	}
}

const results: Record<string, unknown> = {}

{
	const view = await flow({ start: summary(PARENT) })
	results.closed = { text: view.text(), sent: view.sent() }
	await view.click("Match movies")
	results.opened = { text: view.text(), sent: view.sent() }
	await view.click("Find a match")
	results.editor = {
		text: view.text(),
		sent: view.sent(),
		radios: view.radios(),
	}
	await view.pick("Toy Story")
	await view.click("Use this match")
	results.chosen = {
		text: view.text(),
		startDisabled: view.disabled("Start import"),
	}
	await view.click("Update preview")
	results.child = {
		text: view.text(),
		sent: view.sent(),
		buttons: view.buttons(),
	}
	await view.pick("Preserve dates")
	await view.click("Start import")
	results.confirmed = { sent: view.sent() }
	await view.unmount()
}

{
	// A run in progress publishes a replacement, and the page moves to it.
	const running = summary(PARENT, { resolution: resolution() })
	const view = await flow(
		{ start: running },
		{
			summaries: {
				[PARENT]: [
					running,
					summary(PARENT, {
						resolution: resolution({
							state: "completed",
							phase: "publishing",
							processed: 8088,
							matched: 5866,
							pending: 0,
							replacementId: NEXT,
						}),
					}),
				],
				[NEXT]: [
					summary(NEXT, {
						resolution: resolution({
							state: "completed",
							phase: "publishing",
							processed: 8088,
							matched: 5866,
							pending: 0,
							replacementId: NEXT,
						}),
					}),
				],
			},
		},
	)
	results.progress = { text: view.text(), buttons: view.buttons() }
	await poll()
	await poll()
	results.replaced = { text: view.text(), sent: view.sent() }
	await view.unmount()
}

{
	// Early Confirm imports what's matched so far.
	const running = summary(PARENT, { resolution: resolution() })
	const view = await flow(
		{ start: running },
		{ summaries: { [PARENT]: [running] } },
	)
	await view.pick("Preserve dates")
	results.early = { text: view.text(), buttons: view.buttons() }
	await view.click("Import what's matched so far")
	results.earlyConfirmed = { sent: view.sent() }
	await view.unmount()
}

{
	// Discarding during a run cancels it, and its later replacement is never followed.
	const running = summary(PARENT, { resolution: resolution() })
	const view = await flow(
		{ start: running },
		{
			summaries: {
				[PARENT]: [
					running,
					summary(PARENT, {
						resolution: resolution({ state: "completed", replacementId: NEXT }),
					}),
				],
			},
		},
	)
	await view.click("Discard and choose another file")
	await poll()
	results.discarded = { text: view.text(), sent: view.sent() }
	await view.unmount()
}

{
	// Matches not yet sent hold back a replacement until the member loads it.
	const view = await flow(
		{ start: summary(PARENT, { resolution: resolution() }) },
		{
			summaries: {
				[PARENT]: [
					summary(PARENT, { resolution: resolution() }),
					summary(PARENT, {
						resolution: resolution({ state: "completed", replacementId: NEXT }),
					}),
				],
			},
		},
	)
	await view.click("Match movies")
	await view.click("Find a match")
	await view.pick("Toy Story")
	await view.click("Use this match")
	await poll()
	await poll()
	results.held = {
		text: view.text(),
		buttons: view.buttons(),
		sent: view.sent(),
	}
	await view.unmount()
}

{
	// Suggestions: evidence in plain words, Accept all, and Reject.
	const done = summary(PARENT, {
		resolution: resolution({ state: "completed", pending: 0 }),
	})
	const view = await flow(
		{ start: done },
		{ summaries: { [PARENT]: [done] }, suggestions: suggested },
	)
	await view.click("Match movies")
	results.suggested = {
		text: view.text(),
		buttons: view.buttons(),
		sent: view.sent(),
	}
	await view.click("Accept all 2 suggestions")
	results.bulk = { text: view.text(), sent: view.sent() }
	await view.unmount()
}

{
	const done = summary(PARENT, {
		resolution: resolution({ state: "completed", pending: 0 }),
	})
	const view = await flow(
		{ start: done },
		{ summaries: { [PARENT]: [done] }, suggestions: suggested },
	)
	await view.click("Match movies")
	await view.click("Reject")
	results.rejected = { text: view.text() }
	await view.click("Update preview")
	results.rejectSent = { sent: view.sent() }
	await view.unmount()
}

{
	const done = summary(PARENT, {
		resolution: resolution({ state: "completed", pending: 0 }),
	})
	const view = await flow(
		{ start: done },
		{ summaries: { [PARENT]: [done] }, suggestions: suggested },
	)
	await view.click("Match movies")
	await view.click("Accept the suggestion")
	results.individualAccepted = {
		text: view.text(),
		startDisabled: view.disabled("Start import"),
		bulkDisabled: view.disabled("Accept all 2 suggestions"),
	}
	await view.click("Update preview")
	results.individualSent = { sent: view.sent(), text: view.text() }
	await view.unmount()
}

{
	const done = summary(PARENT, {
		resolution: resolution({ state: "completed", pending: 0 }),
	})
	const view = await flow(
		{ start: done },
		{
			summaries: { [PARENT]: [done] },
			suggestions: suggested,
			bulkRefusal: {
				status: 409,
				body: {
					code: "tvtime_suggestion_stale",
					error: "These suggestions have changed. Review them again.",
				},
			},
		},
	)
	await view.click("Match movies")
	await view.click("Accept all 2 suggestions")
	results.stale = { text: view.text(), buttons: view.buttons() }
	await view.click("Refresh suggestions")
	results.refreshed = { sent: view.sent() }
	await view.unmount()
}

{
	const running = summary(PARENT, { resolution: resolution() })
	const view = await flow(
		{ start: running },
		{
			summaries: { [PARENT]: [running] },
			discardRefusal: {
				status: 503,
				body: { error: "Discard could not finish. Try again." },
			},
		},
	)
	await view.click("Discard and choose another file")
	results.discardFailed = { text: view.text(), buttons: view.buttons() }
	await view.unmount()
}

// Busy refusals say so, and when to try again.
for (const [name, code, error] of [
	[
		"busyGlobal",
		"tvtime_resolution_global_busy",
		"Two imports are already matching. Try again after one finishes.",
	],
	[
		"busyMember",
		"tvtime_resolution_member_busy",
		"You already have an import matching. Wait for it to finish or discard it.",
	],
] as const) {
	const matching = summary(RERUN, { createdAt: "2026-10-19T09:00:00.000Z" })
	const view = await flow(
		{ handoff: true },
		{
			previewRefusal: { status: 409, body: { error, code } },
			listAfterRefusal: name === "busyMember" ? [matching] : [],
		},
	)
	results[name] = { text: view.text(), buttons: view.buttons() }
	await view.unmount()
}

{
	// Coming back: an unconfirmed TV Time preview opens again.
	const running = summary(PARENT, { resolution: resolution() })
	const view = await flow(
		{ start: running, open: false },
		{ list: [running], summaries: { [PARENT]: [running] } },
	)
	results.resumed = { text: view.text() }
	await view.unmount()
}

{
	const limited = summary(PARENT, {
		tvtimeLookupLimitCount: 3,
		resolution: resolution({ state: "limited", pending: 0 }),
	})
	const view = await flow(
		{ start: limited },
		{ summaries: { [PARENT]: [limited] } },
	)
	results.limited = { text: view.text(), buttons: view.buttons() }
	await view.unmount()
}

{
	const view = await flow({
		start: summary(PARENT, { tvtimeLookupUnavailableCount: 2 }),
	})
	results.outage = { text: view.text(), buttons: view.buttons() }
	await view.unmount()
}

process.stdout.write(`__TVTIME_IMPORT__${JSON.stringify(results)}`)
process.exit(0)
