// Settings: the tiles (ui/settings/SettingsHome.tsx), and the sheet of the open setting, a child route, over them. One
// country and language provider holds both, so a save on a sheet shows on its tile at once. Members only: a signed-out
// visitor goes to sign-in and comes back here afterwards.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import {
	Outlet,
	useLoaderData,
	useLocation,
	useNavigate,
} from "@remix-run/react"
import React from "react"
import { listConnectedApps } from "~/server/auth/connected-apps.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { MediaPreferenceProvider } from "~/ui/media-preference/MediaPreference"
import { SettingsHome } from "~/ui/settings/SettingsHome"
import { Spinner } from "~/ui/wait/Spinner"
import { getUserIdFromRequest, useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	const [profile, connectedApps] = userId
		? await Promise.all([
				getCachedProfileByUserId(userId),
				// The tile is a summary: Settings opens without it rather than fail.
				listConnectedApps(request).catch(() => null),
			])
		: [null, null]
	return json(
		{ handle: profile?.handle ?? null, connectedApps },
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Settings | GoodWatch",
		description:
			"User Settings at GoodWatch. All movie and tv show ratings and streaming providers on the same page",
		url: "https://goodwatch.app/settings",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "GoodWatch Settings",
	}

	return [
		...buildMeta({ pageMeta, items: [] }),
		{ name: "robots", content: "noindex, nofollow" },
	]
}

export default function Settings() {
	const { handle, connectedApps } = useLoaderData<typeof loader>()
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
		// The country the page loaded with; the provider reads what is saved.
		<MediaPreferenceProvider country={locale.country}>
			<SettingsHome
				handle={handle}
				email={user.email ?? null}
				connectedApps={connectedApps}
			/>
			<Outlet />
		</MediaPreferenceProvider>
	)
}
