// The poster cards' browser code: a small MCP Apps view (ui/initialize, tool input and results, ui/open-link)
// without the ext-apps runtime, which is about 440 KB. The host loads this page in a sandboxed frame and talks to
// it over postMessage with JSON-RPC 2.0. Spec: https://github.com/modelcontextprotocol/ext-apps (2026-01-26).
// Only textContent and validated URLs reach the DOM: tool results are untrusted.
import {
	type PosterCard,
	type PosterView,
	type WatchOffer,
	posterView,
} from "./cards.ts"

const PROTOCOL_VERSION = "2026-01-26"
const origin = document.documentElement.dataset.origin ?? ""

type Message = {
	jsonrpc?: string
	id?: number | string
	method?: string
	params?: Record<string, unknown>
	result?: Record<string, unknown>
	error?: { code?: number; message?: string }
}
interface OpenAiGlobals {
	toolOutput?: unknown
	toolInput?: Record<string, unknown>
	theme?: string
	openExternal?: (options: { href: string }) => void
}
const openai = () =>
	(window as unknown as { openai?: OpenAiGlobals }).openai ?? null

const root = document.getElementById("gw") as HTMLElement
let args: Record<string, unknown> = {}
let lastResult: unknown = null

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

function show(result: unknown) {
	lastResult = result
	render(posterView(result, origin, args))
}

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
		case "ui/notifications/tool-input":
			if (params.arguments && typeof params.arguments === "object")
				args = params.arguments as Record<string, unknown>
			if (lastResult) show(lastResult)
			break
		case "ui/notifications/tool-result":
			show(params.structuredContent)
			break
		case "ui/notifications/tool-cancelled":
			if (!lastResult) showMessage("The request was cancelled.")
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
				})
	}
})

// --- Host context: theme and the host's style variables (Claude's docs: transparent theming) ------------------------

