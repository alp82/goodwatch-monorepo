// Questions while an import runs, in happy-dom: the real Imports page and query hooks, with a stand-in server that
// holds rows for questions the way the import APIs do (confirm with `ask`, items?waiting=, decide). Each scenario acts
// like a member and records what was sent and what the screen said.
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
import type {
	ImportItem,
	ImportOptions,
	ImportQuestion,
	ImportSummary,
} from "~/domain/imports"

const ID = "00000000-0000-4000-8000-0000000000aa"
const IMDB_ID = "00000000-0000-4000-8000-0000000000bb"

/**
 * A held row: what the items API lists, the question it waits on, and where it stands. `next` is the question it comes
 * to once its first question is answered yes (the server's gate order): asked, it waits there; not asked, it is left.
 */
type Row = ImportItem & {
	question: ImportQuestion
	state: string
	next?: ImportQuestion
}
const row = (
	index: number,
	question: ImportQuestion,
	extra: Partial<ImportItem> & { next?: ImportQuestion },
): Row =>
	({
		index,
		key: `trakt:${index}`,
		kind: "rating",
		mediaType: "movie",
		title: "Heat",
		year: 1995,
		tmdbId: 949,
		imdbId: null,
		outcome: "conflict",
		reason: null,
		question,
		state: "",
		...extra,
	}) as Row

/** The stand-in server's import: its summary, its held rows, and how it answers decide. */
const server = {
	summary: null as ImportSummary | null,
	imdb: null as ImdbImportSummary | null,
	rows: [] as Row[],
	/** Decide answers fail with this, once, then work. */
	refuseNext: null as string | null,
	/** How long a response waits before it arrives. It is made when the request comes, so it can be out of date. */
	delay: null as ((url: string) => number) | null,
	/** A deploy from before items?waiting= took a title: it refuses tmdbId and mediaType with 400. */
	noTitleFilter: false,
}

const freshRows = (): Row[] => [
	row(0, "conflict", { score: 9, currentScore: 8 }),
	row(1, "conflict", {
		kind: "review",
		key: "trakt:1",
		score: null,
		currentScore: null,
	}),
	row(2, "conflict", {
		title: "Alien",
		tmdbId: 348,
		score: 10,
		currentScore: 7,
	}),
	row(3, "conflict", {
		title: "Brazil",
		tmdbId: 68,
		score: 6,
		currentScore: 9,
	}),
	row(4, "rewatch", { kind: "want", title: "Seen Film", tmdbId: 11 }),
]

const preview = (questions: boolean): ImportSummary => ({
	id: ID,
	source: "trakt",
	fileName: "trakt-export.zip",
	status: "preview",
	createdAt: "2026-10-24T12:00:00.000Z",
	finishedAt: null,
	counts: {
		rows: 7,
		new: 2,
		unchanged: 0,
		conflict: 5,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
	},
	kinds: {
		rating: 4,
		episode_rating: 0,
		watch: 0,
		want: 2,
		favorite: 0,
		review: 1,
		show_status: 0,
	} as ImportSummary["kinds"],
	...(questions
		? {
				questions: [
					{
						kind: "conflict",
						waiting: 4,
						applying: 0,
						answer: null,
						byKind: { rating: 3, review: 1 },
					},
					{
						kind: "rewatch",
						waiting: 1,
						applying: 0,
						answer: null,
						byKind: { want: 1 },
					},
					{
						kind: "wholeShow",
						waiting: 0,
						applying: 0,
						answer: null,
						byKind: {},
					},
					{
						kind: "undated",
						waiting: 2,
						applying: 0,
						answer: null,
						byKind: { watch: 2 },
					},
				],
			}
		: {}),
	warnings: [],
	options: null,
	processed: 0,
	total: 0,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
})

/** The live summary, with question counts from the held rows, as GET /api/imports/:id answers it. */
function live(): ImportSummary {
	const base = server.summary as ImportSummary
	const ask = base.options?.ask ?? []
	return {
		...base,
		...(base.status === "preview"
			? {}
			: {
					questions: ask.map((kind) => ({
						kind,
						waiting: server.rows.filter(
							(item) =>
								item.question === kind && item.state === `waiting:${kind}`,
						).length,
						applying: server.rows.filter(
							(item) =>
								item.question === kind && item.state === `approved:${kind}`,
						).length,
						answer: base.options?.answers?.[kind] ?? null,
					})),
				}),
	}
}

