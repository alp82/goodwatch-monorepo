import { json } from "@remix-run/node"
import { recParams, type Kind } from "./ranking.ts"

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" }
interface Dependencies<T extends { pending: boolean }> {
	authenticate(request: Request): Promise<string | undefined | null>
	load(userId: string, kind: Kind, trope?: string): Promise<T>
}
/** Authenticate before loading any member data; the session alone supplies the owner. */
export function recommendationsResource<T extends { pending: boolean }>(
	deps: Dependencies<T>,
) {
	return async ({ request }: { request: Request }) => {
		const userId = await deps.authenticate(request)
		if (!userId)
			return json(
				{ error: "Authentication required" },
				{ status: 401, headers },
			)
		const input = recParams(new URL(request.url).searchParams)
		if (!input)
			return json({ error: "Invalid kind or trope" }, { status: 400, headers })
		try {
			const result = await deps.load(userId, input.kind, input.trope)
			return json(result, {
				status: result.pending ? 202 : 200,
				headers: {
					...headers,
					...(result.pending ? { "Retry-After": "2" } : {}),
				},
			})
		} catch (error) {
			if (error instanceof RangeError)
				return json({ error: error.message }, { status: 400, headers })
			throw error
		}
	}
}
