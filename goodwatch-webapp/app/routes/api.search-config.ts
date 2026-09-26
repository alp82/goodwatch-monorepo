import { json } from "@remix-run/node";
import { translationEnabled } from "~/server/search-runtime/runtime.server";
import { LANGUAGE_VERSION } from "~/server/combined-search/language.server";
export const loader = () =>
	json(
		{ version: `d4-corrected-v1:crate-redis-v1:${LANGUAGE_VERSION}:${translationEnabled()}:people-v1` },
		{ headers: { "Cache-Control": "no-store" } },
	);
