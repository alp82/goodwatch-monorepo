import React from "react";
import { useLoaderData } from "@remix-run/react";
import UserAction from "~/ui/auth/UserAction";
import type { LoaderData } from "~/routes/movie.$movieKey";
import type { MovieDetails, TVDetails } from "~/server/details.server";
import type {
	UpdateFavoritesPayload,
	UpdateFavoritesResult,
} from "~/server/favorites.server";
import { useAPIAction } from "~/utils/api-action";

export interface FavoriteActionProps {
	children: React.ReactElement;
	details: MovieDetails | TVDetails;
}

export default function FavoriteAction({
	children,
	details,
}: FavoriteActionProps) {
	const { tmdb_id, media_type } = details;

	const { userData } = useLoaderData<LoaderData>();
	const action = userData?.[media_type]?.[tmdb_id]?.onFavorites
		? "remove"
		: "add";

	const { submitProps } = useAPIAction<
		UpdateFavoritesPayload,
		UpdateFavoritesResult
	>({
		url: "/api/update-favorites",
		params: {
			tmdb_id,
			media_type,
			action,
		},
	});

	return (
		<UserAction instructions={<>Save your all-time favorites.</>}>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	);
}
