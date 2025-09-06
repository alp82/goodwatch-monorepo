import React from "react";

export interface DescriptionProps {
	description: string;
}

export default function Description({ description }: DescriptionProps) {
	return (
		<>
			{description && (
				<div className="my-8 sm:text-lg lg:text-xl prose-invert">
					{description}
				</div>
			)}
		</>
	);
}
