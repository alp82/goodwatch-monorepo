import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node";
import { type Keyword, getKeywords } from "~/server/keywords.server";

type LoaderData = {
	keywords: Awaited<Keyword[]>;
};

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url);
	const keywordIds = (url.searchParams.get("keywordIds") || "").split(",");
	const keywords = await getKeywords({
		keywordIds,
	});

	return json<LoaderData>({
		keywords,
	});
};
