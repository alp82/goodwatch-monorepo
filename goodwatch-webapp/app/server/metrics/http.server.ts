// Observes Node HTTP events so static files and resource routes share the same metrics.
import { subscribe } from "node:diagnostics_channel"
import { readdir } from "node:fs/promises"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { join, relative, sep } from "node:path"
import {
	type RoutePatternMatcher,
	createRoutePatternMatcher,
} from "~/utils/route-pattern"
import {
	audienceLabel,
	cacheControlLabel,
	routeLabel,
	statusClass,
} from "./labels.server"
import { counter, durationBuckets, gauge, histogram } from "./registry.server"

export {
	audienceLabel,
	cacheControlLabel,
	routeLabel,
	statusClass,
} from "./labels.server"

const key = Symbol.for("goodwatch.metrics.http")
const shared = globalThis as typeof globalThis & {
	[key]?: { started: boolean; ignored: WeakSet<Server> }
}
shared[key] ??= { started: false, ignored: new WeakSet() }
const state = shared[key]
export function ignoreMetricsServer(server: Server): void {
	state.ignored.add(server)
}

// A viral spike asks for a few paths over and over, so their labels are remembered. The map is emptied when full: it
// can't grow with the number of distinct paths.
const MAX_REMEMBERED_PATHS = 5000

type RouteLabeler = (pathname: string, statusCode: number) => string

// The lazy import avoids evaluating the build while its route modules are still loading.
async function loadRouteLabeler(): Promise<RouteLabeler> {
	const build = await import("virtual:remix/server-build")
	const matcher: RoutePatternMatcher = createRoutePatternMatcher(build.routes)
	const publicFiles = await listPublicFiles(build.assetsBuildDirectory)
	const remembered = new Map<string, string | null>()
	const patternOf: RoutePatternMatcher = (pathname) => {
		let pattern = remembered.get(pathname)
		if (pattern === undefined) {
			pattern = matcher(pathname)
			if (remembered.size >= MAX_REMEMBERED_PATHS) remembered.clear()
			remembered.set(pathname, pattern)
		}
		return pattern
	}
	return (pathname, statusCode) =>
		routeLabel(pathname, statusCode, patternOf, publicFiles)
}

// The URL paths of the files copied from `public/` into the client build, which the server answers before any route.
// `/assets/` is left out: its prefix is enough. Without a client build (the dev server) the set is empty.
async function listPublicFiles(directory: string): Promise<Set<string>> {
	const files = new Set<string>()
	try {
		const entries = await readdir(directory, {
			recursive: true,
			withFileTypes: true,
		})
		for (const entry of entries) {
			if (!entry.isFile()) continue
			const urlPath = `/${relative(directory, join(entry.parentPath, entry.name)).split(sep).join("/")}`
			if (!urlPath.startsWith("/assets/")) files.add(urlPath)
		}
	} catch {
		// No client build to read.
	}
	return files
}

// writeHead can send headers directly without adding them to getHeader's cache.
function sentHeader(
	response: ServerResponse,
	args: unknown[],
	name: string,
): string {
	const supplied = typeof args[1] === "string" ? args[2] : args[1]
	if (Array.isArray(supplied)) {
		for (let i = 0; i < supplied.length; i += 2) {
			if (String(supplied[i]).toLowerCase() === name)
				return String(supplied[i + 1])
		}
	} else if (supplied && typeof supplied === "object") {
		for (const key in supplied) {
			if (key.toLowerCase() === name)
				return String((supplied as Record<string, unknown>)[key] ?? "")
		}
	}
	return String(response.getHeader(name) ?? "")
}

type HttpEvent = {
	request: IncomingMessage
	response: ServerResponse
	server: Server
}
export function startHttpMetrics(): void {
	if (state.started) return
	state.started = true
	let labelRoute: RouteLabeler | undefined
	void loadRouteLabeler()
		.then((ready) => {
			labelRoute = ready
		})
		.catch(() => {
			console.error("Metrics route manifest could not be loaded")
		})
	const duration = histogram(
		"goodwatch_http_request_duration_seconds",
		"Time from request start to response finish.",
		["route", "status_class", "audience"],
		durationBuckets,
	)
	const headers = histogram(
		"goodwatch_http_response_headers_seconds",
		"Time to response headers for HTML GET requests.",
		["route", "audience"],
		durationBuckets,
	)
	const responses = counter(
		"goodwatch_http_responses_total",
		"Completed HTTP responses.",
		["route", "status_class", "audience", "cache_control"],
	)
	let inFlight = 0
	gauge(
		"goodwatch_http_requests_in_flight",
		"HTTP requests still in flight.",
		[],
		() => [{ labels: [], value: inFlight }],
	)
	const pending = new WeakMap<
		IncomingMessage,
		{
			start: number
			headerSeconds?: number
			contentType: string
			cacheControl: string
			release: () => void
		}
	>()
	// Node 24 documents request, response, socket and server on both channels.
	subscribe("http.server.request.start", (message) => {
		const { request, response, server } = message as HttpEvent
		if (state.ignored.has(server)) return
		inFlight++
		let released = false
		const release = () => {
			if (released) return
			released = true
			inFlight--
			pending.delete(request)
		}
		const timing = {
			start: performance.now(),
			headerSeconds: undefined as number | undefined,
			contentType: "",
			cacheControl: "",
			release,
		}
		pending.set(request, timing)
		response.once("close", release)
		const writeHead = response.writeHead
		response.writeHead = function (
			this: ServerResponse,
			...args: Parameters<ServerResponse["writeHead"]>
		) {
			if (timing.headerSeconds === undefined) {
				timing.headerSeconds = (performance.now() - timing.start) / 1000
				timing.contentType = sentHeader(this, args, "content-type")
				timing.cacheControl = sentHeader(this, args, "cache-control")
			}
			// Compression may wrap this function later. Preserve its receiver and arguments.
			return Reflect.apply(writeHead, this, args)
		} as ServerResponse["writeHead"]
	})
	subscribe("http.server.response.finish", (message) => {
		const { request, response } = message as HttpEvent
		const timing = pending.get(request)
		if (!timing) return
		const seconds = (performance.now() - timing.start) / 1000
		timing.release()
		response.removeListener("close", timing.release)
		const url = request.url ?? "/"
		const query = url.indexOf("?")
		const pathname = query < 0 ? url : url.slice(0, query)
		const route = labelRoute
			? labelRoute(pathname, response.statusCode)
			: "unmatched"
		const audience = audienceLabel(request.headers.cookie)
		const status = statusClass(response.statusCode)
		duration.observe([route, status, audience], seconds)
		responses.inc([
			route,
			status,
			audience,
			cacheControlLabel(timing.cacheControl),
		])
		if (
			request.method === "GET" &&
			timing.contentType.startsWith("text/html") &&
			timing.headerSeconds !== undefined
		) {
			headers.observe([route, audience], timing.headerSeconds)
		}
	})
}
