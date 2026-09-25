// Share lists API. GET tells the editor who is sharing: signed in or not, their handle, or a suggested one.
// POST writes: create, update, set visibility, delete. The signed-in person must own the list.
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from "@remix-run/node"
import { useMutation } from "@tanstack/react-query"
import { warmShareCard } from "~/server/share-card/images.server"
import {
	createList,
	deleteList,
	getProfileByUserId,
	type ShareList,
	ShareListError,
	type ShareListInput,
	setListVisibility,
	suggestHandle,
	updateList,
	type Visibility,
} from "~/server/share-lists/store.server"
import { getUserFromRequest, getUserIdFromRequest } from "~/utils/auth"

type Body =
	| { intent: "create"; list: ShareListInput }
	| { intent: "update"; id: string; list: ShareListInput }
	| { intent: "visibility"; id: string; visibility: Visibility }
	| { intent: "delete"; id: string }

export type ShareListResponse = { list: ShareList } | { deleted: true } | { error: string }

/** Who is sharing. A handle suggestion comes from ?signature=, then the account's name, then its email address. */
export type ShareViewer =
	| { signedIn: false }
	| { signedIn: true; handle: string | null; suggestedHandle: string | null }

export async function loader({ request }: LoaderFunctionArgs) {
	const noStore = { headers: { "Cache-Control": "private, no-store" } }
	const user = await getUserFromRequest({ request })
	if (!user) return json<ShareViewer>({ signedIn: false }, noStore)
	const profile = await getProfileByUserId(user.id)
	if (profile) return json<ShareViewer>({ signedIn: true, handle: profile.handle, suggestedHandle: null }, noStore)
	const meta = user.user_metadata ?? {}
	const suggestedHandle = await suggestHandle(user.id, [
		new URL(request.url).searchParams.get("signature"),
		meta.user_name,
		meta.preferred_username,
		meta.full_name,
		meta.name,
		user.email?.split("@")[0],
	])
	return json<ShareViewer>({ signedIn: true, handle: null, suggestedHandle }, noStore)
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 })
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return json({ error: "Sign in to save and share lists." }, { status: 401 })

	let body: Body
	try {
		body = await request.json()
	} catch {
		return json({ error: "Invalid request." }, { status: 400 })
	}

	try {
		switch (body.intent) {
			case "create": {
				const list = await createList(userId, body.list)
				warmShareCard(list)
				return json({ list })
			}
			case "update": {
				const list = await updateList(userId, String(body.id), body.list)
				warmShareCard(list)
				return json({ list })
			}
			case "visibility":
				return json({ list: await setListVisibility(userId, String(body.id), body.visibility) })
			case "delete":
				await deleteList(userId, String(body.id))
				return json({ deleted: true })
			default:
				return json({ error: "Unknown request." }, { status: 400 })
		}
	} catch (error) {
		if (error instanceof ShareListError) return json({ error: error.message }, { status: error.status })
		console.error("[share-lists] write failed", error)
		return json({ error: "Saving failed. Try again." }, { status: 500 })
	}
}

// Query and mutation helpers

export const fetchShareViewer = async (signature: string): Promise<ShareViewer> => {
	const response = await fetch(`/api/share-lists?signature=${encodeURIComponent(signature)}`)
	if (!response.ok) throw new Error("Couldn't check your account. Try again.")
	return response.json()
}

export const useCreateShareList = () =>
	useMutation({
		mutationFn: async (list: ShareListInput): Promise<ShareList> => {
			const response = await fetch("/api/share-lists", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ intent: "create", list }),
			})
			const result = await response.json().catch(() => ({}))
			if (!response.ok) throw new Error(result.error ?? "Saving the list failed. Try again.")
			return result.list
		},
	})
