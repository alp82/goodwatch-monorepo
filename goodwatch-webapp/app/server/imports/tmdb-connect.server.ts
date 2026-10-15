import { randomUUID } from "node:crypto"
import { createCookie } from "@remix-run/node"
import type { ParsedImport } from "../../domain/imports.ts"
import { type TmdbClient, TmdbError } from "./tmdb-client.server.ts"

export interface Connection {
	id: string
	userId: string
	requestToken: string
	expiresAt: number
	accessToken?: string
	accountId?: string
	canceled?: boolean
}
export interface ConnectionStore {
	create(value: Connection, available: number): Promise<void>
	/** Atomic lease, enforcing ownership when requested. A lease lasts ten minutes. */
	claim(
		id: string,
		userId: string | undefined,
		now: number,
	): Promise<Connection | null>
	/** Without available, retain the lease; otherwise release it for that retry time. */
	save(value: Connection, available?: number): Promise<void>
	remove(id: string): Promise<void>
	due(now: number): Promise<string[]>
}
const cookie = createCookie("tmdb-connect", {
	httpOnly: true,
	sameSite: "lax",
	path: "/api/imports/tmdb",
	maxAge: 15 * 60,
})
const invalid = () =>
	new TmdbError(
		"This TMDB connection expired or is already being used. Start again from Imports.",
		404,
	)

export function createTmdbConnect(deps: {
	store: ConnectionStore
	client: TmdbClient
	member: (
		request: Request,
	) => Promise<{ userId: string | null; headers: Headers }>
	origin: () => string | null
	now?: () => number
}) {
	const { store, client } = deps
	const now = deps.now ?? Date.now
	const retryAt = (error: unknown) =>
		now() +
		Math.max(60_000, error instanceof TmdbError ? (error.retryAfterMs ?? 0) : 0)
	async function disconnect(connection: Connection) {
		if (connection.accessToken) await client.revoke(connection.accessToken)
		await store.remove(connection.id)
	}
	return {
		/** Cleanup needs no browser. Expired leases recover work interrupted by a process restart. */
		async sweep(): Promise<void> {
			for (const id of await store.due(now())) {
				const connection = await store.claim(id, undefined, now())
				if (!connection) continue
				connection.canceled = true
				try {
					if (!connection.accessToken) {
						Object.assign(
							connection,
							await client.exchange(connection.requestToken),
						)
						try {
							await store.save(connection)
						} catch {
							// Even without a durable write, revoke the token we just received.
							await disconnect(connection)
							continue
						}
					}
					await disconnect(connection)
				} catch (error) {
					// Unapproved request tokens expire on TMDB after 15 min. Retry until then,
					// including late approval after Cancel; never discard a known access token.
					if (
						!connection.accessToken &&
						now() >= connection.expiresAt + 5 * 60_000 &&
						error instanceof TmdbError &&
						[401, 403].includes(error.status)
					)
						await store.remove(connection.id)
					else await store.save(connection, retryAt(error))
				}
			}
		},
		async handle(request: Request, step: string): Promise<Response> {
			const { userId, headers } = await deps.member(request)
			headers.set("Cache-Control", "private, no-store")
			headers.set("Referrer-Policy", "no-referrer")
			const fail = (message: string, status: number) =>
				Response.json({ error: message }, { status, headers })
			if (!userId) return fail("Sign in to connect your TMDB account.", 401)
			if (request.method !== "POST") return fail("Method not allowed", 405)
			const origin = deps.origin()
			if (!origin || request.headers.get("Origin") !== origin)
				return fail("Open Imports on GoodWatch to connect TMDB.", 403)
			const redirect = (location: string) => {
				headers.set("Location", location)
				return new Response(null, { status: 303, headers })
			}
			try {
				if (step === "start") {
					const id = randomUUID()
					const requestToken = await client.createRequest(
						`${origin}/settings/imports?source=tmdb&connect=${id}`,
					)
					const connection = {
						id,
						userId,
						requestToken,
						expiresAt: now() + 10 * 60_000,
					}
					await store.create(connection, connection.expiresAt)
					headers.append(
						"Set-Cookie",
						await cookie.serialize(id, { secure: origin.startsWith("https:") }),
					)
					return redirect(
						`https://www.themoviedb.org/auth/access?request_token=${encodeURIComponent(requestToken)}`,
					)
				}
				if (step !== "return" && step !== "abandon")
					return fail("Not found", 404)
				const form = await request.formData()
				const id = form.get("state")
				if (
					typeof id !== "string" ||
					!/^[a-f0-9-]{36}$/.test(id) ||
					(await cookie.parse(request.headers.get("Cookie"))) !== id
				)
					throw invalid()
				const connection = await store.claim(id, userId, now())
				if (!connection) throw invalid()
				let failure: Error | undefined
				let retryTime = now() + 60_000
				let parsed: ParsedImport | undefined
				try {
					if (connection.canceled || connection.accessToken) throw invalid()
					const credentials = await client.exchange(connection.requestToken)
					Object.assign(connection, credentials)
					await store.save(connection)
					if (!credentials.accountId) throw new TmdbError()
					if (step === "return" && connection.expiresAt > now())
						parsed = await client.readAccount(
							credentials.accountId,
							credentials.accessToken,
						)
				} catch (error) {
					retryTime = retryAt(error)
					if (
						!(
							step === "abandon" &&
							!connection.accessToken &&
							error instanceof TmdbError &&
							[401, 403].includes(error.status)
						)
					)
						failure =
							error instanceof TmdbError
								? error
								: new TmdbError(
										"The import could not be prepared. Please try again.",
									)
				} finally {
					connection.canceled = true
					headers.append(
						"Set-Cookie",
						await cookie.serialize("", {
							maxAge: 0,
							secure: origin.startsWith("https:"),
						}),
					)
					if (failure instanceof TmdbError && failure.status === 429) {
						await store.save(connection, retryTime)
					} else if (connection.accessToken) {
						try {
							await disconnect(connection)
						} catch (error) {
							await store.save(connection, retryAt(error))
							failure = new TmdbError(
								"TMDB has not confirmed disconnection. GoodWatch will retry automatically. If this continues, ask TMDB support to revoke GoodWatch’s access.",
							)
						}
					} else await store.save(connection, retryTime)
				}
				if (failure) throw failure
				if (!parsed) return redirect("/settings/imports?source=tmdb")
				try {
					const { previewFetchedImport } = await import("./service.server.ts")
					const observations = parsed
					const summary = await previewFetchedImport(
						userId,
						"TMDB account",
						async () => observations,
					)
					return redirect(`/settings/imports?source=tmdb&import=${summary.id}`)
				} catch {
					throw new TmdbError(
						"The import could not be prepared. Please try again.",
					)
				}
			} catch (error) {
				return fail(
					error instanceof TmdbError
						? error.message
						: "TMDB Connect is temporarily unavailable. Please try again.",
					error instanceof TmdbError ? error.status : 503,
				)
			}
		},
	}
}
