import type React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface SubmitButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	loading?: boolean;
	onSubmit: (e: React.FormEvent) => void;
	children: ReactNode;
}

export default function SubmitButton({
	loading = false,
	onSubmit,
	children,
	...props
}: SubmitButtonProps) {
	const type = props.type ?? "button";

	return (
		<button
			{...props}
			type="submit"
			className={`
        inline-block mt-4 px-4 py-2
        ${loading ? "cursor-default" : ""}
        border border-indigo-700 rounded-md 
        ${loading ? "bg-indigo-700/50" : "bg-indigo-700 hover:bg-indigo-800"}
        ${loading ? "text-gray-200/50" : "text-gray-200 hover:text-white"}
        text-base font-medium 
      `}
			disabled={loading}
			onClick={onSubmit}
		>
			{loading ? "Loading..." : children}
		</button>
	);
}
