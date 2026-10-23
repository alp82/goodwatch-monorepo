import { createRequire } from "node:module"

const require = createRequire(
	new URL("../../goodwatch-webapp/package.json", import.meta.url),
)
const { Window } = require("happy-dom")

export const clients = {
	googlebot:
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	bingbot:
		"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
	browser:
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
}

export function headers(client) {
	return {
		"User-Agent": clients[client],
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9",
		"Sec-Fetch-Dest": "document",
		"Sec-Fetch-Mode": "navigate",
		"Sec-Fetch-Site": "none",
	}
}

function contextSpans(html) {
	const spans = []
	const assignments = /window\.__remixContext\s*=\s*/g
	for (const match of html.matchAll(assignments)) {
		const start = match.index + match[0].length
		const rest = html.slice(start)
		const encoded = /^JSON\.parse\(("(?:[^"\\]|\\.)*")\)/.exec(rest)
		if (encoded) {
			spans.push({
				start,
				end: start + encoded[0].length,
				value: JSON.parse(JSON.parse(encoded[1])),
			})
			continue
		}
		if (rest[0] !== "{")
			throw new Error("Unsupported Remix context serialization")
		let depth = 0
		let quoted = false
		let escaped = false
		let end = start
		for (; end < html.length; end++) {
			const char = html[end]
			if (quoted) {
				if (escaped) escaped = false
				else if (char === "\\") escaped = true
				else if (char === '"') quoted = false
			} else if (char === '"') quoted = true
			else if (char === "{" || char === "[") depth++
			else if (char === "}" || char === "]") {
				depth--
				if (depth === 0) {
					end++
					break
				}
			}
		}
		spans.push({ start, end, value: JSON.parse(html.slice(start, end)) })
	}
	return spans
}
export function contexts(html) {
	return contextSpans(html).map((span) => span.value)
}

function requestFields(value) {
	if (!value || typeof value !== "object") return
	// Only query cache metadata varies with the render time. Catalog dates stay intact.
	if (Array.isArray(value.queries) && Array.isArray(value.mutations)) {
		for (const query of value.queries) {
			for (const key of ["dataUpdatedAt", "errorUpdatedAt"]) {
				if (typeof query.state?.[key] === "number") query.state[key] = 0
			}
		}
	}
	for (const child of Object.values(value)) requestFields(child)
}

