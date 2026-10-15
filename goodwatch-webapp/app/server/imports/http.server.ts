import { json } from "@remix-run/node"
import { z } from "zod"
import { getAuthFromRequest } from "~/utils/auth"
import { ImportFileError } from "./files.server.ts"
import { NativeImportError } from "./store.server.ts"

const fail = (error: string, status: number, headers: Headers) =>
	json({ error }, { status, headers })
export async function withMember(
	request: Request,
	handler: (userId: string, headers: Headers) => Promise<Response>,
) {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	if (!user)
		return fail(
			"Sign in to import your Letterboxd or Trakt data.",
			401,
			headers,
		)
	try {
		return await handler(user.id, headers)
	} catch (error) {
		if (error instanceof NativeImportError)
			return fail(error.message, error.status, headers)
		if (error instanceof ImportFileError)
			return fail(error.message, 400, headers)
		const message = String(
			(error as { message?: unknown } | null)?.message ?? error,
		)
		if (
			(/RelationUnknown|SchemaUnknown/.test(message) &&
				message.includes("user_import")) ||
			/ColumnUnknown/.test(message)
		)
			return fail(
				"Importing isn't available yet. Please try again later.",
				503,
				headers,
			)
		console.error("Native import request failed:", error)
		return fail(
			"Something went wrong on our side. Please try again.",
			500,
			headers,
		)
	}
}
export function importId(params: { id?: string }) {
	const parsed = z.string().uuid().safeParse(params.id)
	if (!parsed.success)
		throw new NativeImportError(
			404,
			"We couldn't find that import. Upload the file again.",
		)
	return parsed.data
}
