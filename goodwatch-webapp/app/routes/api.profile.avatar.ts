// The profile photo: POST multipart `photo` (the browser crops it square first), at most 5 MB, JPEG, PNG or WebP by
// its first bytes; stored as a 512 px WebP without metadata. DELETE removes it. Spec: docs/implementation/member-profile.
import { type ActionFunctionArgs, json } from "@remix-run/node"
import {
	AVATAR_MAX_BYTES,
	avatarPath,
	deleteAvatar,
	encodeAvatar,
	saveAvatar,
	sniffImageType,
} from "~/server/profile/avatar.server"
import { readLimited, sameOrigin } from "~/server/profile/request.server"
import {
	dropPhotoChoice,
	resetProfilePages,
} from "~/server/profile/settings.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { getUserIdFromRequest } from "~/utils/auth"

const headers = { "Cache-Control": "no-store" }
// The multipart wrapper around the file adds a little.
const MAX_REQUEST_BYTES = AVATAR_MAX_BYTES + 64 * 1024

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST" && request.method !== "DELETE")
		return json({ error: "Use POST or DELETE" }, { status: 405, headers })
	if (!sameOrigin(request))
		return json({ error: "Origin mismatch" }, { status: 403, headers })
	const userId = await getUserIdFromRequest({ request })
	if (!userId)
		return json(
			{ error: "Sign in to change your photo." },
			{ status: 401, headers },
		)

	if (request.method === "DELETE") {
		await deleteAvatar(userId)
		await dropPhotoChoice(userId)
		await resetProfilePages(userId)
		return json({ ok: true }, { headers })
	}

	const profile = await getCachedProfileByUserId(userId)
	if (!profile)
		return json({ error: "Pick a handle first." }, { status: 409, headers })
	const body = await readLimited(request, MAX_REQUEST_BYTES)
	if (!body)
		return json(
			{ error: "That photo is larger than 5 MB." },
			{ status: 413, headers },
		)
	let file: unknown
	try {
		const form = await new Request(request.url, {
			method: "POST",
			headers: { "Content-Type": request.headers.get("Content-Type") ?? "" },
			body,
		}).formData()
		file = form.get("photo")
	} catch {
		return json(
			{ error: "Send the photo as a form." },
			{ status: 400, headers },
		)
	}
	if (!(file instanceof File))
		return json({ error: "No photo in the request." }, { status: 400, headers })
	if (file.size > AVATAR_MAX_BYTES)
		return json(
			{ error: "That photo is larger than 5 MB." },
			{ status: 413, headers },
		)
	const bytes = new Uint8Array(await file.arrayBuffer())
	if (!sniffImageType(bytes))
		return json(
			{ error: "Use a JPEG, PNG or WebP photo." },
			{ status: 415, headers },
		)
	let webp: Buffer
	try {
		webp = await encodeAvatar(bytes)
	} catch (error) {
		console.error("[profile] encoding a photo failed:", error)
		return json(
			{ error: "That photo couldn't be read." },
			{ status: 422, headers },
		)
	}
	const version = await saveAvatar(userId, webp)
	await resetProfilePages(userId)
	return json(
		{ ok: true, url: avatarPath(profile.handle, version) },
		{ headers },
	)
}
