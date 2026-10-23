import {
	redirect,
	type HeadersFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
} from "@remix-run/node"
import { finishLink } from "~/server/discord/link-callback.server"
import { linkAccounts } from "~/server/discord/link.server"
import { consumeState, discordIdentity } from "~/server/discord/oauth.server"
import { pageHeaders } from "~/utils/headers"
import { getUserIdFromRequest } from "~/utils/auth"
export const headers: HeadersFunction = (args) => {
	const headers = new Headers(pageHeaders(args))
	headers.set("Referrer-Policy", "no-referrer")
	return headers
}
export const meta: MetaFunction = () => [
	{ title: "Link Discord | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export async function loader({ request }: LoaderFunctionArgs) {
	const { cookie, status } = await finishLink(request, {
		userId: (request) => getUserIdFromRequest({ request }),
		consume: consumeState,
		identity: discordIdentity,
		link: linkAccounts,
	})
	return redirect(`/discord/link?status=${status}`, {
		headers: {
			"Cache-Control": "private, no-store",
			"Set-Cookie": cookie,
			"Referrer-Policy": "no-referrer",
		},
	})
}
