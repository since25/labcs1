const TOKEN_KEY = "lab-inventory-agent-token-v1";
const UI_KEY = "lab-inventory-agent-ui-v1";

let state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  currentUser: null,
  users: [],
  consumables: [],
  freezers: [],
  samples: [],
  activeTab: localStorage.getItem(UI_KEY) || "freezer",
  draft: null,
  conversation: [
    {
      from: "agent",
      text: "可以直接说：我把293T P12冻存了6管，放在-80一号第三层左起第二摞，架内第二层第四个盒子，A1到A6。也可以问：293T在哪？"
    }
  ],
  loading: false
};

init();

async function init() {
  if (state.token) {
    try {
      await loadBootstrap();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      state.token = "";
    }
  }
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

async function loadBootstrap() {
  const payload = await api("/api/bootstrap");
  state.currentUser = payload.user;
  state.users = payload.users;
  state.consumables = payload.consumables;
  state.freezers = payload.freezers;
  state.samples = payload.samples;
}

function currentUser() {
  return state.currentUser;
}

function isAdmin() {
  return currentUser()?.role === "admin";
}

function freezerById(id) {
  return state.freezers.find((freezer) => freezer.id === id);
}

function ownerName(id) {
  return state.users.find((user) => user.id === id)?.name || "未知用户";
}

function locationText(sample) {
  const freezer = freezerById(sample.freezerId);
  return `${freezer?.name || sample.freezerId} / 第${sample.shelf}层 / ${sample.stack}架位 / 架内第${sample.rackLevel}层 / 第${sample.depth}深冻存盒 / ${sample.box} / ${sample.wells}`;
}

function render() {
  const app = document.querySelector("#app");
  const user = currentUser();
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="mark">L</div>
        <div>
          <h1>实验室物料系统</h1>
          <p>耗材库存 + 冰箱样品 Agent</p>
        </div>
      </div>
      ${renderLogin(user)}
      <nav class="nav">
        <button class="${state.activeTab === "freezer" ? "active" : ""}" data-tab="freezer">冰箱 Agent</button>
        <button class="${state.activeTab === "consumables" ? "active" : ""}" data-tab="consumables">室温耗材</button>
        <button class="${state.activeTab === "access" ? "active" : ""}" data-tab="access">权限模型</button>
      </nav>
      <section class="side-card">
        <h2>权限边界</h2>
        <p>Agent 只生成意图；查询和写入由后端 API 按 token 强制过滤。</p>
      </section>
    </aside>
    <main class="main">
      ${user ? renderDashboard(user) : renderLocked()}
    </main>
  `;
  bindEvents();
}

function renderLogin(user) {
  if (user) {
    return `
      <section class="login-panel">
        <span class="label">当前身份</span>
        <strong>${user.name}</strong>
        <p>${user.role === "admin" ? "管理员：后端返回全部样品和配置" : "个人用户：后端只返回自己的冰箱样品"}</p>
        <button class="secondary" data-action="logout">退出登录</button>
      </section>
    `;
  }
  return `
    <section class="login-panel">
      <span class="label">简化登录</span>
      <input id="passwordInput" type="password" placeholder="输入密码：admin123 / wanglab01 / cell01" />
      <button data-action="login">${state.loading ? "登录中" : "登录"}</button>
      <p>第一版用密码映射身份；权限判断在后端 API 层执行。</p>
    </section>
  `;
}

function renderLocked() {
  return `
    <section class="empty-state">
      <h2>先登录，再进入实验室库存视图</h2>
      <p>试用密码：管理员 admin123；个人用户 wanglab01、cell01、chen01。</p>
    </section>
  `;
}

function renderDashboard(user) {
  const heading = user.role === "admin" ? "全实验室视图" : `${user.name} 的个人视图`;
  return `
    <header class="topbar">
      <div>
        <span class="label">当前工作台</span>
        <h2>${heading}</h2>
      </div>
      <div class="stats">
        <div><strong>${state.samples.length}</strong><span>后端返回样品</span></div>
        <div><strong>${state.consumables.length}</strong><span>耗材档案</span></div>
        <div><strong>${state.freezers.length}</strong><span>冰箱</span></div>
      </div>
    </header>
    ${state.activeTab === "freezer" ? renderFreezer() : ""}
    ${state.activeTab === "consumables" ? renderConsumables() : ""}
    ${state.activeTab === "access" ? renderAccess() : ""}
  `;
}

function renderFreezer() {
  return `
    <section class="workspace">
      <div class="agent-panel">
        <div class="panel-head">
          <div>
            <span class="label">自然语言 Agent</span>
            <h3>入库、查找、移动和取出</h3>
          </div>
          <button class="secondary" data-action="seedExample">填入示例</button>
        </div>
        <div class="chat-log">
          ${state.conversation.map((item) => `<div class="message ${item.from}">${item.text}</div>`).join("")}
          ${state.draft ? renderDraft(state.draft) : ""}
        </div>
        <div class="composer">
          <input id="agentInput" placeholder="例如：293T P12在哪？或者：我把A549 P8冻存了4管，放在-80一号第三层左起第二摞，架内第二层第四个盒子，B1到B4" />
          <button data-action="sendAgent">${state.loading ? "处理中" : "发送"}</button>
        </div>
      </div>
      <div class="freezer-panel">
        <div class="panel-head">
          <div>
            <span class="label">-80 定位地图</span>
            <h3>四层冰箱，单层四摞架子</h3>
          </div>
        </div>
        ${renderFreezerMap()}
        ${renderSampleTable()}
      </div>
    </section>
  `;
}

function renderDraft(draft) {
  return `
    <div class="draft-card">
      <span class="label">待确认写入</span>
      <h4>${draft.name} · ${draft.count}管</h4>
      <p>${draft.location}</p>
      <div class="draft-actions">
        <button data-action="confirmDraft">确认保存</button>
        <button class="secondary" data-action="cancelDraft">取消</button>
      </div>
    </div>
  `;
}

function renderFreezerMap() {
  const freezer = state.freezers[0];
  if (!freezer) return `<p class="muted">还没有配置冰箱。</p>`;

  const stacks = ["A", "B", "C", "D"];
  let html = `<div class="freezer-map">`;
  for (let shelf = 1; shelf <= freezer.shelves; shelf += 1) {
    html += `<div class="shelf"><div class="shelf-title">第${shelf}层</div>`;
    for (const stack of stacks) {
      const count = state.samples.filter((sample) => sample.shelf === shelf && sample.stack === stack).length;
      html += `<button class="stack ${count > 0 ? "occupied" : ""}" data-filter-shelf="${shelf}" data-filter-stack="${stack}">
        <strong>${stack}</strong><span>${count}个样品</span>
      </button>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  html += renderRackGrid();
  return html;
}

function renderRackGrid() {
  let html = `<div class="rack-grid"><span class="label">标准架：4层 x 5深</span>`;
  for (let level = 1; level <= 4; level += 1) {
    html += `<div class="rack-row"><b>架内${level}层</b>`;
    for (let depth = 1; depth <= 5; depth += 1) {
      const count = state.samples.filter((sample) => sample.rackLevel === level && sample.depth === depth).length;
      html += `<span class="${count ? "hot" : ""}">第${depth}深</span>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function renderSampleTable() {
  return `
    <div class="table-card">
      <div class="panel-head compact">
        <h3>可见样品清单</h3>
        <span>${isAdmin() ? "管理员：API 返回全量" : "个人用户：API 已按 owner_user_id 过滤"}</span>
      </div>
      <div class="sample-list">
        ${state.samples.map((sample) => `
          <article class="sample-card">
            <div>
              <h4>${sample.name}</h4>
              <p>${sample.type} · ${sample.count}管 · ${sample.status}</p>
              <small>${locationText(sample)}</small>
            </div>
            <div class="owner">
              <span>${ownerName(sample.ownerUserId)}</span>
              <button class="secondary" data-action="takeOne" data-id="${sample.id}">取走1管</button>
            </div>
          </article>
        `).join("") || `<p class="muted">当前身份下没有可见样品。</p>`}
      </div>
    </div>
  `;
}

function renderConsumables() {
  return `
    <section class="consumable-grid">
      ${state.consumables.map((item) => {
        const total = item.locations.reduce((sum, loc) => sum + loc.qty, 0);
        return `
          <article class="consumable-card">
            <div class="panel-head compact">
              <div>
                <h3>${item.name}</h3>
                <span>${item.catalog} · ${item.spec}</span>
              </div>
              <b class="${total <= item.min ? "warn" : ""}">${total}</b>
            </div>
            <p>${item.storage}</p>
            <div class="chips">${item.usages.map((usage) => `<span>${usage}</span>`).join("")}</div>
            <div class="locations">
              ${item.locations.map((loc) => `<div><span>${loc.name}</span><strong>${loc.qty} ${loc.unit}</strong></div>`).join("")}
            </div>
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function renderAccess() {
  return `
    <section class="access-layout">
      <article>
        <span class="label">隔离原则</span>
        <h3>Agent 无法绕过 API</h3>
        <p>前端 Agent 只把自然语言转为结构化请求。样品查询、入库、取走都提交给后端，后端根据 Bearer token 判断当前用户。</p>
      </article>
      <article>
        <span class="label">第一版鉴权</span>
        <h3>密码映射身份</h3>
        <p>登录 API 根据密码返回 token 和 user role。个人用户请求样品时，服务端只返回 owner_user_id 等于当前用户的记录。</p>
      </article>
      <article>
        <span class="label">预留升级</span>
        <h3>数据模型不省略</h3>
        <p>样品仍保存 owner_user_id 和 created_by_user_id。以后把内存数据换成数据库，或者把密码登录换成企业微信，都不影响前端。</p>
      </article>
    </section>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      localStorage.setItem(UI_KEY, state.activeTab);
      render();
    });
  });

  document.querySelector("[data-action='login']")?.addEventListener("click", login);
  document.querySelector("#passwordInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
  document.querySelector("[data-action='logout']")?.addEventListener("click", logout);
  document.querySelector("[data-action='sendAgent']")?.addEventListener("click", sendAgent);
  document.querySelector("#agentInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendAgent();
  });
  document.querySelector("[data-action='seedExample']")?.addEventListener("click", () => {
    document.querySelector("#agentInput").value = "我把A549 P8冻存了4管，放在-80一号第三层左起第二摞，架内第二层第四个盒子，B1到B4，负责人是我";
  });
  document.querySelector("[data-action='confirmDraft']")?.addEventListener("click", confirmDraft);
  document.querySelector("[data-action='cancelDraft']")?.addEventListener("click", () => {
    state.draft = null;
    pushAgent("已取消这次写入。");
  });
  document.querySelectorAll("[data-action='takeOne']").forEach((button) => {
    button.addEventListener("click", () => takeOne(button.dataset.id));
  });
}

async function login() {
  const password = document.querySelector("#passwordInput").value.trim();
  if (!password) return;

  await withLoading(async () => {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    state.token = payload.token;
    state.currentUser = payload.user;
    localStorage.setItem(TOKEN_KEY, payload.token);
    await loadBootstrap();
    state.conversation = [
      {
        from: "agent",
        text: `${payload.user.name}已登录。${payload.user.role === "admin" ? "后端会返回全部样品。" : "后端只会返回属于你的冰箱样品。"}`
      }
    ];
  });
}

async function logout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {
    // Token may already be invalid; local logout should still proceed.
  }
  state.token = "";
  state.currentUser = null;
  state.samples = [];
  state.draft = null;
  localStorage.removeItem(TOKEN_KEY);
  render();
}

async function sendAgent() {
  const input = document.querySelector("#agentInput");
  const text = input.value.trim();
  if (!text) return;
  state.conversation.push({ from: "user", text });
  input.value = "";
  await handleIntent(text);
}

async function handleIntent(text) {
  const normalized = text.toLowerCase();
  if (/(在哪|哪里|查|找|位置)/.test(text)) {
    const term = text.replace(/在哪|在哪里|哪里|查一下|查|找|帮我|位置|？|\?/g, "").trim();
    await searchSamples(term);
    return;
  }
  if (/(取走|取出|用了|消耗)/.test(text)) {
    await searchSamples(text, "如果要扣减库存，请在清单中点“取走1管”，后端会再次检查 owner/admin 权限。");
    return;
  }
  if (/(放|冻存|入库|存了|新增)/.test(text) || normalized.includes("box")) {
    const draft = parseDeposit(text);
    state.draft = draft;
    state.conversation.push({
      from: "agent",
      text: "我已解析为一条入库记录，请确认后再保存。确认后会提交给后端 API，由后端写入当前用户名下。"
    });
    render();
    return;
  }
  pushAgent("我还没有把这句话解析成明确操作。你可以说“某样品在哪”，或者“我把某样品放在某个冰箱坐标”。");
}

async function searchSamples(term, prefix) {
  const cleanTerm = term.replace(/的样品|样品/g, "").trim();
  await withLoading(async () => {
    const payload = await api(`/api/samples?search=${encodeURIComponent(cleanTerm)}`);
    state.samples = payload.samples;
    if (!payload.samples.length) {
      state.conversation.push({
        from: "agent",
        text: `${isAdmin() ? "全库" : "你的授权范围内"}没有找到“${term || "该条件"}”。`
      });
      return;
    }
    const lines = payload.samples.slice(0, 5).map((sample) => `- ${sample.name}：${locationText(sample)}；负责人 ${ownerName(sample.ownerUserId)}`);
    state.conversation.push({
      from: "agent",
      text: `${prefix ? `${prefix}\n` : ""}后端返回 ${payload.samples.length} 条授权结果：\n${lines.join("\n")}`
    });
  });
}

function parseDeposit(text) {
  const user = currentUser();
  const count = Number((text.match(/(\d+)\s*(管|支|个)/) || [])[1] || 1);
  const shelf = Number((text.match(/第?([一二三四1234])层/) || [])[1]?.replace(/[一二三四]/, (m) => ({ 一: 1, 二: 2, 三: 3, 四: 4 }[m])) || 1);
  const stack = parseStack(text);
  const rackLevelMatch = text.match(/架内第?([一二三四1234])层/);
  const rackLevel = Number((rackLevelMatch?.[1] || "1").replace(/[一二三四]/, (m) => ({ 一: 1, 二: 2, 三: 3, 四: 4 }[m])));
  const depth = Number((text.match(/第?([一二三四五12345])(?:个盒子|深|号盒)/) || [])[1]?.replace(/[一二三四五]/, (m) => ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 }[m])) || 1);
  const wells = (text.match(/[A-HJ][0-9]{1,2}\s*(?:到|-)\s*[A-HJ][0-9]{1,2}/i) || text.match(/[A-HJ][0-9]{1,2}/i) || ["未填写孔位"])[0].replace(/\s*到\s*/, "-").toUpperCase();
  const sample = {
    name: parseSampleName(text),
    type: guessType(text),
    count,
    ownerUserId: user.id,
    createdByUserId: user.id,
    status: "在库",
    project: "未归类",
    freezerId: "f80-01",
    shelf,
    stack,
    rackLevel,
    depth,
    box: `Box-${stack}${rackLevel}${depth}`,
    wells,
    note: "由自然语言 Agent 录入"
  };
  return { ...sample, location: locationText(sample) };
}

