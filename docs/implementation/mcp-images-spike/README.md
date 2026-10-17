# Local MCP Apps poster spike

Research fixture only; no production code, credentials or member data. It exposes
`poster_spike` and `ui://goodwatch/posters-v1.html`, using two public movie posters.
The fixture MCP endpoint binds to **127.0.0.1:3001**. Do not deploy or tunnel it.

From this directory, on Node 24:

```bash
npm ci
npm run build
npm start
```

In a second terminal, run the protocol probe (no UI capability advertised):

```bash
node probe.mjs
```

## Render in the official reference host

The upstream host implements the AppBridge and sandbox; the spike does not
simulate a successful tool-result notification. Use a temporary checkout:

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git /tmp/gw-mcp-host
git -C /tmp/gw-mcp-host checkout 82221c0c8ce7661efa6771c9d461511b1650495f
cd /tmp/gw-mcp-host/examples/basic-host
npm install --no-audit --no-fund
npm install --no-save @types/cors
```

Patch the sandbox port and bind the temporary reference host to loopback:

```bash
python3 - <<'PY'
from pathlib import Path
p = Path('src/implementation.ts')
p.write_text(p.read_text().replace('localhost:8081', 'localhost:18081'))
p = Path('serve.ts')
s = p.read_text().replace('hostApp.listen(HOST_PORT,', 'hostApp.listen(HOST_PORT, "127.0.0.1",')
s = s.replace('sandboxApp.listen(SANDBOX_PORT,', 'sandboxApp.listen(SANDBOX_PORT, "127.0.0.1",')
p.write_text(s)
PY
INPUT=index.html node_modules/.bin/vite build
INPUT=sandbox.html node_modules/.bin/vite build
HOST_PORT=18080 SANDBOX_PORT=18081 SERVERS='["http://127.0.0.1:3001/mcp"]' node serve.ts
```

The direct Vite commands avoid upstream's missing standalone `cross-env` dependency.
Open <http://localhost:18080/?server=goodwatch-posters-local-spike&tool=poster_spike&call=true>.
Expect two posters and clickable title links. Stop both servers with Ctrl+C.
No host or browser runs are left active after this research.

For an automated browser check, use a local Playwright installation with Chromium
already installed. From this spike directory:

```bash
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node probe.mjs
```

The probe checks actual external-image loading, host-mediated title navigation,
image-failure label retention, no JavaScript errors, plus the no-UI tool result.
Playwright was reused from the local workspace and is not a runtime dependency.

## Recorded result, 2026-10-17

- Node 24.15.0, ext-apps 2.0.3, server SDK 2.3.1, Playwright 1.55.0: Passed build and probe.
- Bundled HTML: 446,723 bytes; gzip potential: 97,664 bytes. Runtime transport compression was not measured.
- TMDB `w185` fixture posters: 18,754 + 16,958 bytes, both image/jpeg; both loaded in the sandbox.
- [Reference host screenshot](reference-host.png): Visible grid above the collapsible raw result.
- Signed-in Claude/ChatGPT, OG images and mobile layout: Not exercised. This proves the local mechanism only.

The HTML bundle and dependencies are ignored. Only fixture source, lockfile and
the reference-host screenshot are committed. Nothing is registered with a hosted client.
