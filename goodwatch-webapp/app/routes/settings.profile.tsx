// Settings, Edit profile: the member's public profile at /u/:handle. Without a handle, the handle picker first (a handle
// is chosen once and can't be changed, so every card is honestly signed). With one: the picture, cover, bio, links to
// their other profiles, and who sees each part of the profile.
// Spec: docs/implementation/member-profile/README.md
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node"
import { useLoaderData, useRevalidator } from "@remix-run/react"
import type { ProfileTitle } from "~/domain/profile"
import { avatarPath, avatarVersion } from "~/server/profile/avatar.server"
import { getProfileLibrary } from "~/server/profile/library.server"
import { getProfileSettings } from "~/server/profile/settings.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { EditProfile, type EditProfileData } from "~/ui/profile/edit/EditProfile"
import { SettingsPage } from "~/ui/settings/SettingsPage"
import { HandlePicker } from "~/ui/share-lists/HandlePicker"
import { getUserFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

const FAVORITES = 10
const COVERS = 11
const latest = (a: ProfileTitle, b: ProfileTitle) => (b.date ?? "").localeCompare(a.date ?? "")

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getUserFromRequest({ request })
	const headers = { "Cache-Control": "private, no-store" }
	if (!user?.id) return json({ signedIn: false as const, handle: null, edit: null }, { headers })
	const profile = await getCachedProfileByUserId(user.id)
	if (!profile) return json({ signedIn: true as const, handle: null, edit: null }, { headers })

	const [settings, library, version] = await Promise.all([
		getProfileSettings(user.id),
		getProfileLibrary(user.id),
		avatarVersion(user.id),
	])
	const scored = [...library.scored.values()]
	const tens = scored.filter((t) => t.score === 10 && t.poster).sort(latest)
	const nines = scored.filter((t) => t.score === 9 && t.poster).sort(latest)
	const plain = ({ genres: _genres, ...t }: ProfileTitle & { genres?: string[] }): ProfileTitle => t
	const provider = user.user_metadata?.avatar_url
	const edit: EditProfileData = {
		handle: profile.handle,
		settings: {
			bio: settings.bio,
			links: settings.links,
			avatar: settings.avatar,
			cover: settings.cover,
			visibility: settings.visibility,
		},
		photo: version ? avatarPath(profile.handle, version) : null,
		providerPhoto: typeof provider === "string" && provider.startsWith("https://") ? provider : null,
		favorites: [...tens, ...nines].slice(0, FAVORITES).map(plain),
		covers: [...tens, ...nines].filter((t) => t.backdrop).slice(0, COVERS).map(plain),
	}
	return json({ signedIn: true as const, handle: profile.handle, edit }, { headers })
}

export const meta: MetaFunction = () => [
	{ title: "Edit profile | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsProfile() {
	const loaded = useLoaderData<typeof loader>()
	const { revalidate } = useRevalidator()
	if (loaded.edit)
		return (
			<SettingsPage title="Edit profile" intro={`Your public profile at goodwatch.app/u/${loaded.edit.handle}: how it looks, and who sees each part.`}>
				<EditProfile data={loaded.edit as EditProfileData} />
			</SettingsPage>
		)
	return (
		<SettingsPage
			title="Your profile"
			intro="Pick a handle to get your profile: the address of your scores, taste and lists, and the name on every list you share."
		>
			<div className="flex max-w-2xl flex-col gap-6 rounded-2xl bg-white/[0.04] p-5 text-base text-gray-300 ring-1 ring-white/10 md:p-6">
				{loaded.signedIn ? <HandlePicker id="profile-handle" onClaimed={() => revalidate()} /> : <p className="text-gray-400">Sign in to choose a handle.</p>}
			</div>
		</SettingsPage>
	)
}
