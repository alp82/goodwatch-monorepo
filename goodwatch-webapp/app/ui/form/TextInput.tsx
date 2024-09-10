import type React from "react"
import { forwardRef } from "react"
import type { ChangeEvent } from "react"

export interface TextInputProps {
	label: string
	placeholder: string
	icon?: React.ReactNode
	initialValue?: string
	onChange: (text: string) => void
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
	({ label, placeholder, icon, initialValue, onChange }, ref) => {
		const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
			onChange(event.target.value)
		}

		return (
			<>
				<label
					htmlFor="onboarding-search"
					className="mb-2 text-sm font-medium text-gray-900 sr-only dark:text-white"
				>
					{label}
				</label>
				<div className="relative flex-grow max-w-md">
					{icon && (
						<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
							{icon}
						</div>
					)}
					<input
						type="search"
						className="block w-full p-4 ps-10 text-base text-white placeholder-gray-400 border border-gray-500 rounded-lg bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
						placeholder={placeholder}
						defaultValue={initialValue}
						required
						onChange={handleChange}
						ref={ref}
					/>
				</div>
			</>
		)
	},
)