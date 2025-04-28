import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import Collection from "~/ui/details/Collection"

export interface SequelsPrequelsFranchiseProps {
	details: MovieDetails | TVDetails
}

export default function SequelsPrequelsFranchise({
	details,
}: SequelsPrequelsFranchiseProps) {
	const { media_type } = details

	let collection: MovieDetails["collection"] | undefined
	if (media_type === "movie") {
		collection = details.collection
	}

	return (
		<>
			<h2 className="mt-6 text-2xl font-bold">Sequels and Prequels</h2>
			{collection ? (
				<Collection collection={collection} movieId={details.tmdb_id} />
			) : (
				<div className="my-4 text-gray-400 italic">
					No sequels or prequels available
				</div>
			)}
		</>
	)
}