const imdbLive = (): ImdbImportSummary => {
	const base = server.imdb as ImdbImportSummary
	if (base.status === "preview") return base
	return {
		...base,
		questions: [
			{
				kind: "conflict",
				waiting: server.rows.filter((item) => item.state === "waiting:conflict")
					.length,
				applying: 0,
				answer: null,
			},
		],
	}
}

/** Moves held rows as decide does: keep and leave are kept, the source's answers wait to be written. */
function decide(question: ImportQuestion, answer: string, rows?: number[]) {
	let decided = 0
	const ask = server.summary?.options?.ask ?? []
	for (const item of server.rows)
		if (
			item.state === `waiting:${question}` &&
			(!rows || rows.includes(item.index))
		) {
			decided++
			if (answer === "keep" || answer === "leave") item.state = "kept"
			else if (item.next) {
				// Gated again: held for the next question when it was asked, else left as it is without asking.
				item.state = ask.includes(item.next) ? `waiting:${item.next}` : "left"
				item.question = item.next
				item.next = undefined
			} else item.state = `approved:${question}`
		}
	return decided
}

type Sent = { url: string; body: unknown }
let sent: Sent[] = []
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	const url = String(input)
	const body = init?.body ? JSON.parse(String(init.body)) : null
	sent.push({ url, body })
	const response = respond(url, body)
	const ms = server.delay?.(url) ?? 0
	if (ms) await new Promise((resolve) => setTimeout(resolve, ms))
	return response
}) as typeof fetch

// biome-ignore lint/suspicious/noExplicitAny: the stand-in reads whatever the client posts
function respond(url: string, body: any): Response {
	const path = url.split("?")[0]
	const params = new URL(url, "https://goodwatch.app").searchParams
	if (path.endsWith("/decide")) {
		if (server.refuseNext) {
			const error = server.refuseNext
			server.refuseNext = null
			return json({ error }, 409)
		}
		if (path.startsWith("/api/imdb-import")) {
			const decided = decide(
				"conflict",
				body.answer === "imdb" ? "source" : "keep",
				body.rows,
			)
			return json({ import: imdbLive(), decided })
		}
		const approved = () =>
			server.rows.filter((item) => item.state.startsWith("approved:")).length
		const before = approved()
		const decided = decide(body.question, body.answer, body.rows)
		const summary = server.summary as ImportSummary
		// Answers that bring rows in start a finished run again.
		if (summary.status === "done" && approved() > before)
			summary.status = "running"
		if (!body.rows && summary.options)
			summary.options = {
				...summary.options,
				answers: { ...summary.options.answers, [body.question]: body.answer },
			}
		return json({ import: live(), decided })
	}
	if (path === `/api/imports/${ID}/confirm`) {
		const options = body as ImportOptions
		server.summary = {
			...(server.summary as ImportSummary),
			status: "running",
			options,
			processed: 1,
			total: 7,
		}
		for (const item of server.rows)
			if (options.ask?.includes(item.question))
				item.state = `waiting:${item.question}`
		return json({ import: live() })
	}
	if (path === `/api/imdb-import/${IMDB_ID}/confirm`) {
		server.imdb = {
			...(server.imdb as ImdbImportSummary),
			status: "running",
			conflictChoice: body.conflictChoice,
			processed: 1,
			total: 3,
		}
		for (const item of server.rows) item.state = "waiting:conflict"
		return json({ import: imdbLive() })
	}
	if (params.get("waiting")) {
		const question = params.get("waiting")
		const tmdbId = params.get("tmdbId")
		const mediaType = params.get("mediaType")
		if ((tmdbId || mediaType) && server.noTitleFilter)
			return json({ error: "We couldn't load those import rows." }, 400)
		const all = server.rows.filter(
			(item) =>
				item.state === `waiting:${question}` &&
				(!tmdbId ||
					(String(item.tmdbId) === tmdbId && item.mediaType === mediaType)),
		)
		const offset = Number(params.get("offset") ?? 0)
		const held = all.slice(offset, offset + Number(params.get("limit") ?? 50))
		if (path.startsWith("/api/imdb-import"))
			return json({
				total: all.length,
				items: held.map((item) => ({
					index: item.index,
					imdbId: `tt${item.index}`,
					title: item.title,
					year: item.year,
					titleType: "Movie",
					imdbScore: item.score,
					dateRated: null,
					outcome: "conflict",
					reason: null,
					tmdbId: item.tmdbId,
					mediaType: item.mediaType,
					currentScore: item.currentScore,
				})),
			})
		return json({
			total: all.length,
			items: held.map(({ question: _q, state, next: _n, ...item }) => ({
				...item,
				applyState: state,
			})),
		})
	}
	if (params.get("by") === "title")
		return json({ operation: "import", titles: 3, sections: [] })
	if (path.endsWith("/posters"))
		return json({
			posters: [
				{ key: "movie:949", title: "Heat", posterPath: "/heat.jpg" },
				{ key: "movie:348", title: "Alien", posterPath: "/alien.jpg" },
				{ key: "movie:11", title: "Seen Film", posterPath: "/seen.jpg" },
			],
		})
	if (path.includes("/items")) return json({ items: [], total: 0 })
	if (path === `/api/imports/${ID}`) return json({ import: live() })
	if (path === `/api/imdb-import/${IMDB_ID}`)
		return json({ import: imdbLive() })
	if (path === "/api/imports" || path === "/api/imdb-import")
		return json({ imports: [] })
	return json({ error: "not stubbed" }, 404)
}

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { RouterProvider, createMemoryRouter } = await import("react-router-dom")
const { ImportSourcesPage } = await import("./ImportSourcesPage")

