import type React from "react";
import { forwardRef } from "react";
import type { ChangeEvent } from "react";

export interface TextInputProps {
	id: string;
	label: string;
	placeholder: string;
	initialValue?: string;
	onChange: (text: string) => void;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
	({ id, label, placeholder, initialValue, onChange }, ref) => {
		const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
			onChange(event.target.value);
		};

		return (
			<>
				<label
					htmlFor={id}
					className="mb-2 text-sm font-medium sr-only text-white"
				>
					{label}
				</label>
				<input
					id={id}
					type="text"
					className="p-1 text-md text-white placeholder-gray-400 border-2 border-slate-500 rounded-sm bg-slate-700 focus:ring-blue-500 focus:border-blue-500"
					placeholder={placeholder}
					defaultValue={initialValue}
					required
					onChange={handleChange}
					ref={ref}
				/>
			</>
		);
	},
);
