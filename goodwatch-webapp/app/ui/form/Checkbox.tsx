import type React from "react";
import { type ComponentType, type HTMLAttributes, useEffect } from "react";

export interface CheckOption {
	name: string;
	label: string;
	description?: string;
	icon?: ComponentType<HTMLAttributes<SVGElement>>;
}

export interface CheckboxParams<T extends CheckOption> {
	option: T;
	defaultChecked?: boolean;
	onChange: (enabled: boolean) => void;
}

export default function Checkbox<T extends CheckOption>({
	option,
	defaultChecked,
	onChange,
}: CheckboxParams<T>) {
	const { name, label, description } = option;

	//  handlers

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.checked);
	};

	// rendering

	return (
		<div className="flex items-center ps-4 border bg-gray-800/50 border-gray-700 rounded">
			<input
				id={name}
				type="checkbox"
				defaultChecked={defaultChecked}
				name={name}
				className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-600 ring-offset-gray-800 focus:ring-2 "
				onChange={handleChange}
			/>
			<label
				htmlFor={name}
				className="w-full py-4 ms-2 text-sm font-medium text-gray-300"
			>
				{label}
			</label>
		</div>
		// <div className="flex items-start">
		// 	<div className="inline-flex h-6 items-center">
		// 		<input
		// 			id={name}
		// 			name={name}
		// 			type="checkbox"
		// 			aria-describedby={`${name}-describedby`}
		// 			className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
		// 			onChange={handleChange}
		// 		/>
		// 	</div>
		// 	<div className="ml-2 text-sm/6">
		// 		<label htmlFor={name} className="font-medium text-gray-100">
		// 			{label}
		// 		</label>{' '}
		// 		{description && (
		// 			<span id={`${name}-describedby`} className="text-gray-500">
		// 					<span className="sr-only">{description}</span>
		// 				</span>
		// 			)}
		// 		</div>
		// 	</div>
	);
}
