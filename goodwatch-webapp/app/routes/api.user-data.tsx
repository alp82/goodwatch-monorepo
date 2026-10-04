import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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

import { guestUserData, useGuestInteractions } from "~/utils/guest-progress"
import { useMemo } from "react"

const useUserDataInBrowser = () => {
	const interactions = useGuestInteractions()
	const guestData = useMemo(() => guestUserData(interactions), [interactions])
	const { user, loading } = useUser()
	const url = "/api/user-data"
	const query = useQuery<UserData>({
		queryKey: getQueryKeyUserData(user?.id),
		queryFn: async () => await (await fetch(url)).json(),
		enabled: !loading && Boolean(user?.id),
	})
	return user ? query : { ...query, data: guestData, isLoading: false }
}

// The server render never subscribes or fetches, so it reads the member's data straight from the cache that the root
// loader filled. Every title card asks for this data twice, and a query observer per call cost a movie page with 200
// cards 11 ms of render time (docs/benchmarks/viral-spike-render-profile.md).
const SERVER_GUEST_DATA = guestUserData([])
const useUserDataOnServer = () => {
	const { user, loading } = useUser()
	const queryClient = useQueryClient()
	const data = user
		? queryClient.getQueryData<UserData>(getQueryKeyUserData(user.id))
		: SERVER_GUEST_DATA
	return { data, isLoading: !loading && Boolean(user) && data === undefined }
}

/** The viewer's ratings, wishlist and other title marks: a member's from the server, a guest's from this browser. */
export const useUserData =
	typeof document === "undefined" ? useUserDataOnServer : useUserDataInBrowser
