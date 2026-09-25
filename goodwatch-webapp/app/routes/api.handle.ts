// Handles for public profiles. GET ?handle= checks one while someone types; POST claims or changes theirs.
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from "@remix-run/node"
import { claimHandle, handleProblem, isHandleTaken, normalizeHandle, ShareListError } from "~/server/share-lists/store.server"
import { getUserIdFromRequest } from "~/utils/auth"

export type HandleCheck = { handle: string; available: boolean; problem: string | null }

export async function loader({ request }: LoaderFunctionArgs) {
	const handle = normalizeHandle(new URL(request.url).searchParams.get("handle"))
	const problem = handleProblem(handle)
	if (problem) return json<HandleCheck>({ handle, available: false, problem })
	const userId = await getUserIdFromRequest({ request })
	const taken = await isHandleTaken(handle, userId)
	return json<HandleCheck>({ handle, available: !taken, problem: taken ? "That handle is taken." : null })
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 })
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return json({ error: "Sign in to choose a handle." }, { status: 401 })
	let body: { handle?: string; displayName?: string | null }
	try {
		body = await request.json()
	} catch {
		return json({ error: "Invalid request." }, { status: 400 })
	}
	try {
		return json({ profile: await claimHandle(userId, String(body.handle ?? ""), body.displayName) })
	} catch (error) {
		if (error instanceof ShareListError) return json({ error: error.message }, { status: error.status })
		console.error("[share-lists] handle claim failed", error)
		return json({ error: "Saving the handle failed. Try again." }, { status: 500 })
	}
}