type PageProps = Parameters<typeof ImportSourcesPage>[0]
const settle = () =>
	act(async () => new Promise((resolve) => setTimeout(resolve, 30)))
const LOCK = 760

async function page(props: Partial<PageProps>) {
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
	for (let i = 0; i < 3; i++) await settle()
	const buttons = () =>
		[...container.querySelectorAll("button")] as unknown as HTMLButtonElement[]
	const view = {
		text: () => (container.textContent ?? "").replace(/\s+/g, " "),
		heading: () => container.querySelector("h2")?.textContent ?? null,
		counter: () =>
			container.querySelector("[data-question-counter]")?.textContent ?? null,
		answers: () =>
			buttons()
				.filter((b) => b.hasAttribute("data-answer"))
				.map((b) => ({
					text: (b.textContent ?? "").replace("Suggested", "").trim(),
					pressed: b.getAttribute("aria-pressed"),
					suggested: b.hasAttribute("data-suggested"),
				})),
		steps: () =>
			[...container.querySelectorAll("[data-step]")].map((li) => ({
				step: li.getAttribute("data-step"),
				current: !!li.querySelector("[aria-current=step]"),
				done: li.hasAttribute("data-step-done"),
				note: (li.querySelector("span + span")?.textContent ?? "").trim(),
			})),
		strip: () =>
			container
				.querySelector("[data-progress-strip]")
				?.getAttribute("data-progress-strip") ?? null,
		stripNote: () =>
			container.querySelector("[data-strip-note]")?.textContent ?? null,
		error: () =>
			container.querySelector("[data-question-error]")?.textContent ?? "",
		left: () =>
			[...container.querySelectorAll("[data-left]")].map((li) => ({
				kind: li.getAttribute("data-left"),
				line: li.querySelector("span")?.textContent ?? "",
				label: li.querySelector("button")?.getAttribute("aria-label") ?? "",
			})),
		posts: () =>
			sent
				.filter((call) => call.body !== null)
				.map((call) => ({ url: call.url, body: call.body })),
		click: async (label: string, exact = false) => {
			const button = buttons().find((b) =>
				exact
					? (b.textContent ?? "").replace("Suggested", "").trim() === label
					: b.textContent?.includes(label),
			)
			if (!button) throw new Error(`No button "${label}"`)
			await act(async () => button.click())
			await settle()
		},
		tick: async (name: string) => {
			const input = container.querySelector(
				`input[name="${name}"]`,
			) as unknown as HTMLInputElement | null
			if (!input) throw new Error(`No checkbox "${name}"`)
			await act(async () => input.click())
			await settle()
		},
		wait: async (ms: number) => {
			await act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
			await settle()
		},
		/** The heading has focus, as a screen reader would land on it. */
		headingFocused: () =>
			!!document.activeElement &&
			document.activeElement === container.querySelector("h2"),
		laterDisabled: () =>
			(
				container.querySelector(
					"[data-decide-later]",
				) as unknown as HTMLButtonElement | null
			)?.disabled ?? null,
		checked: (name: string) =>
			(
				container.querySelector(
					`input[name="${name}"]`,
				) as unknown as HTMLInputElement | null
			)?.checked ?? null,
		/** The example poster slots of a yes/no question, with their titles. */
		slots: () =>
			[...container.querySelectorAll("[data-held-posters] li")].map((li) =>
				(li.textContent ?? "").trim(),
			),
		/** Waits, a little at a time, until `done` holds or `ms` have passed. */
		until: async (done: () => boolean, ms = 4000) => {
			for (let waited = 0; waited < ms && !done(); waited += 50)
				await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
		},
		/** The screen as a member sees it now. */
		snap: () => ({
			heading: view.heading(),
			counter: view.counter(),
			answers: view.answers(),
			strip: view.strip(),
			stripNote: view.stripNote(),
			laterOffered: view.text().includes("Decide later"),
			text: view.text(),
		}),
		unmount: () => act(async () => root.unmount()),
	}
	return view
}

