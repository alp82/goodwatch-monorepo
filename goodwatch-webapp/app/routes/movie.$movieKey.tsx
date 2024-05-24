import React, { useEffect } from 'react'
import { useLoaderData } from '@remix-run/react'
import { json, LoaderFunctionArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, parse, serialize } from '@supabase/ssr'
import { getDetailsForMovie, MovieDetails } from '~/server/details.server'
import useLocale, { getLocaleFromRequest } from '~/utils/locale'
import Details from '~/ui/Details'
import { useUpdateUrlParams } from '~/hooks/updateUrlParams'
import { getWishList, GetWishListResult, WishListItem } from '~/server/wishList.server'
import { getUserFromRequest } from '~/utils/auth'
import { getWatchHistory, GetWatchHistoryResult } from '~/server/watchHistory.server'
import { getFavorites, GetFavoritesResult } from '~/server/favorites.server'

export function headers() {
  return {
    "Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
  };
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [
    {title: `${data.details.title} (${data.details.release_year}) | Movie | GoodWatch`},
    {description: `Learn all about the movie "${data.details.title} (${data.details.release_year})". Scores, where to watch it and much more.`},
  ]
}

export type LoaderData = {
  details: Awaited<MovieDetails>
  params: {
    tab: string
    country: string
    language: string
  },
  wishList?: GetWishListResult
  watchHistory?: GetWatchHistoryResult
  favorites?: GetFavoritesResult
}

export const loader: LoaderFunction = async ({ params, request }: LoaderFunctionArgs) => {
  const movieId = (params.movieKey || '').split('-')[0]

  const url = new URL(request.url)
  const tab = url.searchParams.get('tab') || 'about'
  const country = url.searchParams.get('country') || ''
  const language = url.searchParams.get('language') || 'en'

  const details = await getDetailsForMovie({
    movieId,
    country,
    language,
  })

  const user = await getUserFromRequest({ request })
  const wishList = await getWishList({ user_id: user?.id })
  const watchHistory = await getWatchHistory({ user_id: user?.id })
  const favorites = await getFavorites({ user_id: user?.id })

  return json<LoaderData>({
    details,
    params: {
      tab,
      country,
      language,
    },
    wishList,
    watchHistory,
    favorites,
  })
}

export default function DetailsMovie() {
  const { details, params } = useLoaderData<LoaderData>()
  const { tab, country, language } = params
  const { locale } = useLocale();

  const { currentParams, updateParams } = useUpdateUrlParams({
    params,
  })

  useEffect(() => {
    if (country === '') {
      const country = localStorage.getItem('country') || locale.country

      const newParams = {
        ...currentParams,
        country,
      }
      updateParams(newParams)
    }
  }, [])

  return (
    <Details details={details} tab={tab} country={country} language={language} />
  )
}
