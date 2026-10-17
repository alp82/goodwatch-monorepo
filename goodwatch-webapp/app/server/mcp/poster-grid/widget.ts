// The poster grid's browser code: a small MCP Apps view (ui/initialize, tool results, ui/open-link) without the
// ext-apps runtime, which is about 440 KB. The host loads this page in a sandboxed iframe and talks to it over
// postMessage with JSON-RPC 2.0. Spec: https://github.com/modelcontextprotocol/ext-apps (2026-01-26).
// Only textContent and validated URLs reach the DOM: tool results are untrusted.
import { type PosterCard, type PosterView, posterView } from "./cards.ts"

const PROTOCOL_VERSION = "2026-01-26"
const VISIBLE = 6
const origin = document.documentElement.dataset.origin ?? ""

type Message = {
	jsonrpc?: string
	id?: number | string
	method?: string
	params?: Record<string, unknown>
	result?: Record<string, unknown>
	error?: { message?: string }
}
interface OpenAiGlobals {
	toolOutput?: unknown
	theme?: string
	openExternal?: (options: { href: string }) => void
}
const openai = () =>
	(window as unknown as { openai?: OpenAiGlobals }).openai ?? null

const $ = <T extends HTMLElement>(id: string) =>
	document.getElementById(id) as T
const root = $<HTMLElement>("gw")
const heading = $<HTMLElement>("heading")
const status = $<HTMLElement>("status")
const grid = $<HTMLUListElement>("grid")
const more = $<HTMLButtonElement>("more")
const page = $<HTMLAnchorElement>("page")

// --- JSON-RPC over postMessage ------------------------------------------------------------------------------------

let nextId = 1
const pending = new Map<
	number,
	{
		resolve: (value: Record<string, unknown>) => void
		reject: (error: Error) => void
	}
>()
const post = (message: Message) =>
	window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*")
function request(method: string, params: Record<string, unknown>) {
	const id = nextId++
	post({ id, method, params })
	return new Promise<Record<string, unknown>>((resolve, reject) => {
		pending.set(id, { resolve, reject })
		setTimeout(() => {
			if (pending.delete(id)) reject(new Error(`${method} timed out`))
		}, 10_000)
	})
}
const notify = (method: string, params: Record<string, unknown> = {}) =>
	post({ method, params })

window.addEventListener("message", (event) => {
	if (event.source !== window.parent) return
	const message = event.data as Message
	if (!message || message.jsonrpc !== "2.0") return
	if (typeof message.id === "number" && !message.method) {
		const waiting = pending.get(message.id)
		if (!waiting) return
		pending.delete(message.id)
		if (message.error)
			waiting.reject(new Error(message.error.message ?? "Request failed"))
		else waiting.resolve(message.result ?? {})
		return
	}
	const params = message.params ?? {}
	switch (message.method) {
		case "ui/notifications/tool-result":
			render(posterView(params.structuredContent, origin))
			break
		case "ui/notifications/tool-cancelled":
			if (!grid.childElementCount) showMessage("The request was cancelled.")
			break
		case "ui/notifications/host-context-changed":
			applyContext(params)
			break
		case "ping":
		case "ui/resource-teardown":
			if (message.id !== undefined) post({ id: message.id, result: {} })
			break
		default:
			if (message.id !== undefined && message.method)
				post({
					id: message.id,
					error: { code: -32601, message: "Method not found" },
				} as Message)
	}
})

// --- Host context --------------------------------------------------------------------------------------------------

function applyContext(context: Record<string, unknown> | undefined) {
	const theme = context?.theme
	if (theme === "light" || theme === "dark")
		document.documentElement.dataset.theme = theme
}

async function openLink(url: string) {
	try {
		const result = await request("ui/open-link", { url })
		if (result.isError) throw new Error("Host refused the link")
	} catch {
		const host = openai()
		if (host?.openExternal) host.openExternal({ href: url })
		else window.open(url, "_blank", "noopener,noreferrer")
	}
}
document.addEventListener("click", (event) => {
	const anchor = (event.target as Element | null)?.closest?.("a[href]")
	if (!(anchor instanceof HTMLAnchorElement)) return
	event.preventDefault()
	void openLink(anchor.href)
})

// --- Rendering -------------------------------------------------------------------------------------------------------

function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	content?: string,
) {
	const node = document.createElement(tag)
	if (className) node.className = className
	if (content !== undefined) node.textContent = content
	return node
}

