import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { createMemberResource } from "../server/yepwatch/member-resource.server";
import {
  goodwatchMemberPrefill,
  goodwatchSavedProgress,
} from "../server/yepwatch/continuous-member-reads.server";
import { verifyOAuthResourceToken } from "../server/auth/oauth-access.server";
import {
  yepwatchOAuthEnvironment,
  YEPWATCH_READ_SCOPE,
} from "../server/auth/yepwatch-oauth-policy";

export async function loader({ request }: LoaderFunctionArgs) {
  const config = yepwatchOAuthEnvironment(process.env);
  if (!config)
    return Response.json(
      { error: "not_configured" },
      { status: 503, headers: { "cache-control": "private, no-store" } }
    );
  return createMemberResource({
    async verify(token) {
      const grant = await verifyOAuthResourceToken(token, {
        resource: config.resource,
        clientId: config.clientId,
        requiredScopes: [YEPWATCH_READ_SCOPE],
      });
      return { userId: grant.extra.userId, expiresAt: grant.expiresAt * 1000 };
    },
    prefill: goodwatchMemberPrefill,
    progress: goodwatchSavedProgress,
  })(request);
}
export function action(_: ActionFunctionArgs) {
  return Response.json(
    { error: "method_not_allowed" },
    { status: 405, headers: { "cache-control": "private, no-store" } }
  );
}
