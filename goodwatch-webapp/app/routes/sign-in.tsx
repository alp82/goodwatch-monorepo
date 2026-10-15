import { getAuthPosters } from "~/server/auth-posters.server"
import type { AuthPoster } from "~/ui/auth/PosterSpotlight"
import { discoveryReturnTo } from "~/utils/account-transfer"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { hasBrowserCookie, isCrawler } from "~/server/crawlers.server";
