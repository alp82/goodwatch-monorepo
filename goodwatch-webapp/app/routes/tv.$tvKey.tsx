import React, { useEffect } from 'react'
import { useLoaderData } from '@remix-run/react'
import { json, LoaderFunctionArgs, LoaderFunction, MetaFunction } from '@remix-run/node'
import { getDetailsForTV, TVDetails } from '~/server/details.server'
import useLocale, { getLocaleFromRequest } from '~/utils/locale'
import Details from '~/ui/Details'
import { useUpdateUrlParams } from '~/hooks/updateUrlParams'

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
  params: {
    tab: string
    country: string
    language: string
  }
}

export const loader: LoaderFunction = async ({ params, request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const tab = url.searchParams.get('tab') || 'about'

  const tvId = (params.tvKey || '').split('-')[0]
  const country = url.searchParams.get('country') || ''
  const language = url.searchParams.get('language') || 'en'
  const details = await getDetailsForTV({
    tvId,
    country,
    language,
  })

  return json<LoaderData>({
    details,
    params: {
      tab,
      country,
      language,
    },
  })
}

export default function DetailsTV() {
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
