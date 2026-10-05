// Local test only. An HTTP/2 server with TLS on loopback that records, per connection, whether the TLS session was
// resumed and how many requests arrived on it. It never makes outbound calls.
//   node stub-tls-server.mjs <port file> <log file> <key file> <certificate file>
import http2 from "node:http2";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const [portFile, logFile, keyFile, certFile] = process.argv.slice(2);
const server = http2.createSecureServer({ key: readFileSync(keyFile), cert: readFileSync(certFile), allowHTTP1: true });
// The client's port names the connection: an HTTP/2 request only reaches its socket through a proxy object.
server.on("secureConnection", (socket) => {
  appendFileSync(logFile, JSON.stringify({ event: "connection", id: socket.remotePort, resumed: socket.isSessionReused(), alpn: socket.alpnProtocol, tls: socket.getProtocol() }) + "\n");
});
server.on("request", (request, response) => {
  let bytes = 0;
  request.on("data", (chunk) => (bytes += chunk.length));
  request.on("end", () => {
    appendFileSync(
      logFile,
      JSON.stringify({ event: "request", connection: request.socket.remotePort ?? null, http: request.httpVersion, method: request.method, path: request.url, body_bytes: bytes, headers: request.headers }) + "\n",
    );
    const status = request.url.startsWith("/fail") ? 500 : 200;
    const page = !request.url.includes(".") && !request.url.startsWith("/api/");
    response.writeHead(status, {
      "content-type": page ? "text/html" : "text/plain",
      ...(page ? { "gw-page-cache": "hit", "gw-cache-identity": request.headers["gw-cache-identity"] || "anon;US;en", "set-cookie": "gw_instance=a; Path=/" } : {}),
    });
    response.end("fixture");
  });
});
server.listen(0, "127.0.0.1", () => writeFileSync(portFile, String(server.address().port)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(0));