const results: Record<string, unknown> = {}

{
	// A preview that counts its questions: Import starts the import, then the questions come while it runs.
	server.summary = preview(true)
	server.rows = freshRows()
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "trakt",
		openImport: ID,
	})
	const choose = view.heading()
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	const first = view.snap()
	const firstSteps = view.steps()
	const confirms = view.posts().filter((call) => call.url.endsWith("/confirm"))
	// Heat: one title with its score and its review, answered on its own.
	sent = []
	await view.click("Yes, keep my 8")
	const locking = view.answers()
	await view.wait(LOCK)
	const second = view.snap()
	const perTitle = view.posts()
	// Alien: the same answer for Alien and Brazil, sent without rows.
	sent = []
	await view.tick("same-for-all")
	const allAnswers = view.answers()
	await view.click("No, use Trakt's scores")
	await view.wait(LOCK)
	const third = view.snap()
	const sameForAll = view.posts()
	// The rewatch question is put off: nothing is sent, and the run view says it waits.
	sent = []
	await view.click("Decide later")
	const later = { ...view.snap(), sent: view.posts() }
	// The run finishes with the question still waiting: Done lists it, with no tick.
	server.summary = {
		...(server.summary as ImportSummary),
		status: "done",
		processed: 7,
		canUndo: true,
		finishedAt: "2026-10-24T12:05:00.000Z",
	}
	await view.wait(1600)
	for (let i = 0; i < 3; i++) await settle()
	const done = { ...view.snap(), left: view.left(), steps: view.steps() }
	// Decide reopens the rewatch question. The first answer is refused: it stays unpicked, with the reason.
	await view.click("Decide")
	const reopened = view.snap()
	server.refuseNext = "This import cannot accept answers now."
	sent = []
	await view.click("No, leave it as Seen")
	await view.wait(LOCK)
	const refused = { ...view.snap(), error: view.error(), sent: view.posts() }
	sent = []
	await view.click("No, leave it as Seen")
	await view.wait(LOCK)
	for (let i = 0; i < 3; i++) await settle()
	const finished = {
		...view.snap(),
		left: view.left(),
		steps: view.steps(),
		sent: view.posts(),
	}
	results.run = {
		choose,
		first,
		firstSteps,
		confirms,
		locking,
		second,
		perTitle,
		allAnswers,
		third,
		sameForAll,
		later,
		done,
		reopened,
		refused,
		finished,
	}
	await view.unmount()
}

{
	// Back later: an import done with a question waiting opens on Done, which lists it; nothing is asked on arrival.
	server.rows = freshRows()
	for (const item of server.rows)
		item.state = item.question === "rewatch" ? "waiting:rewatch" : "kept"
	server.summary = {
		...preview(true),
		status: "done",
		options: {
			kinds: ["rating", "review", "want"],
			conflictChoice: "keep",
			watchDates: "preserve",
			ask: ["conflict", "rewatch"],
			answers: { conflict: "keep" },
		},
		processed: 7,
		total: 7,
		canUndo: true,
		finishedAt: "2026-10-24T12:05:00.000Z",
	}
	// Opened from the history: the page reads the import itself, with its live question counts.
	const view = await page({ initialSource: "trakt", openImport: ID })
	for (let i = 0; i < 3; i++) await settle()
	results.revisit = {
		...view.snap(),
		left: view.left(),
		undo: view.text().includes("Undo this import"),
	}
	await view.unmount()
}

