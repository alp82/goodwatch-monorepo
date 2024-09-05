import React from "react"

export interface NextBackButtonProps {
	nextLabel?: string
	backLabel?: string
	onNext?: () => void
	onBack?: () => void
}

export default function NextBackButtons({
	nextLabel = "Next",
	backLabel = "Back",
	onNext,
	onBack,
}: NextBackButtonProps) {
	return (
		<div className="flex items-center justify-center gap-2">
			<button
				type="button"
				className="rounded-md bg-gray-700 px-2.5 py-1.5 text-lg font-semibold text-white shadow-sm hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 cursor-pointer"
				onClick={onBack}
			>
				{backLabel}
			</button>
			<button
				type="button"
				className="rounded-md bg-indigo-700 px-8 py-1.5 text-lg font-semibold text-white shadow-sm hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 cursor-pointer"
				onClick={onNext}
			>
				{nextLabel}
			</button>
		</div>
	)
}
