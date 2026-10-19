// Settings: who you are, then one tile per setting, each one link to its own page (/settings/country, ...), and My
// library at the end. The layout (settings.tsx) checks the sign-in and holds the country and language provider.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { listConnectedApps } from "~/server/auth/connected-apps.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { SettingsHome } from "~/ui/settings/SettingsHome"
import { getUserIdFromRequest, useUser } from "~/utils/auth"
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

	return buildMeta({ pageMeta, items: [], robots: "noindex, nofollow" })
}

export default function SettingsIndex() {
	const { handle, connectedApps } = useLoaderData<typeof loader>()
	const { user } = useUser()
	return (
		<SettingsHome
			handle={handle}
			email={user?.email ?? null}
			connectedApps={connectedApps}
		/>
	)
}
