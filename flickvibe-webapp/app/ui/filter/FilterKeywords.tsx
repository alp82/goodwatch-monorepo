import React, { useEffect } from 'react'
import { ArrowPathIcon, HashtagIcon, TagIcon, XCircleIcon } from '@heroicons/react/20/solid'
import { useFetcher } from '@remix-run/react'
import Autocomplete, { AutocompleteItem, RenderItemParams } from '~/ui/Autocomplete'
import { Keyword } from '~/server/keywords.server'

export interface FilterKeywordsProps {
  withKeywords: string
  withoutKeywords: string
  onChange: (keywordsToInclude: Keyword[], keywordsToExclude: Keyword[]) => void
}

export default function FilterKeywords({ withKeywords, withoutKeywords, onChange }: FilterKeywordsProps) {
  const withKeywordsFetcher = useFetcher()
  useEffect(() => {
    withKeywordsFetcher.submit(
      { keywordIds: withKeywords },
      {
        method: 'get',
        action: '/api/keywords/by-id',
      }
    )
  }, [withKeywords])
  const keywordsToInclude: Keyword[] = withKeywordsFetcher.data?.keywords || []

  const withoutKeywordsFetcher = useFetcher()
  useEffect(() => {
    withoutKeywordsFetcher.submit(
      { keywordIds: withoutKeywords },
      {
        method: 'get',
        action: '/api/keywords/by-id',
      }
    )
  }, [withoutKeywords])
  const keywordsToExclude: Keyword[] = withoutKeywordsFetcher.data?.keywords || []

  const autocompleteFetcher = useFetcher()
  const autocompleteItems = (autocompleteFetcher.data?.keywords?.results || []).map((keyword: Keyword) => {
    return {
      key: keyword.id,
      label: keyword.name,
    }
  })

  const handleSelect = (selectedItem: AutocompleteItem) => {
    const updatedKeywordsToInclude = [...keywordsToInclude, {
      id: parseInt(selectedItem.key),
      name: selectedItem.label,
    }]
    onChange(updatedKeywordsToInclude, keywordsToExclude)
  }

  const handleDelete = (keywordToDelete: Keyword) => {
    const updatedKeywordsToInclude = keywordsToInclude.filter((keyword) => keyword.id !== keywordToDelete.id)
    onChange(updatedKeywordsToInclude, keywordsToExclude)
  }

  const renderItem = ({ item }: RenderItemParams<AutocompleteItem>) => {
    return (
      <div className="flex gap-2">
        <HashtagIcon className="h-4 w-4 text-gray-800" aria-hidden="true" />
        <div className="text-sm truncate">{item.label}</div>
      </div>
    )
  }

  // TODO debounce
  return <div className="flex flex-wrap gap-4">
    <autocompleteFetcher.Form method="get" action="/api/keywords/search">
      <Autocomplete
        name="query"
        placeholder="Keyword Search"
        icon={autocompleteFetcher.state === 'idle' ?
          <TagIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          :
          <ArrowPathIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        }
        autocompleteItems={autocompleteItems}
        renderItem={renderItem}
        onChange={(event) => autocompleteFetcher.submit(event.target.form)}
        onSelect={handleSelect}
      />
    </autocompleteFetcher.Form>
    <div className="flex gap-2">
      {keywordsToInclude.map((keyword: Keyword) => {
        return <span key={keyword.id} className="inline-flex items-center rounded bg-sky-800 px-2 py-0.5 text-xs font-medium text-sky-100">
          <HashtagIcon className="h-4 w-4 text-sky-100" aria-hidden="true" />
          {keyword.name}
          <XCircleIcon className="ml-2 h-5 w-5 cursor-pointer text-red-400 hover:text-red-500" onClick={() => handleDelete(keyword)} />
        </span>
      })}
    </div>
  </div>
}