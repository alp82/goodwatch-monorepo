import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { libraryChoiceOf } from "~/domain/my-library"
import { isEnabled } from "~/server/features.server"
import { type LibraryPage, getLibraryPage } from "~/server/my-library.server"
import { getUserIdFromRequest } from "~/utils/auth"

// One step of a list of My library (#385), with every status's count.
//   GET /api/my-library?status=seen&sort=score&type=movie&q=alien&offset=60
// Every parameter is optional: Want to see, its default sort, movies and shows, no search, the first 60.
// For members: 401 for a guest, and not found while REC_TRACKING hides tracking from the viewer. The member is the
// session's; nothing in the request says whose library it is.

const headers = { "Cache-Control": "private, no-store" }

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!isEnabled("tracking", { userId }))
		return json({ error: "Not found" }, { status: 404, headers })
	if (!userId) return json({ error: "Sign in" }, { status: 401, headers })
	const params = new URL(request.url).searchParams
	const offset = Number(params.get("offset") ?? 0)
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
		return json({ error: "Pass offset as a step's start" }, { status: 400, headers })
	return json<LibraryPage>(
		await getLibraryPage(userId, libraryChoiceOf(params), offset),
		{ headers },
	)
}
