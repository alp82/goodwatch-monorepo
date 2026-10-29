// Settings, the last tab of the Taste area: the profile header and the Taste row (the gear lit), then the Settings
// column (a chip row on a phone) beside the page: All settings (settings._index.tsx) and each page it lists
// (settings.country.tsx, ...). A member without a handle gets the strip that asks for one in place of the header. One
// country and language provider holds every page, so a save on one shows on the tiles at once. Members only: a
// signed-out visitor goes to sign-in and comes back here afterwards.
import {
	type LoaderFunctionArgs,
	type SerializeFrom,
	json,
} from "@remix-run/node"
import {
	Outlet,
	type ShouldRevalidateFunction,
	useLoaderData,
	useLocation,
	useNavigate,
} from "@remix-run/react"
import React from "react"
import {
	type ProfileHeaderData,
	loadProfileHeader,
} from "~/server/profile/header.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { MediaPreferenceProvider } from "~/ui/media-preference/MediaPreference"
import { NoHandleChrome, ProfileChrome } from "~/ui/profile/ProfileHeader"
import { SettingsFrame } from "~/ui/settings/SettingsFrame"
import { Spinner } from "~/ui/wait/Spinner"
import { getUserIdFromRequest, useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"

export { pageHeaders as headers } from "~/utils/headers"

// Every Settings page is personal: no cache keeps one, the pages without a loader of their own included.
const headers = { "Cache-Control": "private, no-store" }

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	const profile = userId
		? await getCachedProfileByUserId(userId).catch(() => null)
		: null
	// The header is the member's own profile header; without it (no handle, or it fails), the handle strip.
	const loaded = profile?.handle
		? await loadProfileHeader(request, profile.handle).catch(() => null)
		: null
	const header: ProfileHeaderData | null =
		loaded && !(loaded instanceof Response) ? loaded.header : null
	return json({ header }, { headers })
}

// The header stays while moving between Settings pages. A save, or a revalidation of the page (a handle just picked),
// reads it again.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	formMethod || currentUrl.href === nextUrl.href
		? defaultShouldRevalidate
		: false

export default function Settings() {
	const { header } = useLoaderData<typeof loader>() as SerializeFrom<{
		header: ProfileHeaderData | null
	}>
	const { user, loading } = useUser()
	const { locale } = useLocale()
	const navigate = useNavigate()
	const { pathname, search } = useLocation()
	const signedOut = !loading && !user
	React.useEffect(() => {
		if (signedOut)
			navigate(`/sign-in?redirectTo=${encodeURIComponent(pathname + search)}`, {
				replace: true,
			})
	}, [signedOut, navigate, pathname, search])

	if (loading || !user) {
		return (
			<div className="max-w-7xl mx-auto px-8 py-2 md:py-4 lg:py-8">
				<Spinner size="large" />
			</div>
		)
	}

	return (
		<main className="min-h-screen overflow-x-clip text-white">
			{header ? (
				<ProfileChrome
					shell={header.shell as ProfileHeaderData["shell"]}
					identity={header.identity}
					pathname={pathname}
					search={search}
				/>
			) : (
				<NoHandleChrome pathname={pathname} search={search} />
			)}
			{/* The country the page loaded with; the provider reads what is saved. */}
			<MediaPreferenceProvider country={locale.country}>
				<SettingsFrame>
					<Outlet />
				</SettingsFrame>
			</MediaPreferenceProvider>
		</main>
	)
}
