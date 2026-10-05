import type { ActionFunctionArgs } from "@remix-run/node"
import { sentryTunnel } from "~/server/sentry-tunnel.server"

// The Sentry tunnel. The limits and the answers are in the server module.
export const action = ({ request }: ActionFunctionArgs) => sentryTunnel(request)

// Without a loader, Remix answers a GET itself, and that answer has no Cache-Control.
export const loader = ({ request }: ActionFunctionArgs) => sentryTunnel(request)
