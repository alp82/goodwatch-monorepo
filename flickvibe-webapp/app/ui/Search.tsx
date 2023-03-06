import React from 'react'
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { useFetcher, useNavigate } from '@remix-run/react'
import Autocomplete, { AutocompleteItem } from '~/ui/Autocomplete'
import { SearchResult } from '~/server/search.server'
import { titleToDashed } from '~/utils/helpers'

export default function Search() {
  const fetcher = useFetcher()
  const autocompleteItems = (fetcher.data?.searchResults || []).map((searchResult: SearchResult) => {
    return {
      key: searchResult.id,
      mediaType: searchResult.media_type,
      label: searchResult.title || searchResult.name,
      year: (searchResult.release_date || searchResult.first_air_date || '').split('-')[0],
      // TODO smaller image
      imageUrl: `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${searchResult.poster_path}`,
    }
  })

  const navigate = useNavigate()
  const handleSelect = (selectedItem: AutocompleteItem) => {
    const title = titleToDashed(selectedItem.label)
    navigate(`/${selectedItem.mediaType}/${selectedItem.key}-${title}`)
  }

  // TODO debounce
  return <fetcher.Form method="get" action="/api/search">
    <Autocomplete
      name="query"
      placeholder="Search"
      icon={fetcher.state === 'idle' ?
        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true"/>
        :
        <ArrowPathIcon className="h-5 w-5 text-gray-400" aria-hidden="true"/>
      }
      autocompleteItems={autocompleteItems}
      onChange={(event) => fetcher.submit(event.target.form)}
      onSelect={handleSelect}
    />
  </fetcher.Form>
}