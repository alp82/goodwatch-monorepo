import type { LoaderFunctionArgs } from "@remix-run/node"
import { imageResponse } from "~/server/talked-about-now/image.server"

export async function loader({ params }: LoaderFunctionArgs) {
	return imageResponse(params.postId)
}
