import { type LoaderFunction, json } from "@remix-run/node";
import { type GenresResults, getGenresTV } from "~/server/genres.server";

type LoaderData = {
	genres: Awaited<GenresResults>;
};

export const loader: LoaderFunction = async () => {
	const genres = await getGenresTV({
		type: "default",
	});

	return json<LoaderData>({
		genres,
	});
};
