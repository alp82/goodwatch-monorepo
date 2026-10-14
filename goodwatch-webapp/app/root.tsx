import { TelemetryBoot } from "~/telemetry/TelemetryBoot"
import { EARLY_TELEMETRY_SCRIPT } from "~/telemetry/early"
import { GOOGLE_TAG_INLINE_SCRIPT } from "~/telemetry/google-tag"
import { reportBoundaryError } from "~/telemetry/telemetry"
import { DiscoveryContinuity } from "~/ui/DiscoveryContinuity"
import { json } from "@remix-run/node"
import type { User } from "@supabase/auth-js"
import { getLocaleFromRequest } from "~/server/cache-identity.server"
import { capLogLines } from "~/server/log-cap.server"
import { startBrowserGate } from "~/server/browser-gate.server"
import { startMetrics } from "~/server/metrics/index.server"
import { startProcessStats } from "~/server/process-stats.server"
import { startTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getUserData } from "~/server/userData.server"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import { AuthProvider } from "~/ui/auth/AuthProvider"
import { createAuthCookieMatcher } from "~/utils/auth-cookie"
import type {
	LinksFunction,
	LoaderFunction,
	LoaderFunctionArgs,
} from "@remix-run/node"
import {
	Links,
	Meta,
	Scripts,
	ScrollRestoration,
	isRouteErrorResponse,
	useLoaderData,
	useLocation,
	useRouteError,
	useRouteLoaderData,
} from "@remix-run/react"
import {
	type DehydratedState,
	dehydrate,
	HydrationBoundary,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import React from "react"
import { ToastContainer } from "react-toastify"
import { useDehydratedState } from "use-dehydrated-state"

import Footer from "~/ui/Footer"
import { ErrorPage } from "~/ui/ErrorPage"
import {
	HubDialog,
	MobileDock,
	NavigationProvider,
	SearchDialog,
	SiteHeader,
} from "~/ui/navigation"
import { LocaleContext } from "~/utils/locale"
import { assetBase, assetUrl } from "~/utils/asset-url"

// One stylesheet for every page: it imports main.css, the brand font's rules, Swiper's, and the toast styles.
import cssTailwind from "~/tailwind.css?url"
import gabaritoLatin from "~/fonts/gabarito-latin.woff2"
import App from "~/app"
import { AuthContext, getAuthFromRequest } from "./utils/auth"

export const links: LinksFunction = () => [
	...(assetBase()
		? [
				{
					rel: "preconnect",
					href: assetBase(),
					crossOrigin: "anonymous" as const,
				},
			]
		: []),
	{ rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
	{
		rel: "icon",
		type: "image/png",
		sizes: "32x32",
		href: "/favicon-32x32.png",
	},
	{
		rel: "icon",
		type: "image/png",
		sizes: "16x16",
		href: "/favicon-16x16.png",
	},
	{ rel: "manifest", href: assetUrl("/site.webmanifest") },
	// On the static hostname the stylesheet is fetched without credentials, like the scripts and the font, so that it
	// uses the connection the preconnect hint opened. Without it the page's only render-blocking request would wait
	// for a second connection to the same host.
	{
		rel: "stylesheet",
		href: assetUrl(cssTailwind),
		...(assetBase() ? { crossOrigin: "anonymous" as const } : {}),
	},
	// The site header's title is brand text and sits at the top of every page, on phones too. The preload starts
	// the font's download next to the stylesheet's, so the swap from the fallback font comes early. It's the
	// only font request of a page: the Latin Extended file loads only when a page shows such a letter.
	{
		rel: "preload",
		as: "font",
		type: "font/woff2",
		href: assetUrl(gabaritoLatin),
		crossOrigin: "anonymous",
	},
	{
		rel: "preconnect",
		href: "https://image.tmdb.org",
	},
]

export { pageHeaders as headers } from "~/utils/headers"

type LoaderData = {
	user: User | null
	dehydratedState: DehydratedState
	locale: {
		language: string
		country: string
	}
	env: {
		SUPABASE_URL: string
		SUPABASE_ANON_KEY: string
	}
}

// A navigation never reruns the root loader: utils/root-revalidation.ts has the rule.
export { shouldRevalidateRoot as shouldRevalidate } from "~/utils/root-revalidation"

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	// The title snapshot loads in the background from the server's first page request on.
	capLogLines()
	startTitleSnapshot()
	startProcessStats()
	startMetrics()
	startBrowserGate()
	const { locale } = getLocaleFromRequest(request)
	const { user, headers } = await getAuthFromRequest({ request })
	const queryClient = new QueryClient()
	if (user) {
		await queryClient.prefetchQuery({
			queryKey: getQueryKeyUserData(user.id),
			queryFn: () => getUserData({ user_id: user.id }),
		})
	}
	return json<LoaderData>(
		{
			user,
			dehydratedState: dehydrate(queryClient),
			locale,
			env: {
				SUPABASE_URL: process.env.SUPABASE_URL!,
				SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
			},
		},
		{ headers },
	)
}

// What the error page's header knows about the person: the root loader's data when it succeeded (a missing page, or
// a failure of a child route), else what the browser can find out.
type BoundaryRoot = LoaderData | "guest" | "pending"

// The root loader's data is missing when the root loader itself failed. Someone with a sign-in cookie may still be a
// member then, so the loader is asked once more; without the cookie there's nothing to ask, and the page is a guest's.
function useBoundaryRoot(rootData: LoaderData | undefined): BoundaryRoot {
	const [fallback, setFallback] = React.useState<BoundaryRoot>("pending")
	React.useEffect(() => {
		if (rootData) return
		if (!createAuthCookieMatcher("")(document.cookie)) {
			setFallback("guest")
			return
		}
		const controller = new AbortController()
		fetch("/?_data=root", { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => setFallback(data?.env ? data : "guest"))
			.catch(() => {
				if (!controller.signal.aborted) setFallback("guest")
			})
		return () => controller.abort()
	}, [rootData])
	return rootData ?? fallback
}

// The error page draws the site's navigation and the account slot like any page, from the root loader's data.
export function ErrorBoundary() {
	// TODO migrate: https://remix.run/docs/en/main/start/v2#catchboundary-and-errorboundary
	const error = useRouteError()
	// The data went through JSON, which is how it reaches the browser: its type here is the loader's own.
	const rootData = useRouteLoaderData("root") as LoaderData | undefined
	const root = useBoundaryRoot(rootData)
	// An address that names no page is an answer, not a failure of the app.
	const status = isRouteErrorResponse(error) ? error.status : 500
	const notFound = status === 404
	if (!notFound) {
		console.error(error)
		reportBoundaryError(error)
	}
	const detail = import.meta.env.DEV && !notFound
		? [(error as Error)?.message, (error as { data?: unknown })?.data]
				.filter((part) => typeof part === "string" && part)
				.join("\n")
		: undefined

	const [queryClient] = React.useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// With SSR, we usually want to set some default staleTime
						// above 0 to avoid refetching immediately on the client
						staleTime: 60 * 1000,
					},
				},
			}),
	)

	const page = (
		<NavigationProvider>
			<SiteHeader />
			<ErrorPage status={status} detail={detail || undefined} />
			<Footer />
			<MobileDock />
			<HubDialog />
			<SearchDialog />
		</NavigationProvider>
	)

	return (
		<html lang="en">
			<head>
				<title>
					{notFound ? "Page not found | GoodWatch" : "Something went wrong | GoodWatch"}
				</title>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, see telemetry/early.ts */}
				<script dangerouslySetInnerHTML={{ __html: EARLY_TELEMETRY_SCRIPT }} />
				<meta httpEquiv="Content-Type" content="text/html;charset=utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="flex flex-col h-screen bg-gray-900">
				<QueryClientProvider client={queryClient}>
					{typeof root === "object" ? (
						<LocaleContext.Provider value={{ locale: root.locale }}>
							<AuthProvider
								supabaseUrl={root.env.SUPABASE_URL}
								supabaseAnonKey={root.env.SUPABASE_ANON_KEY}
								initialUser={root.user}
							>
								<HydrationBoundary state={root.dehydratedState}>
									{page}
								</HydrationBoundary>
							</AuthProvider>
						</LocaleContext.Provider>
					) : (
						// No client to sign in with yet: the slot is empty while the cookie check runs, then Sign in.
						<AuthContext.Provider value={{ ...NO_CLIENT, loading: root === "pending" }}>
							{page}
						</AuthContext.Provider>
					)}
					<ToastContainer />
					<TelemetryBoot />
					<ScrollRestoration />
					<Scripts />
				</QueryClientProvider>
			</body>
		</html>
	)
}

