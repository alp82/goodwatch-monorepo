// PROTOTYPE - throwaway. Which one GoodWatch wordmark should replace the different logo treatments across the app?
// Five logo systems in white and yellow, switchable via ?variant=, each drawn at every placement of the name:
//   /prototype/rec-brand?variant=A|B|C|D|E     A Initial G · B Split word · C Badge
//                                              D Initial G · white Good (A with a white "ood") · E Initial G badge (D in C's badge)
// A new route, not a variant of an existing page: the name is drawn in the headers, the living room, the og images
// and the share cards, and no single page shows all of them. The contexts are mocks; no production logo component is
// changed, nothing is read from a database, nothing is written.
// Notes: docs/prototypes/brand/README.md.
import type { LinksFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { Review } from "~/ui/prototype-rec-brand/Review"
import css from "~/ui/prototype-rec-brand/brand.css?url"
import { BRANDS } from "~/ui/prototype-rec-brand/variants"
import { assetUrl } from "~/utils/asset-url"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: assetUrl(css) }]
// The variant lives in the URL, and the (empty) loader has nothing to say about it.
export const shouldRevalidate = () => false

export const meta = () => [{ title: "Wordmark prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export default function RecBrandPrototype() {
	const [params] = useSearchParams()
	const raw = params.get("variant") ?? "A"
	const brand = BRANDS[raw as keyof typeof BRANDS] ?? BRANDS.A
	return (
		<>
			<Review brand={brand} />
			<PrototypeSwitcher variants={Object.fromEntries(Object.values(BRANDS).map((b) => [b.key, b.name]))} />
		</>
	)
}
