import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { type DNAParams, type DNAResults, getDNA } from "~/server/dna.server"

type LoaderData = Awaited<DNAResults>

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const text = url.searchParams.get("text") || ""

	const dna = await getDNA({
		text,
	})

	return json<LoaderData>(dna)
}

// Query hook

export const queryKeyDNA = ["dna"]

export const useDNA = ({ text }: DNAParams) => {
	const url = `/api/dna?text=${text}`
	return useQuery<DNAResults>({
		queryKey: [...queryKeyDNA, text],
		queryFn: async () => await (await fetch(url)).json(),
		placeholderData: (previousData) => previousData,
	})
}
