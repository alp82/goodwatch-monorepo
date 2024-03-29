import React from 'react'
import { useLoaderData } from '@remix-run/react'
import { json, LoaderFunctionArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { getDetailsForTV, TVDetails } from '~/server/details.server'
import { getLocaleFromRequest } from '~/utils/locale'
import Details from '~/ui/Details'

export function headers() {
  return {
    "Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
  };
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [
    {title: `${data.details.title} (${data.details.release_year}) | TV Show | GoodWatch`},
    {description: `Learn all about the TV show "${data.details.title} (${data.details.release_year})". Scores, where to watch it and much more.`},
  ]
}

type LoaderData = {
  details: Awaited<TVDetails>
  tab: string
  country: string
  language: string
}

export const loader: LoaderFunction = async ({ params, request }: LoaderFunctionArgs) => {
  const { locale } = getLocaleFromRequest(request)

  const url = new URL(request.url)
  const tab = url.searchParams.get('tab') || 'about'

  const tvId = (params.tvKey || '').split('-')[0]
  const country = url.searchParams.get('country') || locale.country
  const language = url.searchParams.get('language') || 'en'
  const details = await getDetailsForTV({
    tvId,
    country,
    language,
  })

  return json<LoaderData>({
    details,
    tab,
    country,
    language,
  })
}

export default function DetailsTV() {
  const { details, tab, country, language } = useLoaderData<LoaderData>()

  return (
    <Details details={details} tab={tab} country={country} language={language} />
  )
}
