// Local test only. Binds exclusively to loopback and never makes outbound calls.
import http from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";
const [portFile, requestsFile] = process.argv.slice(2);
const server = http.createServer((request, response) => {
  appendFileSync(
    requestsFile,
    JSON.stringify({ method: request.method, path: request.url, headers: request.headers }) + "\n",
  );
  const status = request.url.startsWith("/fail") ? 500 : 200;
  const body = status === 500 ? "fixture failure" : "fixture success";
  response.writeHead(status, {
    "Content-Type": "text/plain",
    "Content-Length": Buffer.byteLength(body),
    "Set-Cookie": "ignored_cookie=1",
  });
  response.end(body);
});
server.listen(0, "127.0.0.1", () => writeFileSync(portFile, String(server.address().port)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