function applyContext(context: Record<string, unknown> | undefined) {
	const theme = context?.theme
	if (theme === "light" || theme === "dark") {
		document.documentElement.dataset.theme = theme
		document.documentElement.style.colorScheme = theme
	}
	const styles = context?.styles as
		| { variables?: Record<string, unknown> }
		| undefined
	for (const [name, value] of Object.entries(styles?.variables ?? {}))
		if (
			/^--[a-z0-9-]{1,60}$/.test(name) &&
			typeof value === "string" &&
			value.length < 300
		)
			document.documentElement.style.setProperty(name, value)
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
function link(url: string, className: string) {
	const anchor = element("a", className)
	anchor.href = url
	anchor.target = "_blank"
	anchor.rel = "noopener noreferrer"
	return anchor
}
function image(src: string, src2x: string | null, eager: boolean) {
	const img = element("img")
	img.alt = ""
	img.decoding = "async"
	img.loading = eager ? "eager" : "lazy"
	img.referrerPolicy = "no-referrer"
	if (src2x) img.srcset = `${src} 1x, ${src2x} 2x`
	img.src = src
	return img
}

/** The poster in its frame; a title without one, or whose file fails, shows its name instead. */
function poster(card: PosterCard, className: string, eager: boolean) {
	const frame = element("span", `poster ${className}`)
	const missing = element("span", "missing", card.name)
	if (card.poster) {
		const img = image(card.poster, card.poster2x, eager)
		img.addEventListener("error", () => {
			img.remove()
			frame.classList.add("none")
		})
		frame.append(img)
	} else frame.classList.add("none")
	frame.append(missing)
	return frame
}

function backdrop(card: PosterCard) {
	if (!card.backdrop) return null
	const img = image(card.backdrop, card.backdrop2x, true)
	img.className = "bd"
	img.addEventListener("error", () => img.remove())
	return img
}

/** The G emblem, "ood" in white and "Watch" in yellow: the site header's logo. Links to the GoodWatch page. */
function logo(pageUrl: string | null) {
	const mark = pageUrl ? link(pageUrl, "mark") : element("span", "mark")
	mark.setAttribute("aria-label", pageUrl ? "See it on GoodWatch" : "GoodWatch")
	if (pageUrl) mark.title = "See it on GoodWatch"
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	svg.setAttribute("viewBox", "0 0 179.84172 189.15848")
	svg.setAttribute("aria-hidden", "true")
	const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
	group.setAttribute("transform", "translate(-9.3413446,-4.720956)")
	for (const [d, transform] of G_PATHS) {
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
		path.setAttribute("d", d)
		if (transform) path.setAttribute("transform", transform)
		group.append(path)
	}
	svg.append(group)
	mark.append(svg, element("span", "ood", "ood"), element("span", "w", "Watch"))
	return mark
}

const facts = (card: PosterCard, withMatch: boolean) =>
	[
		card.year,
		card.kind,
		card.runtime && card.kind === "Movie"
			? `${Math.floor(card.runtime / 60)} h ${card.runtime % 60} min`
			: null,
		withMatch && card.match !== null ? `${card.match}% taste match` : null,
		card.score !== null ? `GoodWatch score ${card.score}` : null,
	]
		.filter(Boolean)
		.join(" · ")

function watchButton(watch: WatchOffer) {
	const button = link(watch.url, "btn white")
	if (watch.logo) {
		const img = image(watch.logo, null, true)
		img.className = "logo"
		img.addEventListener("error", () => img.remove())
		button.append(img)
	}
	button.append(element("span", "play", "▶"), element("span", "", watch.label))
	return button
}

function pickCard(view: PosterView) {
	const card = view.cards[0]
	const article = element("article", "pick")
	const bd = backdrop(card)
	if (bd) article.append(bd)
	article.append(logo(view.pageUrl))
	const inner = element("div", "in")
	const posterLink = link(card.url, "pf")
	posterLink.setAttribute("aria-hidden", "true")
	posterLink.tabIndex = -1
	posterLink.append(poster(card, "", true))
	const body = element("div", "tx")
	const eyebrow = element("p", "eyebrow", view.eyebrow)
	if (view.eyebrowDetail)
		eyebrow.append(element("span", "detail", ` · ${view.eyebrowDetail}`))
	const title = link(card.url, "title")
	title.append(element("h2", "display", card.name))
	body.append(eyebrow, title)
	if (card.tagline) body.append(element("p", "tag", card.tagline))
	body.append(element("p", "meta", facts(card, true)))
	const actions = element("div", "acts")
	if (view.watch) actions.append(watchButton(view.watch))
	const open = link(card.url, view.watch ? "btn glass" : "btn white")
	open.textContent = "Open in GoodWatch"
	actions.append(open)
	body.append(actions)
	inner.append(posterLink, body)
	article.append(inner)
	return article
}

function gridCards(view: PosterView) {
	const [first, ...rest] = view.cards
	const article = element("article", "grid")
	const feat = element("div", "feat")
	const bd = backdrop(first)
	if (bd) feat.append(bd)
	const featLink = link(first.url, "featlink")
	featLink.append(poster(first, "pf", true))
	const body = element("span", "tx")
	body.append(
		element("span", "eyebrow", view.eyebrow),
		element("span", "display name", first.name),
	)
	const meta = element("span", "meta")
	if (first.match !== null)
		meta.append(element("b", "", `${first.match}% taste match`))
	const more = facts(first, false)
	if (more) meta.append(`${first.match !== null ? " · " : ""}${more}`)
	body.append(meta)
	featLink.append(body)
	feat.append(featLink, logo(view.pageUrl))
	article.append(feat)

	if (rest.length || view.pageUrl) {
		const wrap = element("div", "railwrap")
		const rail = element("ul", "rail")
		rest.forEach((card, i) => {
			const item = element("li")
			const anchor = link(card.url, "item")
			anchor.append(poster(card, "", i < 6))
			const name = element("span", "n", card.name)
			if (card.year !== null)
				name.append(element("span", "y", ` (${card.year})`))
			anchor.append(name)
			if (card.match !== null)
				anchor.append(element("span", "m", `${card.match}% match`))
			item.append(anchor)
			rail.append(item)
		})
		if (view.pageUrl) {
			const item = element("li")
			const all = link(view.pageUrl, "item all")
			all.append(element("span", "allbox", "See it on GoodWatch →"))
			item.append(all)
			rail.append(item)
		}
		const back = element("button", "nav prev", "‹")
		const next = element("button", "nav next", "›")
		back.type = next.type = "button"
		back.setAttribute("aria-label", "Scroll back")
		next.setAttribute("aria-label", "Scroll forward")
		const step = (sign: number) =>
			rail.scrollBy({ left: sign * rail.clientWidth * 0.8, behavior: "smooth" })
		back.addEventListener("click", () => step(-1))
		next.addEventListener("click", () => step(1))
		const edges = () => {
			back.hidden = rail.scrollLeft < 4
			next.hidden = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 4
		}
		rail.addEventListener("scroll", edges, { passive: true })
		requestAnimationFrame(edges)
		wrap.append(rail, back, next)
		article.append(wrap)
	}
	return article
}

function messageCard(view: PosterView) {
	const article = element("article", "msg")
	article.append(
		logo(view.pageUrl),
		element("p", "eyebrow", view.eyebrow),
		element("p", "text", view.message ?? ""),
	)
	return article
}

function showMessage(text: string) {
	root.replaceChildren(
		messageCard({
			layout: "message",
			eyebrow: "GoodWatch",
			eyebrowDetail: null,
			cards: [],
			watch: null,
			pageUrl: null,
			message: text,
		}),
	)
	root.dataset.state = "ready"
}

function render(view: PosterView) {
	root.replaceChildren(
		view.layout === "pick"
			? pickCard(view)
			: view.layout === "grid"
				? gridCards(view)
				: messageCard(view),
	)
	root.dataset.state = "ready"
	root.dataset.layout = view.layout
}

// --- Size reporting: the host sizes the frame to the content --------------------------------------------------------

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
		if (host.toolInput) args = host.toolInput
		if (host.toolOutput) show(host.toolOutput)
		window.addEventListener("openai:set_globals", (event) => {
			const globals = (event as CustomEvent<{ globals?: OpenAiGlobals }>).detail
				?.globals
			if (globals?.theme) applyContext({ theme: globals.theme })
			if (globals?.toolInput) args = globals.toolInput
			if (globals?.toolOutput) show(globals.toolOutput)
		})
	}
	try {
		const result = await request("ui/initialize", {
			appInfo: { name: "GoodWatch posters", version: "2.0.0" },
			appCapabilities: { availableDisplayModes: ["inline"] },
			protocolVersion: PROTOCOL_VERSION,
		})
		applyContext(result.hostContext as Record<string, unknown> | undefined)
		notify("ui/notifications/initialized")
	} catch {
		if (!host && !lastResult)
			showMessage(
				"Posters could not load here. The title links in the answer still work.",
			)
	}
	const observer = new ResizeObserver(reportSize)
	observer.observe(document.documentElement)
	observer.observe(document.body)
	reportSize()
}

// The paths of app/img/goodwatch-logo-amber.svg (app/ui/brand/GoodWatchWordmark.tsx draws the same G).
const G_PATHS: [string, string | null][] = [
	["__G_RING__", null],
	["__G_PLAY__", "matrix(0.26458333,0,0,0.26458333,9.3401336,-32.149027)"],
]

void start()
