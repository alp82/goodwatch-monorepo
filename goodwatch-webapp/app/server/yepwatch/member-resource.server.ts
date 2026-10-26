import type {
  MemberPrefill,
  MemberProgressResponse,
} from "../../../packages/yepwatch-contracts/continuous.ts";
import { fillWebFetchGaps } from "../web-fetch-gaps.server.ts";

export const MEMBER_RESOURCE_PATH = "/api/yepwatch/account";
export interface MemberResourceReads {
  verify(token: string): Promise<{ userId: string; expiresAt: number }>;
  displayName?(userId: string): Promise<string | null>;
  prefill(userId: string): Promise<MemberPrefill>;
  progress(userId: string): Promise<MemberProgressResponse>;
}
/** GoodWatch owns this endpoint. The live grant is checked on EVERY read; no caller-selected account. */
export function createMemberResource(reads: MemberResourceReads) {
  return async (request: Request) => {
    // remix-serve installs its Response after importing the build. This can be
    // the first auth-related request on this instance, before auth fills the gaps.
    fillWebFetchGaps();
    const headers = {
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    };
    if (request.method !== "GET")
      return Response.json(
        { error: "method_not_allowed" },
        { status: 405, headers }
      );
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "identity";
    if (
      !["identity", "prefill", "progress"].includes(view) ||
      [...url.searchParams.keys()].some((k) => k !== "view") ||
      url.searchParams.getAll("view").length > 1
    )
      return Response.json(
        { error: "invalid_request" },
        { status: 400, headers }
      );
    const match = /^Bearer ([^\s]{1,16384})$/.exec(
      request.headers.get("authorization") ?? ""
    );
    if (!match)
      return Response.json({ error: "unauthorized" }, { status: 401, headers });
    let identity: { userId: string; expiresAt: number };
    try {
      identity = await reads.verify(match[1]);
    } catch {
      return Response.json({ error: "unauthorized" }, { status: 401, headers });
    }
    try {
      const data =
        view === "prefill"
          ? await reads.prefill(identity.userId)
          : view === "progress"
          ? await reads.progress(identity.userId)
          : undefined;
      const displayName = view === "identity" && reads.displayName
        ? await reads.displayName(identity.userId) : undefined;
      return Response.json(
        { ...identity, ...(displayName === undefined ? {} : { displayName }), ...(data === undefined ? {} : { data }) },
        { headers }
      );
    } catch {
      return Response.json({ error: "busy" }, { status: 503, headers });
    }
  };
}