{
	// An older preview without question counts asks before the import starts, as stage 1 did.
	server.summary = preview(false)
	server.rows = freshRows()
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "trakt",
		openImport: ID,
	})
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	results.oldPreview = {
		...view.snap(),
		confirms: view.posts().filter((call) => call.url.endsWith("/confirm")),
	}
	await view.unmount()
}

{
	// IMDb ratings: Import starts with "ask", then each differing score is asked by title.
	server.rows = [
		row(0, "conflict", { score: 10, currentScore: 8 }),
		row(1, "conflict", {
			title: "Alien",
			tmdbId: 348,
			score: 9,
			currentScore: 6,
		}),
	]
	server.imdb = {
		id: IMDB_ID,
		status: "preview",
		fileName: "ratings.csv",
		createdAt: "2026-10-24T12:00:00.000Z",
		finishedAt: null,
		counts: {
			rows: 3,
			new: 1,
			update: 0,
			unchanged: 0,
			conflict: 2,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		},
		conflictChoice: null,
		processed: 0,
		total: 0,
		applied: { added: 0, updated: 0, kept: 0, failed: 0 },
		withoutFingerprint: null,
		stalled: false,
		canUndo: false,
		error: null,
	}
	const view = await page({
		imdbImports: [server.imdb],
		initialSource: "imdb",
		openImport: IMDB_ID,
	})
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	const first = view.snap()
	const confirms = view.posts().filter((call) => call.url.endsWith("/confirm"))
	sent = []
	await view.click("No, use IMDb's 10")
	await view.wait(LOCK)
	results.imdb = {
		first,
		confirms,
		decided: view.posts(),
		second: view.snap(),
	}
	await view.unmount()
}

const DETAIL = `/api/imports/${ID}`
const counted = (
	waiting: Partial<Record<ImportQuestion, Record<string, number>>>,
): ImportSummary["questions"] =>
	(["conflict", "rewatch", "wholeShow", "undated"] as const).map((kind) => {
		const byKind = waiting[kind] ?? {}
		return {
			kind,
			waiting: Object.values(byKind).reduce((sum, n) => sum + n, 0),
			applying: 0,
			answer: null,
			byKind,
		}
	})

{
	// A season wish for a show already Seen: held for the whole show first, then for rewatch once that's a yes.
	server.rows = [
		row(0, "wholeShow", {
			kind: "want",
			mediaType: "show",
			tmdbId: 1396,
			title: "Breaking Bad",
			next: "rewatch",
		}),
	]
	server.summary = {
		...preview(true),
		source: "mdblist",
		fileName: "MDBList",
		counts: { ...preview(true).counts, rows: 1, new: 0, conflict: 1 },
		kinds: { ...preview(true).kinds, rating: 0, want: 1, review: 0 },
		questions: counted({ wholeShow: { want: 1 } }),
		wishlistShowChoiceCount: 1,
		wishlistRewatchChoiceCount: 1,
	}
	// The held rows come late: the example posters keep their place meanwhile.
	server.delay = (url) => (url.includes("waiting=wholeShow") ? 600 : 0)
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "mdblist",
		openImport: ID,
	})
	await view.click("Import", true)
	const slotsBefore = view.slots()
	const heading = view.heading()
	await view.wait(700)
	const slotsAfter = view.slots()
	server.delay = null
	const confirms = view.posts().filter((call) => call.url.endsWith("/confirm"))
	sent = []
	await view.click("Yes, add the whole show")
	await view.wait(LOCK)
	results.seasonWish = {
		heading,
		confirms,
		slotsBefore,
		slotsAfter,
		decided: view.posts(),
		next: view.snap(),
		row: server.rows[0].state,
	}
	await view.unmount()
}

