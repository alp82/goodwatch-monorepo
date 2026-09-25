// Writes for share lists: create, update, set visibility, delete. The signed-in person must own the list.
import { type ActionFunctionArgs, json } from "@remix-run/node"
import {
	createList,
	deleteList,
	type ShareList,
	ShareListError,
	type ShareListInput,
	setListVisibility,
	updateList,
	type Visibility,
} from "~/server/share-lists/store.server"
import { getUserIdFromRequest } from "~/utils/auth"

type Body =
	| { intent: "create"; list: ShareListInput }
	| { intent: "update"; id: string; list: ShareListInput }
	| { intent: "visibility"; id: string; visibility: Visibility }
	| { intent: "delete"; id: string }

export type ShareListResponse = { list: ShareList } | { deleted: true } | { error: string }

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
				return json({ list })
			}
			case "update": {
				const list = await updateList(userId, String(body.id), body.list)
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
