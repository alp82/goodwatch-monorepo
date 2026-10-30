// Member profile, Shows tab: /u/:handle/shows. The shows they follow, in My shows' groups.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ProfileShell, ProfileShowsPage } from "~/domain/profile"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileShows } from "~/server/profile/page.server"
import { ownerKeepsInWatch, profileLoader } from "~/server/profile/route.server"
import { ProfileTabPage } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { Body } from "~/ui/profile/parts"
import { ShowsPage } from "~/ui/profile/pages/ShowsPage"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	page: ProfileShowsPage
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(args, async ({ ownerId, shell }) => {
		ownerKeepsInWatch(shell, args.request)
		const page = await loadProfileShows(ownerId, shell)
		return { page }
	})

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => profileMeta((data as Partial<Data> | undefined)?.shell, "shows")

export default function ProfileShows() {
	const { shell, page } = useLoaderData() as Data
	return (
		<ProfileTabPage shell={shell} part="shows" title="Shows" line={shell.viewer === "owner" ? "The shows you follow, with progress." : "The shows they follow, with progress."}>
			<Body>
				<ShowsPage shell={shell} page={page} />
			</Body>
		</ProfileTabPage>
	)
}
