import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  releaseMembers,
  releaseMemberConfig,
} from "./proposal-release-members.ts";
import { createMemberResource } from "./member-resource.server.ts";
import {
  ProposalMemoryRepository,
  proposalFixtureCatalog,
} from "./proposal-test-support.ts";
import { ProposalService } from "./proposal-service.server.ts";
import { createProposalHandler } from "./proposal-http.server.ts";
import { pkce } from "./continuous-members.server.ts";

const origin = "https://yepwatch.example";
const config = releaseMemberConfig(
  {
    YEPWATCH_MEMBER_ENABLED: "true",
    YEPWATCH_MEMBER_ISSUER_ORIGIN: "https://goodwatch.example",
    AUTH_YEPWATCH_CLIENT_ID: "yepwatch",
    AUTH_YEPWATCH_RESOURCE: `${origin}/api/yepwatch`,
    AUTH_YEPWATCH_REDIRECT_URIS: `${origin}/api/yepwatch/v1/proposal/member/callback`,
  },
  origin
)!;

test("remote GoodWatch signup/login completion retains guest actor, votes and private canonical progress; preview callback is exact", async () => {
  const repo = new ProposalMemoryRepository();
  const service = new ProposalService(
    repo,
    proposalFixtureCatalog,
    "test-remote-members-secret-at-least32"
  );
  const guest = await service.create({
    contractVersion: 3,
    commandId: randomBytes(16).toString("hex"),
    admissionSecret: randomBytes(32).toString("base64url"),
    nickname: "Guest",
  });
  const id = guest.snapshot.shared.roomId,
    participantId = guest.credential.participantId;
  const before = (await repo.read(id))!.room;
  let linkedUser = "new-account";
  const resource = createMemberResource({
    async verify(token) {
      assert.equal(token, "fixture-grant");
      return { userId: linkedUser, expiresAt: Date.now() + 600000 };
    },
    async displayName(user) { assert.equal(user, linkedUser); return "Alex"; },
    async prefill(user) {
      assert.equal(user, linkedUser);
      return { country: null, serviceIds: [], savedProgressAvailable: true };
    },
    async progress(user) {
      assert.equal(user, linkedUser);
      return {
        source: "goodwatch",
        shows: [
          {
            showId: 1396,
            nextEpisode: { tmdbId: 62086, season: 1, number: 2 },
          },
        ],
        limitReached: false,
      };
    },
  });
  let exchanges = 0;
  const transport: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).origin, config.issuerOrigin);
    if (new URL(request.url).pathname === "/api/auth/oauth2/token") {
      exchanges++;
      const form = new URLSearchParams(await request.text());
      assert.equal(form.get("client_id"), config.clientId);
      assert.equal(form.get("redirect_uri"), config.callbackUrl);
      return Response.json({
        access_token: "fixture-grant",
        expires_in: 600,
        token_type: "Bearer",
      });
    }
    return resource(request);
  };
  const members = releaseMembers(repo, config, transport);
  const start = await members.start(id, participantId, {
    roomId: id,
    client: "browser",
    returnTo: `${origin}/room/${id}`,
  });
  const authorize = new URL(start.authorizeUrl);
  assert.equal(authorize.pathname, "/api/auth/oauth2/authorize");
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  const linked = await members.callback(
    start.state,
    "fixture-code",
    participantId
  );
  assert.equal(linked.returnTo, `${origin}/room/${id}`);
  const after = (await repo.read(id))!.room;
  assert.equal(after.hostId, before.hostId);
  assert.equal(after.participants[0].nickname, "Alex", "Successful GoodWatch sign-in must replace the placeholder Guest name");
  assert.equal(after.participants.length, before.participants.length);
  assert.deepEqual(after.participants[0].votes, before.participants[0].votes);
  assert.deepEqual(
    (await members.status(id, participantId)).prefill?.serviceIds,
    []
  );
  assert.equal(
    (await members.ownProgress(id, participantId)).shows[0].nextEpisode?.number,
    2
  );
  const snapshot = await service.read(id, {
    participantId,
    token: guest.credential.token,
  });
  assert.equal(
    JSON.stringify(snapshot.shared).includes("fixture-grant"),
    false
  );
  assert.equal(JSON.stringify(snapshot.shared).includes("new-account"), false);
  // A room linked by the previous release repairs itself on its ordinary authenticated read.
  const old = (await repo.read(id))!;
  const legacy = structuredClone(old.room); legacy.participants[0].nickname = "Guest";
  assert.equal(await repo.compareAndSwap(old, legacy, false), true);
  const handler = createProposalHandler(service, {allowedOrigins:[origin],serviceSecret:"test-service-secret-at-least-thirty-two",members});
  const restored = await handler(new Request(`${origin}/api/yepwatch/v1/proposal/rooms/${id}`, {headers:{authorization:`Bearer ${guest.credential.token}`,"x-yepwatch-participant":participantId}}));
  assert.equal(restored.status, 200);
  const restoredSnapshot = await restored.json();
  assert.equal(restoredSnapshot.shared.participants[0].nickname, "Alex");
  assert.equal(restoredSnapshot.own.member.state, "linked");
  const named = (await repo.read(id))!; const custom = structuredClone(named.room); custom.participants[0].nickname = "Movie pal";
  assert.equal(await repo.compareAndSwap(named, custom, false), true);
  await members.status(id, participantId);
  assert.equal((await repo.read(id))!.room.participants[0].nickname, "Movie pal", "Keep a deliberately chosen room nickname");
  const verifier = randomBytes(32).toString("base64url");
  const native = await members.start(id, participantId, {
    roomId: id,
    client: "native",
    returnTo: "yepwatch-preview://auth/callback",
    codeChallenge: pkce(verifier),
  });
  assert.equal(
    new URL(await members.nativeReturn(native.state, "fixture-code")).protocol,
    "yepwatch-preview:"
  );
  await members.exchange(id, participantId, {
    roomId: id,
    state: native.state,
    code: "fixture-code",
    codeVerifier: verifier,
  });
  assert.equal(exchanges, 2);
  linkedUser = "different-account";
  assert.equal((await members.status(id, participantId)).state, "unavailable");
});

test("disabled member config stays guest and incomplete enabled configuration fails before serving", () => {
  assert.equal(releaseMemberConfig({}, origin), undefined);
  assert.throws(
    () => releaseMemberConfig({ YEPWATCH_MEMBER_ENABLED: "true" }, origin),
    /registered/
  );
});
