import React from "react"

export interface DescriptionProps {
	description: string
}

export default function Description({ description }: DescriptionProps) {
	return (
		<>
			{description && (
				<>
					<div className="mb-4 prose-md sm:prose-lg lg:prose-xl dark:prose-invert">
						{description}
					</div>
				</>
			)}
		</>
	)
}
