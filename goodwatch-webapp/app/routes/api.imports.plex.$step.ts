import { analyticsAction } from "~/telemetry/product-analytics.server"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { plexConnect } from "~/server/imports/plex-connect-runtime.server"
export const action = analyticsAction(
	({ request, params }: ActionFunctionArgs) =>
	plexConnect.handle(request, params.step ?? ""),
)
export const loader = ({ request, params }: LoaderFunctionArgs) =>
	plexConnect.handle(request, params.step ?? "")
