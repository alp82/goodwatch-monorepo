import { TelemetryBoot } from "~/telemetry/TelemetryBoot"
import { EARLY_TELEMETRY_SCRIPT } from "~/telemetry/early"
import { GOOGLE_TAG_INLINE_SCRIPT } from "~/telemetry/google-tag"
import { reportBoundaryError } from "~/telemetry/telemetry"
import { DiscoveryContinuity } from "~/ui/DiscoveryContinuity"
import { json } from "@remix-run/node"
import type { User } from "@supabase/auth-js"
import { getLocaleFromRequest } from "~/server/cache-identity.server"
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
	useLoaderData,
	useLocation,
	useRouteError,
} from "@remix-run/react"
import {
	type DehydratedState,
	dehydrate,
	HydrationBoundary,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import React, { Suspense, lazy } from "react"
import { ToastContainer } from "react-toastify"
import { useDehydratedState } from "use-dehydrated-state"

import Footer from "~/ui/Footer"
import InfoBox from "~/ui/InfoBox"
import BottomNav from "~/ui/nav/BottomNav"
import type { EnabledFeatures } from "~/utils/features"
import { LocaleContext } from "~/utils/locale"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

// One stylesheet for every page: it imports main.css, the brand font's rules, Swiper's, and the toast styles.
import cssTailwind from "~/tailwind.css?url"
import gabaritoLatin from "~/fonts/gabarito-latin.woff2"
import App from "~/app"
import { SearchJourneyProvider } from "~/ui/search/SearchJourney"
import { getAuthFromRequest } from "./utils/auth"

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
	// The stylesheet stays on the site's own host, whatever host the page's other files are on. It's the one request
	// that blocks the first paint, and the document's connection is already open: on the static hostname it would
	// wait for a second connection. The fonts that it names follow it.
	{ rel: "stylesheet", href: cssTailwind },
	// The site header's title is brand text and sits at the top of every page, on phones too. The preload starts
	// the font's download next to the stylesheet's, so the swap from the fallback font comes early. It's the
	// only font request of a page: the Latin Extended file loads only when a page shows such a letter.
	{
		rel: "preload",
		as: "font",
		type: "font/woff2",
		// The stylesheet names this file with a path, so the preload names the same host as the stylesheet.
		href: gabaritoLatin,
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

// The error page shows the header of the old navigation. Its menus bring the dialog library, so its code loads with
// the error page and not with every page.
const Header = lazy(reloadOnStaleChunk(() => import("~/ui/main/Header")))

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
						<Suspense fallback={null}>
							<Header />
						</Suspense>
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
