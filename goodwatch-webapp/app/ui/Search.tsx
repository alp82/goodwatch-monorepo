import React from 'react'
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { PrefetchPageLinks, useFetcher, useNavigate } from '@remix-run/react'
import Autocomplete, { AutocompleteItem, RenderItemParams } from '~/ui/form/Autocomplete'
import { MediaType, SearchResult } from '~/server/search.server'
import { classNames, titleToDashed } from '~/utils/helpers'
import placeholder from '~/img/placeholder-poster.png'

export interface SearchAutocompleteItem extends AutocompleteItem {
  mediaType: MediaType
  year: string
  imageUrl: string
}

export default function Search() {
  const fetcher = useFetcher()
  const autocompleteItems: SearchAutocompleteItem[] = (fetcher.data?.searchResults || []).map((searchResult: SearchResult) => {
    const imageUrl = searchResult.poster_path ? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${searchResult.poster_path}` : placeholder
    return {
      key: searchResult.id,
      mediaType: searchResult.media_type,
      label: searchResult.title || searchResult.name,
      year: (searchResult.release_date || searchResult.first_air_date || '').split('-')[0],
      // TODO smaller image
      imageUrl,
    }
  })

  const renderItem = ({ item, selected }: RenderItemParams<SearchAutocompleteItem>) => {
    const title = titleToDashed(item.label)
    return (
      <a href={`/${item.mediaType}/${item.key}-${title}`} className="w-full flex items-center">
        <img src={item.imageUrl} alt="" className="h-16 w-12 flex-shrink-0" />
        <div>
          <div className={classNames('ml-3 text-lg truncate font-bold')}>{item.label}</div>
          <div className={classNames('ml-3 truncate', selected ? 'font-semibold' : '')}>{item.mediaType} ({item.year})</div>
        </div>
      </a>
    )
  }

  // TODO debounce
  return <>
    <fetcher.Form method="get" action="/api/search">
      <Autocomplete<SearchAutocompleteItem>
        name="query"
        placeholder="Search"
        icon={fetcher.state === 'idle' ?
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          :
          <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" aria-hidden="true" />
        }
        autocompleteItems={autocompleteItems}
        renderItem={renderItem}
        onChange={(event) => fetcher.submit(event.target.form)}
      />
    </fetcher.Form>
    {autocompleteItems.slice(0, 4).map((item) => (
      <PrefetchPageLinks key={item.key} page={`/${item.mediaType}/${item.key}-${titleToDashed(item.label)}`} />
    ))}
  </>
}