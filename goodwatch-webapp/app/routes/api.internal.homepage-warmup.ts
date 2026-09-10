import { createHash, timingSafeEqual } from "node:crypto";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import {
	HomepageWarmupFailure,
	warmAnonymousHomepage,
} from "~/server/homepage-warmup.server";

const headers = { "Cache-Control": "no-store" };

export function loader() {
	return json(
		{ status: "failed", reason: "method_not_allowed" },
		{ status: 405, headers },
	);
}

export async function action({ request }: ActionFunctionArgs) {
	const secret = process.env.HOMEPAGE_WARMUP_SECRET;
	if (!secret || secret.length < 32) {
		return json(
			{ status: "failed", reason: "not_configured" },
			{ status: 503, headers },
		);
	}
	const provided = request.headers.get("Authorization") || "";
	const digest = (value: string) => createHash("sha256").update(value).digest();
	if (!timingSafeEqual(digest(provided), digest(`Bearer ${secret}`))) {
		return json(
			{ status: "failed", reason: "unauthorized" },
			{ status: 401, headers },
		);
	}
	if (request.method !== "POST") {
		return json(
			{ status: "failed", reason: "method_not_allowed" },
			{ status: 405, headers },
		);
	}
	// This route has one fixed scope and accepts no body or query parameters.
	if (new URL(request.url).search || (await request.text()).length !== 0) {
		return json(
			{ status: "failed", reason: "unexpected_parameters" },
			{ status: 400, headers },
		);
	}
	try {
		return json(await warmAnonymousHomepage(), { headers });
	} catch (error) {
		const reason =
			error instanceof HomepageWarmupFailure ? error.reason : "warmup_failed";
		const status = error instanceof HomepageWarmupFailure ? error.status : 503;
		console.error("Anonymous homepage warmup failed", { reason });
		return json({ status: "failed", reason }, { status, headers });
	}
}
