import { analyticsAction } from "~/telemetry/product-analytics.server"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { handleAuthRequest } from "../server/auth/boot.server.ts"

export const loader = analyticsAction(({ request }: LoaderFunctionArgs) =>
	handleAuthRequest(request),
)
export const action = analyticsAction(({ request }: ActionFunctionArgs) =>
	handleAuthRequest(request),
)
