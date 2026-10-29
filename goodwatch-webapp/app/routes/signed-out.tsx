// Where sign-out lands: the little living room says good night, then switches itself off (ui/tv-egg/SignedOutTv).
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import { LazyTv } from "~/ui/tv-egg/LazyTv"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Signed out | GoodWatch",
		description: "You're signed out of GoodWatch.",
		url: "https://goodwatch.app/signed-out",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Signed out - GoodWatch",
	}
	// A moment after an action, not a page to find in search results.
	return buildMeta({ pageMeta, items: [], robots: "noindex, follow" })
}

export default function SignedOut() {
	return (
		<LazyTv
			page="signed-out"
			heading="You're signed out"
			plain={
				<div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
					<p className="text-3xl font-bold text-gray-100">You're signed out</p>
					<Link to="/sign-in" className="mt-6 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black hover:bg-amber-300">
						Sign in
					</Link>
				</div>
			}
		/>
	)
}
