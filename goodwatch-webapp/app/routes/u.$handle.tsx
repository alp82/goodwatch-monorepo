// The Profile area on a member's profile: /u/:handle and its tabs. The profile header and the Profile row stay put while
// the tabs change under them (the Outlet). Handles are permanent: a differently cased handle redirects to the lowercase
// one, unknown and deleted handles answer 404. List pages (/u/:handle/lists/new, /:id, /:id/edit) render inside it.
// Spec: docs/implementation/member-profile/README.md
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
	useRouteLoaderData,
} from "@remix-run/react"
import {
	type ProfileHeaderData,
	loadProfileHeader,
} from "~/server/profile/header.server"
import { profileCacheControl } from "~/server/profile/page.server"
import { ProfileChrome, isVisitorView } from "~/ui/profile/ProfileHeader"
import { visitorBarStyle } from "~/ui/profile/header/VisitorView"

export { pageHeaders as headers } from "~/utils/headers"

export const PROFILE_LAYOUT_ID = "routes/u.$handle"

export type ProfileLayoutData = ProfileHeaderData

export async function loader({ request, params }: LoaderFunctionArgs) {
	const loaded = await loadProfileHeader(request, params.handle ?? "")
	if (loaded instanceof Response) return loaded
	return json<ProfileLayoutData>(loaded.header, {
		headers: { "Cache-Control": profileCacheControl(loaded.viewerId) },
	})
}

// The header belongs to the profile: another tab, a tab's own query (?sort, ?side) or ?as=visitor keep it. A save
// (a score, a list) or a revalidation of the page reads it again, for the counts.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	currentParams,
	nextParams,
	formMethod,
	defaultShouldRevalidate,
}) =>
	formMethod ||
	currentUrl.href === nextUrl.href ||
	currentParams.handle !== nextParams.handle
		? defaultShouldRevalidate
		: false

/** The layout's data, for the tabs under it. */
export function useProfileLayout() {
	return useRouteLoaderData<typeof loader>(PROFILE_LAYOUT_ID) as
		| SerializeFrom<ProfileLayoutData>
		| undefined
}

export default function ProfileLayout() {
	const { shell, identity, print, match } = useLoaderData<
		typeof loader
	>() as ProfileLayoutData
	const { pathname, search } = useLocation()
	// --visitor-bar-h: the sticky visitor bar's height while it shows, for the sticky rows under it.
	return (
		<main
			className="min-h-screen overflow-x-clip text-white"
			style={visitorBarStyle(isVisitorView(shell, pathname, search))}
		>
			<ProfileChrome
				shell={shell}
				identity={identity}
				print={print}
				match={match}
				pathname={pathname}
				search={search}
			/>
			<Outlet />
		</main>
	)
}
