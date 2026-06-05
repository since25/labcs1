import {
  authenticatePassword,
  bindTelegramChat,
  createSample,
  locationText,
  userByTelegramChat
} from "./labService.js";
import { analyzeBoxArchive } from "./boxAnalysis.js";

const conversations = new Map();

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("Telegram bot disabled. Set TELEGRAM_BOT_TOKEN to enable mobile archive flow.");
    return;
  }

  const bot = new TelegramClient(token);
  console.log("Telegram bot enabled with long polling.");
  poll(bot).catch((error) => {
    console.error("Telegram bot stopped:", error);
  });
}

async function poll(bot) {
  let offset = 0;
  while (true) {
    const result = await bot.call("getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["message"]
    });

    for (const update of result) {
      offset = update.update_id + 1;
      await handleMessage(bot, update.message);
    }
  }
}

async function handleMessage(bot, message) {
  if (!message?.chat?.id) return;
  const chatId = message.chat.id;
  const text = (message.text || message.caption || "").trim();
  const boundUser = userByTelegramChat(chatId);
  const conversation = conversations.get(chatId) || {};

  if (text === "/start" || text === "/login") {
    conversations.set(chatId, { stage: "awaiting_password" });
    await bot.sendMessage(chatId, "请输入你的系统登录密码，用来绑定 Telegram 会话。");
    return;
  }

  if (!boundUser && conversation.stage !== "awaiting_password") {
    conversations.set(chatId, { stage: "awaiting_password" });
    await bot.sendMessage(chatId, "这个 Telegram 会话还没有绑定用户。请先发送 /login，然后输入你的系统密码。");
    return;
  }

  if (conversation.stage === "awaiting_password") {
    const user = authenticatePassword(text);
    if (!user) {
      await bot.sendMessage(chatId, "密码没有匹配到用户，请重新输入。");
      return;
    }
    bindTelegramChat(user, chatId);
    conversations.set(chatId, { stage: "idle" });
    await bot.sendMessage(chatId, `${user.name} 已绑定。现在可以直接拍盒子照片发给我。`);
    return;
  }

  const user = boundUser;

  if (message.photo?.length) {
    const largestPhoto = message.photo.at(-1);
    const photo = await bot.downloadFile(largestPhoto.file_id);
    const existingPhotos = conversation.stage === "awaiting_location" ? conversation.photos : [];
    const existingCaption = conversation.stage === "awaiting_location" ? conversation.caption : "";
    const photos = [...existingPhotos, photo];
    conversations.set(chatId, {
      stage: "awaiting_location",
      photos,
      caption: [existingCaption, text].filter(Boolean).join("\n"),
      userId: user.id
    });
    await bot.sendMessage(chatId, `已收到 ${photos.length} 张照片。请回复这个盒子的存放位置，例如：-80一号 第3层 左起第二摞 架内第2层 第4深 盒名 蓝色IVT-mRNA盒-20240604。`);
    return;
  }

  if (conversation.stage === "awaiting_location") {
    const analysis = analyzeBoxArchive({
      caption: conversation.caption,
      location: text,
      photos: conversation.photos,
      user
    });
    conversations.set(chatId, {
      ...conversation,
      stage: "awaiting_confirmation",
      location: text,
      analysis
    });
    await bot.sendMessage(chatId, formatAnalysis(analysis));
    return;
  }

  if (conversation.stage === "awaiting_confirmation") {
    if (/^(确认|保存|yes|y|ok|OK)$/i.test(text)) {
      const saved = conversation.analysis.samples.map((sample) => createSample(sample, user));
      conversations.set(chatId, { stage: "idle" });
      await bot.sendMessage(chatId, `已写入 ${saved.length} 条样品记录。\n${saved.map((sample) => `- ${sample.name}：${locationText(sample)}`).join("\n")}`);
      return;
    }
    if (/^(取消|不要|no|n)$/i.test(text)) {
      conversations.set(chatId, { stage: "idle" });
      await bot.sendMessage(chatId, "已取消这次拍照归档，没有写入数据库。");
      return;
    }
    await bot.sendMessage(chatId, "请回复“确认”写入，或回复“取消”。");
    return;
  }

  await bot.sendMessage(chatId, "可以直接拍盒子照片发给我；如果要重新绑定用户，发送 /login。");
}

function formatAnalysis(analysis) {
  const lines = analysis.samples.map((sample, index) => {
    return `${index + 1}. ${sample.name} / ${sample.type} / ${sample.count}管 / ${sample.status} / ${sample.wells}`;
  });

  return [
    "后端分析完成，请确认：",
    `盒子：${analysis.summary.box}`,
    `照片：${analysis.summary.photoCount}张`,
    `样品条目：${analysis.summary.sampleKinds}`,
    `总数量：${analysis.summary.totalTubes}管`,
    "",
    ...lines,
    "",
    "回复“确认”写入数据库，或回复“取消”。"
  ].join("\n");
}

class TelegramClient {
  constructor(token) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call(method, payload) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!json.ok) throw new Error(json.description || `Telegram ${method} failed`);
    return json.result;
  }

  sendMessage(chatId, text) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text
    });
  }

  async downloadFile(fileId) {
    const file = await this.call("getFile", { file_id: fileId });
    const response = await fetch(`${this.baseUrl.replace("/bot", "/file/bot")}/${file.file_path}`);
    if (!response.ok) throw new Error("Telegram file download failed");
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      fileId,
      filePath: file.file_path,
      bytes,
      size: bytes.byteLength
    };
  }
}
