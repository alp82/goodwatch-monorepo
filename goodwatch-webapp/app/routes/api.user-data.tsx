import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import type { UserData } from "~/types/user-data"
import { getUserData } from "~/server/userData.server"
import { getAuthFromRequest, useUser } from "~/utils/auth"

export const queryKeyUserData = ["user-data"] as const

export const getQueryKeyUserData = (userId?: string) =>
	userId ? [...queryKeyUserData, userId] : queryKeyUserData

export const loader: LoaderFunction = async ({ request }) => {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	const userData = await getUserData({ user_id: user?.id })

	return json<UserData>(userData, { headers })
}

export const useUserData = () => {
	const { user, loading } = useUser()
	const url = "/api/user-data"
	return useQuery<UserData>({
		queryKey: getQueryKeyUserData(user?.id),
		queryFn: async () => await (await fetch(url)).json(),
		enabled: !loading && Boolean(user?.id),
	})
}
