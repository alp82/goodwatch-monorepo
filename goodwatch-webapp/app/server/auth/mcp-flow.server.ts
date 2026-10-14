import { verifyOAuthQueryParams } from "@goodwatch/auth-stack/oauth-provider"
import type { createGoodwatchAuth } from "./auth.server.ts"
import { renderMcpLogin, renderMcpConsent } from "./mcp-pages.server.ts"

type AuthService = ReturnType<typeof createGoodwatchAuth>

/** HTTP stand-in for #550. Keep the provider-signed query and every session cookie. */
export async function handleMcpAccountRequest(
 request: Request,
 page: "login" | "consent",
 auth: AuthService,
): Promise<Response> {
 const response = await handle()
 response.headers.set("Cache-Control", "private, no-store")
 response.headers.set("Referrer-Policy", "no-referrer")
 response.headers.set("X-Content-Type-Options", "nosniff")
 response.headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
 return response
 async function handle(): Promise<Response> {
  const query = new URL(request.url).search.slice(1)
  const context = await auth.$context
  if (!await verifyOAuthQueryParams(query, context.secret))
   return new Response("Invalid or expired connection request", {status: 400})
  const params = new URLSearchParams(query)
  const canonicalOrigin = new URL(context.baseURL).origin
  if (new URL(request.url).origin !== canonicalOrigin) return new Response("Origin rejected", {status: 403})
  if (!["GET", "POST"].includes(request.method)) return new Response(null, {status: 405, headers: {Allow: "GET, POST"}})
  if (request.method === "POST" && request.headers.get("Origin") !== canonicalOrigin)
   return new Response("Origin rejected", {status: 403})
  if (page === "consent" && !await auth.api.getSession({headers: request.headers}))
   return new Response("Sign in first", {status: 401})
  if (request.method === "GET") {
   if (page === "login") return html(renderMcpLogin())
   const clientId = params.get("client_id")!
   const client = await context.adapter.findOne<{name?: string; clientDiscoveryId?: string}>({model: "oauthClient", where: [{field: "clientId", value: clientId}]})
   if (!client) return new Response("Unknown app", {status: 400})
   return html(renderMcpConsent({clientName: client.name ?? clientId, clientId,
    redirectUri: params.get("redirect_uri") ?? "", scopes: (params.get("scope") ?? "").split(" ").filter(Boolean),
    unverified: client.clientDiscoveryId !== "cimd"}))
  }
  const form = await request.formData()
  if (page === "consent" && !["allow", "deny"].includes(String(form.get("decision"))))
   return new Response("Choose Allow or Deny", {status: 400})
  const body = page === "login" ? {
   email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""),
   callbackURL: `${canonicalOrigin}/`, oauth_query: query,
  } : {accept: form.get("decision") === "allow", oauth_query: query}
  const headers = new Headers(request.headers)
  headers.set("Content-Type", "application/json")
  headers.set("Accept", "application/json")
  headers.delete("Content-Length")
  const result = await auth.handler(new Request(`${context.baseURL}${page === "login" ? "/sign-in/email" : "/oauth2/consent"}`, {
   method: "POST", headers, body: JSON.stringify(body),
  }))
  if (!result.ok || result.status === 302) return result
  const data = await result.json()
  if (typeof data.url !== "string") return new Response("Connection could not continue", {status: 503})
  const redirects = new Headers({Location: data.url})
  for (const cookie of result.headers.getSetCookie()) redirects.append("Set-Cookie", cookie)
  return new Response(null, {status: 302, headers: redirects})
 }
}
function html(body: string) {
 return new Response(body, {headers: {"Content-Type": "text/html; charset=utf-8"}})
}

export async function handleMcpAccountRoute(request: Request, page: "login" | "consent") {
 const {betterAuthEnabled, getBetterAuth} = await import("./runtime.server.ts")
 if (!betterAuthEnabled()) return new Response(null, {status: 404})
 try {return await handleMcpAccountRequest(request, page, await getBetterAuth())}
 catch {return new Response("Connection is temporarily unavailable", {status: 503, headers: {"Cache-Control": "private, no-store"}})}
}
