import React, { useEffect } from 'react'
import { GlobeAltIcon } from '@heroicons/react/20/solid'
import { useFetcher } from '@remix-run/react'
import { RenderItemParams } from '~/ui/form/Autocomplete'
import Select, { SelectItem } from '~/ui/form/Select'
import { Country } from '~/server/countries.server'

export interface FilterCountriesProps {
  type: 'movie' | 'tv'
  selectedCountry: string
  onChange: (country: string) => void
}

export default function FilterCountries({ type, selectedCountry, onChange }: FilterCountriesProps) {
  const countriesFetcher = useFetcher<{countries: Country[]}>()
  useEffect(() => {
    countriesFetcher.submit(
      { type },
      {
        method: 'get',
        action: '/api/discover/countries',
      }
    )
  }, [type])
  const countries = countriesFetcher.data?.countries || []

  const selectItems = countries.map((country) => {
    return {
      key: country.code,
      label: country.name,
      icon: `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country.code}.svg`,
    }
  }).sort((a, b) => {
    if (a.label < b.label) {
      return -1
    }
    if (a.label > b.label) {
      return 1
    }
    return 0
  })

  const handleSelect = (selectedItem: SelectItem) => {
    onChange(selectedItem.key)
  }

  return <div className="w-72">
    <Select<SelectItem>
      selectItems={selectItems}
      selectedItems={selectItems.find((item) => item.key === selectedCountry)}
      withSearch={true}
      onSelect={handleSelect}
    />
  </div>
}