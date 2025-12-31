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
import { captureRemixErrorBoundaryError, withSentry } from "@sentry/remix"
import { createBrowserClient } from "@supabase/ssr"
import {
	HydrationBoundary,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import posthog from "posthog-js"
import React, { useEffect } from "react"
import { ToastContainer } from "react-toastify"
import { useDehydratedState } from "use-dehydrated-state"

import Footer from "~/ui/Footer"
import InfoBox from "~/ui/InfoBox"
import Header from "~/ui/main/Header"
import BottomNav from "~/ui/nav/BottomNav"
import { LocaleContext, getLocaleFromRequest } from "~/utils/locale"

import "swiper/css"
import "swiper/css/effect-coverflow"
import cssTailwind from "~/tailwind.css?url"
import cssToastify from "react-toastify/dist/ReactToastify.css?url"
import App from "~/app"
// import cssRemixDevTools from 'remix-development-tools/index.css?url'
import cssMain from "~/main.css?url"
import { AuthContext, useUser } from "./utils/auth"

export const links: LinksFunction = () => [
	// ...(process.env.NODE_ENV === "development" ? [{ rel: "stylesheet", href: cssRemixDevTools }] : []),
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
	{ rel: "stylesheet", href: cssMain },
	{ rel: "stylesheet", href: cssTailwind },
	{ rel: "stylesheet", href: cssToastify },
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "preconnect",
		href: "https://image.tmdb.org",
	},
	{
		rel: "preload",
		as: "image",
		fetchpriority: "high",
		href: "https://image.tmdb.org/t/p/w780/gqby0RhyehP3uRrzmdyUZ0CgPPe.jpg", // inception backdrop
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@700&display=swap",
	},
]

type LoaderData = {
	locale: {
		language: string
		country: string
	}
	env: {
		SUPABASE_URL: string
		SUPABASE_ANON_KEY: string
	}
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	// get locale
	const { locale } = getLocaleFromRequest(request)
	return {
		locale,
		env: {
			SUPABASE_URL: process.env.SUPABASE_URL!,
			SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
		},
	}
}

const PostHogInit = () => {
	const { user } = useUser()

	const [posthogInitialized, setPosthogInitialized] = React.useState(false)
	useEffect(() => {
		const isLocalhost =
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1"
		if (!user || isLocalhost) {
			if (posthogInitialized) {
				posthog.reset()
				setPosthogInitialized(false)
			}
			return
		}

		posthog.identify(user.email, user)

		posthog.capture("$set", {
			$set_once: { initial_login: new Date() },
		})

		posthog.capture("Pageview", {
			full_referrer: document.referrer,
		})

		setPosthogInitialized(true)
	}, [user])

	// const { consentGiven } = useCookieConsent()
	const consentGiven = "yes"
	useEffect(() => {
		const isLocalhost =
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1"
		if (isLocalhost) return

		posthog.init("phc_RM4XKAExwoQJUw6LoaNDUqCPLXuFLN6lPWybGsbJASq", {
			// api_host: 'https://eu.i.posthog.com',
			api_host: "https://a.goodwatch.app",
			persistence: consentGiven === "yes" ? "localStorage+cookie" : "memory",
			person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
		})
	}, [consentGiven])

	return null
}

export function ErrorBoundary() {
	// TODO migrate: https://remix.run/docs/en/main/start/v2#catchboundary-and-errorboundary
	const error = useRouteError()
	console.error(error)
	captureRemixErrorBoundaryError(error)

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
				<meta httpEquiv="Content-Type" content="text/html;charset=utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="flex flex-col h-screen bg-gray-900">
				<QueryClientProvider client={queryClient}>
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
					<PostHogInit />
					<ScrollRestoration />
					<Scripts />
				</QueryClientProvider>
			</body>
		</html>
	)
}

function Root() {
	const { locale, env } = useLoaderData<LoaderData>()
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

	const supabase = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

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
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<script
					async
					src="https://www.googletagmanager.com/gtag/js?id=G-5NK4EX51SM"
				/>
				<script
					dangerouslySetInnerHTML={{
						__html: `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-5NK4EX51SM');
				`,
					}}
				/>
				<Meta />
				<Links />
			</head>
			<body className="flex flex-col h-screen bg-gray-900">
				<QueryClientProvider client={queryClient}>
					<LocaleContext.Provider value={{ locale }}>
						<AuthContext.Provider value={{ supabase }}>
							<HydrationBoundary state={dehydratedState}>
								<App />
								{/* <CookieConsent /> */}
								<ToastContainer />
								<PostHogInit />
								{shouldUseScrollRestoration && <ScrollRestoration />}
								<Scripts />
							</HydrationBoundary>
						</AuthContext.Provider>
					</LocaleContext.Provider>
					<ReactQueryDevtools initialIsOpen={false} />
				</QueryClientProvider>
			</body>
		</html>
	)
}

export default withSentry(Root)
