import { useRevalidator } from "@remix-run/react"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { queryKeyOnboardingMedia } from "~/routes/api.onboarding.media"
import { queryKeyUserData } from "~/routes/api.user-data"

const loadingProps = {
	pointerEvents: "none",
	opacity: 0.7,
}

interface UseSubmitProps<Params> {
	url: `/api/${string}`
	params: Params
	onClick?: () => void
}

export const useAPIAction = <Params extends {}, Result extends {}>({
	url,
	params,
	onClick,
}: UseSubmitProps<Params>) => {
	const queryClient = useQueryClient()
	const isLoading = useIsFetching({ queryKey: queryKeyUserData })

	const [result, setResult] = useState<Result | null>(null)
	const handleSubmit = async () => {
		if (onClick) {
			onClick()
		}
		setResult(null)
		const response = await fetch(url, {
			method: "POST",
			body: JSON.stringify(params),
		})
		const result: Result = await response.json()
		setResult(result)

		// invalidate queries
		queryClient.invalidateQueries({
			queryKey: queryKeyUserData,
		})
		queryClient.invalidateQueries({
			queryKey: queryKeyOnboardingMedia,
		})
	}

	const submitProps = {
		onClick: handleSubmit,
		disabled: isLoading || null,
		style: isLoading ? loadingProps : {},
	}

	return {
		result,
		isLoading,
		submitProps,
	}
}
