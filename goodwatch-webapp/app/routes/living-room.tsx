// The living room moved to `/` (#234); keep old links and TV params working.
import { type LoaderFunctionArgs, redirect } from "@remix-run/node"

export const loader = ({ request }: LoaderFunctionArgs) =>
	redirect(`/${new URL(request.url).search}`, 301)
