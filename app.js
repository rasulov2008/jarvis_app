/* Джарвис · HEMIS & Финансы — Telegram Mini App 2.7.
   - Безрамочный полноэкранный режим (Bot API 8.0 requestFullscreen + disableVerticalSwipes)
   - Вкладка «Финансы» справа без жёлтой точки, вход через BiometricManager + PIN («Доступ к разделу финансы / Подтвердите вход», иконка 🔑 без текста PIN, без дублирующей кнопки отпечатка)
   - Быстрое и безотказное переключение всех 8 семестров во вкладке НБ и вывод «Нет пропусков» при отсутствии данных
   - Две ветви уведомлений («Бот» и «HEMIS»): опрос HEMIS каждые 20 мин в окне 05:40–23:00 (Ташкент) и тихий час 23:30–05:50 */
"use strict";

// ---------------------------------------------------------------- утилиты
const tg = typeof window !== "undefined" ? window.Telegram && window.Telegram.WebApp : null;
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const API = ((params.get("api") || (typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG.API_URL) || "") + "").replace(/\/$/, "");
const DEMO = params.has("demo") || !(tg && tg.initData);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parseISO = (s) => { const [y, m, d] = String(s || "2026-11-13").slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1)); };
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const dm = (s) => `${String(s || "").slice(8, 10)}.${String(s || "").slice(5, 7)}`;
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":"); return Number(h) * 60 + Number(m); };
const num = (x) => (x == null ? "—" : Number.isInteger(+x) ? String(+x) : (+x).toFixed(1).replace(/\.0$/, ""));
const money = (x) => (x == null ? "—" : Math.round(+x).toLocaleString("ru-RU").replace(/\u00a0/g, " "));
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
const pairsWord = (n) => `${n} ${plural(n, "пару", "пары", "пар")}`;
const semNo = (code) => Number(code) - 10;
const sizeKb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);

// Все 8 семестров бакалавриата (коды HEMIS 11..18 -> 1..8 семестр)
const ALL_SEM_CODES = ["11", "12", "13", "14", "15", "16", "17", "18"];
function normalizeSemesters(sems) {
  const cur = String((sems && sems.current) || "13");
  const raw = (sems && Array.isArray(sems.codes) ? sems.codes : []).map(String);
  const codes = Array.from(new Set([...ALL_SEM_CODES, ...raw]))
    .filter((c) => Number(c) >= 11 && Number(c) <= 18)
    .sort((a, b) => Number(a) - Number(b));
  return { codes, current: cur };
}

function nowTk() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return { iso: `${g("year")}-${pad(g("month"))}-${pad(g("day"))}`, min: (g("hour") % 24) * 60 + g("minute") };
}
const mondayOf = (offset) => { const b = parseISO(nowTk().iso); return iso(addDays(b, -((b.getUTCDay() + 6) % 7) + 7 * offset)); };

const ICON = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  nb: '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
  exam: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 3h6v3H9zM9 14l2 2 4-4"/>',
  grades: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14.5 7 22l5-3 5 3-1.5-7.5"/>',
  money: '<rect x="2" y="6" width="20" height="13" rx="3"/><path d="M2 10h20M16 14h2"/>',
  more: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tasks: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  fingerprint: '<path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="m1 1 22 22"/>',
  backspace: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="m18 9-6 6M12 9l6 6"/>',
};
const HERO_ICON = { schedule: "calendar", nb: "nb", exams: "exam", grades: "grades", money: "money", more: "more", tasks: "tasks", resources: "book", subjects: "layers", contract: "wallet", settings: "bell" };
const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ICON.calendar}</svg>`;

// ---------------------------------------------------------------- состояние и кэш (Вкладка Финансы — крайняя справа)
const TABS = [
  { id: "schedule", label: "Расписание", icon: "calendar" },
  { id: "nb", label: "НБ", icon: "nb" },
  { id: "grades", label: "Оценки", icon: "grades" },
  { id: "more", label: "Ещё", icon: "more" },
  { id: "money", label: "Финансы", icon: "money" },
];

const SEM_SCREENS = new Set(["nb", "exams", "grades", "subjects", "tasks", "resources"]);

const S = {
  tab: "schedule",
  sub: null,
  week: 0,
  day: null,
  sem: {},
  examTab: null,
  gradeMode: "overview", // overview | targets
  goalGrade: "5",        // 5 | 4 | 3
  notifBranch: "bot",    // bot | hemis (две ветви уведомлений)
  moneyPeriod: "month",  // today | week | month | year
  moneyTab: "ops",       // ops | cats | debts | subs
  moneyUnlocked: false,  // Защита вкладки Финансы (BiometricManager + PIN)
  pinBuffer: "",
  pinSetupMode: false,   // Режим смены PIN-кода
  pinError: false,
  bioScanning: false,
  hideBalances: false,   // Скрытие балансов (••••••)
  txFormOpen: false,
  txKind: "expense",
  taskTab: "active",
  resKind: "all",
  res: { subject: null, name: "" },
  open: new Set(),
  pct: {},
};

const TTL = {
  schedule: 10 * 60e3,
  nb: 30 * 60e3,
  exams: 3 * 3600e3,
  grades: 60 * 60e3,
  subjects: 60 * 60e3,
  tasks: 30 * 60e3,
  resources: 3 * 3600e3,
  contract: 6 * 3600e3,
  money: 2 * 60e3,
  settings: 0,
};
const LS = "jv2:";
const mem = new Map();

function getSavedPin() {
  try { return (typeof localStorage !== "undefined" && localStorage.getItem(LS + "pin")) || "0000"; } catch (e) { return "0000"; }
}
function setSavedPin(pin) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(LS + "pin", String(pin)); } catch (e) { /* ignore */ }
}

const DEFAULT_NOTIF_PREFS = {
  // Ветвь «Бот Джарвис» (время и частота, тихий час 23:30–05:50)
  bot_morning_time: "07:30",
  bot_evening_time: "21:00",
  bot_quiet_hours: "23:30-05:50",
  bot_digest_freq: "2x_day",        // realtime | 3h | 2x_day | daily
  bot_fin_freq: "daily",            // every_tx | daily | weekly
  // Ветвь «HEMIS» (время и частота, опрос каждые 20 мин в 05:40–23:00 по Ташкенту)
  hemis_morning_time: "07:30",
  hemis_prep_time: "19:00",
  hemis_before_min: "10",           // 5 | 10 | 15 | 30
  hemis_poll_freq: "20m_540_2300",  // 20m_540_2300 | 15m | 30m | 1h
  hemis_deadline_freq: "standard",  // intensive | standard | minimal
};

function getNotifPrefs(serverPrefs) {
  let saved = {};
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(LS + "notif_prefs");
    if (raw) saved = JSON.parse(raw) || {};
  } catch (e) { /* ignore */ }
  const merged = { ...DEFAULT_NOTIF_PREFS, ...(serverPrefs || {}), ...saved };
  if (merged.bot_quiet_hours === "23:00-07:00") merged.bot_quiet_hours = "23:30-05:50";
  if (merged.hemis_poll_freq === "30m") merged.hemis_poll_freq = "20m_540_2300";
  return merged;
}
function saveNotifPref(key, val) {
  const next = { ...getNotifPrefs(), [key]: String(val) };
  try { if (typeof localStorage !== "undefined") localStorage.setItem(LS + "notif_prefs", JSON.stringify(next)); } catch (e) { /* ignore */ }
  return next;
}

function cget(path) {
  let e = mem.get(path);
  if (!e) {
    try {
      const raw = typeof localStorage !== "undefined" && localStorage.getItem(LS + path);
      if (raw) { e = JSON.parse(raw); mem.set(path, e); }
    } catch (err) { /* ignore */ }
  }
  return e;
}
function cset(path, data) {
  const e = { t: Date.now(), data };
  mem.set(path, e);
  const write = () => localStorage.setItem(LS + path, JSON.stringify(e));
  try { write(); } catch (err) {
    try { Object.keys(localStorage).filter((k) => k.startsWith(LS) && !["jv2:pin", "jv2:theme", "jv2:notif_prefs"].includes(k)).forEach((k) => localStorage.removeItem(k)); write(); } catch (err2) { /* ignore */ }
  }
}
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : `${Math.round(m / 1440)} дн. назад`; };

let reqId = 0;

// ---------------------------------------------------------------- сеть
async function request(method, path, body, force) {
  if (DEMO) return demoApi(path, method, body);
  if (!API) throw { kind: "noapi" };
  const url = `${API}/api/${path}${force ? (path.includes("?") ? "&" : "?") + "r=1" : ""}`;
  const headers = { "X-Telegram-Init-Data": tg.initData };
  if (body) headers["Content-Type"] = "application/json";
  let res;
  try { res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined }); } catch (e) { throw { kind: "network" }; }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw { kind: j.error || "http", message: j.message };
  }
  return res.json();
}
const api = (path, force) => request("GET", path, null, force);
const post = (path, body) => request("POST", path, body);

// ---------------------------------------------------------------- пути запросов по экранам
const semQ = (id) => (S.sem[id] ? `semester=${S.sem[id]}` : "");
function pathFor(id) {
  switch (id) {
    case "schedule": return `schedule?week=${S.week}&m=${mondayOf(S.week)}`;
    case "nb": case "exams": case "grades": case "tasks": return `${id}${S.sem[id] ? "?" + semQ(id) : ""}`;
    case "subjects": return `grades${S.sem.subjects ? "?semester=" + S.sem.subjects : ""}`;
    case "resources": return S.res.subject ? `resources?semester=${S.sem.resources}&subject=${S.res.subject}` : `resources${S.sem.resources ? "?" + semQ("resources") : ""}`;
    case "money": return `money/overview?period=${S.moneyPeriod}`;
    case "contract": case "settings": return id;
    default: return null;
  }
}
const current = () => S.sub || S.tab;
const ttlOf = (id) => (id === "subjects" ? TTL.grades : TTL[id] ?? 0);

// ---------------------------------------------------------------- общие блоки и 8-семестровый переключатель
function pager({ label, sub, prev, next, action }) {
  return `<div class="card pager">
    <button class="pg-btn" data-a="${action}" data-dir="-1" ${prev ? "" : "disabled"} aria-label="Назад">${ico("left")}</button>
    <div class="mid"><b>${esc(label)}</b><span>${esc(sub || "")}</span></div>
    <button class="pg-btn" data-a="${action}" data-dir="1" ${next ? "" : "disabled"} aria-label="Вперёд">${ico("right")}</button>
  </div>`;
}

function semPager(sems, cur) {
  const norm = normalizeSemesters(sems);
  const active = String(cur || norm.current);
  const i = norm.codes.indexOf(active);
  const sNum = semNo(active);
  const courseNo = Math.ceil(sNum / 2);
  const statusLbl = active === norm.current
    ? `${courseNo}-й курс · Текущий`
    : Number(active) < Number(norm.current)
      ? `${courseNo}-й курс · Прошедший`
      : `${courseNo}-й курс · Учебный план`;
  const prev = i > 0;
  const next = i >= 0 && i < norm.codes.length - 1;
  const strip = norm.codes.map((code) => {
    const n = semNo(code);
    const isOn = code === active ? "on" : "";
    const isCur = code === norm.current ? "cur" : "";
    return `<button class="sem-pill ${isOn} ${isCur}" data-a="semjump" data-code="${code}" title="${n}-й семестр">${n}</button>`;
  }).join("");
  return `<div class="card sem-card">
    <div class="pager">
      <button class="pg-btn" data-a="sem" data-dir="-1" ${prev ? "" : "disabled"} aria-label="Предыдущий семестр">${ico("left")}</button>
      <div class="mid"><b>${sNum}-й семестр (из ${norm.codes.length})</b><span>${esc(statusLbl)}</span></div>
      <button class="pg-btn" data-a="sem" data-dir="1" ${next ? "" : "disabled"} aria-label="Следующий семестр">${ico("right")}</button>
    </div>
    <div class="sem-strip" role="tablist" aria-label="Выбор семестра 1–8">${strip}</div>
  </div>`;
}

const empty = (emoji, title, text) => `<div class="card empty-hint"><div class="big">${emoji}</div><b>${esc(title)}</b><p class="muted small">${esc(text || "")}</p></div>`;
const seg = (items, active, action) => `<div class="seg">${items.map(([k, t, sub]) => `<button class="${k === active ? "on" : ""}" data-a="${action}" data-k="${k}">${esc(t)}${sub != null && sub !== "" ? `<small>${esc(sub)}</small>` : ""}</button>`).join("")}</div>`;
const fileList = (files) => files && files.length ? `<div class="files">${files.map((f) => `<div class="file">${ico("file")}<span>${esc(f.name)}</span><small>${sizeKb(f.size)}</small></div>`).join("")}</div>` : "";

// ---------------------------------------------------------------- расписание (без кнопок .ics и экзаменов)
const typeClass = (t) => { const x = (t || "").toLowerCase(); return x.includes("лек") || x.includes("lec") ? "tag-lec" : x.includes("лаб") || x.includes("lab") ? "tag-lab" : "tag-prac"; };
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function lessonState(l, isToday, nowMin) {
  if (!isToday) return { state: "future", pct: 0 };
  const a = toMin(l.start), b = toMin(l.end);
  if (nowMin >= b) return { state: "past", pct: 100 };
  if (nowMin >= a) return { state: "now", pct: Math.max(2, Math.min(100, Math.round(((nowMin - a) / Math.max(b - a, 1)) * 100))) };
  return { state: "future", pct: 0 };
}

function lessonCard(l, st) {
  const key = `l${l.date}${l.start}${l.subject}`.replace(/\s+/g, ""), open = S.open.has(key);
  const no = (String(l.pair || "").match(/\d+/) || [""])[0];
  const place = [l.room, l.building].filter(Boolean).join(" · ");
  const dur = toMin(l.end) - toMin(l.start);
  const rows = [["Время", `${l.start}–${l.end}${dur > 0 ? ` · ${dur} мин` : ""}`], ["Пара", no ? `${no}-я` : ""], ["Тип", l.type], ["Аудитория", l.room], ["Корпус", l.building], ["Преподаватель", l.teacher], ["Группа", l.group]].filter(([, v]) => v);
  const prev = S.pct[key] ?? 0;
  if (st.state === "now") S.pct[key] = st.pct;
  const prog = st.state === "now" ? `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${st.pct}"><i style="width:${prev}%" data-w="${st.pct}"></i></div>` : "";
  const chips = `${no ? `<span class="num">${esc(no)}</span>` : ""}${l.type ? `<span class="tag ${typeClass(l.type)}">${esc(l.type)}</span>` : ""}`
    + (st.state === "now" ? '<span class="tag tag-now"><i></i>Идёт сейчас</span>' : st.state === "past" ? `<span class="done">${ico("check")}Завершена</span>` : "");
  return `<div class="card lesson ${st.state} ${open ? "open" : ""}">
    <div class="lesson-main" data-a="lesson" data-key="${esc(key)}" role="button" tabindex="0" aria-expanded="${open}">
      <div class="l-time"><b>${esc(l.start)}</b><span>${esc(l.end)}</span></div><div class="l-sep"></div>
      <div class="l-body"><div class="chips">${chips}</div><div class="lname">${esc(l.subject)}</div>
        <div class="meta">${place ? `<div>${ico("pin")}<span>${esc(place)}</span></div>` : ""}${l.teacher ? `<div>${ico("user")}<span>${esc(l.teacher)}</span></div>` : ""}</div>${prog}</div>
      <span class="l-chev">${ico("right")}</span></div>
    <div class="l-detail"><div><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div></div></div>`;
}