function poster(card: PosterCard, eager: boolean) {
	const frame = element("span", "poster")
	const missing = element("span", "missing", card.name)
	if (card.poster) {
		const img = element("img")
		img.alt = ""
		img.width = 185
		img.height = 278
		img.decoding = "async"
		img.loading = eager ? "eager" : "lazy"
		img.referrerPolicy = "no-referrer"
		if (card.poster2x) img.srcset = `${card.poster} 1x, ${card.poster2x} 2x`
		img.src = card.poster
		img.addEventListener("error", () => {
			img.remove()
			frame.classList.add("none")
		})
		frame.append(img)
	} else frame.classList.add("none")
	frame.append(missing)
	if (card.match !== null) {
		const pill = element(
			"span",
			`pill${card.match >= 90 ? " top" : card.match < 60 ? " low" : ""}`,
			`${card.match}%`,
		)
		pill.setAttribute("aria-hidden", "true")
		frame.append(pill)
	}
	return frame
}

function cardItem(card: PosterCard, index: number, pick: boolean) {
	const item = element("li", pick ? "item pick" : "item")
	if (!pick && index >= VISIBLE) item.hidden = true
	const link = element("a", "card")
	link.href = card.url
	link.target = "_blank"
	link.rel = "noopener noreferrer"
	link.append(poster(card, index < VISIBLE))
	const body = element("span", "body")
	// The heading already says Watch next; an episode pick says which episode is next.
	if (pick && card.episode)
		body.append(element("span", "eyebrow", "Next episode"))
	const name = element("span", "name", card.name)
	if (card.year !== null)
		name.append(element("span", "year", ` (${card.year})`))
	body.append(name)
	if (card.episode) body.append(element("span", "meta", card.episode))
	if (card.matchLabel)
		body.append(element("span", pick ? "meta match" : "sr", card.matchLabel))
	link.append(body)
	item.append(link)
	return item
}

function showMessage(text: string) {
	status.textContent = text
	status.hidden = false
}

function render(view: PosterView) {
	heading.textContent = view.heading
	grid.replaceChildren(
		...view.cards.map((card, i) => cardItem(card, i, view.pick)),
	)
	grid.classList.toggle("single", view.pick)
	status.hidden = true
	if (view.message) showMessage(view.message)
	const hidden = view.pick ? 0 : Math.max(0, view.cards.length - VISIBLE)
	more.hidden = hidden === 0
	more.dataset.expanded = "false"
	more.textContent = `Show all ${view.cards.length}`
	more.setAttribute("aria-expanded", "false")
	page.hidden = !view.pageUrl
	if (view.pageUrl) page.href = view.pageUrl
	root.dataset.state = "ready"
}

more.addEventListener("click", () => {
	const expand = more.dataset.expanded !== "true"
	grid.querySelectorAll<HTMLLIElement>("li.item").forEach((item, i) => {
		item.hidden = !expand && i >= VISIBLE
	})
	more.dataset.expanded = String(expand)
	more.setAttribute("aria-expanded", String(expand))
	more.textContent = expand
		? "Show fewer"
		: `Show all ${grid.childElementCount}`
})

// --- Size reporting: the host sizes the iframe to the content ------------------------------------------------------

let lastWidth = 0
let lastHeight = 0
let queued = false
function reportSize() {
	if (queued) return
	queued = true
	requestAnimationFrame(() => {
		queued = false
		const html = document.documentElement
		const previous = html.style.height
		html.style.height = "max-content"
		const height = Math.ceil(html.getBoundingClientRect().height)
		html.style.height = previous
		const width = Math.ceil(window.innerWidth)
		if (width === lastWidth && height === lastHeight) return
		lastWidth = width
		lastHeight = height
		notify("ui/notifications/size-changed", { width, height })
	})
}

// --- Start -----------------------------------------------------------------------------------------------------------

async function start() {
	const host = openai()
	if (host) {
		applyContext({ theme: host.theme })
		if (host.toolOutput) render(posterView(host.toolOutput, origin))
		window.addEventListener("openai:set_globals", (event) => {
			const globals = (event as CustomEvent<{ globals?: OpenAiGlobals }>).detail
				?.globals
			if (globals?.theme) applyContext({ theme: globals.theme })
			if (globals?.toolOutput) render(posterView(globals.toolOutput, origin))
		})
	}
	try {
		const result = await request("ui/initialize", {
			appInfo: { name: "GoodWatch posters", version: "1.0.0" },
			appCapabilities: {},
			protocolVersion: PROTOCOL_VERSION,
		})
		applyContext(result.hostContext as Record<string, unknown> | undefined)
		notify("ui/notifications/initialized")
	} catch {
		if (!host && !grid.childElementCount)
			showMessage(
				"Posters could not load here. The title links in the answer still work.",
			)
	}
	const observer = new ResizeObserver(reportSize)
	observer.observe(document.documentElement)
	observer.observe(document.body)
	reportSize()
}
void start()
