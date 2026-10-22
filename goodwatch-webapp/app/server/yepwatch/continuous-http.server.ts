import { z } from "zod"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import {
	API_PREFIX,
	paths,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import { equal, random } from "./crypto.server.ts"
import { RoomError } from "./errors.ts"
import { ContinuousService } from "./continuous-service.server.ts"
import type { ActorCredential } from "./service.server.ts"
import { attachSchema, parse, resolveSchema, viewSchema } from "./validation.ts"
import {
	continuousAdmissionSchema as admissionSchema,
	continuousJoinSchema as joinSchema,
	continuousCommandSchema as commandSchema,
} from "./continuous-validation.ts"
export interface HttpOptions {
	serviceSecret: string
	allowedOrigins: string[]
	secureCookies?: boolean
	members?: ContinuousMembers
}
async function body(request: Request) {
	if (
		!(request.headers.get("content-type") ?? "").startsWith("application/json")
	)
		throw new RoomError("invalid_request", "JSON body required", 415)
	const reader = request.body?.getReader()
	if (!reader) throw new RoomError("invalid_request", "Body required", 400)
	const parts: Uint8Array[] = []
	let size = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.length
		if (size > 65_536) {
			await reader.cancel()
			throw new RoomError("invalid_request", "Body too large", 413)
		}
		parts.push(value)
	}
	try {
		return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown
	} catch {
		throw new RoomError("invalid_request", "Malformed JSON", 400)
	}
}
export function createContinuousHandler(
	service: ContinuousService,
	options: HttpOptions,
) {
	if (options.serviceSecret.length < 32)
		throw new Error(
			"Gateway service secret must contain at least 32 characters",
		)
	const allowed = new Set(options.allowedOrigins)
	return async (request: Request): Promise<Response> => {
		const url = new URL(request.url)
		const origin = request.headers.get("origin")
		const headers = new Headers({
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
			vary: "Origin",
		})
		if (origin && allowed.has(origin)) {
			headers.set("access-control-allow-origin", origin)
			headers.set("access-control-allow-credentials", "true")
		}
		const reply = (data: unknown, status = 200) =>
			new Response(JSON.stringify(data), { status, headers })
		const originCheck = (required: boolean) => {
			if (origin ? !allowed.has(origin) : required)
				throw new RoomError("forbidden", "Allowed Origin required", 403)
		}
		const credential = (roomId: string): ActorCredential => {
			const authorization = request.headers.get("authorization")
			if (authorization?.startsWith("Bearer ")) {
				const participantId = request.headers.get("x-yepwatch-participant")
				if (!participantId)
					throw new RoomError("unauthorized", "Participant ID required", 401)
				return { participantId, token: authorization.slice(7) }
			}
			if (request.method !== "GET") originCheck(true)
			const name = `yepwatch2_${roomId}`
			const value = (request.headers.get("cookie") ?? "")
				.split(";")
				.map((v) => v.trim())
				.find((v) => v.startsWith(`${name}=`))
				?.slice(name.length + 1)
			const [participantId, token, extra] = (value ?? "").split(".")
			if (!participantId || !token || extra)
				throw new RoomError("unauthorized", "Room credential required", 401)
			return { participantId, token }
		}
		try {
			if (!url.pathname.startsWith(`${API_PREFIX}/`))
				throw new RoomError("not_found", "Endpoint unavailable", 404)
			if (request.method === "OPTIONS") {
				originCheck(true)
				headers.set("access-control-allow-methods", "GET,POST,OPTIONS")
				headers.set(
					"access-control-allow-headers",
					"content-type,authorization,x-yepwatch-participant,x-yepwatch-client",
				)
				return new Response(null, { status: 204, headers })
			}
			if (url.pathname.startsWith(`${API_PREFIX}/realtime/internal/`)) {
				if (
					!equal(
						request.headers.get("authorization") ?? "",
						`Bearer ${options.serviceSecret}`,
					)
				)
					throw new RoomError(
						"unauthorized",
						"Gateway service credential required",
						401,
					)
				if (origin)
					throw new RoomError(
						"forbidden",
						"Internal endpoint disallows browser Origin",
						403,
					)
				if (request.method !== "POST")
					throw new RoomError("not_found", "Endpoint unavailable", 404)
				if (url.pathname === paths.realtimeAttach) {
					const value = parse(attachSchema, await body(request))
					return reply(await service.attach(value.roomId, value.ticket))
				}
				if (url.pathname === paths.realtimeView) {
					const value = parse(viewSchema, await body(request))
					return reply(await service.view(value.roomId, value.lease))
				}
				throw new RoomError("not_found", "Endpoint unavailable", 404)
			}
			if (request.method === "POST") originCheck(false)
			if (url.pathname.startsWith(`${API_PREFIX}/member/`)) {
				const members = options.members
				if (!members)
					throw new RoomError(
						"not_implemented",
						"GoodWatch sign-in is not configured on this runtime",
						501,
					)
				if (request.method === "POST" && url.pathname === paths.memberStart) {
					const value = parse(
						z
							.object({
								roomId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
								returnTo: z.string().url().max(1000),
								client: z.enum(["browser", "native"]),
								codeChallenge: z
									.string()
									.regex(/^[A-Za-z0-9_-]{43}$/)
									.optional(),
							})
							.strict(),
						await body(request),
					)
					const own = await service.read(value.roomId, credential(value.roomId))
					const started = await members.start(
						value.roomId,
						own.own.participantId,
						value,
					)
					return reply({
						authorizeUrl: started.authorizeUrl,
						expiresAt: started.expiresAt,
						state: started.state,
					})
				}
				if (
					request.method === "POST" &&
					url.pathname === paths.memberExchange
				) {
					const value = parse(
						z
							.object({
								roomId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
								state: z.string().min(64).max(160),
								code: z.string().min(1).max(4096),
								codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
							})
							.strict(),
						await body(request),
					)
					const own = await service.read(value.roomId, credential(value.roomId))
					const linked = await members.exchange(
						value.roomId,
						own.own.participantId,
						value,
					)
					await service.notify(value.roomId)
					return reply(linked.status)
				}
				if (request.method === "GET" && url.pathname === paths.memberCallback) {
					const state = url.searchParams.get("state") ?? ""
					const code = url.searchParams.get("code") ?? ""
					if (!state || state.length > 160 || !code || code.length > 4096)
						throw new RoomError(
							"unauthorized",
							"Sign-in did not complete; restart sign-in",
							401,
						)
					const id = state.split(".")[0]
					const kind = await members.callbackClient(state)
					let destination
					if (kind === "native")
						destination = await members.nativeReturn(state, code)
					else {
						const own = await service.read(id, credential(id))
						destination = (
							await members.callback(state, code, own.own.participantId)
						).returnTo
						await service.notify(id)
					}
					// End the issuer's consent form navigation at its allowlisted API
					// callback. A further HTTP redirect (app origin or native scheme) can
					// violate form-action. This document starts a new checked navigation.
					// Only native receives a one-use code/state; browser returns no code.
					const nonce = random()
					headers.set("content-type", "text/html; charset=utf-8")
					headers.set("referrer-policy", "no-referrer")
					headers.set("x-frame-options", "DENY")
					headers.set(
						"content-security-policy",
						`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
					)
					const safe = destination.replace(
						/[&<>"']/g,
						(c) =>
							({
								"&": "&amp;",
								"<": "&lt;",
								">": "&gt;",
								'"': "&quot;",
								"'": "&#39;",
							})[c]!,
					)
					return new Response(
						`<!doctype html><meta name="viewport" content="width=device-width"><title>Return to YepWatch</title><p>GoodWatch connection ready. <a href="${safe}">Return to YepWatch</a></p><script nonce="${nonce}">location.replace(${JSON.stringify(destination).replace(/</g, "\\u003c")})</script>`,
						{ headers },
					)
				}
				throw new RoomError("not_found", "Endpoint unavailable", 404)
			}
			if (request.method === "GET" && url.pathname === paths.metadata) {
				const country = url.searchParams.get("country")
				if (country && !/^[A-Z]{2}$/.test(country))
					throw new RoomError("invalid_request", "Invalid country", 400)
				return reply(await service.catalog.metadata(country))
			}
			if (request.method === "POST" && url.pathname === paths.resolveInvite) {
				const value = parse(resolveSchema, await body(request))
				return reply(await service.resolveInvite(value.code))
			}
			const match = url.pathname.match(
				/^\/api\/yepwatch\/v1\/continuous\/rooms\/([A-Za-z0-9_-]{32})(?:\/(join|commands|realtime-ticket|member(?:\/progress)?))?$/,
			)
			if (
				request.method === "POST" &&
				(url.pathname === paths.rooms || match?.[2] === "join")
			) {
				const native = request.headers.get("x-yepwatch-client") === "native"
				if (!native) originCheck(true)
				const value = await body(request)
				let admission
				if (url.pathname === paths.rooms)
					admission = await service.create(parse(admissionSchema, value))
				else {
					const join = parse(joinSchema, value)
					const roomId = match![1]
					const hasCredential =
						request.headers.has("authorization") ||
						(request.headers.get("cookie") ?? "")
							.split(";")
							.some((c) => c.trim().startsWith(`yepwatch2_${roomId}=`))
					// A reopened invite in the same browser is resume, never a new required voter or silent host replacement.
					admission = hasCredential
						? await service.recoverAdmission(roomId, credential(roomId))
						: await service.join(roomId, join)
				}
				if (!native) {
					const c = admission.credential
					headers.append(
						"set-cookie",
						`yepwatch2_${c.roomId}=${c.participantId}.${c.token}; Path=${API_PREFIX}; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor((c.expiresAt - Date.now()) / 1000))}${options.secureCookies === false ? "" : "; Secure"}`,
					)
					admission.credential.token = ""
				}
				return reply(admission)
			}
			if (match) {
				const [, id, operation] = match
				const actor = credential(id)
				if (request.method === "GET" && !operation) {
					const snapshot = await service.read(id, actor)
					if (options.members)
						snapshot.own.member = await options.members.status(
							id,
							snapshot.own.participantId,
						)
					return reply(snapshot)
				}
				if (request.method === "GET" && operation === "member/progress") {
					const own = await service.read(id, actor)
					if (!options.members)
						throw new RoomError(
							"not_implemented",
							"GoodWatch sign-in not configured",
							501,
						)
					return reply(
						await options.members.ownProgress(id, own.own.participantId),
					)
				}
				if (request.method === "GET" && operation === "member") {
					const own = await service.read(id, actor)
					return reply(
						options.members
							? await options.members.status(id, own.own.participantId)
							: own.own.member,
					)
				}
				if (request.method === "POST" && operation === "commands")
					return reply(
						await service.command(
							id,
							actor,
							parse(commandSchema, await body(request)),
						),
					)
				if (request.method === "POST" && operation === "realtime-ticket")
					return reply(await service.ticket(id, actor))
			}
			throw new RoomError("not_found", "Endpoint unavailable", 404)
		} catch (error) {
			const e =
				error instanceof RoomError
					? error
					: new RoomError("busy", "Service unavailable", 503, true)
			return reply(
				{
					error: {
						code: e.code,
						message: e.message,
						retryable: e.retryable,
						...(e.details ? { details: e.details } : {}),
					},
				},
				e.status,
			)
		}
	}
}
