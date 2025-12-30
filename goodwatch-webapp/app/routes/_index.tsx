import type {
	HeadersFunction,
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import { motion } from "framer-motion"
import { prefetchUserSettings } from "~/server/user-settings.server"
import { prefetchUserData } from "~/server/userData.server"
import { getTrendingMovies, getTrendingTV } from "~/server/trending.server"
import { getUserRecommendations } from "~/server/user-recommendations.server"
import { getWatchlistItems } from "~/server/watchlist-items.server"
import TasteLanding from "~/ui/taste/screens/TasteLanding"
import ShowcaseSection from "~/ui/showcase/ShowcaseSection"
import LoggedInHome from "~/ui/home/LoggedInHome"
import { getUserFromRequest, getUserIdFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"
import { getLocaleFromRequest } from "~/utils/locale"
import logo from "~/img/goodwatch-logo.png";

export const headers: HeadersFunction = () => {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	const pageMeta: PageMeta = {
		title: "GoodWatch - Find the best movies and shows to watch",
		description:
			"Discover the best movies and shows to watch right now. Rate 3 movies to get instant personalized recommendations. From award-winning Netflix exclusives to classic films on Prime Video, Disney+ and HBO.",
		url: "https://goodwatch.app",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Find your next binge by rating movies on GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
}

interface TrendingItem {
	tmdb_id: number
	title: string
	poster_path: string
}

interface RecommendationItem {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string
	match_percentage: number
}

interface WatchlistItemData {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string
}

type LoaderData = {
	isLoggedIn: boolean
	trendingMovies: TrendingItem[]
	trendingTV: TrendingItem[]
	recommendations: RecommendationItem[]
	watchlistItems: WatchlistItemData[]
	dehydratedState: DehydratedState
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const user = await getUserFromRequest({ request })
	const userId = await getUserIdFromRequest({ request })
	const isLoggedIn = !!user
	const { locale } = getLocaleFromRequest(request)

	const queryClient = new QueryClient()

	let trendingMovies: TrendingItem[] = []
	let trendingTV: TrendingItem[] = []
	let recommendations: RecommendationItem[] = []
	let watchlistItems: WatchlistItemData[] = []

	if (isLoggedIn && userId) {
		const apiParams = {
			type: "default",
			country: locale.country,
			language: locale.language,
		}

		const [trending, shows, recs, watchlist] = await Promise.all([
			getTrendingMovies(apiParams),
			getTrendingTV(apiParams),
			getUserRecommendations({ userId, limit: 40 }),
			getWatchlistItems({ userId, limit: 40 }),
			prefetchUserData({ queryClient, request }),
			prefetchUserSettings({ queryClient, request }),
		])

		trendingMovies = trending
		trendingTV = shows
		recommendations = recs
		watchlistItems = watchlist
	}

	return json<LoaderData>({
		isLoggedIn,
		trendingMovies,
		trendingTV,
		recommendations,
		watchlistItems,
		dehydratedState: dehydrate(queryClient),
	})
}

export default function Index() {
	const { 
		isLoggedIn, 
		trendingMovies, 
		trendingTV, 
		recommendations, 
		watchlistItems 
	} = useLoaderData<LoaderData>()

	if (isLoggedIn) {
		return (
			<div className="my-4 md:my-8">
				<LoggedInHome
					trendingMovies={trendingMovies}
					trendingTV={trendingTV}
					recommendations={recommendations}
					watchlistItems={watchlistItems}
				/>
			</div>
		)
	}

	return (
		<div className="flex flex-col items-center justify-center mx-4 my-4 md:my-8 pt-4 text-center">
			{/* Icon */}
			<motion.div
				initial={{ scale: 0 }}
				animate={{ scale: 1 }}
				transition={{ type: "spring" }}
				className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-b from-white/8 to-white/4 rounded-full mb-8"
			>
				<img
					className="h-10 w-auto"
					src={logo}
					alt="GoodWatch Logo"
				/>
			</motion.div>

			<motion.div
				initial={{ scale: 0 }}
				animate={{ scale: 1 }}
				transition={{ delay: 0.2 }}
			>
				<TasteLanding />
			</motion.div>
			
			{/* Feature Showcase - only for non-logged-in users */}
			<ShowcaseSection />
		</div>
	)
}
