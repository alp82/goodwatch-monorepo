import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import type { UserData } from "~/types/user-data"
import { getUserData } from "~/server/userData.server"
import { getUserIdFromRequest } from "~/utils/auth"

export const queryKeyUserData = ["user-data"]

export const loader: LoaderFunction = async ({ request }) => {
	const userId = await getUserIdFromRequest({ request })
	const userData = await getUserData({ user_id: userId })

	return json<UserData>(userData)
}

export const useUserData = () => {
	const url = "/api/user-data"
	return useQuery<UserData>({
		queryKey: queryKeyUserData,
		queryFn: async () => await (await fetch(url)).json(),
	})
}
