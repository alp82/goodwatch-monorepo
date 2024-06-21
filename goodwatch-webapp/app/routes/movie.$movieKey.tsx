import React, { useEffect } from 'react'
import { useLoaderData } from '@remix-run/react'
import { json, type LoaderFunction, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { getDetailsForMovie, type MovieDetails } from '~/server/details.server'
import useLocale from '~/utils/locale'
import Details from '~/ui/Details'
import { useUpdateUrlParams } from '~/hooks/updateUrlParams'
import { getUserFromRequest } from '~/utils/auth'
import { getUserData, type GetUserDataResult } from '~/server/userData.server'

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
  userData?: GetUserDataResult
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
  const userData = await getUserData({ user_id: user?.id })

  return json<LoaderData>({
    details,
    params: {
      tab,
      country,
      language,
    },
    userData,
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
