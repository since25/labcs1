import { db, users } from "./data.js";

export function authenticatePassword(password) {
  return users.find((item) => item.password === password) || null;
}

export function userById(id) {
  return users.find((item) => item.id === id) || null;
}

export function sanitizeUser({ password, telegramChatIds, ...user }) {
  return user;
}

export function publicUsers() {
  return users.map(sanitizeUser);
}

export function filterSamplesForUser(user, samples = db.samples) {
  if (user.role === "admin") return samples;
  return samples.filter((sample) => sample.ownerUserId === user.id);
}

export function searchSamples(user, search = "") {
  const clean = search.trim().toLowerCase();
  return filterSamplesForUser(user).filter((sample) => {
    if (!clean) return true;
    const haystack = `${sample.name} ${sample.type} ${sample.project} ${sample.note}`.toLowerCase();
    return haystack.includes(clean);
  });
}

export function canMutateSample(user, sample) {
  return user.role === "admin" || sample.ownerUserId === user.id;
}

export function createSample(body, user) {
  const sample = normalizeNewSample(body, user);
  db.samples.push(sample);
  db.operations.push(operation(user, "deposit", sample.id));
  return sample;
}

export function takeOneSample(id, user) {
  const sample = db.samples.find((item) => item.id === id);
  if (!sample) return { error: "样品不存在。", status: 404 };
  if (!canMutateSample(user, sample)) return { error: "你没有权限操作这条样品记录。", status: 403 };

  sample.count = Math.max(0, sample.count - 1);
  if (sample.count === 0) sample.status = "已用完";
  db.operations.push(operation(user, "take_one", sample.id));
  return { sample };
}

export function bindTelegramChat(user, chatId) {
  if (!user.telegramChatIds.includes(chatId)) user.telegramChatIds.push(chatId);
}

export function userByTelegramChat(chatId) {
  return users.find((user) => user.telegramChatIds.includes(chatId)) || null;
}

export function locationText(sample) {
  const freezer = db.freezers.find((item) => item.id === sample.freezerId);
  return `${freezer?.name || sample.freezerId} / 第${sample.shelf}层 / ${sample.stack}架位 / 架内第${sample.rackLevel}层 / 第${sample.depth}深冻存盒 / ${sample.box} / ${sample.wells}`;
}

export function parseFreezerLocation(text) {
  const shelf = Number((text.match(/第?([一二三四1234])层/) || [])[1]?.replace(/[一二三四]/, (m) => ({ 一: 1, 二: 2, 三: 3, 四: 4 }[m])) || 1);
  const rackLevelMatch = text.match(/架内第?([一二三四1234])层/);
  const rackLevel = Number((rackLevelMatch?.[1] || "1").replace(/[一二三四]/, (m) => ({ 一: 1, 二: 2, 三: 3, 四: 4 }[m])));
  const depth = Number((text.match(/第?([一二三四五12345])(?:个盒子|深|号盒)/) || [])[1]?.replace(/[一二三四五]/, (m) => ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 }[m])) || 1);

  return {
    freezerId: /二号|2号|02/.test(text) ? "f80-02" : "f80-01",
    shelf,
    stack: parseStack(text),
    rackLevel,
    depth,
    box: parseBoxName(text, parseStack(text), rackLevel, depth)
  };
}

function parseStack(text) {
  if (/左起第二|第二摞|b架|B架|B位|b位/.test(text)) return "B";
  if (/左起第三|第三摞|c架|C架|C位|c位/.test(text)) return "C";
  if (/左起第四|第四摞|d架|D架|D位|d位/.test(text)) return "D";
  return "A";
}

function parseBoxName(text, stack, rackLevel, depth) {
  const named = text.match(/(?:盒子|盒名|box|Box)[:：\s-]*([A-Za-z0-9_\-\u4e00-\u9fa5]+)/);
  return named?.[1] || `Box-${stack}${rackLevel}${depth}`;
}

function normalizeNewSample(body, user) {
  const ownerUserId = user.role === "admin" && body.ownerUserId ? body.ownerUserId : user.id;
  return {
    id: body.id || `s-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: String(body.name || "未命名样品"),
    type: String(body.type || "冷冻样品"),
    count: Number(body.count || 1),
    ownerUserId,
    createdByUserId: user.id,
    status: String(body.status || "在库"),
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

function operation(user, action, sampleId) {
  return {
    id: `op-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    userId: user.id,
    action,
    sampleId,
    time: new Date().toISOString()
  };
}
