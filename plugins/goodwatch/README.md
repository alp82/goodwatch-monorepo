# GoodWatch for Claude

Choose something to watch and keep your GoodWatch progress up to date. This optional plugin adds two workflow skills to the remote GoodWatch MCP connector. It runs no local server and requires no API key or dependency installation.

## Connect

You need a free GoodWatch account. Follow [setup](https://goodwatch.app/use-with-ai), sign in on GoodWatch, and choose Read-only or Read and change my GoodWatch. The server is **https://goodwatch.app/mcp**. Credentials stay in the OAuth flow; never put tokens or passwords in this bundle.

In Claude Code, preview a checkout with `claude --plugin-dir /absolute/path/to/goodwatch`. Open `/mcp` and complete the GoodWatch login. Invoke `/goodwatch:watch-tonight` or `/goodwatch:track-watching`, or describe the task naturally. On Claude surfaces with plugin installation, install the repository through the supported plugin UI after its publication. Availability depends on the surface, plan and organization policy; Claude Code validation alone does not establish compatibility with Claude Desktop or Cowork.

If you already connected GoodWatch, use that same endpoint. A directory plugin and connector must be submitted separately under the same organization and exact URL so Claude can pair them. During a local preview, remove a duplicate manually configured server if the client shows tools twice.

## Try it

- “Find three unseen movies under two hours on my saved services. Explain the taste match and where each streams.”
- “What is my next episode, and what else is on my Wishlist?”
- “Find Arrival (2016) and add it to my Wishlist.” Approve the change when asked.

The connector supports catalog discovery, title details, similar titles, cast/crew, personal library, taste, show progress, share lists and saved settings. Write permission also enables watches, ratings, Wishlist and Not interested changes, show status, settings, and share-list creation/editing. Tool availability can be restricted per account. Tools always act as the connected GoodWatch member; they cannot access another member's private library or unlisted lists.

GoodWatch is free. Requests are limited to 60/minute and 1,000/hour per member. Descriptive smarter search allows 20 uncached attempts per UTC day; name lookup has no separate daily quota. Streaming availability can be unknown or change. Share lists contain exactly five titles and require a public handle created on the website; unlisted links are readable by anyone with the link. This integration cannot play video, import history, claim a handle, or delete your account.

Disconnect in [GoodWatch Connected apps](https://goodwatch.app/settings/connected-apps), then remove the connector/plugin from Claude. [Privacy](https://goodwatch.app/privacy) · [Support](https://goodwatch.app/support) · hello@goodwatch.app · [Service status](https://status.goodwatch.app).

## Packaging and maintenance

The plugin root contains `.claude-plugin/plugin.json`, `.mcp.json`, `skills/`, this README and the MIT license. The standalone repository is https://github.com/alp82/goodwatch-claude-plugin; it is staged privately until the owner authorizes public release. The monorepo is the development source. No runtime dependencies or environment variables are required. Keep the endpoint identical to the standalone connector listing, increment the plugin version for releases, validate the exported repository, and rerun both workflows on each intended Claude surface.
