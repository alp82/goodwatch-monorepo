import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type CastParams,
	type CastResults,
	getCast,
} from "~/server/cast.server"

type LoaderData = Awaited<CastResults>

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const text = url.searchParams.get("text") || ""
	const withCast = url.searchParams.get("withCast") || ""
	const withoutCast = url.searchParams.get("withoutCast") || ""

	const cast = await getCast({
		text,
		withCast,
		withoutCast,
	})

	return json<LoaderData>(cast)
}

// Query hook

export const queryKeyCast = ["cast"]

export const useCast = ({ text, withCast, withoutCast }: CastParams) => {
	const url = `/api/cast?text=${text}&withCast=${withCast}&withoutCast=${withoutCast}`
	return useQuery<CastResults>({
		queryKey: [...queryKeyCast, text, withCast, withoutCast],
		queryFn: async () => await (await fetch(url)).json(),
		placeholderData: (previousData) => previousData,
	})
}
