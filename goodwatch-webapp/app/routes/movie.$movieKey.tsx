import React from 'react'
import { useLoaderData } from '@remix-run/react'
import { json, LoaderFunctionArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { getDetailsForMovie, MovieDetails } from '~/server/details.server'
import { getLocaleFromRequest } from '~/utils/locale'
import Details from '~/ui/Details'

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

type LoaderData = {
  details: Awaited<MovieDetails>
  tab: string
}

export const loader: LoaderFunction = async ({ params, request }: LoaderFunctionArgs) => {
  const { locale } = getLocaleFromRequest(request)

  const url = new URL(request.url)
  const tab = url.searchParams.get('tab') || 'about'

  const movieId = (params.movieKey || '').split('-')[0]
  const country = url.searchParams.get('country') || locale.country
  const language = url.searchParams.get('language') || 'en'
  const details = await getDetailsForMovie({
    movieId,
    country,
    language,
  })

  return json<LoaderData>({
    details,
    tab,
  })
}

export default function DetailsMovie() {
  const { details, tab } = useLoaderData<LoaderData>()

  return (
    <Details details={details} tab={tab} />
  )
}
