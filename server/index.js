import http from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./data.js";
import {
  authenticatePassword,
  createSample,
  publicUsers,
  sanitizeUser,
  searchSamples,
  takeOneSample,
  userById
} from "./labService.js";
import { startTelegramBot } from "./telegramBot.js";

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || "127.0.0.1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "../dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".json": "application/json",
  ".woff2":"font/woff2",
};

const sessions = new Map();

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server ready at http://${HOST}:${PORT}`);
  startTelegramBot();
});

async function route(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // non-API requests → serve static files (no auth required)
  if (!url.pathname.startsWith("/api/")) {
    if (req.method === "GET" && existsSync(DIST)) {
      let filePath = join(DIST, url.pathname);
      const { stat } = await import("node:fs/promises");
      const isDir = await stat(filePath).then(s => s.isDirectory()).catch(() => true);
      if (isDir) filePath = join(DIST, "index.html");
      try {
        const data = await readFile(filePath);
        res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
        res.end(data);
        return;
      } catch { /* fall through */ }
    }
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJson(req);
    const user = authenticatePassword(body.password);
    if (!user) return sendJson(res, 401, { error: "密码未匹配到用户。" });

    const token = randomUUID();
    sessions.set(token, user.id);
    return sendJson(res, 200, { token, user: sanitizeUser(user) });
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (req.method === "GET" && url.pathname === "/api/me") {
    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const token = bearerToken(req);
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    return sendJson(res, 200, {
      user: sanitizeUser(user),
      users: publicUsers(),
      consumables: db.consumables,
      freezers: db.freezers,
      samples: searchSamples(user)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/samples") {
    const search = (url.searchParams.get("search") || "").trim();
    return sendJson(res, 200, { samples: searchSamples(user, search) });
  }

  if (req.method === "POST" && url.pathname === "/api/samples") {
    const body = await readJson(req);
    const sample = createSample(body, user);
    return sendJson(res, 201, { sample });
  }

  const takeOneMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/take-one$/);
  if (req.method === "POST" && takeOneMatch) {
    const result = takeOneSample(takeOneMatch[1], user);
    if (result.error) return sendJson(res, result.status, { error: result.error });
    return sendJson(res, 200, { sample: result.sample });
  }

  sendJson(res, 404, { error: "Not found" });
}

function requireUser(req, res) {
  const token = bearerToken(req);
  const userId = token ? sessions.get(token) : null;
  const user = userById(userId);
  if (!user) {
    sendJson(res, 401, { error: "请先登录。" });
    return null;
  }
  return user;
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  setCors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", `http://${HOST}:${PORT}`);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
