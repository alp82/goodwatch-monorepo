import { JSXElementConstructor } from 'react'

export interface Tab {
  key: string
  label: string
  icon?: JSXElementConstructor<any>
  current: boolean
}

export interface TabsProps {
  tabs: Tab[]
  pills: boolean
  onSelect: (tab: Tab) => void
}

export default function Tabs({ tabs, pills, onSelect }: TabsProps) {
  const renderedTabs = (
    <div className="flex flex-wrap gap-2 font-medium text-xs sm:text-sm md:text-md lg:text-lg">
      {tabs.map((tab) => (
        <span
          key={tab.key}
          onClick={() => onSelect(tab)}
          className={`
            ${tab.current
              ? 'border-indigo-500 text-indigo-200'
              : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'
            }
            ${pills
              ? 'rounded-md px-3 py-2'
              : 'group border-b-2 py-4 px-1'
            }
            ${tab.current && pills && 'bg-indigo-800'}
            cursor-pointer inline-flex items-center
          `}
          aria-current={tab.current ? 'page' : undefined}
        >
          {tab.icon && <tab.icon
            className={`
              -ml-0.5 mr-2 h-5 w-5
            `}
            aria-hidden="true"
          />}
          <span>{tab.label}</span>
        </span>
))}
    </div>
  )

  return (
    <div>
      {/*<div className="sm:hidden">*/}
      {/*  <label htmlFor="tabs" className="sr-only">*/}
      {/*    Select a tab*/}
      {/*  </label>*/}
      {/*  <select*/}
      {/*    id="tabs"*/}
      {/*    name="tabs"*/}
      {/*    className="block w-full rounded-md border-gray-300 bg-gray-700 py-2 px-3 leading-5 text-gray-300 focus:border-indigo-500 focus:ring-indigo-500"*/}
      {/*    defaultValue={tabs.find((tab) => tab.current)?.key}*/}
      {/*    onChange={(e) => {*/}
      {/*      const tab = tabs.find(tab => tab.key === e.target.value)*/}
      {/*      if (tab) {*/}
      {/*        onSelect(tab)*/}
      {/*      }*/}
      {/*    }}*/}
      {/*  >*/}
      {/*    {tabs.map((tab) => (*/}
      {/*      <option key={tab.key} value={tab.key}>*/}
      {/*        {tab.label}*/}
      {/*      </option>*/}
      {/*    ))}*/}
      {/*  </select>*/}
      {/*</div>*/}
      <div className="block">
        {pills ? (
          <nav className="flex space-x-4" aria-label="Tabs">
            {renderedTabs}
          </nav>
        ) : (
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {renderedTabs}
            </nav>
          </div>
        )}
      </div>
    </div>
  )
}