const NO_CLIENT = {
	supabase: undefined,
	getSupabase: () => Promise.reject(new Error("No auth client")),
	user: null,
}

function Root() {
	const { locale, env, user } = useLoaderData<LoaderData>()
	const location = useLocation()

	// Add check for custom scroll handling
	const [shouldUseScrollRestoration, setShouldUseScrollRestoration] =
		React.useState(true)

	// Effect to check if we should use scroll restoration
	React.useEffect(() => {
		if (typeof document !== "undefined") {
			const checkScrollAttribute = () => {
				const hasCustomScroll =
					document.documentElement.hasAttribute("data-custom-scroll")
				setShouldUseScrollRestoration(!hasCustomScroll)
			}

			// Check immediately
			checkScrollAttribute()

			// Also check when attributes change (in case the attribute is added after initial render)
			const observer = new MutationObserver(checkScrollAttribute)
			observer.observe(document.documentElement, { attributes: true })

			return () => observer.disconnect()
		}
	}, [])

	const [queryClient] = React.useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// With SSR, we usually want to set some default staleTime
						// above 0 to avoid refetching immediately on the client
						staleTime: 60 * 1000,
					},
				},
			}),
	)
	const dehydratedState = useDehydratedState()

	return (
		<html
			lang="en"
			className="scroll-smooth"
			style={{ scrollbarGutter: "stable" }}
		>
			<head>
				<meta charSet="utf-8" />
				{/* Records the landing URL and early errors until analytics and error tracking load. */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, see telemetry/early.ts */}
				<script dangerouslySetInnerHTML={{ __html: EARLY_TELEMETRY_SCRIPT }} />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="flex flex-col h-screen bg-gray-900">
				<QueryClientProvider client={queryClient}>
					<LocaleContext.Provider value={{ locale }}>
						<AuthProvider
							supabaseUrl={env.SUPABASE_URL}
							supabaseAnonKey={env.SUPABASE_ANON_KEY}
							initialUser={user}
						>
							<HydrationBoundary state={dehydratedState}>
								<DiscoveryContinuity />
								<App />
								{/* <CookieConsent /> */}
								<ToastContainer />
								<TelemetryBoot />
								{shouldUseScrollRestoration && <ScrollRestoration />}
								<Scripts />
								{/* The tag's script loads after the page is interactive, see telemetry/google-tag.ts. */}
								<script
									// biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script
									dangerouslySetInnerHTML={{ __html: GOOGLE_TAG_INLINE_SCRIPT }}
								/>
							</HydrationBoundary>
						</AuthProvider>
					</LocaleContext.Provider>
					<ReactQueryDevtools initialIsOpen={false} />
				</QueryClientProvider>
			</body>
		</html>
	)
}

export default Root
