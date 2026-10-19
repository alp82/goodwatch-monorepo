// The old "Streaming" tab: its services have their own page again.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { SERVICES_PATH, movedTo } from "~/ui/settings/paths"

export const loader = ({ request }: LoaderFunctionArgs) =>
	movedTo(request, SERVICES_PATH)
