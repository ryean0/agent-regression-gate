import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "agent-regression-gate");
const prefix = "/agent-regression-gate";
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/" || url.pathname === prefix) {
    res.writeHead(302, { location: `${prefix}/` });
    res.end();
    return;
  }
  if (!url.pathname.startsWith(`${prefix}/`)) {
    send(res, 404, "not found");
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(site, rel);
  if (file !== site && !file.startsWith(site + path.sep)) {
    send(res, 403, "forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      send(res, 404, "not found");
      return;
    }
    send(res, 200, data, types[path.extname(file)] ?? "application/octet-stream");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`preview http://127.0.0.1:${port}${prefix}/`);
});
