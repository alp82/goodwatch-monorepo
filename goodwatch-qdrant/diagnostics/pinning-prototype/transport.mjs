// ../goodwatch-search-continue-100/goodwatch-webapp/app/utils/backend-timeout.ts
var BackendTimeoutError = class extends Error {
  constructor(service, timeoutMs, message = `${service} did not respond within ${timeoutMs} ms`) {
    super(message);
    this.name = "BackendTimeoutError";
    this.service = service;
    this.timeoutMs = timeoutMs;
  }
};

// ../goodwatch-search-continue-100/goodwatch-webapp/app/server/search-ranking/qdrant-http.server.ts
import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
var DEFAULT_TIMEOUT_MS = 8e3;
var connection;
function getConnection() {
  if (!connection) {
    const base = new URL(process.env.QDRANT_URL || "http://localhost:6333");
    if (base.port === "6334")
      base.port = "6333";
    const secure = base.protocol === "https:";
    const transport = secure ? https : http;
    const headers = {
      "Content-Type": "application/json"
    };
    if (process.env.QDRANT_API_KEY)
      headers["api-key"] = process.env.QDRANT_API_KEY;
    connection = {
      base,
      headers,
      transport,
      agent: new transport.Agent({
        keepAlive: true,
        keepAliveMsecs: 1e3,
        maxSockets: 16,
        noDelay: true
      })
    };
  }
  return connection;
}
function post(path, body, timeoutMs, phases, started = performance.now()) {
  const { base, headers, transport, agent } = getConnection();
  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: base.protocol,
        hostname: base.hostname,
        port: base.port,
        path: `${base.pathname.replace(/\/$/, "")}${path}`,
        method: "POST",
        agent,
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) }
      },
      (response) => {
        if (phases)
          phases.headersMs = performance.now() - started;
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          if (phases)
            phases.responseEndMs = performance.now() - started;
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks)
          });
        });
        response.on("error", reject);
      }
    );
    if (phases)
      request.on("socket", (socket) => {
        phases.socketMs = performance.now() - started;
        phases.reusedSocket = request.reusedSocket;
        if (!request.reusedSocket && socket.connecting) {
          socket.once("lookup", () => {
            phases.dnsMs = performance.now() - started;
          });
          socket.once("connect", () => {
            phases.connectMs = performance.now() - started;
          });
          socket.once("secureConnect", () => {
            phases.secureConnectMs = performance.now() - started;
          });
        }
      });
    request.setTimeout(
      timeoutMs,
      () => request.destroy(
        new BackendTimeoutError(
          "Qdrant",
          timeoutMs,
          `Qdrant request timed out after ${timeoutMs} ms`
        )
      )
    );
    request.on("error", reject);
    request.end(body);
  });
}
async function queryBatch(collection, queries, options = {}) {
  const started = performance.now();
  const phases = {
    socketMs: null,
    dnsMs: null,
    connectMs: null,
    secureConnectMs: null,
    headersMs: null,
    responseEndMs: null,
    reusedSocket: false
  };
  let status = "failed";
  let reason = "transport";
  let httpStatus = null;
  let parseMs = null;
  let serverMs = null;
  let responseBytes = 0;
  const id = randomUUID();
  try {
    const response = await post(
      `/collections/${encodeURIComponent(collection)}/points/query/batch`,
      JSON.stringify({ searches: queries }),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      phases,
      started
    );
    httpStatus = response.status;
    responseBytes = response.body.length;
    if (httpStatus !== 200) {
      reason = "http_status";
      throw new Error(
        `Qdrant query batch on ${collection} failed with HTTP ${httpStatus}: ${response.body.toString("utf8", 0, 500)}`
      );
    }
    reason = "invalid_response";
    const parseStarted = performance.now();
    const parsed = JSON.parse(response.body.toString("utf8"));
    const results = parsed.result.map((r) => r.points);
    parseMs = performance.now() - parseStarted;
    serverMs = Number.isFinite(parsed.time) && parsed.time >= 0 ? parsed.time * 1e3 : null;
    status = "completed";
    reason = "none";
    return {
      results,
      serverMs: parsed.time * 1e3,
      wallMs: performance.now() - started,
      responseBytes
    };
  } catch (error) {
    if (error instanceof BackendTimeoutError)
      reason = "timeout";
    throw error;
  } finally {
    try {
      console.info(
        JSON.stringify({
          event: "search.qdrant-http.v1",
          at: (/* @__PURE__ */ new Date()).toISOString(),
          id,
          role: process.env.WEBAPP_ROLE === "search" ? "search" : "page",
          commit: /^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT ?? "") ? process.env.SOURCE_COMMIT : null,
          kind: "query_batch",
          status,
          reason,
          httpStatus,
          queryCount: queries.length,
          ...phases,
          parseMs,
          serverMs,
          responseBytes,
          totalMs: performance.now() - started
        })
      );
    } catch {
    }
  }
}
async function postJson(path, body, timeoutMs) {
  const { status, body: raw } = await post(
    path,
    JSON.stringify(body),
    timeoutMs
  );
  if (status !== 200) {
    throw new Error(
      `Qdrant request ${path} failed with HTTP ${status}: ${raw.toString("utf8", 0, 500)}`
    );
  }
  return JSON.parse(raw.toString("utf8")).result;
}
function retrievePoints(collection, request, options = {}) {
  return postJson(
    `/collections/${encodeURIComponent(collection)}/points`,
    // The default of @qdrant/js-client-rest's `retrieve`.
    { with_payload: true, ...request },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
}
export {
  queryBatch,
  retrievePoints
};
