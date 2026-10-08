import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { searchRoleAuthorized } from "~/server/search-role-auth.server";
import { getPaletteTitles } from "~/server/command-palette.server";

export async function loader({ request }: LoaderFunctionArgs) {
	if (!searchRoleAuthorized(request)) return new Response(null, { status: 404 });
	if (request.method !== "GET") return new Response(null, { status: 405 });
	const q = new URL(request.url).searchParams.get("q") ?? "";
	return json({ titles: await getPaletteTitles(q) }, {
		headers: { "Cache-Control": "private, no-store" },
	});
}

export const action = () => new Response(null, { status: 404 });
