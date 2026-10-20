import { useCallback, useEffect, useRef } from "react"
import { useUser } from "~/utils/auth"
import { captureProductEvent } from "./product-analytics"
import type { EventProperties, ProductEvent } from "./product-events"

/** A single place for event context. Identity is resolved by TelemetryBoot for imperative calls too. */
export function useProductAnalytics(context: EventProperties = {}) {
	const { user } = useUser()
	const latest = useRef(context)
	latest.current = context
	return useCallback(
		(event: ProductEvent, properties: EventProperties = {}) =>
			captureProductEvent(
				event,
				{ ...latest.current, ...properties },
				user?.id ?? null,
			),
		[user?.id],
	)
}
/** Emit once per meaningful result key, including SSR data, without counting render/prefetch as a view. */
export function useProductExposure(
	event: ProductEvent,
	key: string | null,
	properties: EventProperties,
) {
	const capture = useProductAnalytics()
	const previous = useRef<string | null>(null)
	useEffect(() => {
		if (key === null || key === previous.current) return
		previous.current = key
		capture(event, properties)
	}, [event, key, capture])
}