function parseStack(text) {
  if (/左起第二|第二摞|b架|B架/.test(text)) return "B";
  if (/左起第三|第三摞|c架|C架/.test(text)) return "C";
  if (/左起第四|第四摞|d架|D架/.test(text)) return "D";
  return "A";
}

function parseSampleName(text) {
  const direct = text.match(/(?:我把|把|新增|入库)?\s*(.+?)(?:冻存了|存了|放了|放在|，放在|,放在)\s*\d*\s*(?:管|支|个)?/);
  const cleaned = (direct?.[1] || text)
    .replace(/^(我把|把|帮我|新增|入库)/, "")
    .replace(/-80一号冰箱|-80一号|负责人是我/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "未命名样品";
}

function guessType(text) {
  if (/细胞|293|a549|jurkat/i.test(text)) return "细胞冻存管";
  if (/rna/i.test(text)) return "RNA";
  if (/质粒|plasmid/i.test(text)) return "质粒";
  if (/抗体|antibody/i.test(text)) return "抗体";
  return "冷冻样品";
}

async function confirmDraft() {
  if (!state.draft) return;
  const { location, ...sample } = state.draft;
  await withLoading(async () => {
    const payload = await api("/api/samples", {
      method: "POST",
      body: JSON.stringify(sample)
    });
    state.draft = null;
    await loadBootstrap();
    state.conversation.push({
      from: "agent",
      text: `后端已保存：${payload.sample.name}。位置是 ${locationText(payload.sample)}。`
    });
  });
}

async function takeOne(id) {
  await withLoading(async () => {
    const payload = await api(`/api/samples/${id}/take-one`, { method: "POST" });
    await loadBootstrap();
    state.conversation.push({
      from: "agent",
      text: `后端已记录取走 1 管：${payload.sample.name}，剩余 ${payload.sample.count} 管。`
    });
  });
}

async function withLoading(task) {
  state.loading = true;
  render();
  try {
    await task();
  } catch (error) {
    state.conversation.push({ from: "agent", text: error.message });
  } finally {
    state.loading = false;
    render();
  }
}

function pushAgent(text) {
  state.conversation.push({ from: "agent", text });
  render();
}
