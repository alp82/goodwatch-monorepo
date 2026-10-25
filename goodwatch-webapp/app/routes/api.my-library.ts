import { presentCatalogLoader } from "~/server/media-payload.server"
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { libraryChoiceOf } from "~/domain/my-library"
import {
	type LibraryPage,
	getLibraryPage,
	withRowServices,
} from "~/server/my-library.server"
import { newOnForLibrary } from "~/server/newly-available.server"
import { getUserIdFromRequest } from "~/utils/auth"

// One step of a list of My library (#385), with every status's count.
//   GET /api/my-library?status=seen&sort=score&type=movie&q=alien&offset=60
// Every parameter is optional: Want to see, its default sort, movies and shows, no search, the first 60.
// For members: 401 for a guest. The member is the session's; nothing in the request says whose library it is.

const headers = { "Cache-Control": "private, no-store" }

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!userId) return json({ error: "Sign in" }, { status: 401, headers })
	const params = new URL(request.url).searchParams
	const offset = Number(params.get("offset") ?? 0)
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
		return json(
			{ error: "Pass offset as a step's start" },
			{ status: 400, headers },
		)
	const choice = libraryChoiceOf(params)
	const page = await getLibraryPage(
		userId,
		choice,
		offset,
		await newOnForLibrary(request, userId, choice.status),
	)
	return json<LibraryPage>(await withRowServices(page, request, userId), {
		headers,
	})
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
