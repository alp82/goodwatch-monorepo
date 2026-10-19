// The old Hidden titles sheet: the titles you marked Not interested are a My library page now.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { HIDDEN_PATH, movedTo } from "~/ui/settings/paths"

export const loader = ({ request }: LoaderFunctionArgs) =>
	movedTo(request, HIDDEN_PATH)
