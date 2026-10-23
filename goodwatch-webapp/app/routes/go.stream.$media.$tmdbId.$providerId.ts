import type { LoaderFunctionArgs } from "@remix-run/node"
import { streamClientKey, streamRedirect } from "../server/discord/stream-redirect.server.ts"

// The short link behind a Discord service button whose own link is too long for Discord.
export const loader = async ({ params, request }: LoaderFunctionArgs) =>
	streamRedirect(params, new URL(request.url), {}, await streamClientKey(request))
