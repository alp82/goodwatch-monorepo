// Handles for public profiles. GET ?handle= checks one while someone types; POST claims the person's handle, once.
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from "@remix-run/node"
import { useMutation, useQuery } from "@tanstack/react-query"
import { claimHandle, isHandleTaken, type Profile, ShareListError } from "~/server/share-lists/store.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { handleProblem, normalizeHandle } from "~/utils/handles"

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
	let body: { handle?: string }
	try {
		body = await request.json()
	} catch {
		return json({ error: "Invalid request." }, { status: 400 })
	}
	if (typeof body !== "object" || body === null) return json({ error: "Invalid request." }, { status: 400 })
	try {
		return json({ profile: await claimHandle(userId, String(body.handle ?? "")) })
	} catch (error) {
		if (error instanceof ShareListError) return json({ error: error.message }, { status: error.status })
		console.error("[share-lists] handle claim failed", error)
		return json({ error: "Saving the handle failed. Try again." }, { status: 500 })
	}
}

// Query and mutation hooks

/** Whether the handle is free for the signed-in person, checked while they type. Pass null to skip the check. */
export const useHandleCheck = (handle: string | null) =>
	useQuery<HandleCheck>({
		queryKey: ["handle-check", handle],
		enabled: handle !== null,
		queryFn: async ({ signal }) => {
			const response = await fetch(`/api/handle?handle=${encodeURIComponent(handle ?? "")}`, { signal })
			if (!response.ok) throw new Error("The handle check failed.")
			return response.json()
		},
	})

export const useClaimHandle = () =>
	useMutation({
		mutationFn: async (body: { handle: string }): Promise<Profile> => {
			const response = await fetch("/api/handle", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			})
			const result = await response.json().catch(() => ({}))
			if (!response.ok) throw new Error(result.error ?? "Saving the handle failed. Try again.")
			return result.profile
		},
	})