function renderSchedule(d) {
  const mon = parseISO(d.monday), now = nowTk(), today = now.iso, days = [];
  for (let i = 0; i < 7; i++) {
    const day = iso(addDays(mon, i));
    days.push({ iso: day, i, lessons: d.lessons.filter((l) => l.date === day).sort((a, b) => toMin(a.start) - toMin(b.start)) });
  }
  if (!S.day || !days.some((x) => x.iso === S.day)) S.day = (days.find((x) => x.iso === today) || days.find((x) => x.lessons.length) || days[0]).iso;
  const label = S.week === 0 ? "Эта неделя" : S.week === 1 ? "Следующая неделя" : S.week === -1 ? "Прошлая неделя" : "Неделя";
  const head = pager({ label, sub: `${dm(d.monday)} – ${dm(d.sunday)}`, prev: S.week > -8, next: S.week < 8, action: "week" });
  const strip = `<div class="days">${days.map((x) => `<button class="day ${x.iso === S.day ? "sel" : ""} ${x.iso === today ? "today" : ""} ${x.lessons.length ? "has" : ""}" data-a="day" data-day="${x.iso}" aria-label="${WD[x.i]}, ${dm(x.iso)}"><span>${WD[x.i]}</span><b>${Number(x.iso.slice(8))}</b><i class="dot"></i></button>`).join("")}</div>`;
  if (!d.published) return head + empty("⏳", "Расписание ещё не опубликовано", "Университет пока не выложил эту неделю.");
  const cur = days.find((x) => x.iso === S.day), lessons = cur.lessons, isToday = cur.iso === today;
  const title = isToday ? "Сегодня" : `${WD[cur.i]}, ${dm(cur.iso)}`;
  if (!lessons.length) return head + strip + `<div class="dayhead off"><b>${title} · пар нет</b></div>` + empty("🎉", "Свободный день", "Можно отдохнуть или заняться делами.");
  const from = Math.min(...lessons.map((l) => toMin(l.start))), to = Math.max(...lessons.map((l) => toMin(l.end)));
  return head + strip + `<div class="dayhead"><b>${title} · ${lessons.length} ${plural(lessons.length, "пара", "пары", "пар")}</b><span class="range">${ico("clock")}${hhmm(from)} – ${hhmm(to)}</span></div>`
    + lessons.map((l) => lessonCard(l, lessonState(l, isToday, now.min))).join("");
}

// ---------------------------------------------------------------- НБ (быстрая прокрутка 8 семестров + чёткий вывод «Нет пропусков»)
const NB_STATUS = { ok: "В норме", warn: "Осторожно", fail: "Лимит превышен", unknown: "Лимит неизвестен" };
const NB_TONE = { ok: "tone-ok", warn: "tone-warn", fail: "tone-bad", unknown: "" };

function renderNb(d) {
  const r = (d && d.report) || {};
  const activeSem = String(S.sem.nb || r.semester || (d && d.semesters && d.semesters.current) || "13");
  S.sem.nb = activeSem;
  let html = semPager(d && d.semesters, activeSem);
  const rows = Array.isArray(r.rows) ? r.rows : [];
  const rowsWithNb = rows.filter((row) => Number(row.hours) > 0 || Number(row.excused_h) > 0 || (row.records && row.records.length > 0));
  const totalH = Number(r.total_hours || 0);
  const excH = Number(r.excused_total || 0);
  html += `<div class="tiles"><div class="tile"><b>${num(totalH)} ч</b><span>Пропущено</span></div><div class="tile"><b>${num(excH)} ч</b><span>Уважительные</span></div><div class="tile"><b>${num(r.limit_pct ?? 25)}%</b><span>Лимит часов</span></div></div>`;
  if (!rowsWithNb.length && totalH === 0 && excH === 0) {
    return html + empty("🎉", "Нет пропусков", "В этом семестре пропусков (НБ) нет.");
  }
  const displayRows = rowsWithNb.length ? rowsWithNb : rows;
  return html + displayRows.map((row, idx) => {
    const key = `nb${activeSem}_${idx}`, open = S.open.has(key), used = row.limit_hours ? Math.min(row.hours / row.limit_hours, 1) : 0;
    const status = NB_STATUS[row.status] ? row.status : "unknown", approx = row.hours_src === "schedule" ? "≈" : "";
    const hours = row.limit_hours ? `<b>${num(row.hours)}</b> / ${approx}${num(row.limit_hours)} ч` : `<b>${num(row.hours)}</b> ч`;
    const left = !row.limit_hours ? "лимит неизвестен" : row.status === "fail" ? "лимит превышен" : `можно ещё <b>${pairsWord(row.left_pairs)}</b>`;
    const records = row.records && row.records.length ? `<div class="records" ${open ? "" : "hidden"}>${row.records.map((a) => `<div><span class="d">${esc(dm(a.date))}</span><span>${esc(a.pair)} пара · ${esc(a.type)}</span><span class="muted" style="margin-left:auto">${num(a.unexcused_h)} ч</span></div>`).join("")}</div>` : "";
    return `<div class="card tap" data-a="toggle" data-key="${key}"><div class="item-top"><div class="name">${esc(row.subject)}</div><span class="pill ${NB_TONE[status]}">${NB_STATUS[status]}</span></div>
      <div class="bar ${status}"><i style="width:${(used * 100).toFixed(0)}%"></i></div><div class="foot"><span>${hours}</span><span>${left}</span></div>${records}</div>`;
  }).join("");
}

// ---------------------------------------------------------------- экзамены
const EXAM_TABS = [["1", "1-е", "промеж."], ["2", "2-е", "промеж."], ["c", "Текущий", "контроль"], ["s", "Сессия", "итоговый"]];

function renderExams(d) {
  const activeSem = String(S.sem.exams || d.semester || "13");
  S.sem.exams = activeSem;
  const today = nowTk().iso, by = { 1: [], 2: [], c: [], s: [] };
  (d.exams || []).forEach((e) => { if (by[e.group]) by[e.group].push(e); });
  if (!S.examTab || !by[S.examTab]) {
    const up = Object.entries(by).map(([k, v]) => [k, v.filter((e) => e.date >= today)]).filter(([, v]) => v.length).map(([k, v]) => [k, v[0].date]);
    S.examTab = up.length ? up.sort((a, b) => a[1].localeCompare(b[1]))[0][0] : ["s", "c", "2", "1"].find((k) => by[k].length) || "s";
  }
  const tabs = EXAM_TABS.map(([k, t, sub]) => [k, t, by[k].length ? `${by[k].length} экз.` : sub]);
  let html = semPager(d.semesters, activeSem)
    + seg(tabs, S.examTab, "examtab");
  const items = by[S.examTab];
  if (!(d.exams && d.exams.length)) return html + empty("🗓", "Расписание экзаменов пока не опубликовано", "Как только оно появится в HEMIS для выбранного семестра, здесь появятся даты.");
  if (!items.length) return html + empty("✨", "В этой вкладке экзаменов нет", "");
  const card = (e) => {
    const day = parseISO(e.date), left = Math.round((day - parseISO(today)) / 864e5);
    const state = left < 0 ? "past" : left === 0 ? "today" : "";
    const when = left < 0 ? ["прошёл", ""] : left === 0 ? ["сегодня", "tone-bad"] : left === 1 ? ["завтра", "tone-warn"] : [`через ${left} дн.`, left <= 3 ? "tone-warn" : ""];
    return `<div class="card exam ${state}"><div class="edate"><b>${day.getUTCDate()}</b><span>${MON[day.getUTCMonth()]}</span></div>
      <div class="grow"><div class="name">${esc(e.subject)}</div>
        <div class="meta-inline"><span>${ico("clock")}${WD[(day.getUTCDay() + 6) % 7]}, ${esc(e.start)}${e.end ? `–${esc(e.end)}` : ""}</span>${e.room ? `<span>${ico("pin")}${esc(e.room)}</span>` : ""}${e.teacher ? `<span>${ico("user")}${esc(e.teacher)}</span>` : ""}</div>
        ${S.examTab === "c" && e.kind ? `<div style="margin-top:7px"><span class="chip">${esc(e.kind)}</span></div>` : ""}</div>
      <span class="chip when ${when[1]}">${when[0]}</span></div>`;
  };
  const main = items.filter((e) => e.sheet === 1), retake = items.filter((e) => e.sheet !== 1);
  html += main.map(card).join("");
  if (retake.length) html += `<div class="section-title">Пересдача · 2-я ведомость</div>` + retake.map(card).join("");
  return html;
}

// ---------------------------------------------------------------- оценки и калькулятор целевых баллов (/api/grade_targets)
const grade5 = (pct) => (pct == null ? null : pct >= 86 ? 5 : pct >= 71 ? 4 : pct >= 55 ? 3 : 2);

function forecast(o) {
  if (!o || o.ball == null || !o.max || !(o.max > 0 && o.max < 100)) return "";
  const left = 100 - o.max, parts = [];
  [[3, 55], [4, 71], [5, 86]].forEach(([g, t]) => { const need = t - o.ball; if (need > 0) parts.push(`«${g}» — ${need <= left ? "ещё " + num(Math.round(need * 10) / 10) : "недостижима"}`); });
  return parts.length ? `🎯 Осталось ${num(left)} б. · до ${parts.join(" · ")}` : "🎯 Высшая оценка уже обеспечена";
}

function buildTargetsFromPerf(p) {
  if (!p || !p.subjects) return [];
  const thresholds = [["3", 55], ["4", 71], ["5", 86]];
  const out = p.subjects.map((s) => {
    const o = s.overall || {};
    const cur = +(o.ball ?? ((s.current?.ball || 0) + (s.mid?.ball || 0)));
    const maxP = +(o.max || ((s.current?.max || 0) + (s.mid?.max || 0)) || 70);
    const rem = Math.max(0, 100 - maxP);
    const targets = {};
    thresholds.forEach(([g, th]) => {
      const need = Math.max(0, Math.round((th - cur) * 10) / 10);
      const reachable = need <= rem || (rem === 0 && cur >= th);
      const reqPct = rem > 0 && need > 0 ? Math.round((need / rem) * 1000) / 10 : (need === 0 ? 0 : null);
      targets[g] = { need_points: need, remaining_pool: rem, reachable, required_pct_of_remaining: reqPct };
    });
    return {
      name: s.name,
      credit: s.credit || 0,
      current_total: Math.round(cur * 10) / 10,
      played_max: Math.round(maxP * 10) / 10,
      remaining_pool: Math.round(rem * 10) / 10,
      targets,
    };
  });
  out.sort((a, b) => (b.credit - a.credit) || (b.targets["4"].need_points - a.targets["4"].need_points));
  return out;
}

