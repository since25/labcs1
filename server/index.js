import http from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { db, publicUsers, users } from "./data.js";

const PORT = Number(process.env.API_PORT || 8788);
const sessions = new Map();

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API server ready at http://127.0.0.1:${PORT}`);
});

async function route(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJson(req);
    const user = users.find((item) => item.password === body.password);
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
      samples: filterSamplesForUser(user, db.samples)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/samples") {
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const filtered = filterSamplesForUser(user, db.samples).filter((sample) => {
      if (!search) return true;
      const haystack = `${sample.name} ${sample.type} ${sample.project} ${sample.note}`.toLowerCase();
      return haystack.includes(search);
    });
    return sendJson(res, 200, { samples: filtered });
  }

  if (req.method === "POST" && url.pathname === "/api/samples") {
    const body = await readJson(req);
    const sample = normalizeNewSample(body, user);
    db.samples.push(sample);
    db.operations.push(operation(user, "deposit", sample.id));
    return sendJson(res, 201, { sample });
  }

  const takeOneMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/take-one$/);
  if (req.method === "POST" && takeOneMatch) {
    const sample = db.samples.find((item) => item.id === takeOneMatch[1]);
    if (!sample) return sendJson(res, 404, { error: "样品不存在。" });
    if (!canMutateSample(user, sample)) return sendJson(res, 403, { error: "你没有权限操作这条样品记录。" });

    sample.count = Math.max(0, sample.count - 1);
    if (sample.count === 0) sample.status = "已用完";
    db.operations.push(operation(user, "take_one", sample.id));
    return sendJson(res, 200, { sample });
  }

  sendJson(res, 404, { error: "Not found" });
}

function filterSamplesForUser(user, samples) {
  if (user.role === "admin") return samples;
  return samples.filter((sample) => sample.ownerUserId === user.id);
}

function canMutateSample(user, sample) {
  return user.role === "admin" || sample.ownerUserId === user.id;
}

function normalizeNewSample(body, user) {
  const ownerUserId = user.role === "admin" && body.ownerUserId ? body.ownerUserId : user.id;
  return {
    id: `s-${Date.now()}`,
    name: String(body.name || "未命名样品"),
    type: String(body.type || "冷冻样品"),
    count: Number(body.count || 1),
    ownerUserId,
    createdByUserId: user.id,
    status: "在库",
    project: String(body.project || "未归类"),
    freezerId: String(body.freezerId || "f80-01"),
    shelf: Number(body.shelf || 1),
    stack: String(body.stack || "A"),
    rackLevel: Number(body.rackLevel || 1),
    depth: Number(body.depth || 1),
    box: String(body.box || `Box-${body.stack || "A"}${body.rackLevel || 1}${body.depth || 1}`),
    wells: String(body.wells || "未填写孔位"),
    note: String(body.note || "由自然语言 Agent 录入")
  };
}

function requireUser(req, res) {
  const token = bearerToken(req);
  const userId = token ? sessions.get(token) : null;
  const user = users.find((item) => item.id === userId);
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

function sanitizeUser({ password, ...user }) {
  return user;
}

function operation(user, action, sampleId) {
  return {
    id: `op-${Date.now()}`,
    userId: user.id,
    action,
    sampleId,
    time: new Date().toISOString()
  };
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
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5174");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
