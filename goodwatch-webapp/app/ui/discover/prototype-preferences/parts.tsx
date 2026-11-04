// PROTOTYPE - throwaway (discover search preferences, see README.md). URL helpers shared by the prototype's parts.
import { useNavigate, useSearchParams } from "@remix-run/react"

export function useGo() {
	const navigate = useNavigate()
	return (next: URLSearchParams, replace = false) =>
		navigate({ search: `?${next}` }, { replace, preventScrollReset: true })
}
export function useParams() {
	return useSearchParams()[0]
}