function renderGrades(d) {
  const p = d.perf || { subjects: [], credits: 0 };
  const activeSem = String(S.sem.grades || p.semester || "13");
  S.sem.grades = activeSem;
  let html = semPager(d.semesters, activeSem);
  html += `<div class="tiles four"><div class="tile"><b>${p.gpa_calc ?? "—"}</b><span>GPA</span></div><div class="tile"><b>${p.avg_pct != null ? num(p.avg_pct) + "%" : "—"}</b><span>Средний</span></div><div class="tile"><b>${p.credits}</b><span>Кредитов</span></div><div class="tile"><b>${p.subjects.length}</b><span>Предметов</span></div></div>`;
  html += seg([["overview", "📊 Баллы и GPA", "текущие"], ["targets", "🎯 Цели на сессию", "калькулятор"]], S.gradeMode, "grademode");

  if (!p.subjects.length) return html + empty("🎓", "Предметов пока нет", "");

  if (S.gradeMode === "targets") {
    const tList = (d.targets && d.targets.subjects) ? d.targets.subjects : buildTargetsFromPerf(p);
    html += seg([["5", "На «5»", "86+ баллов"], ["4", "На «4»", "71+ балл"], ["3", "На «3»", "55+ баллов"]], S.goalGrade, "goalgrade");
    return html + tList.map((s) => {
      const gGoal = s.targets[S.goalGrade] || s.targets["5"];
      const badgeTone = gGoal.need_points <= 0 ? "tone-ok" : !gGoal.reachable ? "tone-bad" : gGoal.required_pct_of_remaining > 80 ? "tone-warn" : "tone-brand";
      const badgeTxt = gGoal.need_points <= 0 ? "Уже закрыто ✅" : !gGoal.reachable ? "Недостижимо" : `Нужно +${num(gGoal.need_points)} б.`;
      return `<div class="card">
        <div class="item-top">
          <div class="grow">
            <div class="name">${esc(s.name)}</div>
            <div class="muted small" style="margin-top:2px">Вес: <b>${s.credit} кр.</b> · Набрано <b>${num(s.current_total)}</b> из ${num(s.played_max)} б. (в розыгрыше ${num(s.remaining_pool)} б.)</div>
          </div>
          <span class="pill ${badgeTone}">${badgeTxt}</span>
        </div>
        <div class="target-grid">
          ${["3", "4", "5"].map((g) => {
            const t = s.targets[g];
            const val = t.need_points <= 0 ? "✅ Есть" : !t.reachable ? "⛔ Нет" : `+${num(t.need_points)} б.`;
            const sub = t.need_points <= 0 ? "гарантировано" : !t.reachable ? `макс +${num(s.remaining_pool)}` : `${num(t.required_pct_of_remaining)}% от остатка`;
            return `<div class="target-box ${S.goalGrade === g ? "active-goal" : ""}">
              <small>Оценка «${g}»</small>
              <b>${val}</b>
              <span>${sub}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }).join("");
  }

  return html + p.subjects.map((s) => {
    const o = s.overall, has = o && o.ball != null && o.ball !== 0, g = s.grade5 || (has ? grade5(o.pct) : null);
    const parts = [["Текущий", s.current], ["Промежуточный", s.mid], ["Итоговый", s.final], ...(s.extra || []).map((x) => [x.name, x])].filter(([, v]) => v && v.ball != null);
    return `<div class="card grade ${g ? "g" + g : ""}"><div class="row" style="gap:14px">
        <div class="ring" style="--p:${has ? Math.min(o.pct || 0, 100) : 0}"><b>${has ? num(o.pct) + "%" : "—"}</b></div>
        <div class="grow"><div class="name">${esc(s.name)}</div><div class="muted small">${s.credit} кр.${has ? ` · ${num(o.ball)} / ${num(o.max)} б.` : " · учебный план семестра"}</div></div>
        ${g ? `<div class="gbadge">${g}</div>` : ""}</div>
      ${parts.length ? `<div class="parts">${parts.map(([n, v]) => `<div class="part"><div class="ptop"><b>${esc(n)}</b><span>${num(v.ball)}${v.max ? ` / ${num(v.max)}` : ""}</span></div><div class="pb"><i style="width:${Math.min(v.pct ?? (v.max ? (v.ball / v.max) * 100 : 0), 100)}%"></i></div></div>`).join("")}</div>` : ""}
      ${forecast(o) ? `<div class="forecast">${forecast(o)}</div>` : ""}</div>`;
  }).join("");
}

function renderSubjects(d) {
  const p = d.perf || { subjects: [], credits: 0 };
  const activeSem = String(S.sem.subjects || p.semester || "13");
  S.sem.subjects = activeSem;
  const html = semPager(d.semesters, activeSem);
  if (!p.subjects.length) return html + empty("📚", "Предметов пока нет", "");
  const total = p.subjects.reduce((a, s) => a + (s.load || 0), 0);
  return html + `<div class="tiles"><div class="tile"><b>${p.subjects.length}</b><span>Предметов</span></div><div class="tile"><b>${p.credits}</b><span>Кредитов</span></div><div class="tile"><b>${total || "—"}</b><span>Часов</span></div></div>`
    + p.subjects.map((s) => `<div class="card"><div class="name">${esc(s.name)}</div><div class="chips" style="margin-top:8px"><span class="chip tone-brand">${s.credit} кр.</span>${s.load ? `<span class="chip">${s.load} ч</span>` : ""}${s.kind ? `<span class="chip">${esc(s.kind)}</span>` : ""}</div></div>`).join("");
}

// ---------------------------------------------------------------- Экран Биометрии + PIN-код (лаконичный, без дублирующей кнопки отпечатка)
function renderVaultGate() {
  const title = S.pinSetupMode ? "Новый 4-значный PIN-код" : "Доступ к разделу финансы";
  const sub = S.pinSetupMode ? "Введите 4 цифры" : "Подтвердите вход";

  const dots = [0, 1, 2, 3].map((i) => {
    const filled = i < S.pinBuffer.length ? "filled" : "";
    const err = S.pinError ? "err" : "";
    return `<span class="pin-dot ${filled} ${err}"></span>`;
  }).join("");

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return `<div class="card vault-wrap">
    <button class="bio-orb ${S.bioScanning ? "scanning" : ""}" data-a="bioauth" aria-label="Войти по отпечатку пальца">
      ${ico("fingerprint")}
    </button>
    <b style="font-size:18px">${esc(title)}</b>
    <p class="muted small" style="margin:4px 0 0">${esc(sub)}</p>
    <div class="pin-dots ${S.pinError ? "shake" : ""}">${dots}</div>
    <div class="numpad">
      ${keys.map((k) => `<button class="num-key" data-a="pinkey" data-digit="${k}">${k}</button>`).join("")}
      <button class="num-key bio-key" data-a="bioauth" aria-label="Биометрия">${ico("fingerprint")}</button>
      <button class="num-key" data-a="pinkey" data-digit="0">0</button>
      <button class="num-key" data-a="pinback" aria-label="Стереть">${ico("backspace")}</button>
    </div>
    ${S.pinSetupMode ? `<div style="margin-top:16px"><button class="btn ghost sm" data-a="pincancel">Отмена</button></div>` : ""}
  </div>`;
}

const CAT_ICONS = {
  "продукты": "🛒", "еда": "🍽", "транспорт": "🚕", "связь": "📱", "покупки": "🛍", "развлечения": "🎮",
  "здоровье": "💊", "жильё": "🏠", "учёба": "📚", "подписки": "🔁", "подарки": "🎁", "другое": "📦",
  "стипендия": "🎓", "родители": "👪", "зарплата": "💼", "подработка": "🧑‍💻", "подарок": "🎁", "возврат": "↩️",
  "начальный остаток": "🏁", "сверка": "⚖️",
};
const CAT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899"];
const EXP_CATS = ["продукты", "еда", "транспорт", "покупки", "учёба", "связь", "подписки", "развлечения", "здоровье", "другое"];
const INC_CATS = ["стипендия", "родители", "подработка", "зарплата", "подарок", "возврат", "другое"];

const fmtMoney = (val) => (S.hideBalances ? "••••••" : money(val));

function renderMoney(d) {
  if (!S.moneyUnlocked || S.pinSetupMode) return renderVaultGate();
  if (!d || !d.balances) return empty("💸", "Финансы загружаются", "");
  const accounts = d.balances.accounts || [];
  const summary = d.summary || {};
  const debts = d.debts || [];
  const subs = d.subscriptions || [];
  const recent = d.recent || [];

  let html = `<div class="acc-grid">
    ${accounts.map((a, idx) => `<div class="acc-card ${idx === 0 ? "card-bank" : "card-cash"}">
      <div class="acc-head">
        <span>${esc(a.icon || "💳")} ${esc(a.name)}</span>
        <span class="tiny">${idx === 0 ? "UZCARD / HUMO" : "CASH UZS"}</span>
      </div>
      <div class="acc-val">${fmtMoney(a.balance)} <span class="tiny" style="font-weight:500;opacity:0.8">сум</span></div>
    </div>`).join("")}
  </div>`;

  html += `<div class="card hero-card">
    <div class="between">
      <div>
        <div class="row" style="gap:6px">
          <span class="muted small">Общий капитал</span>
          <button class="chip" data-a="hidebal" title="Скрыть или показать суммы">${ico(S.hideBalances ? "eyeOff" : "eye")}</button>
          <button class="chip" data-a="pinsetup" title="Сменить PIN-код" aria-label="Сменить PIN-код">🔑</button>
          <button class="chip tone-warn" data-a="lockmoney" title="Заблокировать Финансы">${ico("lock")}</button>
        </div>
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em;margin-top:4px">${fmtMoney(d.balances.total)} <span class="small muted">сум</span></div>
      </div>
      <button class="btn sm" data-a="toggleform">${ico("plus")}${S.txFormOpen ? "Скрыть" : "Записать"}</button>
    </div>
    ${S.txFormOpen ? renderTxForm() : ""}
  </div>`;

  html += seg([["today", "Сегодня"], ["week", "7 дней"], ["month", "Месяц"], ["year", "Год"]], S.moneyPeriod, "mperiod");

  html += `<div class="burn-strip">
    <div class="tile"><b style="color:var(--bad)">−${fmtMoney(summary.expense || 0)}</b><span>Расходы</span></div>
    <div class="tile"><b style="color:var(--ok)">+${fmtMoney(summary.income || 0)}</b><span>Доходы</span></div>
    <div class="tile"><b>${summary.safe_daily ? fmtMoney(summary.safe_daily) : fmtMoney(summary.per_day || 0)}</b><span>${summary.safe_daily ? "Лимит/день" : "Темп/день"}</span></div>
  </div>`;

  if (summary.projected_month && S.moneyPeriod === "month") {
    html += `<div class="card" style="padding:10px 14px">
      <div class="between small">
        <span class="muted">🔥 Прогноз к концу месяца (Burn-Rate):</span>
        <b>~${fmtMoney(summary.projected_month)} сум</b>
      </div>
    </div>`;
  }

  html += seg([
    ["ops", "Операции", `${recent.length}`],
    ["cats", "Категории", `${(summary.expense_by_category || []).length}`],
    ["debts", "Долги", `${debts.length}`],
    ["subs", "Подписки", `${subs.length}`],
  ], S.moneyTab, "mtab");

  if (S.moneyTab === "cats") {
    const cats = summary.expense_by_category || [];
    const totalExp = Math.max(1, +(summary.expense || 0));
    if (!cats.length) return html + empty("📊", "За этот период трат нет", "Добавьте расход кнопкой «Записать» выше.");
    const stack = `<div class="stack-bar">${cats.slice(0, 6).map((c, i) => `<i style="width:${Math.max(3, (c[1] / totalExp) * 100).toFixed(1)}%;background:${CAT_COLORS[i % CAT_COLORS.length]}"></i>`).join("")}</div>`;
    return html + `<div class="card">${stack}${cats.map((c, i) => {
      const catName = c[0], amt = c[1], cnt = c[2], pct = Math.round((amt / totalExp) * 100);
      return `<div style="margin-top:11px">
        <div class="between small">
          <span>${CAT_ICONS[catName] || "📦"} <b>${esc(catName)}</b> <span class="muted">(${cnt} шт.)</span></span>
          <span><b>${fmtMoney(amt)}</b> сум · <span class="muted">${pct}%</span></span>
        </div>
        <div class="bar" style="margin:6px 0 0;height:6px"><i style="width:${pct}%;background:${CAT_COLORS[i % CAT_COLORS.length]}"></i></div>
      </div>`;
    }).join("")}</div>`;
  }

  if (S.moneyTab === "debts") {
    if (!debts.length) return html + empty("🤝", "Активных долгов нет", "Никто никому не должен. В чате можно написать: «одолжил Алишеру 100к».");
    return html + debts.map((db) => {
      const isGiven = db.direction === "given";
      return `<div class="card">
        <div class="between">
          <div>
            <span class="pill ${isGiven ? "tone-ok" : "tone-bad"}">${isGiven ? "Мне должны" : "Я должен"}</span>
            <div class="name" style="margin-top:6px">${esc(db.person)}</div>
            ${db.description ? `<div class="muted small">${esc(db.description)}</div>` : ""}
          </div>
          <div style="text-align:right">
            <b style="font-size:17px">${fmtMoney(db.amount)} сум</b>
            ${db.due_date ? `<div class="muted tiny">до ${esc(db.due_date)}</div>` : ""}
          </div>
        </div>
      </div>`;
    }).join("");
  }

  if (S.moneyTab === "subs") {
    if (!subs.length) return html + empty("🔁", "Подписок пока нет", "Регулярные списания (интернет, связь, сервисы) появятся здесь.");
    return html + subs.map((s) => `<div class="card">
      <div class="between">
        <div>
          <div class="name">${esc(s.title)}</div>
          <div class="muted small">Каждое <b>${s.billing_day}</b>-е число · ${esc(s.category)}</div>
        </div>
        <div style="text-align:right">
          <b>${fmtMoney(s.amount)} ${esc(s.currency)}</b>
          <div style="margin-top:6px">
            <button class="btn tonal sm" data-a="subpay" data-title="${esc(s.title)}" data-amount="${s.amount}" data-cur="${esc(s.currency)}" data-cat="${esc(s.category)}">Списать</button>
          </div>
        </div>
      </div>
    </div>`).join("");
  }

  if (!recent.length) return html + empty("🧾", "Операций пока нет", "Нажмите «Записать», чтобы внести первую трату или доход.");
  return html + `<div class="card">${recent.map((tx) => {
    const isInc = tx.kind === "income" || tx.kind === "opening";
    const isTr = tx.kind === "transfer";
    const sign = isInc ? "+" : isTr ? "⇄ " : "−";
    const icoChar = isTr ? "🔁" : (CAT_ICONS[tx.category] || "💳");
    const title = tx.description || tx.category || (isTr ? `${tx.account} → ${tx.to_account}` : "Операция");
    const sub = `${tx.category ? tx.category + " · " : ""}${tx.account || "карта"} · ${dm(tx.created_at)}`;
    return `<div class="tx-row">
      <div class="tx-ico">${icoChar}</div>
      <div class="grow">
        <div class="name" style="font-size:14.5px">${esc(title)}</div>
        <div class="muted tiny">${esc(sub)}</div>
      </div>
      <div class="tx-amt ${isInc ? "inc" : "exp"}">${sign}${fmtMoney(tx.amount)}</div>
    </div>`;
  }).join("")}</div>`;
}

