import type React from "react";
import { forwardRef } from "react";
import type { ChangeEvent } from "react";

export interface SearchInputProps {
	id: string;
	label: string;
	placeholder: string;
	icon?: React.ReactNode;
	initialValue?: string;
	onChange: (text: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
	({ id, label, placeholder, icon, initialValue, onChange }, ref) => {
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
				<div className="relative grow max-w-md">
					{icon && (
						<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
							{icon}
						</div>
					)}
					<input
						id={id}
						type="search"
						className="block w-full p-4 ps-10 text-lg text-white placeholder-gray-400 border-2 border-slate-500 rounded-lg bg-slate-700 focus:ring-blue-500 focus:border-blue-500"
						placeholder={placeholder}
						defaultValue={initialValue}
						required
						onChange={handleChange}
						ref={ref}
					/>
				</div>
			</>
		);
	},
);
