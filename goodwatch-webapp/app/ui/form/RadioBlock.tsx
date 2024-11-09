import { Radio, RadioGroup } from "@headlessui/react"
import React, {
	type ComponentType,
	type HTMLAttributes,
	useEffect,
} from "react"

export interface RadioOption {
	name: string
	label: string
	description: string
	icon: ComponentType<HTMLAttributes<SVGElement>>
}

export type Orientation = "horizontal" | "vertical"

export interface RadioBlockParams<T extends RadioOption[]> {
	options: T
	value?: T[number]
	orientation: Orientation
	onChange: (option: T[number]) => void
}

export default function RadioBlock<T extends RadioOption[]>({
	options,
	value,
	orientation,
	onChange,
}: RadioBlockParams<T>) {
	// initialization

	const [selectedOption, setSelectedOption] = React.useState<T[number]>(
		value || options[0],
	)

	useEffect(() => {
		if (!value || value === selectedOption) return
		setSelectedOption(value)
	}, [value])

	//  handlers

	const handleSelect = (option: RadioOption) => {
		setSelectedOption(option)
		onChange(option)
	}

	// rendering

	return (
		<RadioGroup
			value={selectedOption}
			onChange={handleSelect}
			className={`-space-y-px rounded-md ${orientation === "horizontal" && "flex flex-wrap gap-1"}`}
		>
			{options.map((option, index) => (
				<Radio
					key={option.name}
					value={option}
					aria-label={option.name}
					aria-description={option.description}
					className={`
            group relative p-3 flex gap-1
            ${orientation === "vertical" && "flex-col md:grid md:grid-cols-2 md:pl-4 md:pr-6"}
            border border-gray-700 data-[checked]:border-slate-700
            focus:outline-none cursor-pointer
            ${index === 0 ? "rounded-tl-md rounded-tr-md" : ""}
            ${index === options.length - 1 ? "rounded-bl-md rounded-br-md" : ""}
						bg-blue-950 data-[checked]:bg-slate-950
            data-[checked]:z-10
        `}
				>
					<span className="flex gap-2">
						<span
							aria-hidden="true"
							className="
                mt-0.5 h-4 w-4 flex shrink-0 items-center justify-center cursor-pointer
                rounded-full border border-gray-500
                group-data-[checked]:border-transparent group-data-[checked]:bg-indigo-600
                group-data-[focus]:ring-2 group-data-[focus]:ring-indigo-600 group-data-[focus]:ring-offset-2
              "
						>
							<span className="h-1.5 w-1.5 rounded-full group-data-[checked]:bg-gray-100" />
						</span>
						<span className="block mr-4 text-sm font-medium text-gray-200 group-data-[checked]:text-indigo-50">
							{option.label}
						</span>
					</span>
					<span className="block ml-6 md:ml-0 text-sm text-gray-400 group-data-[checked]:text-indigo-100">
						{option.description}
					</span>
				</Radio>
			))}
		</RadioGroup>
	)
}
