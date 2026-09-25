// Profile settings: the person's handle, the address of their public profile, /u/:handle, where their shared lists
// appear. A handle is chosen once (in onboarding, when sharing, or here) and can't be changed, so every card is
// honestly signed.
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import React from "react"
import { getProfileByUserId } from "~/server/share-lists/store.server"
import { profilePath } from "~/ui/share-card/links"
import { HandlePicker } from "~/ui/share-lists/HandlePicker"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	const profile = userId ? await getProfileByUserId(userId) : null
	return json(
		{ signedIn: !!userId, handle: profile?.handle ?? null },
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export const meta: MetaFunction = () => [
	{ title: "Profile Settings | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsProfile() {
	const loaded = useLoaderData<typeof loader>()
	const [handle, setHandle] = React.useState(loaded.handle)

	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex max-w-lg flex-col gap-6 text-base text-gray-300">
				<div>
					<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
						Public profile
					</h2>
					<p className="mt-2 text-gray-400">
						Your handle is the address of your public profile, where the lists
						you share appear, and it signs every list card.
					</p>
				</div>

				{handle ? (
					<div className="flex flex-col gap-1">
						<p className="text-sm font-medium text-gray-300">Handle</p>
						<p className="text-2xl font-black text-white">@{handle}</p>
						<p className="text-sm text-gray-500">
							goodwatch.app/u/{handle} · Handles are permanent, so nobody can
							sign a list as someone else.
						</p>
						<Link
							to={profilePath(handle)}
							className="mt-2 font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200"
						>
							View your profile
						</Link>
					</div>
				) : loaded.signedIn ? (
					<HandlePicker id="profile-handle" onClaimed={setHandle} />
				) : (
					<p className="text-gray-400">Sign in to choose a handle.</p>
				)}
			</div>
		</div>
	)
}
