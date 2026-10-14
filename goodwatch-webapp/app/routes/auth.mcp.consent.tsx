// The consent page an app such as Claude opens when a member connects it (#534: variant B, #570): a page of its own,
// without the site's navigation. Allow grants everything the app asked for; there is no partial choice.
import {
	BookmarkIcon,
	ChartBarIcon,
	CheckIcon,
	GlobeAltIcon,
	LockClosedIcon,
	NoSymbolIcon,
	PencilSquareIcon,
	PlayCircleIcon,
	StarIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import { ExclamationTriangleIcon, ShieldCheckIcon } from "@heroicons/react/24/solid"
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { Form, useLoaderData, useLocation } from "@remix-run/react"
import { type ComponentType, type ReactNode, type SVGProps, useState } from "react"
import { STANDALONE } from "~/app"
import { consentHeaders, mcpConsentAction, mcpConsentLoader } from "~/server/auth/mcp-flow.server"
import type { ConsentApp, ConsentView } from "~/utils/mcp-connect"
import { ConnectAppBadge, GoodWatchBadge } from "~/ui/auth/connect"
import { APP_CAN_CHANGE, APP_CAN_NEVER, APP_CAN_SEE, CONNECTED_APPS_PATH } from "~/ui/connector/connector"
import { Spinner } from "~/ui/wait/Spinner"
import { useAuthClient } from "~/utils/auth-client"

export const handle = STANDALONE

export const meta: MetaFunction = () => [
	{ title: "Connect an app | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export const headers: HeadersFunction = ({ loaderHeaders, actionHeaders }) => (actionHeaders.has("Location") ? actionHeaders : loaderHeaders)

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const view = await mcpConsentLoader(request)
	const headers = consentHeaders(request)
	if (view instanceof Response) {
		for (const [key, value] of headers) if (!view.headers.has(key)) view.headers.set(key, value)
		return view
	}
	return json(view, { headers })
}

export const action = async ({ request }: ActionFunctionArgs) => {
	const answer = await mcpConsentAction(request)
	for (const [key, value] of consentHeaders(request)) if (!answer.headers.has(key)) answer.headers.set(key, value)
	return answer
}

type Item = { icon: ComponentType<SVGProps<SVGSVGElement>>; text: string }
const SEE_ICONS = [StarIcon, PlayCircleIcon, ChartBarIcon, TvIcon]
const CHANGE_ICONS = [PlayCircleIcon, StarIcon, BookmarkIcon, PencilSquareIcon, GlobeAltIcon]
const CAN_SEE: Item[] = APP_CAN_SEE.map((text, i) => ({ icon: SEE_ICONS[i] ?? StarIcon, text }))
const CAN_CHANGE: Item[] = APP_CAN_CHANGE.map((text, i) => ({ icon: CHANGE_ICONS[i] ?? PencilSquareIcon, text }))

export default function Consent() {
	const view = useLoaderData<typeof loader>() as ConsentView
	const { app } = view
	const [leaving, setLeaving] = useState<"allow" | "deny" | null>(null)
	// The signed query goes back with the answer; the action checks it again.
	const { pathname, search } = useLocation()
	return (
		<div className="min-h-screen bg-gray-950 text-gray-300">
			<div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-5 py-8 sm:py-14">
				<p className="text-center text-2xl font-black tracking-tight text-white">
					Good<span className="text-amber-400">Watch</span>
				</p>
				{leaving ? (
					<Leaving app={app} allowed={leaving === "allow"} />
				) : (
					<>
						<Header app={app} />
						{!app.verified && <UnverifiedWarning app={app} />}
						<SignedInAs email={view.email} restartUrl={view.restartUrl} />
						<List title={`${app.name} can see`} items={CAN_SEE} />
						{view.canChange ? (
							<List title={`${app.name} can change`} items={CAN_CHANGE} />
						) : (
							<p className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-400">
								{app.name} asked to see only. It can't change anything.
							</p>
						)}
						<Cannot name={app.name} />
					</>
				)}
				{/* A plain post: the answer is a redirect to the app, which the browser follows. */}
				<Form method="post" action={pathname + search} reloadDocument className={leaving ? "hidden" : "flex flex-col-reverse gap-3 sm:flex-row"}>
					<button
						type="submit"
						name="decision"
						value="deny"
						onClick={() => setTimeout(() => setLeaving("deny"))}
						className="flex-1 cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 font-semibold text-gray-100 hover:bg-gray-700"
					>
						Deny
					</button>
					<button
						type="submit"
						name="decision"
						value="allow"
						onClick={() => setTimeout(() => setLeaving("allow"))}
						className="flex-1 cursor-pointer rounded-lg bg-amber-700 px-4 py-3 font-semibold text-white hover:bg-amber-600"
					>
						Allow {app.name}
					</button>
				</Form>
				{!leaving && (
					<p className="text-center text-xs leading-relaxed text-gray-500">
						Afterwards you go back to {app.host === "this computer" ? app.name : app.host}. Disconnect {app.name} any time in
						Settings, Connected apps.
					</p>
				)}
			</div>
		</div>
	)
}

function Header({ app }: { app: ConsentApp }) {
	return (
		<div className="text-center">
			<div className="mb-5 flex items-center justify-center gap-3">
				<ConnectAppBadge app={app} />
				<span className="flex items-center gap-1 text-gray-500" aria-hidden="true">
					<span className="h-1 w-1 rounded-full bg-current" />
					<span className="h-1 w-1 rounded-full bg-current" />
					<span className="h-1 w-1 rounded-full bg-current" />
				</span>
				<GoodWatchBadge />
			</div>
			<h1 className="text-2xl font-bold text-white sm:text-3xl">{app.name} wants to access your GoodWatch</h1>
			<p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-gray-400">
				{app.verified ? (
					<ShieldCheckIcon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
				) : (
					<ExclamationTriangleIcon className="h-4 w-4 text-amber-400" aria-hidden="true" />
				)}
				{app.verified ? `Details published by ${app.host}` : `Unverified app · ${app.host}`}
			</p>
		</div>
	)
}

function UnverifiedWarning({ app }: { app: ConsentApp }) {
	return (
		<div role="alert" className="rounded-xl border border-amber-700 bg-amber-950/50 p-4 text-sm leading-relaxed text-amber-50">
			<p className="font-semibold">GoodWatch can't check who made this app.</p>
			<p className="mt-1">
				It calls itself "{app.name}". Only allow it if you started this connection yourself, in an app you trust. It
				returns to {app.host}.
			</p>
		</div>
	)
}

// "Not you?" signs out and starts the app's request again, so it asks the right member to sign in.
function SignedInAs({ email, restartUrl }: { email: string; restartUrl: string }) {
	const auth = useAuthClient()
	const [busy, setBusy] = useState(false)
	const switchAccount = async () => {
		setBusy(true)
		await auth.signOut()
		window.location.assign(restartUrl)
	}
	return (
		<div className="flex items-center gap-3 rounded-xl bg-gray-900/70 px-4 py-3 ring-1 ring-gray-700">
			<span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-700 font-semibold text-white">
				{email.slice(0, 1).toUpperCase()}
			</span>
			<div className="min-w-0 flex-1 text-sm">
				<p className="text-gray-400">Signed in as</p>
				<p className="truncate font-medium text-gray-100">{email}</p>
			</div>
			<button type="button" onClick={switchAccount} disabled={busy} className="cursor-pointer text-sm font-medium text-amber-500 hover:text-amber-400">
				{busy ? <Spinner size="small" /> : "Not you?"}
			</button>
		</div>
	)
}

function List({ title, items }: { title: string; items: Item[] }) {
	return (
		<section>
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
			<ul className="space-y-2.5">
				{items.map(({ icon: Icon, text }) => (
					<li key={text} className="flex items-start gap-3 text-gray-200">
						<Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
						<span>{text}</span>
					</li>
				))}
			</ul>
		</section>
	)
}

function Cannot({ name }: { name: string }) {
	return (
		<section className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
			<h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-300">
				<LockClosedIcon className="h-4 w-4" aria-hidden="true" /> {name} can never
			</h2>
			<ul className="space-y-1 text-sm text-gray-400">
				{APP_CAN_NEVER.map((text) => (
					<li key={text} className="flex items-start gap-2">
						<NoSymbolIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
						{text}
					</li>
				))}
			</ul>
		</section>
	)
}

// After the choice the browser goes back to the app; this shows while it does.
function Leaving({ app, allowed }: { app: ConsentApp; allowed: boolean }): ReactNode {
	return (
		<div role="status" className="flex flex-col items-center gap-4 py-8 text-center">
			{allowed ? (
				<CheckIcon className="h-12 w-12 rounded-full bg-emerald-900 p-2.5 text-emerald-300" aria-hidden="true" />
			) : (
				<NoSymbolIcon className="h-12 w-12 text-gray-400" aria-hidden="true" />
			)}
			<h1 className="text-2xl font-bold text-white">{allowed ? `${app.name} is connected` : `${app.name} was not connected`}</h1>
			<p className="flex items-center gap-2 text-gray-400">
				<Spinner size="small" /> Taking you back to {app.host === "this computer" ? app.name : app.host}…
			</p>
			{allowed && (
				<p className="text-sm text-gray-500">
					You can disconnect it in <a href={CONNECTED_APPS_PATH} className="text-amber-500 hover:text-amber-400">Settings, Connected apps</a>.
				</p>
			)}
		</div>
	)
}
