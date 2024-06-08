import React, { ReactNode, useEffect, useState } from 'react'
import {CheckIcon, ChevronUpDownIcon, XMarkIcon} from '@heroicons/react/20/solid'
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import { classNames } from '~/utils/helpers'

export type AutocompleteMode = 'select' | 'search'

export interface AutocompleteItem {
  key: string | number
  label: string
}

export interface RenderItemParams<RenderItem extends AutocompleteItem> {
  item: RenderItem
  active: boolean
  selected: boolean
  disabled: boolean
}

export interface AutocompleteProps<RenderItem extends AutocompleteItem> {
  name: string
  placeholder: string
  icon: ReactNode
  autocompleteItems: RenderItem[]
  renderItem: (renderItemParams: RenderItemParams<RenderItem>) => ReactNode
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSelect?: (selectedItem: RenderItem) => void
}

export default function Autocomplete<RenderItem extends AutocompleteItem>({
  name,
  placeholder,
  icon,
  autocompleteItems,
  renderItem,
  onChange,
  onSelect,
}: AutocompleteProps<RenderItem>) {
  const [query, setQuery] = useState('')
  const [isDirty, setIsDirty] = useState(Boolean(query))
  const [selectedItem, setSelectedItem] = useState<RenderItem | null>(null)

  const autocompleteMatches = query ? autocompleteItems.filter((item) => {
    const lowercaseQuery = query.toLowerCase()
    return (typeof item.key !== 'string' || item.key.toLowerCase().includes(lowercaseQuery)) || item.label.toLowerCase().includes(lowercaseQuery)
  }) : autocompleteItems

  useEffect(() => {
    if (!selectedItem || !onSelect) return
    onSelect(selectedItem)
    handleReset()
  }, [selectedItem])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value || '')
    setIsDirty(event.target.value.length > 0)
    if (onChange) {
      onChange(event)
    }
  }

  const handleReset = () => {
    setQuery('')
    setIsDirty(false)
  }


  return (
    <Combobox as="div" value={selectedItem} onChange={setSelectedItem}>
      <div className="relative mt-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {icon}
        </div>
        <ComboboxInput
          id="search-input"
          className="block w-full rounded-md border border-transparent bg-gray-700 py-2 pl-10 pr-3 leading-5 text-gray-300 placeholder-gray-400 focus:border-gray-400 focus:bg-slate-700 focus:text-gray-100 focus:outline-none focus:ring-gray-400 sm:text-sm"
          name={name}
          placeholder={placeholder}
          autoComplete="off"
          value={query}
          displayValue={(item: AutocompleteItem) => item?.label}
          onChange={handleChange}
        />
        {isDirty && <ComboboxButton
          id="search-reset"
          className="absolute inset-y-0 right-6 flex items-center px-2"
          onClickCapture={handleReset}
        >
          <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-200" aria-hidden="true" />
        </ComboboxButton>}
        <ComboboxButton
          id="search-toggle-dropdown"
          className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
        >
          <ChevronUpDownIcon className="h-5 w-5 text-gray-400 hover:text-gray-200" aria-hidden="true" />
        </ComboboxButton>

        {autocompleteMatches?.length > 0 && (
          <ComboboxOptions className="absolute z-10 mt-1 max-h-96 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {autocompleteMatches.map((item) => (
              <ComboboxOption
                key={item.key}
                value={item}
                className={({ active }) =>
                  classNames(
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                  )
                }
              >
                {({ active, selected, disabled }) => (
                  <>
                    <div className="flex items-center">
                      {renderItem({ item, active, selected, disabled })}
                    </div>

                    {selected && (
                      <span
                        className={classNames(
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          active ? 'text-white' : 'text-indigo-600'
                        )}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        )}
      </div>
    </Combobox>
  )
}