import React from "react"

export interface YesNoButtonsProps {
	onYes: () => void
	onNo: () => void
}

export default function YesNoButtons({ onYes, onNo }: YesNoButtonsProps) {
	return (
		<div className="flex items-center justify-center gap-2">
			<button
				type="button"
				className="rounded-md bg-red-700 px-2.5 py-1.5 text-lg font-semibold text-white shadow-sm hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 cursor-pointer"
				onClick={onNo}
			>
				No
			</button>
			<button
				type="button"
				className="rounded-md bg-green-700 px-8 py-1.5 text-lg font-semibold text-white shadow-sm hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 cursor-pointer"
				onClick={onYes}
			>
				Yes
			</button>
		</div>
	)
}
