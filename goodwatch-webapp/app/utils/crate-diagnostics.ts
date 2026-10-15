import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

type Context = {
	requestId: string | null
	route: string
	method?: string
	operationId?: string
	operation?: string
	failed: boolean
}
const context = new AsyncLocalStorage<Context>()

/** Route must come from the manifest, never a concrete URL, query string or member id. */
export function withCrateRequest<T>(
	route: string,
	method: string,
	run: () => T,
): T {
	return context.run(
		{ requestId: randomUUID(), route, method, failed: false },
		run,
	)
}

export function crateRequestFailed(): boolean {
	return context.getStore()?.failed ?? false
}

/** Wrap the server listener, before Remix starts loaders/actions, including resource routes. */
export function withCrateHttpRequest<T>(
	request: IncomingMessage,
	response: ServerResponse,
	labelRoute: (pathname: string, status: number) => string,
	run: () => T,
): T {
	const pathname = (request.url ?? "/").split("?", 1)[0]
	return withCrateRequest(
		labelRoute(pathname, 200),
		request.method ?? "GET",
		() => {
			const current = context.getStore()!
			const start = performance.now()
			response.once("finish", () => {
				if (current.failed || response.statusCode >= 500)
					context.run(current, () =>
						crateEvent("crate.http", {
							status: response.statusCode,
							hadCrateFailure: current.failed,
							outcome: response.statusCode >= 500 ? "failed" : "responded",
							durationMs: performance.now() - start,
						}),
					)
			})
			return run()
		},
	)
}

export function crateEvent(
	event: string,
	fields: Record<string, unknown>,
): void {
	const current = context.getStore()
	if (event === "crate.attempt_failed" && current) current.failed = true
	console.warn(
		JSON.stringify({
			time: new Date().toISOString(),
			event,
			role: process.env.WEBAPP_ROLE ?? "both",
			requestId: current?.requestId ?? null,
			route: current?.route ?? "background",
			method: current?.method,
			operationId: current?.operationId,
			operation: current?.operation,
			...fields,
		}),
	)
}

/** Link failed writes, their readback and their final helper outcome without logging keys or values. */
export async function withCrateOperation<T>(
	operation: string,
	run: () => Promise<T>,
): Promise<T> {
	const parent = context.getStore()
	const current: Context = {
		...parent,
		requestId: parent?.requestId ?? null,
		route: parent?.route ?? "background",
		operationId: randomUUID(),
		operation,
		failed: false,
	}
	return context.run(current, async () => {
		try {
			const result = await run()
			if (current.failed) crateEvent("crate.recovery", { outcome: "succeeded" })
			return result
		} catch (error) {
			if (current.failed)
				crateEvent("crate.recovery", {
					outcome: "failed",
					...crateErrorFields(error),
				})
			throw error
		} finally {
			if (parent && current.failed) parent.failed = true
		}
	})
}

/** Strip comments and literal values before capping. Malformed strings redact through the end. */
export function redactedSqlShape(sql: string): string {
	return sql
		.replace(
			/--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|\$(\w*)\$[\s\S]*?(?:\$\1\$|$)|(?:[Ee])?'(?:''|\\[\s\S]|[^'\\])*(?:'|$)|"(?:""|[^"])*(?:"|$)|\b(?:0x[0-9a-f]+|\d+(?:\.\d*)?(?:e[+-]?\d+)?)\b/gi,
			(token) =>
				token.startsWith('"')
					? token
					: token.startsWith("--") || token.startsWith("/*")
						? " "
						: "?",
		)
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 1500)
}

export const sqlShapeId = (shape: string) =>
	createHash("sha256").update(shape).digest("hex").slice(0, 16)

/** Server messages can contain SQL, parameters and credentials. Retain only class and machine codes. */
export function crateErrorFields(error: unknown) {
	const e = error as {
		name?: unknown
		message?: unknown
		code?: unknown
		statusCode?: unknown
	}
	const sqlClass =
		typeof e?.message === "string"
			? /^([A-Za-z][A-Za-z0-9_]{0,63})\[|^([A-Za-z][A-Za-z0-9_]*(?:Exception|Error)):/.exec(
					e.message,
				)
			: null
	const name =
		typeof e?.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(e.name)
			? e.name
			: "Error"
	const code =
		typeof e?.code === "number" ||
		(typeof e?.code === "string" && /^[A-Z][A-Z0-9_]{0,31}$/.test(e.code))
			? e.code
			: undefined
	return {
		errorClass: sqlClass?.[1] ?? sqlClass?.[2] ?? name,
		errorCode: code,
		httpStatus: typeof e?.statusCode === "number" ? e.statusCode : undefined,
	}
}
