import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { plexConnect } from "~/server/imports/plex-connect-runtime.server"
export const action = ({ request, params }: ActionFunctionArgs) =>
	plexConnect.handle(request, params.step ?? "")
export const loader = ({ request, params }: LoaderFunctionArgs) =>
	plexConnect.handle(request, params.step ?? "")
