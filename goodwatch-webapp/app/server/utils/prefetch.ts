import type { QueryClient, QueryKey } from "@tanstack/react-query"
import { getUserIdFromRequest } from "~/utils/auth"

export interface PrefetchParams {
	queryClient: QueryClient
	request: Request
}

export interface PrefetchQueryProps<T> extends PrefetchParams {
	queryKey: QueryKey | ((params: { userId: string | undefined }) => QueryKey)
	getter: (params: { userId: string | undefined }) => T
}

export const prefetchQuery = async <T>({
	queryClient,
	queryKey,
	getter,
	request,
}: PrefetchQueryProps<T>) => {
	const userId = await getUserIdFromRequest({ request })
	const params = { userId }
	await queryClient.prefetchQuery({
		queryKey: typeof queryKey === "function" ? queryKey(params) : queryKey,
		queryFn: () => getter(params),
	})
}
