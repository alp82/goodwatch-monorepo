// What the /u/<handle> card shows, as a signed-out visitor may see it: the picture, the viewer type when the taste is
// public, the favorites' posters when the scores are public, and the numbers of the public parts.
import sharp from "sharp"
import { canSee } from "~/domain/profile"
import { resolveAvatar } from "~/server/profile/avatar-choice.server"
import { readAvatar } from "~/server/profile/avatar.server"
import { getProfileLibrary } from "~/server/profile/library.server"
import { getProfilePortrait } from "~/server/profile/portrait.server"
import { getProfileSettings } from "~/server/profile/settings.server"
import {
	getProfileByHandle,
	publicListsByUser,
} from "~/server/share-lists/view.server"
import { AVATAR_GRADIENTS } from "~/ui/account/AccountAvatar"
import type { OgProfileContent } from "~/ui/og-image/ProfileCard"

const poster = (path: string | null) =>
	path ? `https://image.tmdb.org/t/p/w342${path}` : null
const count = (n: number) => n.toLocaleString("en-US")

/** The photo as a JPEG data URI: satori can't decode the WebP it's stored as. */
async function photoDataUri(userId: string): Promise<string | null> {
	const photo = await readAvatar(userId)
	if (!photo) return null
	const jpeg = await sharp(photo.data).jpeg({ quality: 85 }).toBuffer()
	return `data:image/jpeg;base64,${jpeg.toString("base64")}`
}

/** The card's content for a handle; null when no member has it. */
export async function profileCardContent(
	handle: string,
): Promise<OgProfileContent | null> {
	const profile = await getProfileByHandle(handle)
	if (!profile) return null
	const { userId } = profile
	const settings = await getProfileSettings(userId)
	const sees = (part: Parameters<typeof canSee>[1]) =>
		canSee(settings.visibility, part, "guest")
	const [library, lists, persona, avatar] = await Promise.all([
		getProfileLibrary(userId),
		sees("lists") ? publicListsByUser(userId) : Promise.resolve([]),
		sees("taste")
			? getProfilePortrait(userId, "fingerprint")
					.then((view) => view.identity?.name ?? null)
					.catch(() => null)
			: Promise.resolve(null),
		resolveAvatar(
			userId,
			profile.handle,
			settings.avatar,
			settings.providerPhoto,
		),
	])

	// Favorites: every 10, latest watched first, then 9s when there are fewer than six.
	const favorites = sees("scores")
		? [...library.scored.values()]
				.filter((t) => (t.score ?? 0) >= 9 && t.poster)
				.sort(
					(a, b) =>
						(b.score ?? 0) - (a.score ?? 0) ||
						(b.date ?? "").localeCompare(a.date ?? ""),
				)
				.slice(0, 6)
		: []
	const stats: OgProfileContent["stats"] = []
	if (sees("seen"))
		stats.push({ value: count(library.seenKeys.length), label: "seen" })
	if (sees("scores"))
		stats.push({
			value: count(Object.keys(library.data.scores).length),
			label: "scores",
		})
	if (sees("lists"))
		stats.push({
			value: count(lists.length),
			label: lists.length === 1 ? "list" : "lists",
		})

	const gradient = AVATAR_GRADIENTS[avatar.color] ?? AVATAR_GRADIENTS.amber
	const picture =
		settings.avatar.kind === "photo" && avatar.url
			? await photoDataUri(userId).catch(() => null)
			: avatar.url
	return {
		kind: "profile",
		handle: profile.handle,
		persona,
		avatar: picture,
		avatarColors: [gradient.from, gradient.to, gradient.ink],
		posters: favorites.map((t) => poster(t.poster)),
		stats,
	}
}
