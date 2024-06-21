import { json, type LoaderFunctionArgs, type LoaderFunction } from '@remix-run/node'
import { type CountriesResults, getCountries } from '~/server/countries.server'

export type LoaderData = {
  countries: CountriesResults,
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') || 'movie') as 'movie' | 'tv'
  const params = {
    type,
  }
  const countries = await getCountries(params)

  return json<LoaderData>({
    countries,
  })
}