function renderTxForm() {
  const cats = S.txKind === "income" ? INC_CATS : EXP_CATS;
  return `<div class="detail tx-form">
    ${seg([["expense", "➖ Расход"], ["income", "➕ Доход"], ["transfer", "🔁 Перевод"]], S.txKind, "txkind")}
    <div class="form-row">
      <input class="inp" id="txAmount" type="number" inputmode="decimal" placeholder="Сумма (напр. 45000)" min="1">
      <select class="sel" id="txCurrency" aria-label="Валюта">
        <option value="UZS">UZS</option>
        <option value="USD">USD ($)</option>
        <option value="EUR">EUR (€)</option>
        <option value="RUB">RUB (₽)</option>
      </select>
    </div>
    <div class="form-row">
      <select class="sel" id="txCategory" aria-label="Категория" ${S.txKind === "transfer" ? "disabled" : ""}>
        ${cats.map((c) => `<option value="${esc(c)}">${CAT_ICONS[c] || "📦"} ${esc(c)}</option>`).join("")}
      </select>
      <select class="sel" id="txAccount" aria-label="Счёт">
        <option value="карта">💳 Карта</option>
        <option value="наличные">💵 Нал</option>
      </select>
    </div>
    <input class="inp" id="txDesc" type="text" placeholder="${S.txKind === "transfer" ? "Перевод на второй счёт" : "Описание (напр. Корзинка, кофе)"}">
    <button class="btn ok block" data-a="txsubmit">${ico("check")}Сохранить операцию</button>
  </div>`;
}

// ---------------------------------------------------------------- «Ещё» и подразделы
const MENU = [
  ["exams", "Экзамены и Контроли", "Расписание 1-ON, 2-ON и сессии по 8 семестрам", "exam", "brand"],
  ["tasks", "Задания и Дедлайны", "Условия, оценки и отправка файлов в чат", "tasks", "violet"],
  ["resources", "Учебные ресурсы", "Лекции и презентации по предметам", "book", "ok"],
  ["subjects", "Предметы семестра", "Кредиты и аудиторная нагрузка (1–8 семестр)", "layers", "brand"],
  ["contract", "Контракт на обучение", "Оплата, остаток и ежемесячный план", "wallet", "warn"],
  ["settings", "Уведомления", "Две ветви: Бот и HEMIS · время и частота", "bell", "bad"],
];

function renderMore() {
  return `<div class="card menu">${MENU.map(([id, t, sub, icon, tone]) => `<button class="menu-item" data-a="open" data-sub="${id}"><span class="menu-ico tone-${tone}">${ico(icon)}</span><span class="grow"><b>${t}</b><span class="muted small">${sub}</span></span><span class="chev">${ico("right")}</span></button>`).join("")}</div>
    <p class="muted small" style="text-align:center;margin:8px 0 0">Данные кэшируются на устройстве — приложение открывается мгновенно.<br>Кнопка ⟳ в шапке обновляет активный раздел.</p>`;
}

// ---------- задания
function minutesLeft(deadline) {
  if (!deadline) return null;
  const now = nowTk(), dayDiff = Math.round((parseISO(deadline.slice(0, 10)) - parseISO(now.iso)) / 864e5);
  return dayDiff * 1440 + toMin(deadline.slice(11)) - now.min;
}
function leftLabel(m) {
  const a = Math.abs(m), t = a < 60 ? `${a} мин` : a < 2880 ? `${Math.floor(a / 60)} ч` : `${Math.floor(a / 1440)} дн.`;
  return m < 0 ? `просрочено на ${t}` : `осталось ${t}`;
}
const taskGroup = (t) => (t.graded ? "graded" : t.overdue ? "overdue" : "active");

function renderTasks(d) {
  const activeSem = String(S.sem.tasks || d.semester || "13");
  S.sem.tasks = activeSem;
  const allTasks = d.tasks || [];
  const groups = { active: [], overdue: [], graded: [], all: allTasks };
  allTasks.forEach((t) => groups[taskGroup(t)].push(t));
  const tabs = [["active", "Активные"], ["overdue", "Просрочено"], ["graded", "Оценено"], ["all", "Все"]].map(([k, t]) => [k, t, groups[k].length]);
  let html = semPager(d.semesters, activeSem) + seg(tabs, S.taskTab, "tasktab");
  const list = groups[S.taskTab];
  if (!list.length) return html + empty(S.taskTab === "active" ? "🎉" : "✨", S.taskTab === "active" ? "Активных заданий нет" : "Здесь пусто", "");
  return html + list.map((t) => {
    const key = `t${t.id}`, open = S.open.has(key), m = t.graded ? null : minutesLeft(t.deadline);
    const badge = t.graded ? `<span class="pill tone-ok">${num(t.mark)}${t.max_ball ? ` / ${num(t.max_ball)}` : ""}</span>`
      : t.sent_at ? '<span class="pill tone-violet">Отправлено</span>'
      : m != null ? `<span class="pill ${m < 0 ? "tone-bad" : m < 2880 ? "tone-warn" : ""}">${leftLabel(m)}</span>` : "";
    const detail = `<div class="detail" ${open ? "" : "hidden"}>
      ${t.description ? `<p>${esc(t.description)}</p>` : ""}
      ${t.teacher_comment ? `<p class="muted"><b>Комментарий преподавателя:</b> ${esc(t.teacher_comment)}</p>` : ""}
      ${t.teacher ? `<div class="meta-inline"><span>${ico("user")}${esc(t.teacher)}</span><span>Попытки: ${esc(t.attempts)}</span></div>` : ""}
      ${fileList(t.files)}
      <button class="btn tonal block" data-a="send" data-type="task" data-id="${esc(t.id)}">${ico("send")}Открыть карточку и ИИ-разбор в боте</button>
    </div>`;
    return `<div class="card tap" data-a="toggle" data-key="${key}"><div class="item-top"><div class="grow"><div class="name">${esc(t.title)}</div><div class="muted small" style="margin-top:2px">${esc(t.subject)}${t.lesson_type ? " · " + esc(t.lesson_type) : ""}</div></div>${badge}</div>
      ${t.deadline ? `<div class="meta-inline"><span>${ico("clock")}до ${esc(dm(t.deadline))} ${esc(t.deadline.slice(11))}</span></div>` : ""}${detail}</div>`;
  }).join("");
}

// ---------- ресурсы
function renderResources(d) {
  const activeSem = String(S.sem.resources || d.semester || "13");
  S.sem.resources = activeSem;
  if (!S.res.subject) {
    const html = semPager(d.semesters, activeSem);
    const list = (d.subjects || []).filter((x) => x.resources);
    if (!list.length) return html + empty("📖", "Материалов пока нет", "Преподаватели ещё не загрузили ресурсы в этом семестре.");
    return html + list.map((x) => `<button class="card tap row" style="width:100%" data-a="subject" data-id="${esc(x.id)}" data-name="${esc(x.name)}"><span class="menu-ico tone-violet">${ico("book")}</span>
      <span class="grow"><span class="name" style="display:block">${esc(x.name)}</span><span class="muted small">${x.resources} ${plural(x.resources, "материал", "материала", "материалов")}</span></span><span class="muted">${ico("right")}</span></button>`).join("");
  }
  if (!d.resources || !d.resources.length) return empty("✨", "Материалов нет", "");
  const kinds = [...new Set(d.resources.map((r) => r.kind).filter(Boolean))];
  const rank = (k) => (/лек/i.test(k) ? 0 : /практ|семин/i.test(k) ? 1 : 2);
  kinds.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ru"));
  if (S.resKind !== "all" && !kinds.includes(S.resKind)) S.resKind = "all";
  const count = (k) => d.resources.filter((r) => r.kind === k).length;
  const tabs = kinds.length > 1 ? seg([["all", "Все", `${d.resources.length} шт.`], ...kinds.map((k) => [k, k, `${count(k)} шт.`])], S.resKind, "reskind") : "";
  const shown = S.resKind === "all" ? d.resources : d.resources.filter((r) => r.kind === S.resKind);
  return tabs + `<div class="dayhead off"><b>${shown.length} ${plural(shown.length, "тема", "темы", "тем")}</b><span class="muted small">нажмите на тему</span></div>` + shown.map((r) => {
    const key = `r${r.id}`, open = S.open.has(key);
    const items = r.items.map((i) => `${i.url ? `<div class="file">${ico("link")}<span><a class="link" data-a="link" data-url="${esc(i.url)}">${esc(i.comment || i.type || i.url)}</a></span></div>` : ""}${fileList(i.files)}`).join("");
    return `<div class="card tap" data-a="toggle" data-key="${key}"><div class="item-top"><div class="name">${esc(r.title)}</div>${r.files_count ? `<span class="pill">${ico("file")}${r.files_count}</span>` : ""}</div>
      <div class="chips" style="margin-top:7px">${r.kind ? `<span class="chip ${r.kind.toLowerCase().includes("лек") ? "tag-lec" : "tag-prac"}">${esc(r.kind)}</span>` : ""}${(r.languages || []).map((l) => `<span class="chip">${esc(l)}</span>`).join("")}</div>
      <div class="detail" ${open ? "" : "hidden"}>${r.teacher ? `<div class="meta-inline"><span>${ico("user")}${esc(r.teacher)}</span></div>` : ""}${r.comment && r.comment.length > 3 ? `<p>${esc(r.comment)}</p>` : ""}${items}
        ${r.files_count ? `<button class="btn tonal block" data-a="send" data-type="resource" data-id="${esc(r.id)}" data-subject="${esc(S.res.subject)}" data-semester="${esc(activeSem)}">${ico("send")}Прислать файлы и конспект в чат</button>` : ""}</div></div>`;
  }).join("");
}

