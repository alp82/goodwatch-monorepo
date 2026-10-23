import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
} from "@remix-run/node"
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useOutlet,
} from "@remix-run/react"
import {
	linkingAvailable,
	LinkingUnavailable,
} from "~/server/discord/link.server"
import {
	authorizeUrl,
	createState,
	requireLinkOrigin,
} from "~/server/discord/oauth.server"
import { linkStatusMessage } from "~/server/discord/link-status"
import { SettingsPage } from "~/ui/settings/SettingsPage"
import { getUserIdFromRequest, getUserFromRequest } from "~/utils/auth"

export const meta: MetaFunction = () => [
	{ title: "Link Discord | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export { pageHeaders as headers } from "~/utils/headers"
const privateHeaders = { "Cache-Control": "private, no-store" }
async function requireUser(request: Request) {
	const id = await getUserIdFromRequest({ request })
	if (!id) throw redirect("/sign-in?redirectTo=%2Fdiscord%2Flink")
	return id
}
export async function loader({ request }: LoaderFunctionArgs) {
	if (new URL(request.url).pathname === "/discord/link/callback")
		return json(
			{ account: "", available: true, status: null },
			{ headers: privateHeaders },
		)
	await requireUser(request)
	const user = await getUserFromRequest({ request })
	return json(
		{
			account: user?.email ?? "your GoodWatch account",
			available: await linkingAvailable(),
			status: new URL(request.url).searchParams.get("status"),
		},
		{ headers: privateHeaders },
	)
}
export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUser(request)
	requireLinkOrigin(request)
	if (!(await linkingAvailable()))
		return json(
			{ error: new LinkingUnavailable().message },
			{ status: 503, headers: privateHeaders },
		)
	if (!process.env.DISCORD_APP_ID || !process.env.DISCORD_CLIENT_SECRET)
		return json(
			{ error: new LinkingUnavailable().message },
			{ status: 503, headers: privateHeaders },
		)
	try {
		const { state, cookie } = await createState(userId)
		return redirect(authorizeUrl(state), {
			headers: { ...privateHeaders, "Set-Cookie": cookie },
		})
	} catch {
		return json(
			{ error: "Linking is temporarily unavailable. Please try again." },
			{ status: 503, headers: privateHeaders },
		)
	}
}
export default function DiscordLink() {
	const { account, available, status } = useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()
	const outlet = useOutlet()
	if (outlet) return outlet
	return (
		<SettingsPage
			title="Link Discord"
			intro="Get personal title cards in Discord."
		>
			{status === "linked" ? (
				<p>
					You linked Discord. You can close this tab and go back to Discord.
				</p>
			) : (
				<p className="mb-4">Linking Discord to {account}.</p>
			)}
			{status && status !== "linked" && (
				<p role="alert">{linkStatusMessage(status)}</p>
			)}
			{status === "linked" ? null : !available || result?.error ? (
				<p role="alert">
					{result?.error ??
						"Linking isn't available yet. Please try again later."}
				</p>
			) : (
				<Form method="post">
					<button
						type="submit"
						className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white"
					>
						Continue with Discord
					</button>
				</Form>
			)}
			<Link to="/settings/account" className="mt-6 block text-amber-400">
				Account settings
			</Link>
		</SettingsPage>
	)
}
