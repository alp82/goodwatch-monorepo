import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { handleAuth } from "../auth.server"

export const loader = ({ request }: LoaderFunctionArgs) => handleAuth(request)
export const action = ({ request }: ActionFunctionArgs) => handleAuth(request)
