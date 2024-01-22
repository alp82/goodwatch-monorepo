import { Fragment, useState } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'

export interface SelectItem {
  key: string
  label: string
  icon?: string
  disabled?: boolean
}

export interface SelectPropsBase<RenderItem> {
  selectItems: RenderItem[]
  withSearch?: boolean
}

export interface SelectPropsSingle<RenderItem> extends SelectPropsBase<RenderItem> {
  selectedItems?: RenderItem
  withMultiSelection?: false
  onSelect: (selectedItem: RenderItem) => void
}

export interface SelectPropsMulti<RenderItem> extends SelectPropsBase<RenderItem> {
  selectedItems: RenderItem[]
  withMultiSelection: true
  onSelect: (selectedItem: RenderItem[]) => void
}

export type SelectProps<RenderItem> = SelectPropsSingle<RenderItem> | SelectPropsMulti<RenderItem>

export default function Select<RenderItem extends SelectItem>({
  selectItems,
  selectedItems,
  withSearch,
  withMultiSelection,
  onSelect,
}: SelectProps<RenderItem>) {
  const [query, setQuery] = useState('')

  let searchMatches = query ? selectItems.filter((item) => {
    const lowercaseQuery = query.toLowerCase()
    return item.key.toLowerCase().includes(lowercaseQuery) || item.label.toLowerCase().includes(lowercaseQuery)
  }) : selectItems

  if (withMultiSelection) {
    searchMatches = searchMatches.sort((a, b) => {
      if (selectedItems.find((item) => item.key === a.key)) {
        return -1
      }
      return 0
    })
  }

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const handleSelect = (selectedItem: RenderItem) => {
    onSelect(selectedItem)
    setQuery('')
  }

  const handleMultiSelect = (selectedItems: RenderItem[]) => {
    onSelect(selectedItems)
  }

  return (
    <Listbox value={withMultiSelection ? selectedItems || [] : selectedItems || ''} onChange={withMultiSelection ? handleMultiSelect : handleSelect} multiple={withMultiSelection}>
      {({ open }) => (
        <>
          <div className="relative mt-2">
            <Listbox.Button className="relative w-full cursor-default rounded-md bg-gray-700 py-1.5 pl-3 pr-10 text-left text-gray-100 shadow-sm ring-1 ring-inset ring-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6">
              {selectedItems ? (
                withMultiSelection ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedItems.map((item) => (
                      <span key={item.key} className="flex items-center">
                        <img src={item.icon} alt={item.label} title={item.label} className="h-5 w-5 flex-shrink-0 rounded-full" />
                        <span className="sr-only ml-3 block truncate">{item.label}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="flex items-center">
                    <img src={selectedItems.icon} alt={selectedItems.label} className="h-5 w-5 flex-shrink-0 rounded-full" />
                    <span className="ml-3 block truncate">{selectedItems.label}</span>
                  </span>
                )
              ) : (
                <span className="ml-3 block truncate">&nbsp;</span>
              )}
              <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </span>
            </Listbox.Button>

            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md bg-gray-700 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {withSearch && (
                  <div className="sticky top-0 z-10 bg-gray-700">
                    <li className="text-gray-100 cursor-default select-none relative py-2 px-3">
                      <input
                        type="search"
                        name="search"
                        defaultValue={query}
                        autoComplete={"off"}
                        className="bg-gray-800 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="Search"
                        onChange={handleSearch}
                      />
                    </li>
                    <hr className="mb-2 h-px border-t-0 bg-gray-500" />
                  </div>
                )}
                {searchMatches.map((item) => (
                  <Listbox.Option
                    key={item.key}
                    className={({ active }) =>
                      `
                        ${active ? 'bg-indigo-600 text-white' : 'text-gray-100'}
                        relative cursor-default select-none py-2 pl-3 pr-9
                      `
                    }
                    value={item}
                  >
                    {({ selected, active }) => {
                      const isSelected = withMultiSelection ? selectedItems.find((selectedItem) => selectedItem.key === item.key) : selected
                      return (
                        <>
                          <div className="flex items-center">
                            {item.icon && <img src={item.icon} alt="" className="h-5 w-5 flex-shrink-0 rounded-full" />}
                            <span
                              className={`${isSelected ? 'font-semibold' : 'font-normal'} ml-3 block truncate`}
                            >
                              {item.label}
                            </span>
                          </div>

                          {isSelected ? (
                            <span
                              className={`
                                ${active ? 'text-white' : 'text-indigo-300'}
                                absolute inset-y-0 right-0 flex items-center pr-4
                              `}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )
                    }}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </>
      )}
    </Listbox>
  )
}