// The old "Streaming" tab: its country and services are now on Where you watch.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { WHERE_YOU_WATCH_PATH, movedTo } from "~/ui/settings/paths"

export const loader = ({ request }: LoaderFunctionArgs) =>
	movedTo(request, WHERE_YOU_WATCH_PATH)
