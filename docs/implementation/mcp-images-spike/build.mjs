import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const result = await build({
  entryPoints: ["widget.mjs"], bundle: true, minify: true,
  format: "esm", target: "es2022", write: false,
});
const template = await readFile("widget.html", "utf8");
const script = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
await mkdir("dist", { recursive: true });
const html = template.replace("/* BUNDLE */", () => script);
await writeFile("dist/widget.html", html);
console.log(`UI resource: ${Buffer.byteLength(html)} bytes`);
