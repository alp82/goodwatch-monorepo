import type { ActionFunctionArgs, ActionFunction } from "@remix-run/node";
import { updateWishList } from "~/server/wishList.server";
import { getUserIdFromRequest } from "~/utils/auth";

export const action: ActionFunction = async ({
	request,
}: ActionFunctionArgs) => {
	const params = await request.json();
	const user_id = await getUserIdFromRequest({ request });

	return await updateWishList({
		...params,
		user_id,
	});
};