// ---------- контракт
function renderContract(c) {
  const pct = c.paid_pct != null ? Math.min(c.paid_pct, 100) : null;
  const info = [["Специальность", c.speciality], ["Курс", c.course], ["Форма обучения", c.form], ["Учебный год", c.year], ["GPA в HEMIS", c.gpa]].filter(([, v]) => v != null && v !== "");
  const monthsLeft = 7;
  const monthlyRec = c.remaining > 0 ? Math.round(c.remaining / monthsLeft) : 0;
  return `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><b>Оплата контракта</b><span class="pill ${c.remaining > 0 ? "tone-warn" : "tone-ok"}">${c.remaining > 0 ? "есть остаток" : "оплачено"}</span></div>
      <div class="bigbar"><i style="width:${pct ?? 0}%"></i></div>
      <div class="foot" style="margin-top:8px">
        <span>${pct != null ? `Оплачено ${num(pct)}%` : ""}</span>
        ${monthlyRec > 0 ? `<span>План: <b>${money(monthlyRec)}</b> сум/мес.</span>` : ""}
      </div></div>
    <div class="money"><div class="tile"><b>${money(c.total)}</b><span>Всего</span></div><div class="tile"><b>${money(c.paid)}</b><span>Оплачено</span></div><div class="tile"><b>${money(c.remaining)}</b><span>Остаток</span></div></div>
    ${c.remaining > 0 ? `<div class="row" style="gap:8px">
      <button class="btn grow" data-a="copy" data-text="${Math.round(c.remaining)}">${ico("copy")}Скопировать остаток</button>
      <button class="btn tonal grow" data-a="contractpay" data-amount="${monthlyRec}">💸 Записать 1 мес.</button>
    </div>` : ""}
    ${info.length ? `<div class="card">${info.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>`).join("")}</div>` : ""}`;
}

// ---------- Двухветвевые настройки уведомлений («Бот» и «HEMIS»)
const BOT_TOGGLE_META = [
  ["bot_briefing_on", "Утренний ИИ-брифинг Джарвиса", "План дня, задачи, погода и приоритеты"],
  ["bot_finance_on", "Финансовый дайджест и Burn-Rate", "Вечерний отчёт по расходам и остатку дневного лимита"],
  ["bot_subs_on", "Подписки и возврат долгов", "Напоминания за день до списания или даты долга"],
  ["bot_reminders_on", "Умные напоминания и таймеры", "Персональные поручения, созданные в диалоге с ботом"],
  ["bot_memory_on", "Еженедельный обзор целей", "Воскресная сводка прогресса и заметок памяти"],
];

const HEMIS_TOGGLE_META = [
  ["morning_on", "Утренняя сводка расписания", "Список пар, корпусов и аудиторий на сегодня"],
  ["lesson_alert_on", "Напоминание перед началом пары", "Пуш с номером аудитории за выбранное время до звонка"],
  ["prep_on", "Подготовка к семинарам и практикам", "Вечернее напоминание о завтрашних практических занятиях"],
  ["changes_on", "Изменения в расписании", "Мгновенно при переносе пары или смене кабинета"],
  ["nb_on", "Новые пропуски (НБ)", "Уведомление при появлении НБ и расчёт остатка до 25%"],
  ["grades_on", "Новые оценки и баллы", "Оповещение при выставлении текущих, ОН и итоговых баллов"],
  ["tasks_on", "Новые задания от преподавателей", "Когда в HEMIS загружено новое задание или файл"],
  ["deadlines_on", "Приближающиеся дедлайны", "Контроль сроков сдачи самостоятельных работ"],
  ["exams_on", "Экзамены и ведомости", "Новые даты сессии и напоминания перед экзаменом"],
];

function renderFreqRow(title, sub, prefKey, curVal, options) {
  return `<div class="notif-row">
    <div class="notif-head">
      <div><b>${esc(title)}</b>${sub ? `<span class="setting-sub">${esc(sub)}</span>` : ""}</div>
    </div>
    <div class="freq-pills">
      ${options.map(([val, label]) => `<button class="freq-pill ${curVal === val ? "on" : ""}" data-a="notiffreq" data-key="${esc(prefKey)}" data-val="${esc(val)}">${esc(label)}</button>`).join("")}
    </div>
  </div>`;
}

function renderTimeRow(title, sub, prefKey, curVal, presets) {
  return `<div class="notif-row">
    <div class="notif-head">
      <div><b>${esc(title)}</b>${sub ? `<span class="setting-sub">${esc(sub)}</span>` : ""}</div>
      <input type="time" class="time-inp" value="${esc(curVal)}" data-a="notiftime" data-key="${esc(prefKey)}" aria-label="${esc(title)}">
    </div>
    <div class="freq-pills">
      ${presets.map((t) => `<button class="freq-pill ${curVal === t ? "on" : ""}" data-a="notiffreq" data-key="${esc(prefKey)}" data-val="${esc(t)}">${esc(t)}</button>`).join("")}
    </div>
  </div>`;
}

function renderSettings(d) {
  const prefs = getNotifPrefs(d && d.prefs);
  const toggleMap = {};
  ((d && d.toggles) || []).forEach((t) => { toggleMap[t.key] = Boolean(t.on); });

  const isOn = (key) => (key in toggleMap ? toggleMap[key] : true);

  const branchTabs = seg([
    ["bot", "🤖 Уведомления Бота", "ИИ, финансы, задачи"],
    ["hemis", "🎓 Уведомления HEMIS", "пары, оценки, НБ"],
  ], S.notifBranch, "notifbranch");

  if (S.notifBranch === "bot") {
    const timeAndFreqCard = `<div class="section-title">⏰ Время и частота · Ветвь «Бот»</div>
      <div class="card notif-block">
        ${renderTimeRow("Утренний ИИ-брифинг", "Сводка задач, планов и курса валют утром", "bot_morning_time", prefs.bot_morning_time, ["07:00", "07:30", "08:00", "09:00"])}
        ${renderTimeRow("Вечерний финансовый отчёт", "Итоги расходов за день и прогноз Burn-Rate", "bot_evening_time", prefs.bot_evening_time, ["20:00", "21:00", "22:00", "23:00"])}
        ${renderFreqRow("Частота ИИ-дайджестов и проверок", "Как часто бот присылает сводки по задачам и памяти", "bot_digest_freq", prefs.bot_digest_freq, [
          ["realtime", "Мгновенно"],
          ["3h", "Каждые 3 ч"],
          ["2x_day", "2 раза в день"],
          ["daily", "Раз в день"],
        ])}
        ${renderFreqRow("Частота финансовых оповещений", "Режим уведомлений о лимите и тратах", "bot_fin_freq", prefs.bot_fin_freq, [
          ["every_tx", "После каждой траты"],
          ["daily", "Вечерний отчёт"],
          ["weekly", "Раз в неделю"],
        ])}
        ${renderFreqRow("Тихий час (Не беспокоить)", "Интервал без звуковых уведомлений ночью по Ташкенту", "bot_quiet_hours", prefs.bot_quiet_hours, [
          ["23:30-05:50", "23:30 – 05:50"],
          ["00:00-06:00", "00:00 – 06:00"],
          ["off", "Без ограничений"],
        ])}
      </div>`;

    const togglesCard = `<div class="section-title">🔔 Категории оповещений · Бот</div>
      <div class="card menu">
        ${BOT_TOGGLE_META.map(([key, label, sub]) => `<button class="setting" data-a="setting" data-key="${esc(key)}">
          <span class="grow"><b>${esc(label)}</b><span class="setting-sub">${esc(sub)}</span></span>
          <span class="switch ${isOn(key) ? "on" : ""}"></span>
        </button>`).join("")}
      </div>`;

    return branchTabs + timeAndFreqCard + togglesCard;
  }

  // Ветвь «HEMIS»
  const warn = d && d.auth_failed ? `<div class="card notice"><span class="menu-ico tone-bad">${ico("bell")}</span><div><b>HEMIS не принял пароль</b><div class="muted small">Введите его заново в боте: Меню → HEMIS → «Войти».</div></div></div>` : "";
  const last = d && d.last_ok_at ? `<p class="muted small" style="text-align:center;margin:4px 0 0">Последняя синхронизация с HEMIS: ${esc(String(d.last_ok_at).replace("T", " ").slice(0, 16))}</p>` : "";

  const hemisTimeAndFreqCard = `<div class="section-title">⏰ Время и частота · Ветвь «HEMIS»</div>
    <div class="card notif-block">
      ${renderFreqRow("Опрос HEMIS по расписанию (Ташкент)", "Стучимся в HEMIS каждые 20 минут только в промежутке 05:40 – 23:00", "hemis_poll_freq", prefs.hemis_poll_freq, [
        ["20m_540_2300", "Каждые 20 мин (05:40 – 23:00)"],
        ["15m", "Каждые 15 мин"],
        ["30m", "Каждые 30 мин"],
        ["1h", "Каждый час"],
      ])}
      ${renderTimeRow("Время утренней сводки пар", "Во сколько присылать расписание занятий на день", "hemis_morning_time", prefs.hemis_morning_time, ["06:45", "07:15", "07:30", "08:00"])}
      ${renderTimeRow("Время напоминания о семинарах", "Вечерняя проверка практик и семинаров на завтра", "hemis_prep_time", prefs.hemis_prep_time, ["18:00", "19:00", "20:00", "21:00"])}
      ${renderFreqRow("Уведомление перед началом пары", "За сколько минут до звонка напоминать об аудитории", "hemis_before_min", prefs.hemis_before_min, [
        ["5", "За 5 мин"],
        ["10", "За 10 мин"],
        ["15", "За 15 мин"],
        ["30", "За 30 мин"],
      ])}
      ${renderFreqRow("Частота напоминаний о дедлайнах", "График предупреждений о сроках сдачи и экзаменах", "hemis_deadline_freq", prefs.hemis_deadline_freq, [
        ["intensive", "За 7, 3, 1 дн. и 3 ч"],
        ["standard", "За 3 и 1 день"],
        ["minimal", "Только за 24 ч"],
      ])}
    </div>`;

  const hemisTogglesCard = `<div class="section-title">🔔 Категории оповещений · HEMIS</div>
    <div class="card menu">
      ${HEMIS_TOGGLE_META.map(([key, label, sub]) => `<button class="setting" data-a="setting" data-key="${esc(key)}">
        <span class="grow"><b>${esc(label)}</b><span class="setting-sub">${esc(sub)}</span></span>
        <span class="switch ${isOn(key) ? "on" : ""}"></span>
      </button>`).join("")}
    </div>`;

  return branchTabs + warn + hemisTimeAndFreqCard + hemisTogglesCard + last;
}

// ---------------------------------------------------------------- заголовки и ошибки
function heroFor(id, d) {
  switch (id) {
    case "schedule": return ["Расписание", d ? `${dm(d.monday)} – ${dm(d.sunday)}` : ""];
    case "nb": {
      const sCode = S.sem.nb || (d && d.report && d.report.semester) || "13";
      return ["Пропуски (НБ)", `${semNo(sCode)}-й семестр · лимит ${d && d.report ? num(d.report.limit_pct) : 25}%`];
    }
    case "exams": {
      const sCode = S.sem.exams || (d && d.semester) || "13";
      return ["Экзамены", d ? `${semNo(sCode)}-й семестр · ${d.exams.length} ${plural(d.exams.length, "экзамен", "экзамена", "экзаменов")}` : `${semNo(sCode)}-й семестр`];
    }
    case "grades": {
      const sCode = S.sem.grades || (d && d.perf && d.perf.semester) || "13";
      return [S.gradeMode === "targets" ? "Цели на сессию" : "Оценки и GPA", `${semNo(sCode)}-й семестр${d && d.perf && d.perf.period ? " · " + d.perf.period : ""}`];
    }
    case "money":
      if (!S.moneyUnlocked) return ["Финансы", "Подтвердите вход"];
      return ["Финансы", d && d.summary ? `Расходы ${d.summary.title || "за период"}: ${fmtMoney(d.summary.expense)} сум` : "Счета, бюджет и Burn-Rate"];
    case "subjects": {
      const sCode = S.sem.subjects || (d && d.perf && d.perf.semester) || "13";
      return ["Предметы", `${semNo(sCode)}-й семестр (из 8)`];
    }
    case "tasks": {
      const sCode = S.sem.tasks || (d && d.semester) || "13";
      return ["Задания", d ? `${semNo(sCode)}-й семестр · ${d.count} ${plural(d.count, "задание", "задания", "заданий")}` : `${semNo(sCode)}-й семестр`];
    }
    case "resources": {
      const sCode = S.sem.resources || (d && d.semester) || "13";
      return S.res.subject ? [S.res.name || "Ресурсы", "Материалы предмета"] : ["Ресурсы", `${semNo(sCode)}-й семестр`];
    }
    case "contract": return ["Контракт", "Оплата и расчёт по месяцам"];
    case "settings": return ["Уведомления", S.notifBranch === "bot" ? "Ветвь «Бот Джарвис» · время и частота" : "Ветвь «HEMIS» · 05:40–23:00 каждые 20 мин"];
    default: return ["Ещё", "Разделы HEMIS и инструменты"];
  }
}
const RENDER = {
  schedule: renderSchedule,
  nb: renderNb,
  exams: renderExams,
  grades: renderGrades,
  money: renderMoney,
  more: renderMore,
  subjects: renderSubjects,
  tasks: renderTasks,
  resources: renderResources,
  contract: renderContract,
  settings: renderSettings,
};

function errorView(e) {
  const kinds = {
    not_connected: ["🔌", "HEMIS не подключён", "Откройте бота: Меню → HEMIS → «Войти»."],
    unauthorized: ["🔒", "Нет доступа", "Откройте приложение кнопкой из бота — данные видит только владелец."],
    network: ["📡", "Нет связи с ботом", "Проверьте интернет. Если бот на бесплатном Render, он мог заснуть — повторите через 30 секунд."],
    noapi: ["🧭", "Не указан адрес бота", "Откройте приложение кнопкой из бота или задайте API_URL в config.js."],
    hemis: ["🏫", "HEMIS не отвечает", e && e.message ? e.message : "Попробуйте позже."],
  };
  const [emoji, title, text] = kinds[e && e.kind] || ["⚠️", "Что-то пошло не так", (e && e.message) || "Попробуйте ещё раз."];
  return `<div class="card err"><div class="big">${emoji}</div><h3>${esc(title)}</h3><p class="muted small">${esc(text)}</p><button class="btn" data-a="retry">Повторить</button></div>`;
}

// ---------------------------------------------------------------- DOM и BiometricManager
if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const view = $("view"), loadbar = $("loadbar"), refreshBtn = $("refresh"), themeBtn = $("themeBtn");
  const SKELETON = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  let toastTimer = 0, lastHtml = "", lastIcon = "", pressing = false, deferred = null, lastFetch = 0;

  function renderTabsBar() {
    $("tabsIn").innerHTML = TABS.map((t) => (
      `<button class="tab ${S.tab === t.id ? "on" : ""}" data-a="tab" data-tab="${t.id}">${ico(t.icon)}<span>${t.label}</span></button>`
    )).join("");
  }
  renderTabsBar();

  $("back").innerHTML = ico("left");
  $("stampIco").innerHTML = ico("clock");

  function toast(text) {
    const el = $("toast"); el.textContent = text; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  const haptic = (kind) => { try { tg && tg.HapticFeedback && (kind ? tg.HapticFeedback.notificationOccurred(kind) : tg.HapticFeedback.selectionChanged()); } catch (e) { /* ignore */ } };

  // Инициализация нативного Telegram BiometricManager (Bot API 7.2+)
  function initBiometrics() {
    try {
      if (tg && tg.BiometricManager && !tg.BiometricManager.isInited) {
        tg.BiometricManager.init(() => {
          if (current() === "money" && !S.moneyUnlocked) repaint(null);
        });
      }
    } catch (e) { /* ignore */ }
  }

  function triggerBiometricAuth() {
    const bm = tg && tg.BiometricManager;
    if (bm && bm.isInited && bm.isBiometricAvailable) {
      const runAuth = () => {
        S.bioScanning = true;
        repaint(null);
        bm.authenticate({ reason: "Подтвердите вход в Финансы" }, (ok) => {
          S.bioScanning = false;
          if (ok) {
            S.moneyUnlocked = true;
            S.pinBuffer = "";
            S.pinError = false;
            renderTabsBar();
            haptic("success");
            toast("Вход выполнен 🔓");
            load({ anim: "fade" });
          } else {
            haptic("error");
            toast("Биометрия не подтверждена — введите PIN");
            repaint(null);
          }
        });
      };
      if (!bm.isAccessGranted) {
        bm.requestAccess({ reason: "Подтвердите вход в Финансы" }, (granted) => {
          if (granted) runAuth();
          else toast("Доступ к биометрии отклонён — используйте PIN-код");
        });
      } else {
        runAuth();
      }
      return;
    }

    // Демо-режим (в браузере или на устройстве без BiometricManager): визуальное сканирование отпечатка за 500 мс
    if (S.bioScanning) return;
    S.bioScanning = true;
    repaint(null);
    setTimeout(() => {
      S.bioScanning = false;
      S.moneyUnlocked = true;
      S.pinBuffer = "";
      S.pinError = false;
      renderTabsBar();
      haptic("success");
      toast("Отпечаток подтверждён 🔓");
      load({ anim: "fade" });
    }, 520);
  }

  function syncThemeIcon() {
    if (!themeBtn) return;
    const isLight = document.documentElement.dataset.theme === "light";
    themeBtn.innerHTML = ico(isLight ? "moon" : "sun");
  }

  function applyTheme(light) {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    syncThemeIcon();
    const bgHex = light ? "#f1f5f9" : "#060b16";
    const barHex = light ? "#ffffff" : "#060b16";
    try {
      tg && tg.setHeaderColor && tg.setHeaderColor(bgHex);
      tg && tg.setBackgroundColor && tg.setBackgroundColor(bgHex);
      tg && tg.setBottomBarColor && tg.setBottomBarColor(barHex);
    } catch (e) { /* ignore */ }
  }

  function setThemeFromEnv() {
    let saved = null;
    try { saved = localStorage.getItem("jv2:theme"); } catch (e) { /* ignore */ }
    const light = saved ? saved === "light" : (tg ? tg.colorScheme === "light" : matchMedia("(prefers-color-scheme: light)").matches);
    applyTheme(light);
  }

  const setBusy = (on) => { loadbar.classList.toggle("on", on); refreshBtn.classList.toggle("spin", on); };
  const stampText = (t) => (DEMO ? "демо" : t ? ago(t) : "");

  function chrome(id, data, stamp) {
    const [title, sub] = heroFor(id, data);
    $("title").textContent = title;
    $("subtitle").textContent = sub || "\u00a0";
    $("stamp").textContent = stampText(stamp);
    const icon = id === "money" && !S.moneyUnlocked ? "lock" : (HERO_ICON[id] || "calendar");
    if (icon !== lastIcon) { $("badge").innerHTML = ico(icon); lastIcon = icon; }
    renderTabsBar();
    $("back").hidden = !S.sub;
    refreshBtn.hidden = id === "more" || (id === "money" && !S.moneyUnlocked);
    try { if (tg && tg.BackButton) S.sub ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) { /* ignore */ }
  }

  function afterPaint() {
    requestAnimationFrame(() => view.querySelectorAll(".progress i[data-w]").forEach((i) => { i.style.width = `${i.dataset.w}%`; }));
  }

  function show(html, anim) {
    if (html === lastHtml && !anim) return;
    view.innerHTML = html; lastHtml = html;
    view.className = "";
    if (anim) { const cls = `enter-${anim}`; void view.offsetWidth; view.classList.add(cls); setTimeout(() => view.classList.remove(cls), 260); }
    afterPaint();
  }

  function paint(id, data, stamp, opts = {}) {
    if (opts.token != null && opts.token !== reqId) return;
    if (opts.bg && pressing) { deferred = () => paint(id, data, stamp, opts); return; }
    chrome(id, data, stamp);
    if (id === "money" && (!S.moneyUnlocked || S.pinSetupMode)) {
      show(renderVaultGate(), opts.anim);
      return;
    }
    if (!data && id !== "more") {
      // Сохраняем полосу семестров на экране во время подгрузки, чтобы переключение семестров никогда не зависало
      if (SEM_SCREENS.has(id) && !(id === "resources" && S.res.subject)) {
        show(semPager(null, S.sem[id] || "13") + SKELETON, opts.anim);
      } else {
        show(SKELETON, opts.anim);
      }
      return;
    }
    show(RENDER[id](data), opts.anim);
    const [t, s] = heroFor(id, data);
    $("title").textContent = t; $("subtitle").textContent = s || "\u00a0";
  }

  async function load(opts = {}) {
    const { force = false, anim = "fade" } = opts;
    const my = ++reqId, id = current(), path = pathFor(id);
    if (id === "money" && !S.moneyUnlocked) {
      paint(id, null, 0, { anim });
      setBusy(false);
      return;
    }
    if (!path) { paint(id, null, 0, { anim }); setBusy(false); return; }
    const e = cget(path);
    paint(id, e && e.data, e && e.t, { anim });
    if (e && !force && Date.now() - e.t < ttlOf(id)) { setBusy(false); return; }
    setBusy(true);
    try {
      const data = await api(path, force);
      cset(path, data); lastFetch = Date.now();
      paint(id, data, lastFetch, { bg: true, token: my });
    } catch (err) {
      if (my !== reqId) return;
      if (e) {
        toast("Нет связи — показаны сохранённые данные");
      } else if (id === "nb") {
        // Если по выбранному семестру в HEMIS нет данных НБ — выводим «Нет пропусков», сохраняя переключатель семестров
        const fallbackSem = String(S.sem.nb || "13");
        const emptyNb = { semesters: { codes: ALL_SEM_CODES, current: "13" }, report: { semester: fallbackSem, semester_no: semNo(fallbackSem), limit_pct: 25, total_hours: 0, excused_total: 0, rows: [] } };
        paint(id, emptyNb, Date.now(), { token: my });
      } else {
        show((SEM_SCREENS.has(id) ? semPager(null, S.sem[id] || "13") : "") + errorView(err));
      }
    } finally {
      if (my === reqId) setBusy(false);
    }
  }

  const repaint = (anim) => {
    const id = current();
    if (id === "money" && (!S.moneyUnlocked || S.pinSetupMode)) {
      paint(id, null, 0, { anim });
      return;
    }
    const e = cget(pathFor(id));
    if (e) paint(id, e.data, e.t, { anim });
  };

  const goBack = () => {
    if (S.sub === "resources" && S.res.subject) { S.res.subject = null; } else { S.sub = null; }
    S.open.clear(); load({ anim: "prev" });
  };

  function copyFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    ta.remove();
  }

  const actions = {
    tab: (el) => {
      const t = el.dataset.tab;
      if (S.tab !== t || S.sub) {
        S.tab = t;
        S.sub = null;
        S.open.clear();
        load();
        if (t === "money" && !S.moneyUnlocked) {
          const bm = tg && tg.BiometricManager;
          if (bm && bm.isInited && bm.isBiometricAvailable && bm.isAccessGranted) {
            triggerBiometricAuth();
          }
        }
      }
    },
    open: (el) => { S.sub = el.dataset.sub; S.open.clear(); if (S.sub === "resources") S.res.subject = null; load({ anim: "next" }); },
    back: goBack,
    bioauth: () => triggerBiometricAuth(),
    pinkey: (el) => {
      if (S.pinBuffer.length >= 4) return;
      S.pinError = false;
      S.pinBuffer += String(el.dataset.digit || "");
      repaint(null);
      if (S.pinBuffer.length === 4) {
        if (S.pinSetupMode) {
          setSavedPin(S.pinBuffer);
          S.pinSetupMode = false;
          S.pinBuffer = "";
          haptic("success");
          toast("Новый PIN-код сохранён 🔐");
          load({ anim: "fade" });
          return;
        }
        if (S.pinBuffer === getSavedPin()) {
          S.moneyUnlocked = true;
          S.pinBuffer = "";
          renderTabsBar();
          haptic("success");
          toast("Финансы разблокированы 🔓");
          load({ anim: "fade" });
        } else {
          S.pinError = true;
          haptic("error");
          toast("Неверный PIN-код");
          repaint(null);
          setTimeout(() => { S.pinBuffer = ""; S.pinError = false; repaint(null); }, 420);
        }
      }
    },
    pinback: () => {
      if (!S.pinBuffer.length) return;
      S.pinBuffer = S.pinBuffer.slice(0, -1);
      S.pinError = false;
      repaint(null);
    },
    pinsetup: () => {
      S.pinSetupMode = true;
      S.pinBuffer = "";
      S.pinError = false;
      repaint("fade");
    },
    pincancel: () => {
      S.pinSetupMode = false;
      S.pinBuffer = "";
      repaint("fade");
    },
    lockmoney: () => {
      S.moneyUnlocked = false;
      S.pinBuffer = "";
      S.txFormOpen = false;
      renderTabsBar();
      toast("Раздел Финансы заблокирован 🔒");
      repaint("fade");
    },
    hidebal: () => {
      S.hideBalances = !S.hideBalances;
      repaint(null);
    },
    theme: () => {
      const nextLight = document.documentElement.dataset.theme !== "light";
      try { localStorage.setItem("jv2:theme", nextLight ? "light" : "dark"); } catch (e) { /* ignore */ }
      applyTheme(nextLight);
      toast(nextLight ? "Светлая тема" : "Тёмная тема");
    },
    refresh: () => {
      if (!DEMO && Date.now() - lastFetch < 15000) { toast("Данные уже свежие"); return; }
      toast("Обновляю…"); load({ force: true, anim: null });
    },
    retry: () => load({ force: true }),
    week: (el) => { const dir = Number(el.dataset.dir); S.week += dir; S.day = null; load({ anim: dir > 0 ? "next" : "prev" }); },
    day: (el) => { S.day = el.dataset.day; repaint("fade"); },
    sem: (el) => {
      const id = current(), e = cget(pathFor(id));
      const sems = normalizeSemesters(e && e.data && e.data.semesters);
      const dir = Number(el.dataset.dir);
      const cur = String(S.sem[id] || sems.current || "13");
      const curIdx = sems.codes.indexOf(cur);
      const i = (curIdx >= 0 ? curIdx : 2) + dir;
      if (i < 0 || i >= sems.codes.length) return;
      S.sem[id] = sems.codes[i];
      if (id === "exams") S.examTab = null;
      S.open.clear();
      load({ anim: dir > 0 ? "next" : "prev" });
    },
    semjump: (el) => {
      const id = current(), code = String(el.dataset.code || "");
      if (!code) return;
      const prevCode = String(S.sem[id] || "13");
      if (code === prevCode) return;
      S.sem[id] = code;
      if (id === "exams") S.examTab = null;
      S.open.clear();
      load({ anim: Number(code) > Number(prevCode) ? "next" : "prev" });
    },
    examtab: (el) => { S.examTab = el.dataset.k; repaint("fade"); },
    grademode: (el) => { S.gradeMode = el.dataset.k; repaint("fade"); },
    goalgrade: (el) => { S.goalGrade = el.dataset.k; repaint("fade"); },
    notifbranch: (el) => { S.notifBranch = el.dataset.k; repaint("fade"); },
    notiffreq: async (el) => {
      const key = el.dataset.key, val = el.dataset.val;
      if (!key || val == null) return;
      saveNotifPref(key, val);
      repaint(null);
      try {
        await post("settings", { pref_key: key, pref_value: val });
      } catch (e) { /* сохранён локально */ }
      toast("Настройка сохранена ✅");
      haptic("success");
    },
    mperiod: (el) => { S.moneyPeriod = el.dataset.k; load({ anim: "fade" }); },
    mtab: (el) => { S.moneyTab = el.dataset.k; repaint("fade"); },
    toggleform: () => { S.txFormOpen = !S.txFormOpen; repaint("fade"); },
    txkind: (el) => { S.txKind = el.dataset.k; repaint(null); },
    txsubmit: async (el) => {
      const amtEl = $("txAmount"), curEl = $("txCurrency"), catEl = $("txCategory"), accEl = $("txAccount"), descEl = $("txDesc");
      const amount = parseFloat(amtEl && amtEl.value);
      if (!amount || amount <= 0) { toast("Введите сумму больше нуля"); return; }
      const payload = {
        kind: S.txKind,
        amount,
        currency: curEl ? curEl.value : "UZS",
        category: S.txKind === "transfer" ? null : (catEl ? catEl.value : "другое"),
        account: accEl ? accEl.value : "карта",
        description: descEl ? descEl.value.trim() : "",
      };
      el.disabled = true;
      try {
        await post("money/tx", payload);
        S.txFormOpen = false;
        toast("Операция сохранена ✅");
        haptic("success");
        await load({ force: true, anim: "fade" });
      } catch (err) {
        toast((err && err.message) || "Ошибка при сохранении");
        haptic("error");
      } finally {
        el.disabled = false;
      }
    },
    subpay: async (el) => {
      const d = el.dataset;
      el.disabled = true;
      try {
        await post("money/tx", {
          kind: "expense",
          amount: parseFloat(d.amount),
          currency: d.cur || "UZS",
          category: d.cat || "подписки",
          account: "карта",
          description: `Подписка: ${d.title}`,
        });
        toast(`Списание «${d.title}» записано ✅`);
        haptic("success");
        S.moneyTab = "ops";
        await load({ force: true, anim: "fade" });
      } catch (err) {
        toast("Не удалось записать списание");
      } finally {
        el.disabled = false;
      }
    },
    contractpay: async (el) => {
      const amount = parseFloat(el.dataset.amount);
      if (!amount) return;
      el.disabled = true;
      try {
        await post("money/tx", {
          kind: "expense",
          amount,
          currency: "UZS",
          category: "учёба",
          account: "карта",
          description: "Оплата контракта HEMIS (ежемесячный план)",
        });
        toast("Платёж по контракту записан в Финансы ✅");
        haptic("success");
      } catch (err) {
        toast("Не удалось записать платёж");
      } finally {
        el.disabled = false;
      }
    },
    tasktab: (el) => { S.taskTab = el.dataset.k; repaint("fade"); },
    reskind: (el) => { S.resKind = el.dataset.k; repaint("fade"); },
    subject: (el) => { S.res.subject = el.dataset.id; S.res.name = el.dataset.name; S.resKind = "all"; S.open.clear(); load({ anim: "next" }); },
    lesson: (el) => {
      const key = el.dataset.key, card = el.closest(".lesson");
      S.open.has(key) ? S.open.delete(key) : S.open.add(key);
      card.classList.toggle("open", S.open.has(key)); el.setAttribute("aria-expanded", S.open.has(key));
    },
    toggle: (el, ev) => {
      if (ev.target.closest("[data-a='send'], [data-a='link']")) return;
      const key = el.dataset.key; S.open.has(key) ? S.open.delete(key) : S.open.add(key);
      el.querySelectorAll(".records, .detail").forEach((n) => { n.hidden = !S.open.has(key); });
    },
    link: (el, ev) => { ev.preventDefault(); const u = el.dataset.url; tg && tg.openLink ? tg.openLink(u) : window.open(u, "_blank"); },
    copy: async (el) => {
      const txt = el.dataset.text || "";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(txt);
        else copyFallback(txt);
        toast("Скопировано в буфер");
        haptic("success");
      } catch (e) {
        copyFallback(txt);
        toast("Скопировано");
      }
    },
    send: async (el) => {
      const d = el.dataset, label = el.innerHTML;
      el.disabled = true; el.innerHTML = "Отправляю в чат…";
      try {
        await post("send", { type: d.type, id: d.id, subject: d.subject, semester: d.semester });
        toast("Готово — карточка и файлы отправлены в чат с ботом"); haptic("success");
      } catch (err) { toast((err && err.message) || "Не удалось отправить"); haptic("error"); }
      el.disabled = false; el.innerHTML = label;
    },
    setting: async (el) => {
      const key = el.dataset.key, sw = el.querySelector(".switch"), on = !sw.classList.contains("on");
      sw.classList.toggle("on", on);
      try {
        await post("settings", { key, value: on });
        const path = pathFor("settings"), e = cget(path);
        if (e) {
          let t = (e.data.toggles || []).find((x) => x.key === key);
          if (t) t.on = on;
          else { e.data.toggles = [...(e.data.toggles || []), { key, label: key, on }]; }
          cset(path, e.data);
        }
      } catch (err) { sw.classList.toggle("on", !on); toast("Не удалось сохранить"); }
    },
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-a]");
    if (!el || el.disabled) return;
    if (el.tagName === "INPUT" && el.type === "time") return;
    const a = el.dataset.a;
    if (!["toggle", "refresh", "send", "copy", "setting", "lesson"].includes(a)) haptic();
    if (actions[a]) actions[a](el, ev);
  });

  document.addEventListener("change", async (ev) => {
    const el = ev.target.closest("input[data-a='notiftime']");
    if (!el) return;
    const key = el.dataset.key, val = el.value;
    if (!key || !val) return;
    saveNotifPref(key, val);
    repaint(null);
    try {
      await post("settings", { pref_key: key, pref_value: val });
    } catch (e) { /* сохранён локально */ }
    toast(`Время обновлено: ${val} ⏰`);
    haptic("success");
  });

  document.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches("[role='button']")) { ev.preventDefault(); ev.target.click(); } });

  const release = () => { pressing = false; if (deferred) { const f = deferred; deferred = null; setTimeout(f, 60); } };
  document.addEventListener("pointerdown", () => { pressing = true; }, { passive: true, capture: true });
  ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, release, { passive: true, capture: true }));

  setInterval(() => {
    if (document.hidden) return;
    const id = current(), e = cget(pathFor(id));
    if (!e) return;
    $("stamp").textContent = stampText(e.t);
    if (id === "schedule" && S.week === 0) paint(id, e.data, e.t, { bg: true, token: reqId });
  }, 30000);

  if (tg) {
    tg.ready();
    tg.expand();
    try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) { /* ignore */ }
    try { if (tg.requestFullscreen) tg.requestFullscreen(); } catch (e) { /* ignore */ }
    tg.onEvent && tg.onEvent("themeChanged", setThemeFromEnv);
    tg.BackButton && tg.BackButton.onClick(goBack);
  }
  initBiometrics();
  setThemeFromEnv();
  load();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Автоматически запираем Финансы при сворачивании приложения
      S.moneyUnlocked = false;
      S.pinBuffer = "";
    } else {
      load({ anim: null });
    }
  });
}

// ---------------------------------------------------------------- интерактивное демо-состояние (все 8 семестров: 11..18)
const demoMoneyState = {
  accounts: [
    { id: 1, name: "карта", icon: "💳", balance: 1485000 },
    { id: 2, name: "наличные", icon: "💵", balance: 320000 },
  ],
  recent: [
    { id: 108, kind: "expense", amount: 68000, category: "продукты", account: "карта", description: "Корзинка (молоко, фрукты, хлеб)", created_at: "2026-11-13T12:40:00+05:00" },
    { id: 107, kind: "expense", amount: 24000, category: "транспорт", account: "карта", description: "Yandex Go до университета", created_at: "2026-11-13T08:10:00+05:00" },
    { id: 106, kind: "expense", amount: 42000, category: "еда", account: "наличные", description: "Обед с однокурсниками", created_at: "2026-11-12T13:30:00+05:00" },
    { id: 105, kind: "income", amount: 850000, category: "стипендия", account: "карта", description: "Стипендия за ноябрь", created_at: "2026-11-10T16:15:00+05:00" },
    { id: 104, kind: "expense", amount: 257000, category: "подписки", account: "карта", description: "Подписка ChatGPT Plus [20 USD × 12850]", created_at: "2026-11-08T19:00:00+05:00" },
    { id: 103, kind: "expense", amount: 195000, category: "продукты", account: "карта", description: "Закупка в Makro", created_at: "2026-11-05T18:20:00+05:00" },
    { id: 102, kind: "expense", amount: 90000, category: "учёба", account: "наличные", description: "Распечатка материалов и тетради", created_at: "2026-11-03T11:00:00+05:00" },
  ],
  debts: [
    { id: 1, person: "Алишер", amount: 120000, direction: "given", description: "Одолжил на билеты и обед", due_date: "2026-11-20" },
    { id: 2, person: "Сардор", amount: 45000, direction: "taken", description: "Скинулись за такси вечером", due_date: "2026-11-16" },
  ],
  subscriptions: [
    { id: 1, title: "Тариф Beeline + Интернет", amount: 85000, currency: "UZS", category: "связь", billing_day: 1 },
    { id: 2, title: "ChatGPT Plus / Claude", amount: 20, currency: "USD", category: "подписки", billing_day: 15 },
    { id: 3, title: "Yandex Plus", amount: 29900, currency: "UZS", category: "подписки", billing_day: 22 },
  ],
};

const demoToggleState = {
  // Ветвь «Бот»
  bot_briefing_on: true,
  bot_finance_on: true,
  bot_subs_on: true,
  bot_reminders_on: true,
  bot_memory_on: true,
  // Ветвь «HEMIS»
  morning_on: true,
  lesson_alert_on: true,
  prep_on: false,
  changes_on: true,
  nb_on: true,
  tasks_on: true,
  grades_on: true,
  deadlines_on: true,
  exams_on: true,
};

function demoSubjectsForSem(sem) {
  const sc = (name, ball, max) => ({ name, ball, max, pct: max ? Math.round((ball / max) * 1000) / 10 : null });
  const catalog = {
    "11": [
      { id: "101", name: "Iqtisodiyot nazariyasi", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 91, 100), grade5: 5, current: sc("Joriy", 28, 30), mid: sc("Oraliq", 37, 40), final: sc("Yakuniy", 26, 30), extra: [] },
      { id: "102", name: "Oliy matematika I", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 87, 100), grade5: 5, current: sc("Joriy", 26, 30), mid: sc("Oraliq", 35, 40), final: sc("Yakuniy", 26, 30), extra: [] },
      { id: "103", name: "Akademik yozuv va xorijiy til", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 84, 100), grade5: 4, current: sc("Joriy", 25, 30), mid: sc("Oraliq", 34, 40), final: sc("Yakuniy", 25, 30), extra: [] },
      { id: "104", name: "Axborot texnologiyalari", kind: "Majburiy", load: 60, credit: 4, overall: sc("Umumiy", 93, 100), grade5: 5, current: sc("Joriy", 29, 30), mid: sc("Oraliq", 37, 40), final: sc("Yakuniy", 27, 30), extra: [] },
    ],
    "12": [
      { id: "201", name: "Makroiqtisodiyot I", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 89, 100), grade5: 5, current: sc("Joriy", 27, 30), mid: sc("Oraliq", 36, 40), final: sc("Yakuniy", 26, 30), extra: [] },
      { id: "202", name: "Ehtimollar nazariyasi va mat. statistika", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 86, 100), grade5: 5, current: sc("Joriy", 26, 30), mid: sc("Oraliq", 35, 40), final: sc("Yakuniy", 25, 30), extra: [] },
      { id: "203", name: "Menejment asoslari", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 82, 100), grade5: 4, current: sc("Joriy", 25, 30), mid: sc("Oraliq", 33, 40), final: sc("Yakuniy", 24, 30), extra: [] },
      { id: "204", name: "O‘zbekistonning eng yangi tarixi", kind: "Tanlov", load: 60, credit: 4, overall: sc("Umumiy", 90, 100), grade5: 5, current: sc("Joriy", 28, 30), mid: sc("Oraliq", 36, 40), final: sc("Yakuniy", 26, 30), extra: [] },
    ],
    "13": [
      { id: "1", name: "Ekonometrika", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 45, 50), grade5: 5, current: sc("Joriy", 26, 30), mid: sc("1-ON", 19, 20), final: null, extra: [] },
      { id: "2", name: "Statistika", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 41, 50), grade5: 4, current: sc("Joriy", 24, 30), mid: sc("1-ON", 17, 20), final: null, extra: [] },
      { id: "3", name: "Strategik marketing", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 36, 50), grade5: 4, current: sc("Joriy", 21, 30), mid: sc("1-ON", 15, 20), final: null, extra: [] },
      { id: "4", name: "Philosophy", kind: "Tanlov", load: 60, credit: 2, overall: sc("Umumiy", 88, 100), grade5: 5, current: sc("Joriy", 28, 30), mid: sc("Oraliq", 36, 40), final: sc("Yakuniy", 24, 30), extra: [] },
    ],
    "14": [
      { id: "401", name: "Amaliy ekonometrika II (Panel Data)", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "402", name: "Mikroiqtisodiyot II", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "403", name: "Korporativ moliya", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "404", name: "Buxgalteriya hisobi va audit", kind: "Tanlov", load: 90, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
    ],
    "15": [
      { id: "501", name: "Moliya bozorlari va institutlari", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "502", name: "Davlat byudjeti va soliq siyosati", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "503", name: "Xalqaro iqtisodiyot", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "504", name: "Raqamli iqtisodiyot va AI tahlil", kind: "Tanlov", load: 90, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
    ],
    "16": [
      { id: "601", name: "Investitsion loyihalar tahlili", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "602", name: "O‘yinlar nazariyasi va sanoat iqtisodiyoti", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "603", name: "Bank ishi va pul-kredit siyosati", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "604", name: "Ma’lumotlar tahlili (Python & R)", kind: "Tanlov", load: 90, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
    ],
    "17": [
      { id: "701", name: "Makroiqtisodiy modellash (DSGE)", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "702", name: "Iqtisodiy o‘sish va rivojlanish", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "703", name: "Risk-menejment va sug‘urta", kind: "Tanlov", load: 90, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "704", name: "Ilmiy-tadqiqot metodologiyasi", kind: "Majburiy", load: 60, credit: 4, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
    ],
    "18": [
      { id: "801", name: "Bitiruv malakaviy ishi (Дипломный проект)", kind: "Majburiy", load: 240, credit: 12, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
      { id: "802", name: "Ishlab chiqarish va diplomoldi amaliyoti", kind: "Majburiy", load: 180, credit: 8, overall: sc("Umumiy", 0, 100), grade5: null, current: null, mid: null, final: null, extra: [] },
    ],
  };
  return catalog[sem] || catalog["13"];
}

function demoApi(path, method, body) {
  const today = nowTk().iso, base = parseISO(today);
  const q = new URLSearchParams(path.split("?")[1] || ""), kind = path.split("?")[0];
  const sems = { codes: ALL_SEM_CODES, current: "13" };
  const sem = sems.codes.includes(q.get("semester")) ? q.get("semester") : "13";
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 50));
  const d = (n) => iso(addDays(base, n));

  if (method === "POST") {
    if (kind === "settings" && body) {
      if (body.key) demoToggleState[body.key] = Boolean(body.value);
      if (body.pref_key) saveNotifPref(body.pref_key, body.pref_value);
      return wait({ ok: true });
    }
    if (kind === "money/tx" && body) {
      const fxMap = { UZS: 1, USD: 12850, EUR: 13800, RUB: 132 };
      const rate = fxMap[body.currency] || 1;
      const amtUzs = Math.round((+body.amount || 0) * rate);
      const desc = body.currency && body.currency !== "UZS"
        ? `${body.description || body.category || "Операция"} [${body.amount} ${body.currency} × ${rate}]`
        : (body.description || body.category || "Операция");
      const acc = demoMoneyState.accounts.find((a) => a.name === body.account) || demoMoneyState.accounts[0];
      if (body.kind === "income") acc.balance += amtUzs;
      else if (body.kind === "transfer") {
        const other = demoMoneyState.accounts.find((a) => a.id !== acc.id) || demoMoneyState.accounts[1];
        acc.balance -= amtUzs;
        if (other) other.balance += amtUzs;
      } else {
        acc.balance -= amtUzs;
      }
      demoMoneyState.recent.unshift({
        id: Date.now() % 100000,
        kind: body.kind || "expense",
        amount: amtUzs,
        category: body.category || "другое",
        account: acc.name,
        to_account: body.kind === "transfer" ? (acc.name === "карта" ? "наличные" : "карта") : null,
        description: desc,
        created_at: `${today}T14:30:00+05:00`,
      });
    }
    return wait({ ok: true });
  }

  if (kind === "money/overview") {
    const totalBal = demoMoneyState.accounts.reduce((s, a) => s + a.balance, 0);
    const byCat = {};
    let totalExp = 0, totalInc = 0;
    demoMoneyState.recent.forEach((tx) => {
      if (tx.kind === "expense") {
        totalExp += tx.amount;
        byCat[tx.category] = byCat[tx.category] || [0, 0];
        byCat[tx.category][0] += tx.amount;
        byCat[tx.category][1] += 1;
      } else if (tx.kind === "income") {
        totalInc += tx.amount;
      }
    });
    const catList = Object.entries(byCat).map(([k, [amt, n]]) => [k, amt, n]).sort((a, b) => b[1] - a[1]);
    const perDay = Math.round(totalExp / 13);
    return wait({
      balances: { accounts: demoMoneyState.accounts, total: totalBal },
      summary: {
        period: q.get("period") || "month",
        title: "за ноябрь",
        expense: totalExp,
        income: totalInc,
        expense_by_category: catList,
        per_day: perDay,
        projected_month: perDay * 30,
        safe_daily: Math.max(25000, Math.round((2000000 - totalExp) / 17)),
      },
      recent: demoMoneyState.recent,
      debts: demoMoneyState.debts,
      subscriptions: demoMoneyState.subscriptions,
    });
  }

  if (kind === "schedule") {
    const off = Number(q.get("week") || 0), mon = addDays(parseISO(mondayOf(0)), off * 7);
    const plan = [
      ["1", "08:30", "09:50", "Ekonometrika", "Лекция", "3-505", "Akramova N. M."],
      ["2", "10:00", "11:20", "Mikroiqtisodiyot", "Практика", "2-214", "Karimov S. R."],
      ["3", "11:30", "12:50", "Statistika", "Практика", "5-305", "Rustamov A. B."],
      ["4", "13:00", "14:20", "Strategik marketing", "Лекция", "1-101", "Madaminova S. N."],
    ];
    const lessons = [];
    [0, 1, 2, 3, 4].forEach((i) => plan.forEach((p, j) => { if ((i + j) % 4 !== 3) lessons.push({ date: iso(addDays(mon, i)), pair: `${p[0]} пара`, start: p[1], end: p[2], subject: p[3], type: p[4], room: p[5], building: "Корпус A", teacher: p[6], group: "" }); }));
    return wait({ today, monday: iso(mon), sunday: iso(addDays(mon, 6)), published: Math.abs(off) < 3, lessons: Math.abs(off) < 3 ? lessons : [] });
  }
  if (kind === "nb") {
    const rows13 = [
      { subject: "Ekonometrika", hours: 6, pairs: 3, limit_hours: 15, hours_src: "manual", status: "ok", left_pairs: 4, records: [{ date: "2026-10-19", pair: "1", type: "Лекция", unexcused_h: 2 }] },
      { subject: "Philosophy", hours: 14, pairs: 7, limit_hours: 15, hours_src: "manual", status: "warn", left_pairs: 0, records: [{ date: "2026-10-12", pair: "2", type: "Лекция", unexcused_h: 2 }, { date: "2026-10-19", pair: "3", type: "Практика", unexcused_h: 2 }] },
      { subject: "Mikroiqtisodiyot", hours: 4, pairs: 2, limit_hours: 15, hours_src: "schedule", status: "ok", left_pairs: 5, records: [{ date: "2026-10-05", pair: "1", type: "Лекция", unexcused_h: 2 }] },
      { subject: "Statistika", hours: 2, pairs: 1, limit_hours: 15, hours_src: "manual", status: "ok", left_pairs: 6, records: [] },
    ];
    const rows12 = [
      { subject: "Makroiqtisodiyot I", hours: 4, pairs: 2, limit_hours: 15, hours_src: "manual", status: "ok", left_pairs: 5, records: [{ date: "2026-04-14", pair: "2", type: "Практика", unexcused_h: 2 }] },
    ];
    const semRows = sem === "13" ? rows13 : sem === "12" ? rows12 : [];
    const totalH = semRows.reduce((a, r) => a + r.hours, 0);
    const excH = sem === "13" ? 4 : 0;
    return wait({ semesters: sems, report: { semester: sem, semester_no: semNo(sem), limit_pct: 25, total_hours: totalH, excused_total: excH, hours_table_missing: [], rows: semRows } });
  }
  if (kind === "exams") {
    const ex = (id, subject, group, sheet, n, start, end, room, teacher, k) => ({ id, subject, kind: k || "", group, sheet, date: d(n), start, end, room, teacher });
    const exams = sem === "13" ? [
      ex("1", "Ekonometrika", "s", 1, 14, "09:00", "10:20", "3-505", "AKRAMOVA N. M.", "Yakuniy nazorat"),
      ex("2", "Statistika", "s", 1, 18, "13:00", "14:20", "5-305", "RUSTAMOV A. B.", "Yakuniy nazorat"),
      ex("3", "Strategik marketing", "2", 1, 3, "10:00", "11:20", "2-214", "MADAMINOVA S. N.", "2-ON"),
      ex("4", "Mikroiqtisodiyot", "c", 1, 5, "11:30", "12:50", "2-214", "KARIMOV S. R.", "Joriy nazorat"),
      ex("5", "Ekonometrika", "1", 1, -20, "08:30", "09:50", "5-305", "AKRAMOVA N. M.", "1-ON"),
    ] : Number(sem) < 13 ? [
      ex("7", demoSubjectsForSem(sem)[0].name, "s", 1, -90, "09:00", "10:20", "1-101", "SOBIROV T. K.", "Yakuniy nazorat"),
    ] : [];
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), today, exams });
  }
  if (kind === "grades" || kind === "grade_targets") {
    const subjects = demoSubjectsForSem(sem);
    const credits = subjects.reduce((a, s) => a + (s.credit || 0), 0);
    const isFuture = Number(sem) > 13;
    const avgPct = isFuture ? null : (sem === "13" ? 85.4 : 88.6);
    const gpaCalc = isFuture ? null : (sem === "13" ? 4.6 : 4.8);
    const periodMap = {
      "11": "09.2025 – 01.2026", "12": "02.2026 – 06.2026",
      "13": "09.2026 – 01.2027", "14": "02.2027 – 06.2027",
      "15": "09.2027 – 01.2028", "16": "02.2028 – 06.2028",
      "17": "09.2028 – 01.2029", "18": "02.2029 – 06.2029",
    };
    const perf = { semester: sem, semester_no: semNo(sem), period: periodMap[sem] || "", subjects, credits, avg_pct: avgPct, gpa_calc: gpaCalc };
    return wait({ semesters: sems, perf, targets: { semester_no: semNo(sem), credits, gpa_calc: gpaCalc, subjects: buildTargetsFromPerf(perf) } });
  }
  if (kind === "tasks") {
    const t = (id, title, subject, n, hh, extra) => ({ id, title, subject, description: "Решите задачи по инструментальным переменным (2SLS) и прикрепите отчёт в формате .docx или .pdf.", kind: "Задание", lesson_type: "Практика", teacher: "Akramova N. M.", max_ball: 10, mark: null, graded: false, overdue: n < 0, status: "", deadline: `${d(n)} ${hh}`, deadline_left: "", attempts: "0/3", files: [{ name: "iv_2sls_tasks.pdf", size: 245000, ext: "pdf" }], my_files: [], sent_at: null, teacher_comment: "", ...extra });
    const tasks = sem === "13" ? [
      t("1", "Практикум №8: Эндогенность и метод ИП (2SLS)", "Ekonometrika", 2, "23:59"),
      t("2", "Кейс-анализ розничной сети Korzinka", "Strategik marketing", 5, "18:00", { files: [{ name: "korzinka_case.docx", size: 180000, ext: "docx" }] }),
      t("3", "Расчёт ошибки выборки (Задача 8.2)", "Statistika", -1, "12:00"),
      t("4", "МНК и предпосылки Гаусса-Маркова", "Ekonometrika", -8, "10:00", { graded: true, overdue: false, mark: 9.5, sent_at: d(-9) + " 09:00", teacher_comment: "Отличный пошаговый вывод." }),
    ] : Number(sem) < 13 ? [
      t("5", `Итоговый кейс (${semNo(sem)}-й семестр)`, demoSubjectsForSem(sem)[0].name, -60, "18:00", { graded: true, overdue: false, mark: 9.8 }),
    ] : [];
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), status: "all", count: tasks.length, tasks });
  }
  if (kind === "resources") {
    if (q.get("subject")) {
      const r = (id, title, k, files) => ({ id, title, comment: "Конспект лекции, формулы и примеры расчётов.", subject: "Ekonometrika", kind: k, languages: ["Русский"], teacher: "AKRAMOVA N. M.", items: [{ type: "Презентация", comment: "", url: "", files: Array.from({ length: files }, (_, i) => ({ name: `${title}-${i + 1}.pptx`, size: 1800000, ext: "pptx" })) }], files_count: files, links_count: 0 });
      return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), subject_id: q.get("subject"), resources: [r("1", "Тема 7. Фиктивные переменные и лог-модели", "Лекция", 1), r("2", "Тема 8. Эндогенность и двухшаговый МНК (2SLS)", "Лекция", 2), r("3", "Семинар 8. Разбор задач по ИП", "Практика", 1)] });
    }
    const subList = sem === "13" ? [{ id: "149", name: "Ekonometrika", credit: 6, resources: 18 }, { id: "151", name: "Statistika", credit: 4, resources: 14 }, { id: "153", name: "Strategik marketing", credit: 4, resources: 10 }] : demoSubjectsForSem(sem).map((s, idx) => ({ id: String(s.id), name: s.name, credit: s.credit, resources: Number(sem) <= 13 ? 12 - idx * 2 : 4 }));
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), subjects: subList });
  }
  if (kind === "contract") return wait({ gpa: 4.6, speciality: "Iqtisodiyot (Экономика)", course: "2-курс", form: "Очная", year: "2026-2027", total: 12000000, paid: 7800000, remaining: 4200000, paid_pct: 65.0, fields_consistent: true });
  if (kind === "settings") {
    const allKeys = [...BOT_TOGGLE_META, ...HEMIS_TOGGLE_META];
    return wait({
      auth_failed: false,
      last_ok_at: new Date().toISOString(),
      prefs: getNotifPrefs(),
      toggles: allKeys.map(([key, label]) => ({ key, label, on: key in demoToggleState ? demoToggleState[key] : true })),
    });
  }
  return wait({});
}

if (typeof module !== "undefined") module.exports = { nowTk, lessonState, hhmm, lessonCard, mondayOf, normalizeSemesters, renderSchedule, renderNb, renderExams, renderGrades, renderMoney, renderVaultGate, renderSubjects, renderTasks, renderResources, renderContract, renderSettings, renderMore, demoApi, S, errorView, forecast, esc, pathFor, minutesLeft, leftLabel, heroFor };
