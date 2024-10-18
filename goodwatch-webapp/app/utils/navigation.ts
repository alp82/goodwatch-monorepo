import { useLocation, useNavigate } from "@remix-run/react"

export type UseNavProps<T> = {}

export const useNav = <T extends {}>({}: UseNavProps<T> = {}) => {
	const location = useLocation()
	const navigate = useNavigate()

	const updateQueryParams = (paramsToUpdate: Partial<T>) => {
		const newParams = new URLSearchParams(location.search)

		for (const [key, value] of Object.entries(paramsToUpdate)) {
			if (value !== undefined && value !== null && value !== "") {
				newParams.set(key, String(value))
			} else {
				newParams.delete(key)
			}
		}

		navigate(`${location.pathname}?${newParams.toString()}`)
	}

	return { updateQueryParams }
}
