import { useRevalidator } from "@remix-run/react"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { queryKeyOnboardingMedia } from "~/routes/api.onboarding.media"
import { queryKeyUserData } from "~/routes/api.user-data"

const loadingProps = {
	pointerEvents: "none",
	opacity: 0.7,
}

interface Endpoint<Params> {
	url: `/api/${string}`
	params: Params
}

interface UseSubmitProps<Params> {
	endpoints: Endpoint<Params>[]
	onClick?: () => void
}

export const useAPIAction = <Params extends {}, Result extends {}>({
	endpoints,
	onClick,
}: UseSubmitProps<Params>) => {
	const queryClient = useQueryClient()
	const isLoading = useIsFetching({ queryKey: queryKeyUserData })

	const [results, setResults] = useState<Result[] | null>(null)
	const handleSubmit = async () => {
		if (onClick) {
			onClick()
		}
		setResults(null)

		const promises = endpoints.map(({ url, params }) =>
			fetch(url, {
				method: "POST",
				body: JSON.stringify(params),
			}),
		)
		const responses = await Promise.all(promises)
		const results = await Promise.all(
			responses.map((response) => response.json()),
		)
		setResults(results)

		// invalidate queries
		await queryClient.invalidateQueries({
			queryKey: queryKeyUserData,
		})
		await queryClient.invalidateQueries({
			queryKey: queryKeyOnboardingMedia,
		})
		await queryClient.refetchQueries({
			queryKey: queryKeyUserData,
			type: "active",
		})
		await queryClient.refetchQueries({
			queryKey: queryKeyOnboardingMedia,
			type: "active",
		})
	}

	const submitProps = {
		onClick: handleSubmit,
		disabled: isLoading || null,
		style: isLoading ? loadingProps : {},
	}

	return {
		results,
		isLoading,
		submitProps,
	}
}
