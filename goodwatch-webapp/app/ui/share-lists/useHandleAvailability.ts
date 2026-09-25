// Whether a typed handle can be claimed: valid by the rules, and free on the server. The server check waits until
// the person pauses typing.
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

export function useHandleAvailability(input: string) {
	const handle = normalizeHandle(input)
	const problem = handle ? handleProblem(handle) : null
	const debounced = useDebounced(handle, CHECK_DELAY_MS)
	const check = useHandleCheck(
		!problem && handle && debounced === handle ? handle : null,
	)
	const checking =
		!problem &&
		!!handle &&
		(debounced !== handle || check.isFetching)
	const available =
		check.data?.handle === handle && check.data.available && !checking
	const unavailable =
		!checking && check.data?.handle === handle && !check.data.available
	return {
		handle,
		problem,
		checking,
		available,
		unavailable,
		checkFailed: check.isError,
		unavailableReason: check.data?.problem ?? "That handle is taken.",
	}
}
