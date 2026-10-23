import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { mdblistImport } from "~/server/imports/mdblist-runtime.server"
import { analyticsAction } from "~/telemetry/product-analytics.server"

export const action = analyticsAction(({ request }: ActionFunctionArgs) =>
	mdblistImport.handle(request),
)
export const loader = ({ request }: LoaderFunctionArgs) =>
	mdblistImport.handle(request)
