// What every `/api/imdb-import/*` route shares: the signed-in member, private responses, and errors as
// `{ error }` with a message written for the member.
import { json } from "@remix-run/node"
import { z } from "zod"
import type { ImdbImportError as ImdbImportErrorBody } from "~/domain/imdb-import"
import { getAuthFromRequest } from "~/utils/auth"
import { ImdbImportError } from "./file.server"

const fail = (error: string, status: number, headers: Headers) => json<ImdbImportErrorBody>({ error }, { status, headers })

/** Crate answers a statement on a table that doesn't exist with RelationUnknown: the migration hasn't run. */
function isMissingTable(error: unknown) {
	const message = String((error as { message?: unknown } | null)?.message ?? error)
	return /RelationUnknown|SchemaUnknown/.test(message) && message.includes("user_import")
}

/**
 * Runs the route for the signed-in member. `run` gets the member's ID, which every read and write is bound to,
 * and the response headers to pass on, which may carry a refreshed session cookie.
 */
export async function withMember(
	request: Request,
	run: (userId: string, headers: Headers) => Promise<Response>,
): Promise<Response> {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	if (!user) return fail("Sign in to import your IMDb ratings.", 401, headers)
	try {
		return await run(user.id, headers)
	} catch (error) {
		if (error instanceof ImdbImportError) return fail(error.message, error.status, headers)
		if (isMissingTable(error)) {
			console.error("IMDb import: the import tables are missing. Run migrations/20261002_imdb_import_crate.sql.")
			return fail("Importing from IMDb isn't available yet. Please try again later.", 503, headers)
		}
		console.error("IMDb import request failed:", error)
		return fail("Something went wrong on our side. Please try again.", 500, headers)
	}
}

/** The `:id` of a route. Import IDs are UUIDs; anything else can't be an import. */
export function importId(params: { id?: string }): string {
	const parsed = z.string().uuid().safeParse(params.id)
	if (!parsed.success) throw new ImdbImportError(404, "We couldn't find that import. Upload the file again.")
	return parsed.data
}

/** The value JSON text holds, or null when it isn't JSON. */
export function parseJson(text: string): unknown {
	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}

/** The JSON body of a POST, or null when it isn't JSON. */
export const readJson = (request: Request): Promise<unknown> => request.json().catch(() => null)
