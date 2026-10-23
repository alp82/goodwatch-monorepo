// Edit profile's save: POST the whole ProfileSettings (bio, links, picture, cover, visibility), checked by
// domain/profile-settings.ts. POST { seen: true } to /api/profile/settings?notice=1 hides the one-time "Your profile is
// public now" banner. Spec: docs/implementation/member-profile/README.md
import { type ActionFunctionArgs, json } from "@remix-run/node"
import { validateProfileSettings } from "~/domain/profile-settings"
import { avatarVersion } from "~/server/profile/avatar.server"
import { fromThisSite, readJsonLimited } from "~/server/profile/request.server"
import {
	isHttpsUrl,
	markProfileNoticeSeen,
	resetProfilePages,
	saveProfileSettings,
} from "~/server/profile/settings.server"
import { getUserData } from "~/server/userData.server"
import { getUserFromRequest } from "~/utils/auth"

const headers = { "Cache-Control": "no-store" }
/** A full settings object is well under 4 KB (a 160-character bio, six links). */
const MAX_BODY_BYTES = 16 * 1024

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Use POST" }, { status: 405, headers })
	if (!fromThisSite(request))
		return json({ error: "Origin mismatch" }, { status: 403, headers })
	const user = await getUserFromRequest({ request })
	if (!user?.id)
		return json(
			{ error: "Sign in to edit your profile." },
			{ status: 401, headers },
		)
	const read = await readJsonLimited(request, MAX_BODY_BYTES)
	if (!read.ok)
		return read.problem === "too-large"
			? json({ error: "Request too large" }, { status: 413, headers })
			: json({ error: "Invalid JSON" }, { status: 400, headers })
	const body = read.value
	if (!body || typeof body !== "object" || Array.isArray(body))
		return json({ error: "Invalid request" }, { status: 400, headers })

	if (new URL(request.url).searchParams.get("notice") === "1") {
		await markProfileNoticeSeen(user.id)
		return json({ ok: true }, { headers })
	}

	// The sign-in provider's photo is read from the member's own session, never from the request.
	const providerPhoto = isHttpsUrl(user.user_metadata?.avatar_url)
		? (user.user_metadata.avatar_url as string)
		: null
	const [data, photo] = await Promise.all([
		getUserData({ user_id: user.id }),
		avatarVersion(user.id),
	])
	const checked = validateProfileSettings(body as Record<string, unknown>, {
		scored: (key) => key in data.scores,
		hasPhoto: photo !== null,
		hasProviderPhoto: providerPhoto !== null,
	})
	if (!checked.ok)
		return json(
			{ error: checked.problems[0].message, problems: checked.problems },
			{ status: 400, headers },
		)
	const saved = await saveProfileSettings(
		user.id,
		checked.settings,
		providerPhoto,
	)
	if (!saved)
		return json(
			{ error: "Saving failed. Try again." },
			{ status: 500, headers },
		)
	await resetProfilePages(user.id)
	return json({ ok: true, settings: checked.settings }, { headers })
}
