// The old Hidden titles page: the titles you marked Not interested live in Settings now (/settings/not-interested).
import type { LoaderFunctionArgs } from "@remix-run/node"
import { NOT_INTERESTED_PATH, movedTo } from "~/ui/settings/paths"

export const loader = ({ request }: LoaderFunctionArgs) =>
	movedTo(request, NOT_INTERESTED_PATH)
