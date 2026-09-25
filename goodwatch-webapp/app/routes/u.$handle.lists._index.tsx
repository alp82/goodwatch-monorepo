// /u/:handle/lists has no page of its own: a person's lists are on their profile.
import { type LoaderFunctionArgs, redirect } from "@remix-run/node"
import { profilePath } from "~/ui/share-card/links"
import { normalizeHandle } from "~/utils/handles"

export const loader = ({ params }: LoaderFunctionArgs) =>
	redirect(profilePath(normalizeHandle(params.handle)), 301)
