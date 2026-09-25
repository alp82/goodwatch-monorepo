// Whether a typed handle can be claimed: valid by the rules, and free on the server. The server check waits until
// the person pauses typing, and skips the handle they already have.
import { useEffect, useState } from "react"
import { useHandleCheck } from "~/routes/api.handle"
import { handleProblem, normalizeHandle } from "~/utils/handles"

const CHECK_DELAY_MS = 300

function useDebounced<T>(value: T, delay: number) {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const id = window.setTimeout(() => setDebounced(value), delay)
		return () => window.clearTimeout(id)
	}, [value, delay])
	return debounced
}

export function useHandleAvailability(
	input: string,
	current: string | null = null,
) {
	const handle = normalizeHandle(input)
	const problem = handle ? handleProblem(handle) : null
	const isCurrent = !!current && handle === current
	const debounced = useDebounced(handle, CHECK_DELAY_MS)
	const check = useHandleCheck(
		!problem && handle && !isCurrent && debounced === handle ? handle : null,
	)
	const checking =
		!problem &&
		!!handle &&
		!isCurrent &&
		(debounced !== handle || check.isFetching)
	const available =
		isCurrent ||
		(check.data?.handle === handle && check.data.available && !checking)
	const unavailable =
		!checking && check.data?.handle === handle && !check.data.available
	return {
		handle,
		problem,
		isCurrent,
		checking,
		available,
		unavailable,
		checkFailed: check.isError,
		unavailableReason: check.data?.problem ?? "That handle is taken.",
	}
}
