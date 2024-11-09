import React, { type ChangeEventHandler } from "react"

export interface NumberInputProps {
	name: string
	placeholder: string
	value?: string
	min?: number
	max?: number
	defaultValue?: string
	onBlur?: ChangeEventHandler<HTMLInputElement>
	onChange?: ChangeEventHandler<HTMLInputElement>
}

export default function NumberInput({
	name,
	placeholder,
	value,
	min,
	max,
	defaultValue,
	onBlur,
	onChange,
}: NumberInputProps) {
	return (
		<div className="w-24">
			<label htmlFor={name} className="sr-only">
				{placeholder}
			</label>
			<input
				id={name}
				name={name}
				value={value}
				min={min}
				max={max}
				defaultValue={defaultValue}
				type="number"
				className="block w-full rounded-md border-0 py-1.5 bg-stone-800 text-stone-300 shadow-sm ring-inset ring-stone-300 placeholder-stone-400 focus:border-stone-400 focus:bg-stone-700 focus:text-stone-100 focus:ring-2 focus:ring-inset focus:ring-stone-400 sm:text-sm sm:leading-6"
				placeholder={placeholder}
				onBlur={onBlur}
				onChange={onChange}
			/>
		</div>
	)
}
