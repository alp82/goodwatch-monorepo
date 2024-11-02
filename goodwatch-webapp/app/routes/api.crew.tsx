import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type CrewParams,
	type CrewResults,
	getCrew,
} from "~/server/crew.server"

type LoaderData = Awaited<CrewResults>

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const text = url.searchParams.get("text") || ""
	const withCrew = url.searchParams.get("withCrew") || ""
	const withoutCrew = url.searchParams.get("withoutCrew") || ""

	const crew = await getCrew({
		text,
		withCrew,
		withoutCrew,
	})

	return json<LoaderData>(crew)
}

// Query hook

export const queryKeyCrew = ["crew"]

export const useCrew = ({ text, withCrew, withoutCrew }: CrewParams) => {
	const url = `/api/crew?text=${text}&withCrew=${withCrew}&withoutCrew=${withoutCrew}`
	return useQuery<CrewResults>({
		queryKey: [...queryKeyCrew, text, withCrew, withoutCrew],
		queryFn: async () => await (await fetch(url)).json(),
		placeholderData: (previousData) => previousData,
	})
}
