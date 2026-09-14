import { redirect, type LoaderFunctionArgs } from "@remix-run/node"

export const loader = ({ params }: LoaderFunctionArgs) =>
	redirect(params.type === "movies" ? "/movies" : "/shows", 301)
