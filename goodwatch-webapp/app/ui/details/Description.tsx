import React from "react";

export interface DescriptionProps {
	description: string;
}

export default function Description({ description }: DescriptionProps) {
	return (
		<>
			{description && (
				<div className="my-4 prose-md sm:prose-lg lg:prose-xl prose-invert">
					{description}
				</div>
			)}
		</>
	);
}
