import { randomUUID } from "node:crypto"
import type { ParsedImport } from "../../domain/imports.ts"
import {
	CONNECTION_WINDOW_MS,
	createConnectCookie,
	isConnectOrigin,
	readConnectState,
} from "./connect-request.server.ts"
import type { Connection, ConnectionStore } from "./connect-store.server.ts"
import type { PlexClient } from "./plex-client.server.ts"
import { PlexError } from "./plex-http.server.ts"
import { plexFeedUrl } from "./plex-rss.server.ts"

const cookie = createConnectCookie("plex")
const invalid = () =>
	new PlexError(
		"Connection expired or already used. Start again from Imports.",
		404,
	)
export function createPlexConnect(deps: {
	store: ConnectionStore
	client: PlexClient
	origin: () => string | null
	member: (
		request: Request,
	) => Promise<{ userId: string | null; headers: Headers }>
	now?: () => number
}) {
	const now = deps.now ?? Date.now
	const { store, client } = deps
	async function discard(connection: Connection) {
		connection.requestToken = ""
		connection.pinId = undefined
		connection.accessToken = undefined
		connection.canceled = true
		try {
			await store.save(connection)
		} finally {
			await store.remove(connection.id)
		}
	}
	return {
		async sweep() {
			for (const id of await store.due(now())) {
				let value: Connection | null = null
				try {
					value = await store.claim(id, undefined, now())
					if (value) await discard(value)
				} catch {
					if (value) await store.save(value, now() + 60_000).catch(() => {})
					else {
						await store.pause(id).catch(() => {})
						console.error(
							"Plex connection cleanup paused; operator action required.",
							{ connectionId: id },
						)
					}
				}
			}
		},
		async handle(request: Request, step: string): Promise<Response> {
			const { userId, headers } = await deps.member(request)
			headers.set("Cache-Control", "private, no-store")
			headers.set("Referrer-Policy", "no-referrer")
			const fail = (message: string, status: number) =>
				Response.json({ error: message }, { status, headers })
			const redirect = (location: string) => {
				headers.set("Location", location)
				return new Response(null, { status: 303, headers })
			}
			if (!userId) return fail("Sign in to connect Plex.", 401)
			if (request.method !== "POST") return fail("Method not allowed", 405)
			const origin = deps.origin()
			if (!isConnectOrigin(request, origin))
				return fail("Open Imports on GoodWatch to connect Plex.", 403)
			try {
				if (step === "start") {
					const connection: Connection = {
						id: randomUUID(),
						source: "plex",
						userId,
						requestToken: "",
						expiresAt: now() + CONNECTION_WINDOW_MS,
					}
					if (!(await store.create(connection, connection.expiresAt)))
						return fail(
							"Finish or cancel an open connection, or wait ten minutes before starting again.",
							429,
						)
					let code: string
					try {
						const pin = await client.createPin(connection.id)
						connection.pinId = pin.id
						code = pin.code
						await store.save(connection, connection.expiresAt)
					} catch {
						await store.remove(connection.id)
						throw new PlexError()
					}
					headers.append(
						"Set-Cookie",
						await cookie.serialize(connection.id, {
							secure: origin.startsWith("https:"),
						}),
					)
					return redirect(
						`https://app.plex.tv/auth#?${new URLSearchParams({ clientID: connection.id, code, forwardUrl: `${origin}/settings/imports?source=plex&connect=${connection.id}`, "context[device][product]": "GoodWatch" })}`,
					)
				}
				if (step !== "return" && step !== "abandon")
					return fail("Not found", 404)
				const form = await request.formData()
				const id = await readConnectState(request, form, cookie)
				if (!id) throw invalid()
				const feed = form.get("feed")
				const feedUrl =
					typeof feed === "string" && feed.trim() && step === "return"
						? plexFeedUrl(feed.trim())
						: undefined
				const connection = await store.claim(id, userId, now())
				if (!connection) throw invalid()
				let parsed: ParsedImport | undefined
				let pending = false
				try {
					if (step === "return") {
						if (connection.expiresAt <= now()) throw invalid()
						const token = await client.claimPin(
							connection.pinId ?? connection.requestToken,
							connection.id,
						)
						if (!token) {
							pending = true
							await store.save(connection, connection.expiresAt)
							return fail(
								"Plex sign-in is not finished. Approve the connection in Plex, then try Preview again.",
								409,
							)
						}
						connection.consumed = true
						await store.save(connection)
						parsed = await client.readImport(token, connection.id, feedUrl)
					}
				} finally {
					if (!pending) {
						// Wipe the encrypted payload before deleting, so a failed delete retains no credential.
						await discard(connection)
						headers.append(
							"Set-Cookie",
							await cookie.serialize("", {
								maxAge: 0,
								secure: origin.startsWith("https:"),
							}),
						)
					}
				}
				if (!parsed) return redirect("/settings/imports?source=plex")
				const { previewFetchedImport } = await import("./service.server.ts")
				const summary = await previewFetchedImport(
					userId,
					"Plex server and watchlist",
					parsed,
				)
				return redirect(`/settings/imports?source=plex&import=${summary.id}`)
			} catch (error) {
				return fail(
					error instanceof PlexError
						? error.message
						: "Plex Connect is temporarily unavailable. Please try again.",
					error instanceof PlexError ? error.status : 503,
				)
			}
		},
	}
}
