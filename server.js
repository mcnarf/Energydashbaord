import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const PORT = parseInt(process.env.PORT || "3000", 10);

fs.mkdirSync(DATA_DIR, { recursive: true });

const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function handleProxy(req, res, reqUrl) {
  const haUrlHeader = req.headers["x-ha-url"];
  const haTokenHeader = req.headers["x-ha-token"];
  const haUrl = (Array.isArray(haUrlHeader) ? haUrlHeader[0] : haUrlHeader) || "";
  const haToken = (Array.isArray(haTokenHeader) ? haTokenHeader[0] : haTokenHeader) || "";

  if (!haUrl || !haToken) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing x-ha-url or x-ha-token header" }));
    return;
  }

  const subPath = reqUrl.pathname.replace(/^\/api\/ha-proxy\/?/, "");
  const normalizedBase = haUrl.replace(/\/+$/, "");
  const targetPath = subPath.startsWith("api/") ? `/${subPath}` : `/api/${subPath}`;
  const targetUrl = `${normalizedBase}${targetPath}${reqUrl.search}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method || "GET",
      headers: {
        Authorization: `Bearer ${haToken}`,
        "Content-Type": "application/json",
      },
    });

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, { "Content-Type": contentType });
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Home Assistant proxy request failed",
      })
    );
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function handleGetConfig(res) {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ config: null }));
      return;
    }
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ config: parsed }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to read config",
      })
    );
  }
}

async function handleSaveConfig(req, res) {
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid config payload" }));
      return;
    }
    const tmpFile = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(parsed, null, 2), "utf-8");
    fs.renameSync(tmpFile, CONFIG_FILE);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to save config",
      })
    );
  }
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (reqUrl.pathname === "/api/version") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        version: PKG.version,
        commit: process.env.GIT_COMMIT || null,
        buildDate: process.env.BUILD_DATE || null,
      })
    );
    return;
  }

  if (reqUrl.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (reqUrl.pathname === "/api/config") {
    if (req.method === "GET") {
      handleGetConfig(res);
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      await handleSaveConfig(req, res);
      return;
    }
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  if (reqUrl.pathname.startsWith("/api/ha-proxy")) {
    await handleProxy(req, res, reqUrl);
    return;
  }

  const safePath = path.normalize(reqUrl.pathname).replace(/^(\.\.[/\\])+/, "");
  let candidate = path.join(DIST_DIR, safePath === "/" ? "index.html" : safePath);

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    serveStatic(res, candidate);
    return;
  }

  const fallback = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(fallback)) {
    serveStatic(res, fallback);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found. Run npm run build first.");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Voltix Energy Dashboard listening on http://0.0.0.0:${PORT}`);
});
