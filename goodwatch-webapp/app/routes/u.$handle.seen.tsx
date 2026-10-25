// Member profile, Seen tab: /u/:handle/seen. What they watched, latest first, by month.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ProfileShell, ProfileSeenPage } from "~/domain/profile"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileSeen } from "~/server/profile/page.server"
import { profileLoader, visitorServices } from "~/server/profile/route.server"
import type { RowServices } from "~/server/row-services.server"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { Body, count } from "~/ui/profile/parts"
import { SeenPage } from "~/ui/profile/pages/SeenPage"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	page: ProfileSeenPage
	services: RowServices | null
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(args, async ({ ownerId, viewerId, shell }) => {
		const page = await loadProfileSeen(ownerId, shell)
		const services = await visitorServices(args.request, viewerId, shell, page.titles)
		return { page, services }
	})

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => profileMeta((data as Partial<Data> | undefined)?.shell, "seen")

export default function ProfileSeen() {
	const { shell, page, services } = useLoaderData() as Data
	return (
		<ProfileFrame shell={shell} tab="seen" part="seen" title="Seen" line={`${count(shell.counts.seen)} titles seen, latest first.`}>
			<Body>
				<SeenPage shell={shell} page={page} services={services} />
			</Body>
		</ProfileFrame>
	)
}
