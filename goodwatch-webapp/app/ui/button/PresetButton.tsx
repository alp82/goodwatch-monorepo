import React, { type ButtonHTMLAttributes, type ReactNode } from "react"

export interface PresetButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	active: boolean
	children: ReactNode
}

export default function PresetButton({
	active,
	children,
	...props
}: PresetButtonProps) {
	const type = props.type ?? "button"

	return (
		<button
			{...props}
			type={type}
			className={`
				py-1 px-2 border-2 border-stone-500
				${active ? "bg-stone-950 border-2 border-blue-600" : "bg-stone-700 hover:bg-stone-800"}
				${props.className ?? ""}
			`}
		>
			{children}
		</button>
	)
}
