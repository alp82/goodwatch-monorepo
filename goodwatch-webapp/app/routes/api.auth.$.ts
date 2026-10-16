import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { handleAuthRequest } from "../server/auth/boot.server.ts"

export const loader = ({ request }: LoaderFunctionArgs) =>
	handleAuthRequest(request)
export const action = ({ request }: ActionFunctionArgs) =>
	handleAuthRequest(request)
