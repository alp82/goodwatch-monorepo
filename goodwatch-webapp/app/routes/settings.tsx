// Settings: the tiles (settings._index.tsx) and the page each tile opens (settings.country.tsx, ...). One country and
// language provider holds every page, so a save on one shows on the tiles at once. Members only: a signed-out visitor
// goes to sign-in and comes back here afterwards.
import { json } from "@remix-run/node"
import { Outlet, useLocation, useNavigate } from "@remix-run/react"
import React from "react"
import { MediaPreferenceProvider } from "~/ui/media-preference/MediaPreference"
import { Spinner } from "~/ui/wait/Spinner"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"

export { pageHeaders as headers } from "~/utils/headers"

// Every Settings page is personal: no cache keeps one, the pages without a loader of their own included.
export const loader = () => json(null, { headers: { "Cache-Control": "private, no-store" } })

export default function Settings() {
	const { user, loading } = useUser()
	const { locale } = useLocale()
	const navigate = useNavigate()
	const { pathname, search } = useLocation()
	// PROTOTYPE - throwaway: the AI import hint prototype renders for guests on a local server without sign-in.
	const preview = pathname === "/settings/imports" && search.includes("variant=")
	const signedOut = !loading && !user && !preview
	React.useEffect(() => {
		if (signedOut)
			navigate(`/sign-in?redirectTo=${encodeURIComponent(pathname + search)}`, {
				replace: true,
			})
	}, [signedOut, navigate, pathname, search])

	if (!preview && (loading || !user)) {
		return (
			<div className="max-w-7xl mx-auto px-8 py-2 md:py-4 lg:py-8">
				<Spinner size="large" />
			</div>
		)
	}

	return (
		// The country the page loaded with; the provider reads what is saved.
		<MediaPreferenceProvider country={locale.country}>
			<Outlet />
		</MediaPreferenceProvider>
	)
}
