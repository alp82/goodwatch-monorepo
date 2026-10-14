import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { json, redirect } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import { useCallback, useEffect } from "react"
import type { SidesView } from "~/server/taste-portrait/view"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import { isEnabled } from "~/server/features.server"
import {
	type TasteTabData,
	loadTasteTab,
} from "~/server/taste-portrait/page.server"
import { prefetchUserSettings } from "~/server/user-settings.server"
import TasteProfile from "~/ui/taste/TasteProfile"
import {
	onlySideChanged,
	openingSide,
	requestedSide,
	withSide,
} from "~/ui/taste/side-address"
import { SidesOfYou } from "~/ui/taste/tabs/SidesOfYou"
import { TasteTabFrame } from "~/ui/taste/tabs/TasteTabFrame"
import { getUserFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

// The side on show is the address's (`?side=`): a change of it alone keeps the page's data.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod && onlySideChanged(currentUrl, nextUrl)
		? false
		: defaultShouldRevalidate

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const tabs = (data as LoaderData | undefined)?.kind === "tabs"
	const pageMeta: PageMeta = tabs
		? {
				title: "Your taste - GoodWatch",
				description:
					"The sides of your movie and TV taste, the places just past them, and more of what you love on your services.",
				url: "https://goodwatch.app/taste",
				image: "https://goodwatch.app/images/heroes/hero-movies.png",
				alt: "Your taste on GoodWatch",
			}
		: {
				title: "Your Taste Profile - GoodWatch",
				description:
					"View your complete taste profile with personalized insights about your movie and TV preferences.",
				url: "https://goodwatch.app/taste",
				image: "https://goodwatch.app/images/heroes/hero-movies.png",
				alt: "Your taste profile on GoodWatch",
			}

	return buildMeta({ pageMeta, items: [] })
}

// The unlock-ladder profile, served while REC_TASTE_PAGE hides the Taste tabs from the viewer.
type ProfileData = {
	kind: "profile"
	userId: string
	dehydratedState: DehydratedState
}

type LoaderData = ProfileData | TasteTabData<"sides">

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const user = await getUserFromRequest({ request })
	const userId = user?.id ?? null

	if (isEnabled("tastePage", { userId }))
		return loadTasteTab(request, "sides", userId)

	if (!user) {
		return redirect("/taste/quiz", {
			headers: { "Cache-Control": "private, no-store" },
		})
	}

	const queryClient = new QueryClient()
	await prefetchUserSettings({ queryClient, request })

	return json<ProfileData>({
		kind: "profile",
		userId: user.id,
		dehydratedState: dehydrate(queryClient),
	})
}

export default function TasteRoute() {
	const data = useLoaderData<LoaderData>()
	const [params, setParams] = useSearchParams()
	// The side on show takes the address's place, without a history entry: Back leaves the page in one step.
	const onAddress = useCallback(
		(id: string | null) =>
			setParams((now) => withSide(now, id), {
				replace: true,
				preventScrollReset: true,
			}),
		[setParams],
	)

	if (data.kind === "tabs")
		return (
			<TasteTabFrame tab="sides" memberView={data.view}>
				{(view) => (
					<Sides
						view={view}
						requested={requestedSide(params)}
						onAddress={onAddress}
					/>
				)}
			</TasteTabFrame>
		)

	return (
		<div className="relative">
			<TasteProfile userId={data.userId} />
		</div>
	)
}

/**
 * Sides of you, opened on the side the address asks for (`?side=`, ui/taste/side-address.ts). An address that names
 * no side of the person's is the page as without one, and loses the parameter. Kept in this file: the address's
 * module then has one importer and stays out of the shell every page loads.
 */
function Sides({
	view,
	requested,
	onAddress,
}: {
	view: SidesView
	requested: string | null
	onAddress: (id: string | null) => void
}) {
	const unknown =
		requested !== null && !view.sides.some((side) => side.id === requested)
	useEffect(() => {
		if (unknown) onAddress(null)
	}, [unknown, onAddress])
	return (
		<SidesOfYou
			view={view}
			opening={openingSide(view.sides, requested, view.openFirst)}
			onOpen={onAddress}
		/>
	)
}
