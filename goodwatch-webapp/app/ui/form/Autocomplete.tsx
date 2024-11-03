import {
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOption,
	ComboboxOptions,
} from "@headlessui/react"
import {
	CheckIcon,
	ChevronUpDownIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import type React from "react"
import { type ReactNode, useEffect, useState } from "react"
import { classNames } from "~/utils/helpers"

export interface AutocompleteItem {
	key: string
	label: string
}

export interface RenderItemParams<RenderItem extends AutocompleteItem> {
	item: RenderItem
	focus: boolean
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
	const [query, setQuery] = useState("")
	const [isDirty, setIsDirty] = useState(Boolean(query))
	const [selectedItem, setSelectedItem] = useState<RenderItem | null>(null)

	const autocompleteMatches = query
		? autocompleteItems.filter((item) => {
				const lowercaseQuery = query.toLowerCase()
				return item.label.toLowerCase().includes(lowercaseQuery)
			})
		: autocompleteItems

	useEffect(() => {
		if (!selectedItem || !onSelect) return
		onSelect(selectedItem)
		handleReset()
	}, [selectedItem])

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value || "")
		setIsDirty(event.target.value.length > 0)
		if (onChange) {
			onChange(event)
		}
	}

	const handleReset = () => {
		setQuery("")
		setIsDirty(false)
	}

	return (
		<Combobox as="div" value={selectedItem} onChange={setSelectedItem}>
			<div className="relative">
				<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					{icon}
				</div>
				<ComboboxInput
					id="search-input"
					className="
						block w-full py-2 pl-10 pr-3
						border border-transparent rounded-md focus:border-gray-400
						bg-gray-800 focus:bg-gray-900
						ring-1 ring-inset ring-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-600
						leading-5 text-gray-300 focus:text-gray-100 placeholder-gray-500 text-sm
					"
					name={name}
					placeholder={placeholder}
					autoComplete="off"
					autoFocus={true}
					value={query}
					displayValue={(item: AutocompleteItem) => item?.label}
					onChange={handleChange}
				/>
				{isDirty && (
					<ComboboxButton
						id="search-reset"
						className="absolute inset-y-0 right-6 flex items-center px-2"
						onClickCapture={handleReset}
					>
						<XMarkIcon
							className="h-5 w-5 text-gray-400 hover:text-gray-200"
							aria-hidden="true"
						/>
					</ComboboxButton>
				)}
				<ComboboxButton
					id="search-toggle-dropdown"
					className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
				>
					<ChevronUpDownIcon
						className="h-5 w-5 text-gray-400 hover:text-gray-200"
						aria-hidden="true"
					/>
				</ComboboxButton>

				{autocompleteMatches?.length > 0 && (
					<ComboboxOptions
						className="
						absolute mt-1 max-h-96 w-full overflow-y-auto overflow-x-hidden
						rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
						text-sm sm:text-base
					"
					>
						{autocompleteMatches.map((item) => (
							<ComboboxOption
								key={item.key}
								value={item}
								className={({ focus }) =>
									classNames(
										"relative cursor-pointer select-none py-2 pl-3 pr-9 text-white",
										focus ? "bg-stone-950" : "bg-stone-800",
									)
								}
							>
								{({ focus, selected, disabled }) => (
									<>
										<div className="flex items-center">
											{renderItem({ item, focus, selected, disabled })}
										</div>

										{selected && (
											<span
												className={classNames(
													"absolute inset-y-0 right-0 flex items-center pr-4",
													focus ? "text-white" : "text-indigo-600",
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
