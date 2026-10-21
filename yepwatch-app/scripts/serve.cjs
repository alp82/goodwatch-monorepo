const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', process.env.EXPORT_DIR ?? 'dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json', '.map': 'application/json' };
http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  let target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (!target.startsWith(`${root}${path.sep}`) && target !== root) { response.writeHead(403).end(); return; }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) target = path.join(root, 'index.html');
  response.setHeader('Content-Type', mime[path.extname(target)] ?? 'application/octet-stream');
  response.setHeader('Referrer-Policy', 'no-referrer');
  fs.createReadStream(target).pipe(response);
}).listen(Number(process.env.PORT ?? 8081), '127.0.0.1');