export function normalize(html) {
	let result = html
	for (const { start, end, value } of contextSpans(html).reverse()) {
		requestFields(value)
		result =
			result.slice(0, start) +
			JSON.stringify(value).replace(
				/[<>&]/g,
				(char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
			) +
			result.slice(end)
	}

	result = result.replace(
		/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,
		(whole, open, body, close) => {
			if (
				(/^\s*import\s/.test(body) &&
					body.includes("window.__remixRouteModules")) ||
				/^\s*window\.__remixManifest\s*=/.test(body)
			) {
				return `${open}[Remix build manifest and route imports]${close}`
			}
			// The start page delays this same generated import block until first paint.
			const delayed = body.replace(
				/(\}\)\()("(?:[^"\\]|\\.)*")(?=,\[)/g,
				(call, prefix, encoded) => {
					const code = JSON.parse(encoded)
					return /^\s*import\s/.test(code) &&
						code.includes("window.__remixRouteModules")
						? `${prefix}"[Remix route imports]"`
						: call
				},
			)
			return delayed === body ? whole : `${open}${delayed}${close}`
		},
	)
	return result
		.replace(
			/\/assets\/([^\s"'<>?]+)-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)\b/g,
			"/assets/$1-[hash]$2",
		)
		.replace(/<[^>]+>/g, (tag) =>
			tag.replace(/\bnonce=(["'])[^"']*\1/g, 'nonce="[nonce]"'),
		)
}

export function structure(html) {
	const window = new Window({
		settings: {
			disableJavaScriptEvaluation: true,
			disableCSSFileLoading: true,
			disableJavaScriptFileLoading: true,
		},
	})
	const document = new window.DOMParser().parseFromString(html, "text/html")
	const landmarks = {}
	for (const element of document.querySelectorAll(
		"html, head, body, main, header, footer, nav, section, article, aside, [role]",
	)) {
		const key = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.getAttribute("aria-label") ? `[${element.getAttribute("aria-label")}]` : ""}${element.getAttribute("role") ? `[role=${element.getAttribute("role")}]` : ""}`
		const counts = {}
		for (const child of element.querySelectorAll("*"))
			counts[child.tagName] = (counts[child.tagName] || 0) + 1
		landmarks[key] ??= []
		landmarks[key].push(counts)
	}
	const keys = []
	function walk(value, path) {
		if (!value || typeof value !== "object") return
		if (Array.isArray(value)) {
			// Array lengths are data; the union of their fields describes the shape.
			for (const child of value) walk(child, `${path}[]`)
		} else
			for (const [key, child] of Object.entries(value)) {
				keys.push(`${path}.${key}`)
				walk(child, `${path}.${key}`)
			}
	}
	for (const context of contexts(html))
		walk(context.state?.loaderData, "loaderData")
	const jsonLd = [
		...document.querySelectorAll('script[type="application/ld+json"]'),
	].map((script) => {
		const data = JSON.parse(script.textContent)
		const shape = (value) =>
			Array.isArray(value)
				? value.map(shape)
				: value && typeof value === "object"
					? Object.fromEntries(
							Object.entries(value).map(([k, v]) => [
								k,
								k === "@type" ? v : shape(v),
							]),
						)
					: typeof value
		return shape(data)
	})
	for (const script of document.querySelectorAll("script, style"))
		script.remove()
	const text = document.body.textContent
	window.happyDOM.abort()
	return { landmarks, loaderDataKeys: [...new Set(keys)].sort(), jsonLd, text }
}

export function failures(a, b) {
	const issues = []
	for (const [side, value] of [
		["base", a],
		["candidate", b],
	]) {
		if (value.status >= 500 || value.status < 200)
			issues.push(`${side} returned ${value.status}`)
		if (!value.body.includes("</html>"))
			issues.push(`${side} did not return a complete HTML document`)
	}
	if (a.status !== b.status) issues.push(`status: ${a.status} -> ${b.status}`)
	if (JSON.stringify(a.redirects) !== JSON.stringify(b.redirects))
		issues.push("redirect chain changed")
	if (
		/\bno-store\b/i.test(a.cacheControl || "") !==
		/\bno-store\b/i.test(b.cacheControl || "")
	)
		issues.push("no-store on one side only")
	if (a.body !== b.body) issues.push("document HTML changed")
	return issues
}

export function classAllowlist(patterns) {
	return patterns.map((pattern) => new RegExp(`^(?:${pattern})$`))
}

export function filterClasses(html, patterns = []) {
	let removed = 0
	if (!patterns.length) return { html, removed }
	// Keep raw-text elements and comments opaque. Preserve all bytes outside class values.
	const result = html.replace(
		/<!--[\s\S]*?-->|<(script|style|textarea|title|xmp|iframe|noembed|noframes|noscript)(?=[\t\n\f\r />])(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?(?:<\/\1\s*>|$)|<[a-z][a-z0-9:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/gi,
		(fragment) => {
			if (fragment.startsWith("<!--")) return fragment
			const end = /^<(?:[^>"']|"[^"]*"|'[^']*')*>/.exec(fragment)?.[0]
			if (!end) return fragment
			const tag = end.replace(
				/(\s+)([^\s=/>]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/g,
				(attribute, space, name, equals, value) => {
					if (name.toLowerCase() !== "class" || value[0] !== '"')
						return attribute
					const tokens = value
						.slice(1, -1)
						.split(/[\t\n\f\r ]+/)
						.filter(Boolean)
					const kept = tokens.filter(
						(token) => !patterns.some((regex) => regex.test(token)),
					)
					const count = tokens.length - kept.length
					removed += count
					return count
						? `${space}${name}${equals}"${kept.join(" ")}"`
						: attribute
				},
			)
			return tag + fragment.slice(end.length)
		},
	)
	return { html: result, removed }
}

export function emptyLoaderLists(html) {
	const paths = []
	for (const context of contexts(html)) {
		for (const [route, data] of Object.entries(
			context.state?.loaderData || {},
		)) {
			if (Array.isArray(data)) {
				if (!data.length) paths.push(`${route}`)
			} else if (data && typeof data === "object") {
				for (const [key, value] of Object.entries(data))
					if (Array.isArray(value) && !value.length)
						paths.push(`${route}.${key}`)
			}
		}
	}
	return [...new Set(paths)].sort()
}

export function manifestPaths(html) {
	return [
		...new Set(html.match(/\/assets\/manifest-[A-Za-z0-9_-]+\.js\b/g) || []),
	].sort()
}

export function manifestRoutes(source) {
	// Remix emits a JSON assignment. Never evaluate fetched JavaScript.
	const match = /^\s*window\.__remixManifest\s*=\s*([\s\S]*?)\s*;?\s*$/.exec(
		source,
	)
	if (!match) throw new Error("Unsupported Remix manifest serialization")
	const { routes } = JSON.parse(match[1])
	if (!routes || typeof routes !== "object" || Array.isArray(routes))
		throw new Error("Manifest has no routes object")
	return Object.fromEntries(
		Object.entries(routes)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([id, route]) => [
				id,
				{
					hasLoader: Boolean(route.hasLoader),
					hasClientLoader: Boolean(route.hasClientLoader),
					hasAction: Boolean(route.hasAction),
					hasErrorBoundary: Boolean(route.hasErrorBoundary),
					module:
						route.module?.replace(/-[A-Za-z0-9_-]{8}(\.js)\b/g, "-[hash]$1") ??
						null,
				},
			]),
	)
}

export function manifestDiff(base, candidate) {
	return [...new Set([...Object.keys(base), ...Object.keys(candidate)])]
		.sort()
		.flatMap((route) => {
			if (!(route in base))
				return [{ route, kind: "added", candidate: candidate[route] }]
			if (!(route in candidate))
				return [{ route, kind: "removed", base: base[route] }]
			const fields = Object.fromEntries(
				Object.keys(base[route])
					.filter((key) => base[route][key] !== candidate[route][key])
					.map((key) => [
						key,
						{ base: base[route][key], candidate: candidate[route][key] },
					]),
			)
			return Object.keys(fields).length
				? [{ route, kind: "changed", fields }]
				: []
		})
}
