import { useLoaderData } from "@remix-run/react";
import React from "react";
import type { LoaderData } from "~/routes/movie.$movieKey";
import type { MovieDetails, TVDetails } from "~/server/details.server";
import type {
	UpdateWatchHistoryPayload,
	UpdateWatchHistoryResult,
} from "~/server/watchHistory.server";
import UserAction from "~/ui/auth/UserAction";
import { useAPIAction } from "~/utils/api-action";

export interface WatchHistoryActionProps {
	children: React.ReactElement;
	details: MovieDetails | TVDetails;
}

export default function WatchHistoryAction({
	children,
	details,
}: WatchHistoryActionProps) {
	const { tmdb_id, media_type } = details;

	const { userData } = useLoaderData<LoaderData>();
	const action = userData?.[media_type]?.[tmdb_id]?.onWatchHistory
		? "remove"
		: "add";

	const { submitProps } = useAPIAction<
		UpdateWatchHistoryPayload,
		UpdateWatchHistoryResult
	>({
		url: "/api/update-watch-history",
		params: {
			tmdb_id,
			media_type,
			action,
		},
	});

	return (
		<UserAction
			instructions={<>Your history shows every title you ever have watched.</>}
		>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	);
}
