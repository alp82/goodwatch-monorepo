import "../setup.server.ts"
export default function handleRequest() {
	return new Response("Local OAuth/MCP resource route harness", { status: 404 })
}