{
	// Heat's rows straddle the loaded page: its score comes first, 600 more of its entries after 199 other titles.
	server.rows = [
		row(0, "conflict", { score: 9, currentScore: 8 }),
		...Array.from({ length: 199 }, (_, at) =>
			row(at + 1, "conflict", {
				title: `Film ${at + 1}`,
				tmdbId: 10_000 + at,
				score: 6,
				currentScore: 7,
			}),
		),
		...Array.from({ length: 600 }, (_, at) =>
			row(200 + at, "conflict", {
				kind: "review",
				score: null,
				currentScore: null,
			}),
		),
	]
	server.summary = {
		...preview(true),
		counts: { ...preview(true).counts, rows: 800, new: 0, conflict: 800 },
		kinds: { ...preview(true).kinds, rating: 200, want: 0, review: 600 },
		questions: counted({ conflict: { rating: 200, review: 600 } }),
	}
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "trakt",
		openImport: ID,
	})
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	const first = view.heading()
	sent = []
	await view.click("Yes, keep my 8")
	await view.wait(LOCK)
	await view.until(() => view.heading() !== first)
	const decided = view.posts()
	const titleReads = sent.filter((call) =>
		call.url.includes("waiting=conflict"),
	)
	results.split = {
		first,
		reads: titleReads.map((call) => call.url),
		batches: decided.map((call) => {
			const rows = (call.body as { rows?: number[] }).rows ?? []
			return { count: rows.length, first: rows[0], last: rows.at(-1) }
		}),
		heldLeft: server.rows.filter(
			(item) => item.tmdbId === 949 && item.state === "waiting:conflict",
		).length,
		next: view.heading(),
	}

	// While an answer is on its way, Decide later waits; a refused answer keeps its question and the reason.
	server.refuseNext = "This import cannot accept answers now."
	server.delay = (url) => (url.endsWith("/decide") ? 400 : 0)
	const asked = view.heading()
	sent = []
	await view.click("No, use Trakt's 6")
	const laterWhilePending = view.laterDisabled()
	await view.click("Decide later")
	const afterLaterClick = view.heading()
	await view.wait(LOCK)
	server.delay = null
	results.pending = {
		asked,
		laterWhilePending,
		afterLaterClick,
		settled: { ...view.snap(), error: view.error() },
		laterAfter: view.laterDisabled(),
	}
	await view.unmount()
}

{
	// Another tab answers the title on screen: polling brings the next one. Its "Same answer for all" starts unticked,
	// and focus stays where it was; the member's own answer moves focus to the screen it brings.
	server.rows = freshRows()
	server.summary = preview(true)
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "trakt",
		openImport: ID,
	})
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	const firstFocused = view.headingFocused()
	await view.tick("same-for-all")
	const tickedFirst = view.checked("same-for-all")
	decide("conflict", "keep", [0, 1])
	await view.until(() => (view.heading() ?? "").includes("Alien"))
	const swapped = {
		heading: view.heading(),
		ticked: view.checked("same-for-all"),
		focused: view.headingFocused(),
	}
	sent = []
	await view.click("Yes, keep my 7")
	await view.wait(LOCK)
	results.otherTab = {
		firstFocused,
		tickedFirst,
		swapped,
		decided: view.posts(),
		next: view.heading(),
		nextFocused: view.headingFocused(),
	}
	await view.unmount()
}

{
	// A progress read sent before an answer, and arriving after it, says the run is done with the question waiting.
	// It is dropped: the run goes on, and Done comes with nothing left once the answer is in.
	server.rows = [
		row(4, "rewatch", { kind: "want", title: "Seen Film", tmdbId: 11 }),
	]
	server.summary = {
		...preview(true),
		questions: counted({ rewatch: { want: 1 } }),
	}
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "trakt",
		openImport: ID,
	})
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	const asked = view.heading()
	;(server.summary as ImportSummary).status = "done"
	server.delay = (url) => (url === DETAIL ? 1200 : 0)
	const polls = () => sent.filter((call) => call.url === DETAIL).length
	const before = polls()
	await view.until(() => polls() > before)
	server.delay = null
	await view.click("Yes, add to Want to rewatch")
	await view.wait(LOCK)
	// The answer's row goes in, and the run finishes.
	for (const item of server.rows) item.state = "added"
	;(server.summary as ImportSummary).status = "done"
	await view.wait(1300)
	await view.until(() => (view.heading() ?? "").startsWith("Done."))
	results.stalePoll = {
		asked,
		final: { ...view.snap(), left: view.left() },
	}
	await view.unmount()
}

