// The old "Country & titles" tab: its country is now on Where you watch, its titles language on Show titles in.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { WHERE_YOU_WATCH_PATH, movedTo } from "~/ui/settings/paths"

export const loader = ({ request }: LoaderFunctionArgs) =>
	movedTo(request, WHERE_YOU_WATCH_PATH)
