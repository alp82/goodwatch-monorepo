import { TelemetryBoot } from "~/telemetry/TelemetryBoot"
import { EARLY_TELEMETRY_SCRIPT } from "~/telemetry/early"
import { GOOGLE_TAG_INLINE_SCRIPT } from "~/telemetry/google-tag"
import { reportBoundaryError } from "~/telemetry/telemetry"
export { retryNetworkLoader as clientLoader } from "~/utils/retry-network-loader"
import { DiscoveryContinuity } from "~/ui/DiscoveryContinuity"
import { json } from "@remix-run/node"
import type { User } from "@supabase/auth-js"
import { getEnabledFeatures } from "~/server/features.server"
import { capLogLines } from "~/server/log-cap.server"
import { startBrowserGate } from "~/server/browser-gate.server"
import { startMetrics } from "~/server/metrics/index.server"
import { startProcessStats } from "~/server/process-stats.server"
import { startTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getUserData } from "~/server/userData.server"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import { AuthProvider } from "~/ui/auth/AuthProvider"
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
	type ShouldRevalidateFunction,
	useLoaderData,
	useLocation,
	useRouteError,
} from "@remix-run/react"
import { createBrowserClient } from "@supabase/ssr"
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
import InfoBox from "~/ui/InfoBox"
import Header from "~/ui/main/Header"
import BottomNav from "~/ui/nav/BottomNav"
import type { EnabledFeatures } from "~/utils/features"
import { LocaleContext, getLocaleFromRequest } from "~/utils/locale"

// One stylesheet for every page: it imports main.css, Swiper's, and the toast styles.
import cssTailwind from "~/tailwind.css?url"
import App from "~/app"
import { SearchJourneyProvider } from "~/ui/search/SearchJourney"
import { useOgImageWarmup } from "~/ui/og-image/useOgImageWarmup"
import { getAuthFromRequest } from "./utils/auth"

export const links: LinksFunction = () => [
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
	{ rel: "manifest", href: "/site.webmanifest" },
	{ rel: "stylesheet", href: cssTailwind },
	{
		rel: "preconnect",
		href: "https://image.tmdb.org",
	},
]

export { pageHeaders as headers } from "~/utils/headers"

type LoaderData = {
	user: User | null
	features: EnabledFeatures
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

// Root data (user, features, locale, env) never depends on the query string, so filter and
// search text changes must not rerun the auth check and the user data prefetch.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) => {
	if (
		!formMethod &&
		currentUrl.pathname === nextUrl.pathname &&
		currentUrl.search !== nextUrl.search
	)
		return false
	return defaultShouldRevalidate
}

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
			features: getEnabledFeatures({ userId: user?.id }),
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

export function ErrorBoundary() {
	// TODO migrate: https://remix.run/docs/en/main/start/v2#catchboundary-and-errorboundary
	const error = useRouteError()
	console.error(error)
	reportBoundaryError(error)

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

	return (
		<html lang="en">
			<head>
				<title>Oh no!</title>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, see telemetry/early.ts */}
				<script dangerouslySetInnerHTML={{ __html: EARLY_TELEMETRY_SCRIPT }} />
				<meta httpEquiv="Content-Type" content="text/html;charset=utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="flex flex-col h-screen bg-gray-900">
				<QueryClientProvider client={queryClient}>
					<SearchJourneyProvider>
						<Header />
						<main className="relative grow mx-auto mt-24 w-full max-w-7xl px-2 sm:px-6 lg:px-8 text-neutral-300">
							<InfoBox text="Sorry, but an error occurred" />
							<div className="mt-6 p-6 bg-red-800 rounded-lg shadow-lg flex flex-col gap-4">
								{/* Error message */}
								<strong className="text-xl text-white">
									{(error as any)?.message || (error as any)?.data}
								</strong>

								{/* Try Again button */}
								<button
									type="button"
									className="self-start px-4 py-2 bg-gray-800 text-gray-100 hover:bg-gray-700 rounded-sm transition-colors"
									onClick={() => window.location.reload()}
								>
									Try Again
								</button>

								{/* Error stack trace */}
								{error?.stack && (
									<div className="bg-red-900 text-white p-4 rounded-lg overflow-auto max-h-64">
										<pre className="whitespace-pre-wrap break-words">
											{(error as any).message}
											<pre>{(error as any).data}</pre>
										</pre>
									</div>
								)}
							</div>
						</main>
						<Footer />
						<BottomNav />
						<ToastContainer />
						{/* <CookieConsent /> */}
						<TelemetryBoot />
						<ScrollRestoration />
						<Scripts />
					</SearchJourneyProvider>
				</QueryClientProvider>
			</body>
		</html>
	)
}

function Root() {
	const { locale, env, user } = useLoaderData<LoaderData>()
	const location = useLocation()
	useOgImageWarmup()

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

	const [supabase] = React.useState(() =>
		createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
	)

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
						<AuthProvider supabase={supabase} initialUser={user}>
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
