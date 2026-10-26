import { mcpServerInfo } from "../mcp/identity.ts"

// The pinned provider always advertises DPoP, with no disable option. This deployment
// uses the SDK's bearer-only verifier; normalize every public discovery alias here.
export async function bearerMcpMetadata(request: Request, response: Response) {
	const path = new URL(request.url).pathname
	if (
		!response.ok ||
		request.method === "HEAD" ||
		!/(?:^|\/)\.well-known\/(?:oauth-authorization-server|openid-configuration|oauth-protected-resource)(?:\/|$)/.test(
			path,
		)
	)
		return response
	const metadata = await response.json()
	metadata.dpop_signing_alg_values_supported = undefined
	metadata.dpop_bound_access_tokens_required = undefined
	if (metadata.resource) {
		// The shared issuer also supports YepWatch; MCP clients must only discover MCP scopes.
		metadata.scopes_supported = ["mcp:read", "mcp:write"]
		metadata.resource_name = mcpServerInfo.title
		metadata.resource_documentation = mcpServerInfo.websiteUrl
		metadata.logo_uri = mcpServerInfo.icons[2].src
	} else {
		metadata.service_documentation = mcpServerInfo.websiteUrl
	}
	const headers = new Headers(response.headers)
	headers.delete("Content-Length")
	headers.delete("ETag")
	return new Response(JSON.stringify(metadata), {
		status: response.status,
		headers,
	})
}
