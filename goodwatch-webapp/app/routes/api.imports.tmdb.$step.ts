import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { tmdbConnect } from "~/server/imports/tmdb-connect-runtime.server"

export const action = ({ request, params }: ActionFunctionArgs) =>
	tmdbConnect.handle(request, params.step ?? "")
export const loader = ({ request, params }: LoaderFunctionArgs) =>
	tmdbConnect.handle(request, params.step ?? "")
