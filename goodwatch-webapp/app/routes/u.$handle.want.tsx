import { START_AFTER_PAINT } from "~/utils/start-after-paint"
// Member profile, Wishlist tab: /u/:handle/want. What they want to see; the owner's Watch now first.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ProfileShell, ProfileWishlistPage } from "~/domain/profile"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileWishlist } from "~/server/profile/page.server"
import { ownerKeepsInWatch, profileLoader, visitorScores } from "~/server/profile/route.server"
import { ProfileTabPage } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { Body, count } from "~/ui/profile/parts"
import { WishlistPage } from "~/ui/profile/pages/WishlistPage"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	page: ProfileWishlistPage
	you: Record<string, number> | null
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(args, async ({ ownerId, viewerId, shell }) => {
		ownerKeepsInWatch(shell, args.request)
		const page = await loadProfileWishlist(ownerId, shell)
		const you = await visitorScores(viewerId, shell, page.titles.map((t) => t.key))
		return { page, you }
	})

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => profileMeta((data as Partial<Data> | undefined)?.shell, "wishlist")

export default function ProfileWishlist() {
	const { shell, page, you } = useLoaderData() as Data
	return (
		<ProfileTabPage shell={shell} part="wishlist" title="Wishlist" line={`${count(shell.counts.wishlist)} titles to see.`}>
			<Body>
				<WishlistPage shell={shell} page={page} you={you} />
			</Body>
		</ProfileTabPage>
	)
}

// The complete server document paints before route modules compete for bandwidth.
export const handle = START_AFTER_PAINT
