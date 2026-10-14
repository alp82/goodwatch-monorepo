#!/usr/bin/env bash
# Disposable probe: never changes the webapp's dependencies or lockfile.
set -euo pipefail
probe_dir=$(mktemp -d)
trap 'rm -rf "$probe_dir"' EXIT
npm install --prefix "$probe_dir" --ignore-scripts --no-audit --no-fund \
  @modelcontextprotocol/server@2.3.1 zod@3.25.76 typescript@5.6.3 @types/node@22
cat > "$probe_dir/probe.mjs" <<'JS'
import assert from 'node:assert/strict';
import * as sdk from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { z as z3 } from 'zod';

for (const name of ['createMcpHandler', 'WebStandardStreamableHTTPServerTransport',
  'requireBearerAuth', 'verifyBearerToken', 'bearerAuthChallengeResponse',
  'oauthMetadataResponse', 'buildOAuthProtectedResourceMetadata',
  'getOAuthProtectedResourceMetadataUrl']) assert.equal(typeof sdk[name], 'function', name);
const resource = new URL('https://goodwatch.example/mcp');
const metadataUrl = sdk.getOAuthProtectedResourceMetadataUrl(resource);
assert.equal(metadataUrl, 'https://goodwatch.example/.well-known/oauth-protected-resource/mcp');
const gate = sdk.requireBearerAuth({
  verifier: { async verifyAccessToken(token) {
    return { token, clientId: 'probe', scopes: ['mcp'], expiresAt: Date.now() / 1000 + 60, resource };
  } }, expectedResource: resource, requiredScopes: ['mcp'], resourceMetadataUrl: metadataUrl,
});
const rejected = await gate(new Request(resource));
assert.equal(rejected.status, 401);
assert.match(rejected.headers.get('www-authenticate'), /resource_metadata=/);
assert.equal((await gate(new Request(resource, { headers: { authorization: 'Bearer probe' } }))).clientId, 'probe');

async function listTools(schema) {
  const handler = sdk.createMcpHandler(() => {
    const server = new sdk.McpServer({ name: 'zod-probe', version: '1.0.0' });
    server.registerTool('echo', { inputSchema: schema }, async args => ({ content: [{ type: 'text', text: args.text }] }));
    return server;
  });
  try {
    const response = await handler.fetch(new Request(resource, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }));
    const body = await response.text();
    const line = body.startsWith('data:') || body.includes('\ndata:')
      ? body.split('\n').find(line => line.startsWith('data:')).slice(5).trim() : body;
    return JSON.parse(line);
  } finally { await handler.close(); }
}
const schema = z.object({ text: z.string() });
assert.equal(schema['~standard'].jsonSchema, undefined);
const listed = await listTools(schema);
assert.equal(listed.result.tools[0].inputSchema.properties.text.type, 'string');
const legacy = await listTools(z3.object({ text: z3.string() }));
assert.ok(legacy.error);
assert.match(legacy.error.message, /zod 3/);
console.log('PASS: SDK exports, bearer gate, RFC9728 URL, bundled zod/v4 tools/list fallback; Zod 3 rejected');
JS
node "$probe_dir/probe.mjs"
cat > "$probe_dir/typecheck.mts" <<'TS'
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
const server = new McpServer({ name: 'probe', version: '1' });
// Runtime fallback works, but bundled v4 lacks StandardJSONSchemaV1.
// @ts-expect-error Missing ~standard.jsonSchema in Zod bundled with 3.25.76.
server.registerTool('echo', { inputSchema: z.object({ text: z.string() }) }, async () => ({ content: [] }));
TS
"$probe_dir/node_modules/.bin/tsc" --noEmit --strict --skipLibCheck --target ES2022 \
  --module NodeNext --moduleResolution NodeNext "$probe_dir/typecheck.mts"
echo 'PASS: TypeScript confirms bundled zod/v4 is not accepted directly by registerTool'
npm install --prefix "$probe_dir" --ignore-scripts --no-audit --no-fund zod@4.2.0
sed '/@ts-expect-error/d' "$probe_dir/typecheck.mts" > "$probe_dir/upgraded.mts"
"$probe_dir/node_modules/.bin/tsc" --noEmit --strict --skipLibCheck --target ES2022 \
  --module NodeNext --moduleResolution NodeNext "$probe_dir/upgraded.mts"
node --input-type=module -e "const { z } = await import('$probe_dir/node_modules/zod/index.js'); if (typeof z.object({text:z.string()})['~standard'].jsonSchema?.input !== 'function') process.exit(1);"
echo 'PASS: Zod 4.2.0 provides Standard JSON Schema and registerTool typechecks without suppression'
