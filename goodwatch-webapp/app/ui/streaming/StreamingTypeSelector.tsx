import React from "react"
import type { StreamType } from "~/server/details.server"

const types: { label: string; value: StreamType }[] = [
	{ label: "Flatrate", value: "flatrate" },
	{ label: "Buy", value: "buy" },
	{ label: "Rent", value: "rent" },
]

interface StreamingTypeSelectorProps {
	value: string
	onChange: (value: StreamType) => void
}

export default function StreamingTypeSelector({
	value,
	onChange,
}: StreamingTypeSelectorProps) {
	return (
		<div className="w-full flex gap-2 items-center">
			{types.map((type) => (
				<button
					key={type.value}
					className={`w-full max-w-36 px-3 py-1.5 rounded-sm border text-sm transition-colors ${
						value === type.value
							? "text-black border-amber-700 bg-amber-500 "
							: " text-white border-stone-500 bg-stone-700 hover:bg-stone-600"
					}`}
					onClick={() => onChange(type.value)}
					type="button"
				>
					{type.label}
				</button>
			))}
		</div>
	)
}
