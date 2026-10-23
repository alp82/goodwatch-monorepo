import { ensureYepWatchClient } from "./yepwatch-client.server.ts";
import { releaseMembers } from "../yepwatch/proposal-release-members.ts";
import { createMemberResource } from "../yepwatch/member-resource.server.ts";
import {
  ProposalMemoryRepository,
  proposalFixtureCatalog,
} from "../yepwatch/proposal-test-support.ts";
import { ProposalService } from "../yepwatch/proposal-service.server.ts";
/** Explicit disposable actual issuer test; no production account/config operations. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import Redis from "ioredis";
import type { Cluster } from "ioredis";
import { createGoodwatchAuth, setCookiesOf } from "./auth.server.ts";
import { AuthMailQueue } from "./mail.server.ts";
import {
  localCrateTransport,
  migrateAuthTables,
} from "./crate-adapter.server.ts";
import { ValkeyAuthStorage } from "./secondary-storage.server.ts";
import { loadMcpConsent } from "./mcp-flow.server.ts";
import { pkce } from "../yepwatch/continuous-members.server.ts";
import { verifyOAuthResourceToken } from "./oauth-access.server.ts";
const crateOrigin = process.env.YEPWATCH_TEST_AUTH_CRATE_ORIGIN;
if (
  process.env.YEPWATCH_TEST_AUTH_DISPOSABLE !== "1" ||
  !crateOrigin ||
  new URL(crateOrigin).protocol !== "http:" ||
  new URL(crateOrigin).hostname !== "127.0.0.1" ||
  !process.env.YEPWATCH_TEST_AUTH_REDIS_URL ||
  new URL(process.env.YEPWATCH_TEST_AUTH_REDIS_URL).protocol !== "redis:" ||
  new URL(process.env.YEPWATCH_TEST_AUTH_REDIS_URL).hostname !== "127.0.0.1"
)
  throw new Error("Explicit disposable loopback OAuth endpoints required");
const sql = localCrateTransport([crateOrigin]);
await migrateAuthTables(sql);
const redis = new Redis(process.env.YEPWATCH_TEST_AUTH_REDIS_URL);
const messages: { text?: unknown }[] = [];
const mail = new AuthMailQueue({
  async sendMail(message) {
    messages.push(message);
    return {};
  },
});
const origin = "http://127.0.0.1:15984";
const resource = "https://yepwatch.example/api/yepwatch";
const callback =
  "https://yepwatch.example/api/yepwatch/v1/proposal/member/callback";
const policy = {
  resource,
  clientId: "will-be-provisioned-locally",
  redirectUris: [callback],
};
const auth = createGoodwatchAuth({
  sql,
  storage: new ValkeyAuthStorage(() => redis as unknown as Cluster),
  mail,
  baseURL: origin,
  secret: "disposable-yepwatch-central-issuer-secret-20261022",
  google: { clientId: "local-unused", clientSecret: "local-unused" },
  mcp: { resource: `${origin}/mcp` },
  yepwatch: policy,
  rateLimit: { enabled: false },
});
const post = (path: string, body: unknown, cookie = "") =>
  auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.1",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
try {
  const email = `yepwatch-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = "Local-YepWatch-example-only-20261022!";
  const signup = await post("/sign-up/email", {
    email,
    password,
    name: "Disposable member",
  });
  assert.equal(signup.status, 200);
  await mail.drain();
  const text = messages.map((m) => String(m.text)).join("\n");
  const link = text.match(/http:\/\/127\.0\.0\.1:15984\/api\/auth\/\S+/)?.[0];
  assert.ok(link, "Verification mail captured locally");
  const verified = await auth.handler(new Request(link));
  assert.ok([200, 302].includes(verified.status));
  const login = await post("/sign-in/email", { email, password });
  assert.equal(login.status, 200);
  const cookie = setCookiesOf(login.headers)
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  console.log(
    "Actual issuer fixture signup/verification/login completed; checking session"
  );
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  assert.ok(session, "Actual login session missing");
  console.log(
    "Actual session verified; creating dedicated local public client"
  );
  policy.clientId = `yepwatch-local-${randomBytes(10).toString('hex')}`;
  assert.equal((await ensureYepWatchClient(auth, policy)).ready, false);
  assert.equal((await ensureYepWatchClient(auth, policy, true)).ready, true);
  assert.equal((await ensureYepWatchClient(auth, policy, true)).ready, true);
  assert.equal((await ensureYepWatchClient(auth, policy)).ready, true);

  const resourceHandler = createMemberResource({
    async verify(token) {
      const result = await verifyOAuthResourceToken(
        token,
        {
          resource,
          clientId: policy.clientId,
          requiredScopes: ["yepwatch:read"],
        },
        auth
      );
      return {
        userId: result.extra.userId,
        expiresAt: result.expiresAt * 1000,
      };
    },
    async prefill() {
      return { country: null, serviceIds: [], savedProgressAvailable: true };
    },
    async progress() {
      return { source: "goodwatch", shows: [], limitReached: false };
    },
  });
  const repo = new ProposalMemoryRepository();
  const service = new ProposalService(
    repo,
    proposalFixtureCatalog,
    "signup-smoke-room-secret-at-least32"
  );
  const guest = await service.create({
    contractVersion: 3,
    commandId: randomBytes(16).toString("hex"),
    admissionSecret: randomBytes(32).toString("base64url"),
    nickname: "Guest",
  });
  const roomId = guest.snapshot.shared.roomId;
  const members = releaseMembers(
    repo,
    {
      ...policy,
      issuerOrigin: origin,
      callbackUrl: callback,
      publicOrigin: "https://yepwatch.example",
    },
    async (input, init) => {
      const req = new Request(input, init);
      return new URL(req.url).pathname === "/api/yepwatch/account"
        ? resourceHandler(req)
        : auth.handler(req);
    }
  );
  for (const client of ["browser", "native"] as const) {
    const verifier = randomBytes(32).toString("base64url");
    const returnTo =
      client === "browser"
        ? `https://yepwatch.example/room/${roomId}`
        : "yepwatch-preview://auth/callback";
    const started = await members.start(
      roomId,
      guest.credential.participantId,
      {
        roomId,
        client,
        returnTo,
        ...(client === "native" ? { codeChallenge: pkce(verifier) } : {}),
      }
    );
    const authorization = await auth.handler(
      new Request(started.authorizeUrl, { headers: { cookie, origin } })
    );
    assert.equal(authorization.status, 302);
    const consentUrl = new URL(authorization.headers.get("location")!, origin);
    assert.equal(consentUrl.pathname, "/auth/mcp/consent");
    const ordinary = await loadMcpConsent(new Request(consentUrl, { headers: { cookie } }), auth);
    assert.ok(!(ordinary instanceof Response), "Unconfigured apps still need the permission page");
    const signedOut = await loadMcpConsent(new Request(consentUrl), auth, policy);
    assert.ok(signedOut instanceof Response);
    assert.equal(signedOut.status, 302);
    assert.ok(signedOut.headers.get("location")?.startsWith("/sign-in?"));
    const tampered = new URL(consentUrl);
    tampered.searchParams.set("redirect_uri", "https://wrong.example/callback");
    const rejected = await loadMcpConsent(new Request(tampered, { headers: { cookie } }), auth, policy);
    assert.ok(rejected instanceof Response);
    assert.equal(rejected.status, 400);
    // First-party continuation still issues the durable grant required by the account resource.
    const consent = await loadMcpConsent(new Request(consentUrl, { headers: { cookie } }), auth, policy);
    assert.ok(consent instanceof Response);
    assert.equal(consent.status, 302);
    const dest = new URL(consent.headers.get("location")!, origin);
    assert.equal(dest.searchParams.get("state"), started.state);
    const code = dest.searchParams.get("code")!;
    assert.ok(code);
    if (client === "browser")
      assert.equal(
        (
          await members.callback(
            started.state,
            code,
            guest.credential.participantId
          )
        ).returnTo,
        returnTo
      );
    else {
      assert.equal(
        new URL(await members.nativeReturn(started.state, code)).protocol,
        "yepwatch-preview:"
      );
      await members.exchange(roomId, guest.credential.participantId, {
        roomId,
        state: started.state,
        code,
        codeVerifier: verifier,
      });
    }
    assert.equal(
      (await members.status(roomId, guest.credential.participantId)).state,
      "linked"
    );
    assert.deepEqual(
      (await members.ownProgress(roomId, guest.credential.participantId)).shows,
      []
    );
    const recovered = await service.read(roomId, {
      participantId: guest.credential.participantId,
      token: guest.credential.token,
    });
    assert.equal(recovered.shared.hostParticipantId, guest.credential.participantId);
    assert.equal(recovered.shared.hostParticipantId, guest.snapshot.shared.hostParticipantId);
    assert.equal(recovered.shared.participants.length, 1);
  }
  console.log(
    "PASS actual local GoodWatch signup, captured email verification, first-party direct continuation, remote resource and browser/native-protocol return to the same proposal guest. Preferences/progress empty fixtures; no production operations."
  );
} finally {
  await mail.drain();
  redis.disconnect();
}
