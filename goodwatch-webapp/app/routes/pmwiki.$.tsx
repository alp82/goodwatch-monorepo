import type { LoaderFunctionArgs } from "@remix-run/node"
import { redirect } from "@remix-run/node"

export const loader = async ({ params }: LoaderFunctionArgs) => {
	return redirect("/", { status: 301 })
}
