import { createHash } from "node:crypto"
import { json } from "@remix-run/node"
import type { ImportSummary, ParsedImport } from "../../domain/imports.ts"
import { isConnectOrigin } from "./connect-request.server.ts"
import { type MdblistClient, MdblistError } from "./mdblist-client.server.ts"

// The member pastes their MDBList API key; GoodWatch reads the account once and shows the usual preview. The key
// gives full access to the MDBList account (MDBList has no read-only key), so it lives only in this request: it is
// never stored, logged, put in a URL GoodWatch shows, or sent back.
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/
const MAX_BODY_BYTES = 4096

export function createMdblistImport(deps: {
	client: MdblistClient
	member: (
		request: Request,
	) => Promise<{ userId: string | null; headers: Headers }>
	origin: () => string | null
	preview?: (
		userId: string,
		displayName: string,
		parsed: ParsedImport,
	) => Promise<Pick<ImportSummary, "id">>
}) {
	// One read at a time per member and per key, so a double submit can't spend the member's MDBList quota twice.
	const running = new Set<string>()
	const preview =
		deps.preview ??
		(async (userId: string, displayName: string, parsed: ParsedImport) =>
			(await import("./service.server.ts")).previewFetchedImport(
				userId,
				displayName,
				parsed,
			))
	return {
		async handle(request: Request): Promise<Response> {
			const { userId, headers } = await deps.member(request)
			headers.set("Cache-Control", "private, no-store")
			headers.set("Referrer-Policy", "no-referrer")
			const fail = (message: string, status: number) =>
				json({ error: message }, { status, headers })
			if (!userId) return fail("Sign in to import from MDBList.", 401)
			if (request.method !== "POST") return fail("Method not allowed", 405)
			if (!isConnectOrigin(request, deps.origin()))
				return fail("Open Imports on GoodWatch to import from MDBList.", 403)
			if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES)
				return fail("Paste only your MDBList API key.", 413)
			let apiKey = ""
			try {
				const value = (await request.formData()).get("apiKey")
				apiKey = typeof value === "string" ? value.trim() : ""
			} catch {
				return fail("Paste your MDBList API key.", 400)
			}
			if (!KEY_PATTERN.test(apiKey))
				return fail(
					"That doesn't look like an MDBList API key. Copy it from your MDBList preferences.",
					400,
				)
			const keyLock = `key:${createHash("sha256").update(apiKey).digest("hex")}`
			const memberLock = `member:${userId}`
			if (running.has(keyLock) || running.has(memberLock))
				return fail(
					"An MDBList import is already being read. Wait for its preview.",
					429,
				)
			running.add(keyLock)
			running.add(memberLock)
			try {
				// The member's request signal: leaving the page stops the read and frees the lock.
				const parsed = await deps.client.readAccount(apiKey, {
					signal: request.signal,
				})
				apiKey = ""
				const summary = await preview(userId, "MDBList account", parsed)
				headers.set(
					"Location",
					`/settings/imports?source=mdblist&import=${summary.id}`,
				)
				return new Response(null, { status: 303, headers })
			} catch (error) {
				// Only fixed messages: anything else could carry the key.
				return error instanceof MdblistError
					? fail(error.message, error.status)
					: fail("The import could not be prepared. Please try again.", 503)
			} finally {
				apiKey = ""
				running.delete(keyLock)
				running.delete(memberLock)
			}
		},
	}
}
