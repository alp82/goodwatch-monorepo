// THROWAWAY #534: account + OAuth UI decisions, with memory-only actions and shareable variants.
import type { LinksFunction } from "@remix-run/node"
import type { ShouldRevalidateFunction } from "@remix-run/react"
import AuthPrototype from "~/ui/prototype-auth/AuthPrototype"
import styles from "~/ui/prototype-auth/auth.css?url"
import { assetUrl } from "~/utils/asset-url"

export function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}
export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(styles) },
]
export const meta = () => [
	{ title: "Account & connected apps prototype | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const shouldRevalidate: ShouldRevalidateFunction = () => false
export default AuthPrototype
