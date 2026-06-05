# Lab Inventory Agent

实验室耗材与冰箱样品管理原型，包含网页端和可选 Telegram 手机端入口。

## 本地运行

```bash
npm install
npm run dev
```

网页端：`http://127.0.0.1:5174/`

后端 API：`http://127.0.0.1:8788/api`

## Telegram 拍照归档

配置 bot token 后启动后端：

```bash
TELEGRAM_BOT_TOKEN=你的bot_token npm run dev:api
```

交互流程：

1. 在 Telegram 里发送 `/login`
2. 输入系统密码，例如 `wanglab01`
3. 直接拍冻存盒照片发送给 bot
4. bot 询问盒子位置
5. 回复位置，例如：`-80一号 第3层 左起第二摞 架内第2层 第4深 盒名 蓝色IVT-mRNA盒-20240604`
6. 后端返回分析结果
7. 回复 `确认` 写入数据库，或回复 `取消`

当前图像分析层是可替换的轻量占位实现：它会根据图片 caption 中的文字做粗归档，未识别内容会进入“待复核”。后续可以把 `server/boxAnalysis.js` 替换为真正的 OCR/VLM 服务。
