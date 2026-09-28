import { useRouteLoaderData } from "@remix-run/react"
import {
	type EnabledFeatures,
	type Feature,
	NO_FEATURES,
} from "~/utils/features"

// Whether the viewer sees a feature, as the root loader resolved it with
// features.server.ts. Off while the root data is missing (error pages).
export function useFeature(feature: Feature): boolean {
	return useFeatures()[feature]
}

export function useFeatures(): EnabledFeatures {
	const data = useRouteLoaderData("root") as
		| { features?: EnabledFeatures }
		| undefined
	return data?.features ?? NO_FEATURES
}
