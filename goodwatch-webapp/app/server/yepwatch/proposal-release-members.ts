import { z } from "zod";
import {
  ContinuousMembers,
  type MemberIssuer,
} from "./continuous-members.server.ts";
import { RoomError } from "./errors.ts";
import { MEMBER_RESOURCE_PATH } from "./member-resource.server.ts";
import { paths } from "../../../packages/yepwatch-contracts/proposal.ts";
import {
  YEPWATCH_READ_SCOPE,
  yepwatchOAuthEnvironment,
} from "../auth/yepwatch-oauth-policy.ts";
import type { ContinuousRepository } from "./continuous-types.ts";
import type { Env } from "./proposal-release-config.ts";

const identity = z.object({
  userId: z.string().min(1).max(256),
  expiresAt: z.number().finite().positive(),
  displayName: z.string().max(1024).nullable().optional(),
});
const prefill = z
  .object({
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    serviceIds: z.array(z.number().int().positive()).max(100),
    savedProgressAvailable: z.boolean(),
  })
  .strict();
const nextEpisode = z.object({
  tmdbId: z.number().int().positive(),
  season: z.number().int().nonnegative(),
  number: z.number().int().nonnegative(),
  displaySeason: z.number().optional(),
  displayNumber: z.number().optional(),
  presentationVersion: z.string().optional(),
});
const progress = z.object({
  source: z.literal("goodwatch"),
  shows: z
    .array(
      z.object({
        showId: z.number().int().positive(),
        nextEpisode: nextEpisode.nullable(),
      })
    )
    .max(30),
  limitReached: z.boolean(),
});

export function releaseMemberConfig(env: Env, publicOrigin: string) {
  if (env.YEPWATCH_MEMBER_ENABLED !== "true") {
    if (env.YEPWATCH_MEMBER_ENABLED && env.YEPWATCH_MEMBER_ENABLED !== "false")
      throw new Error("Invalid member-enabled setting");
    return undefined;
  }
  const oauth = yepwatchOAuthEnvironment(env);
  if (!oauth)
    throw new Error(
      "Member mode requires the registered GoodWatch OAuth client/resource/callback"
    );
  const origin = new URL(env.YEPWATCH_MEMBER_ISSUER_ORIGIN ?? "");
  if (
    origin.origin !== env.YEPWATCH_MEMBER_ISSUER_ORIGIN ||
    origin.protocol !== "https:"
  )
    throw new Error("Member issuer must be an exact HTTPS origin");
  const callbackUrl = `${publicOrigin}${paths.memberCallback}`;
  if (!oauth.redirectUris.includes(callbackUrl))
    throw new Error("Register the exact YepWatch member callback");
  return { ...oauth, issuerOrigin: origin.origin, callbackUrl, publicOrigin };
}
export type ReleaseMemberConfig = NonNullable<
  ReturnType<typeof releaseMemberConfig>
>;

/** Remote adapter: GoodWatch verifies live grants and reads its own accounts. No issuer or account DB is bundled here. */
export function releaseMembers(
  repo: ContinuousRepository,
  config: ReleaseMemberConfig,
  transport: typeof fetch = fetch
) {
  async function resource(token: string, view: string, expectedUser?: string) {
    const url = new URL(MEMBER_RESOURCE_PATH, config.issuerOrigin);
    url.searchParams.set("view", view);
    let response: Response;
    try {
      response = await transport(url, {
        headers: { authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new RoomError(
        "busy",
        "GoodWatch is temporarily unavailable; your room is saved",
        503,
        true
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new RoomError("member_required", "Connect GoodWatch again", 403);
    if (!response.ok)
      throw new RoomError(
        "busy",
        "GoodWatch is temporarily unavailable; your room is saved",
        503,
        true
      );
    const result = identity
      .extend({ data: z.unknown().optional() })
      .parse(await response.json());
    if (
      result.expiresAt <= Date.now() ||
      (expectedUser && result.userId !== expectedUser)
    )
      throw new RoomError("unauthorized", "GoodWatch account changed", 401);
    return result;
  }
  const issuer: MemberIssuer = {
    authorize({ state, challenge, redirectUri }) {
      if (redirectUri !== config.callbackUrl)
        throw new Error("Unexpected member callback");
      const url = new URL("/api/auth/oauth2/authorize", config.issuerOrigin);
      url.search = new URLSearchParams({
        response_type: "code",
        prompt: "consent",
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: YEPWATCH_READ_SCOPE,
        resource: config.resource,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }).toString();
      return url.href;
    },
    async exchange({ code, verifier, redirectUri }) {
      if (redirectUri !== config.callbackUrl)
        throw new Error("Unexpected member callback");
      const response = await transport(
        new URL("/api/auth/oauth2/token", config.issuerOrigin),
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          redirect: "error",
          signal: AbortSignal.timeout(12000),
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: config.clientId,
            redirect_uri: redirectUri,
            resource: config.resource,
            code,
            code_verifier: verifier,
          }),
        }
      );
      if (!response.ok)
        throw new RoomError(
          "unauthorized",
          "GoodWatch connection did not complete. Try connecting again.",
          401
        );
      const value = z
        .object({
          access_token: z.string().min(1).max(16384),
          expires_in: z.number().positive().finite(),
          token_type: z.string().refine((t) => t.toLowerCase() === "bearer"),
        })
        .parse(await response.json());
      return {
        accessToken: value.access_token,
        expiresAt: Date.now() + value.expires_in * 1000,
      };
    },
    verify: (token) => resource(token, "identity"),
  };
  return new ContinuousMembers(
    repo,
    issuer,
    {
      async prefill(userId, token) {
        if (!token) throw new Error("Member grant required");
        return prefill.parse((await resource(token, "prefill", userId)).data);
      },
      async progress(userId, token) {
        if (!token) throw new Error("Member grant required");
        return progress.parse((await resource(token, "progress", userId)).data);
      },
    },
    {
      callbackUrl: config.callbackUrl,
      browserOrigins: [config.publicOrigin],
      nativeReturnUri: "yepwatch://auth/callback",
      nativeReturnUris: ["yepwatch-preview://auth/callback"],
    }
  );
}
