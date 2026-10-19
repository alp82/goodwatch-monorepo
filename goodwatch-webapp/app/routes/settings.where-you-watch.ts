// The old Where you watch page: its country is now Watching from, and its services have a page of their own.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { COUNTRY_PATH, movedTo } from "~/ui/settings/paths"

export const loader = ({ request }: LoaderFunctionArgs) =>
	movedTo(request, COUNTRY_PATH)
