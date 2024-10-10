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

import Footer from "~/ui/Footer"
import InfoBox from "~/ui/InfoBox"
import Header from "~/ui/main/Header"
import BottomNav from "~/ui/nav/BottomNav"
import { LocaleContext, getLocaleFromRequest } from "~/utils/locale"

import cssToastify from "react-toastify/dist/ReactToastify.css?url"
import { useDehydratedState } from "use-dehydrated-state"
import App from "~/app"
// import cssRemixDevTools from 'remix-development-tools/index.css?url'
import cssMain from "~/main.css?url"
import { useCookieConsent } from "~/routes/api.user-settings.get"
import cssTailwind from "~/tailwind.css?url"
import { CookieConsent } from "~/ui/CookieConsent"
import { AuthRedirect } from "~/ui/auth/AuthRedirect"
import { AuthContext, useUser } from "./utils/auth"

export const links: LinksFunction = () => [
	// ...(process.env.NODE_ENV === "development" ? [{ rel: "stylesheet", href: cssRemixDevTools }] : []),
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

	const { consentGiven } = useCookieConsent()
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
	return (
		<html lang="en">
			<head>
				<title>Oh no!</title>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="flex flex-col h-screen bg-gray-900">
				<Header />
				<main className="relative flex-grow mx-auto mt-24 w-full max-w-7xl px-2 sm:px-6 lg:px-8 text-neutral-300">
					<InfoBox text="Sorry, but an error occurred" />
					<div className="mt-6 p-6 bg-red-800 rounded-lg shadow-lg flex flex-col gap-4">
						{/* Error message */}
						<strong className="text-xl text-white">
							{error.message || error.data}
						</strong>

						{/* Try Again button */}
						<button
							type="button"
							className="self-start px-4 py-2 bg-gray-800 text-gray-100 hover:bg-gray-700 rounded transition-colors"
							onClick={() => window.location.reload()}
						>
							Try Again
						</button>

						{/* Error stack trace */}
						{error.stack && (
							<div className="bg-red-900 text-white p-4 rounded-lg overflow-auto max-h-64">
								<pre className="whitespace-pre-wrap break-words">
									{error.stack}
								</pre>
							</div>
						)}
					</div>
				</main>
				<Footer />
				<BottomNav />
				<ToastContainer />
				<CookieConsent />
				<PostHogInit />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

function Root() {
	const { locale, env } = useLoaderData<LoaderData>()

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
		<html lang="en" className="scroll-smooth">
			<head>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="flex flex-col h-screen bg-gray-900">
				<QueryClientProvider client={queryClient}>
					<AuthRedirect>
						<HydrationBoundary state={dehydratedState}>
							<LocaleContext.Provider value={{ locale }}>
								<AuthContext.Provider value={{ supabase }}>
									<App />
									<CookieConsent />
									<ToastContainer />
									<PostHogInit />
									<ScrollRestoration />
									<Scripts />
								</AuthContext.Provider>
							</LocaleContext.Provider>
						</HydrationBoundary>
					</AuthRedirect>
					<ReactQueryDevtools initialIsOpen={false} />
				</QueryClientProvider>
			</body>
		</html>
	)
}

export default withSentry(Root)
