import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"

export interface DetailsDNAProps {
	details: MovieDetails | TVDetails
}

export default function DetailsDNA({ details }: DetailsDNAProps) {
	const { tropes } = details

	const [spoilerVisible, setSpoilerVisible] = React.useState(false)
	const handleRevealSpoiler = () => {
		setSpoilerVisible(true)
	}

	return (
		<>
			<h3 className="text-xl font-bold">Tropes</h3>
			<p>
				powered by{" "}
				<a
					href="https://tvtropes.org/"
					target="_blank"
					rel="noreferrer"
					className="text-blue-400 hover:text-blue-500 cursor-pointer"
				>
					TV Tropes
				</a>
			</p>
			<div className="tropes mt-4 flex flex-col gap-2">
				{tropes.map((trope) => {
					return (
						<div key={trope.name} className="grid grid-cols-4 gap-4">
							<a
								href={trope.url}
								target="_blank"
								rel="noreferrer"
								className="text-blue-400 hover:text-blue-500 cursor-pointer"
							>
								{trope.name}
							</a>
							<div
								className="col-span-3"
								dangerouslySetInnerHTML={{ __html: trope.html }}
							/>
						</div>
					)
				})}
			</div>
		</>
	)
}
