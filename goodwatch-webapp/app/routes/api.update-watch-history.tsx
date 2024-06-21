import type { ActionFunctionArgs, ActionFunction } from "@remix-run/node";
import { updateWatchHistory } from "~/server/watchHistory.server";
import { getUserIdFromRequest } from "~/utils/auth";

export const action: ActionFunction = async ({
	request,
}: ActionFunctionArgs) => {
	const params = await request.json();
	const user_id = await getUserIdFromRequest({ request });

	return await updateWatchHistory({
		...params,
		user_id,
	});
};
