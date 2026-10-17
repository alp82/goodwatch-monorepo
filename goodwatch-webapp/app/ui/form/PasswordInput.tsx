import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import React, { forwardRef, useState } from "react";

export interface PasswordInputProps {
	id: string;
	label: string;
	placeholder: string;
	value: string;
	error?: string;
	onChange: (value: string) => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
	({ id, label, placeholder, value, error, onChange }, ref) => {
		const [showPassword, setShowPassword] = useState(false);

		return (
			<div className="space-y-1">
				<label htmlFor={id} className="block text-sm font-medium text-gray-300">
					{label}
				</label>
				<div className="relative">
					<input
						type={showPassword ? "text" : "password"}
						id={id}
						value={value}
						placeholder={placeholder}
						onChange={(e) => onChange(e.target.value)}
						className={`
            mt-1 block w-full rounded-md bg-white/[0.06] px-3 py-2 pr-10
            text-white placeholder-white/30
            border ${error ? "border-red-400" : "border-white/20"}
            shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm
          `}
					/>
					<button
						type="button"
						onClick={() => setShowPassword(!showPassword)}
						className="absolute inset-y-0 right-0 flex items-center pr-3"
					>
						{showPassword ? (
							<EyeSlashIcon className="h-4 w-4 text-gray-400" />
						) : (
							<EyeIcon className="h-4 w-4 text-gray-400" />
						)}
					</button>
				</div>
				{error && <p className="text-sm text-red-400">{error}</p>}
			</div>
		);
	},
);