{
	// A 50,000-row import: Heat's two rows are at both ends of the file. Its answer reads them in one request.
	server.rows = [
		row(0, "conflict", { score: 9, currentScore: 8 }),
		...Array.from({ length: 49_998 }, (_, at) =>
			row(at + 1, "conflict", {
				title: `Film ${at + 1}`,
				tmdbId: 10_000 + at,
				score: 6,
				currentScore: 7,
			}),
		),
		row(49_999, "conflict", {
			kind: "review",
			score: null,
			currentScore: null,
		}),
	]
	server.summary = {
		...preview(true),
		counts: { ...preview(true).counts, rows: 50_000, new: 0, conflict: 50_000 },
		kinds: { ...preview(true).kinds, rating: 49_999, want: 0, review: 1 },
		questions: counted({ conflict: { rating: 49_999, review: 1 } }),
	}
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "trakt",
		openImport: ID,
	})
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	const first = view.heading()
	sent = []
	await view.click("Yes, keep my 8")
	await view.wait(LOCK)
	await view.until(() => view.heading() !== first)
	results.large = {
		first,
		titleReads: sent
			.filter((call) => call.url.includes("tmdbId="))
			.map((call) => call.url),
		pageReads: sent.filter(
			(call) =>
				call.url.includes("waiting=conflict") &&
				!call.url.includes("tmdbId=") &&
				!call.url.includes("offset=0&"),
		).length,
		decided: view.posts(),
	}
	await view.unmount()
}

{
	// A deploy from before the title filter: Heat's rows are found by reading every page of the held rows.
	server.noTitleFilter = true
	server.rows = [
		row(0, "conflict", { score: 9, currentScore: 8 }),
		...Array.from({ length: 399 }, (_, at) =>
			row(at + 1, "conflict", {
				title: `Film ${at + 1}`,
				tmdbId: 10_000 + at,
				score: 6,
				currentScore: 7,
			}),
		),
		row(400, "conflict", { kind: "review", score: null, currentScore: null }),
	]
	server.summary = {
		...preview(true),
		counts: { ...preview(true).counts, rows: 401, new: 0, conflict: 401 },
		kinds: { ...preview(true).kinds, rating: 400, want: 0, review: 1 },
		questions: counted({ conflict: { rating: 400, review: 1 } }),
	}
	const view = await page({
		sourceImports: [server.summary],
		initialSource: "trakt",
		openImport: ID,
	})
	await view.click("Import", true)
	for (let i = 0; i < 3; i++) await settle()
	const first = view.heading()
	sent = []
	await view.click("Yes, keep my 8")
	await view.wait(LOCK)
	await view.until(() => view.heading() !== first)
	results.oldServer = {
		reads: sent
			.filter((call) => call.url.includes("waiting=conflict"))
			.map((call) => call.url),
		decided: view.posts(),
	}
	server.noTitleFilter = false
	await view.unmount()
}

{
	// A whole answer saved, but the request failed before its rows moved: they stay held under the answer. While the
	// run goes on, the strip counts them and no question comes; Done lists the answer with Finish, which sends it again.
	server.rows = freshRows().slice(2, 4)
	for (const item of server.rows) item.state = "waiting:conflict"
	server.summary = {
		...preview(true),
		status: "running",
		options: {
			kinds: ["rating"],
			conflictChoice: "source",
			watchDates: "preserve",
			ask: ["conflict"],
			answers: { conflict: "source" },
		},
		processed: 5,
		total: 7,
	}
	const view = await page({ initialSource: "trakt", openImport: ID })
	for (let i = 0; i < 3; i++) await settle()
	const running = view.snap()
	;(server.summary as ImportSummary).status = "done"
	;(server.summary as ImportSummary).finishedAt = "2026-10-24T12:05:00.000Z"
	await view.until(() => view.left().length > 0)
	const done = { ...view.snap(), left: view.left() }
	// The first Finish is refused: the answer stays listed, with the reason.
	server.refuseNext = "This import cannot accept answers now."
	sent = []
	await view.click("Finish")
	const refused = {
		left: view.left(),
		error:
			view.text().match(/This import cannot accept answers now\./)?.[0] ?? "",
		sent: view.posts(),
	}
	sent = []
	await view.click("Finish")
	const resent = view.posts()
	// The answer's rows go in, and the run finishes again.
	for (const item of server.rows) item.state = "updated"
	;(server.summary as ImportSummary).status = "done"
	await view.wait(1600)
	await view.until(() => (view.heading() ?? "").startsWith("Done."))
	results.unfinished = {
		running,
		done,
		refused,
		resent,
		final: { ...view.snap(), left: view.left() },
	}
	await view.unmount()
}

process.stdout.write(`__IMPORT_QUESTIONS__${JSON.stringify(results)}`)
process.exit(0)
