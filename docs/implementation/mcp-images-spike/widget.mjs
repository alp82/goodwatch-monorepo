import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "GoodWatch posters", version: "0.0.1" });
function linkToHost(anchor) {
  anchor.addEventListener("click", async (event) => {
    event.preventDefault();
    try { await app.openLink({ url: anchor.href }); }
    catch { document.querySelector("#status").textContent = "Open the title link in the text answer."; }
  });
}
linkToHost(document.querySelector("#page"));
app.ontoolresult = ({ structuredContent }) => {
  const grid = document.querySelector("#grid");
  grid.replaceChildren();
  for (const title of structuredContent?.items ?? []) {
    const url = new URL(title.url);
    if (url.origin !== "https://goodwatch.app") continue;
    const anchor = document.createElement("a");
    anchor.href = url.href;
    if (title.poster_url) {
      const poster = new URL(title.poster_url);
      if (poster.origin === "https://image.tmdb.org") {
        const img = document.createElement("img");
        img.src = poster.href;
        img.alt = `${title.name} poster`;
        img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => { img.hidden = true; });
        anchor.append(img);
      }
    }
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = `${title.name} (${title.year ?? "Year unknown"})`;
    anchor.append(label);
    linkToHost(anchor);
    grid.append(anchor);
  }
  document.querySelector("#status").textContent = `${grid.childElementCount} titles`;
};
app.onerror = (error) => { document.querySelector("#status").textContent = String(error); };
await app.connect();
