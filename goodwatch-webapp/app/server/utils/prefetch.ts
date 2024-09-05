import type { QueryClient } from "@tanstack/react-query"
import { getUserIdFromRequest } from "~/utils/auth"

export interface PrefetchParams {
	queryClient: QueryClient
	request: Request
}

export interface PrefetchQueryProps<T> extends PrefetchParams {
	queryKey: string[]
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
		queryKey,
		queryFn: () => getter(params),
	})
}
