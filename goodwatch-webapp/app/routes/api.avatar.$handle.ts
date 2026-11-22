// A member's profile photo by handle: /api/avatar/:handle?v=<version>. The version changes with every upload, so the
// current one is cached for a year; any other version moves to the current one.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { avatarPath, readAvatar } from "~/server/profile/avatar.server"
import { readProviderAvatar } from "~/server/profile/provider-avatar.server"
import { getProfileByHandle } from "~/server/share-lists/view.server"

const missing = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })

export async function loader({ params, request }: LoaderFunctionArgs) {
	const profile = await getProfileByHandle(params.handle ?? "")
	if (!profile) return missing()
	const url = new URL(request.url)
	if (url.searchParams.get("source") === "google") {
		const photo = await readProviderAvatar(profile.userId)
		if (!photo) return missing()
		const etag = `"${photo.version}"`
		const headers = {
			"Cache-Control": "public, no-cache",
			ETag: etag,
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'",
		}
		if (
			request.headers
				.get("If-None-Match")
				?.split(",")
				.some((tag) => tag.trim().replace(/^W\//, "") === etag)
		)
			return new Response(null, { status: 304, headers })
		return new Response(photo.data, {
			headers: {
				...headers,
				"Content-Type": "image/webp",
				"Content-Length": String(photo.data.length),
			},
		})
	}
	const photo = await readAvatar(profile.userId)
	if (!photo) return missing()
	const asked = url.searchParams.get("v")
	if (asked !== photo.version)
		return new Response(null, {
			status: 302,
			headers: {
				Location: avatarPath(profile.handle, photo.version),
				"Cache-Control": "no-store",
			},
		})
	return new Response(photo.data, {
		headers: {
			"Content-Type": "image/webp",
			"Content-Length": String(photo.data.length),
			"Cache-Control": "public, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'",
		},
	})
}
