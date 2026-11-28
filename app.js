/* Jarvis · Учёба — Telegram Mini App v3 (Priority-First Pulse Dashboard + Instant Cold Start) */
"use strict";

// ---------------------------------------------------------------- utilities
const tg = typeof window !== "undefined" ? window.Telegram && window.Telegram.WebApp : null;
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const API = ((params.get("api") || (typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG.API_URL) || "") + "").replace(/\/$/, "");
const DEMO = params.has("demo") || !(tg && tg.initData);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parseISO = (s) => { const [y, m, d] = String(s || "2026-11-28").slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1)); };
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const dm = (s) => `${String(s || "").slice(8, 10)}.${String(s || "").slice(5, 7)}`;
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":"); return Number(h) * 60 + Number(m); };
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const num = (x) => (x == null ? "—" : Number.isInteger(+x) ? String(+x) : (+x).toFixed(1).replace(/\.0$/, ""));
const money = (x) => (x == null ? "—" : Math.round(+x).toLocaleString("ru-RU").replace(/\u00a0/g, " "));
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
const pairsWord = (n) => `${n} ${plural(n, "пару", "пары", "пар")}`;
const semNo = (code) => Number(code) - 10;
const sizeKb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);

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
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return { iso: `${g("year")}-${pad(g("month"))}-${pad(g("day"))}`, min: (g("hour") % 24) * 60 + g("minute") };
}
const mondayOf = (offset) => { const b = parseISO(nowTk().iso); return iso(addDays(b, -((b.getUTCDay() + 6) % 7) + 7 * offset)); };

const ICON = {
  pulse: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  study: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
  more: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
};
const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ICON.pulse}</svg>`;

// ---------------------------------------------------------------- state & cache
const TABS = [
  { id: "pulse", label: "Главное", icon: "pulse" },
  { id: "schedule", label: "Расписание", icon: "calendar" },
  { id: "study", label: "Учёба", icon: "study" },
  { id: "more", label: "Ещё", icon: "more" },
];

const SEM_SCREENS = new Set(["nb", "exams", "grades", "subjects", "tasks", "resources"]);

const S = {
  tab: "pulse",
  studyTab: "grades", // grades | nb | exams | tasks
  sub: null,
  week: 0,
  day: null,
  sem: {},
  examTab: null,
  notifBranch: "bot",
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
  settings: 0,
};
const LS = "jv2:";
const mem = new Map();
const inflight = new Map();

const DEFAULT_NOTIF_PREFS = {
  bot_morning_time: "06:00",
  bot_evening_time: "23:00",
  bot_quiet_hours: "23:30-05:50",
  hemis_morning_time: "06:30",
  hemis_prep_time: "16:00",
  hemis_before_min: "10",
  hemis_poll_freq: "20m_540_2300",
  hemis_deadline_freq: "standard",
};

function getNotifPrefs(serverPrefs) {
  let saved = {};
  try { saved = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(LS + "notif_prefs")) || "{}") || {}; } catch (e) { /* ignore */ }
  const merged = { ...DEFAULT_NOTIF_PREFS, ...(serverPrefs || {}), ...saved };
  if (merged.bot_quiet_hours === "23:00-07:00") merged.bot_quiet_hours = "23:30-05:50";
  if (merged.hemis_poll_freq === "30m") merged.hemis_poll_freq = "20m_540_2300";
  return merged;
}
function saveNotifPref(key, val) {
  let saved = {};
  try { saved = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(LS + "notif_prefs")) || "{}") || {}; } catch (e) { /* ignore */ }
  saved[key] = String(val);
  try { if (typeof localStorage !== "undefined") localStorage.setItem(LS + "notif_prefs", JSON.stringify(saved)); } catch (e) { /* ignore */ }
  return { ...getNotifPrefs(), ...saved };
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
    try { Object.keys(localStorage).filter((k) => k.startsWith(LS) && !["jv2:theme", "jv2:notif_prefs"].includes(k)).forEach((k) => localStorage.removeItem(k)); write(); } catch (err2) { /* ignore */ }
  }
}
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "сейчас" : m < 60 ? `${m}м` : m < 1440 ? `${Math.round(m / 60)}ч` : `${Math.round(m / 1440)}д`; };

let reqId = 0;

// ---------------------------------------------------------------- network (boot prefetch + dedup + timeout)
async function request(method, path, body, force) {
  if (DEMO) return demoApi(path, method, body);
  if (!API) throw { kind: "noapi" };

  if (method === "GET" && !force && typeof window !== "undefined" && window.__BOOT_FETCH__ && window.__BOOT_FETCH__[path]) {
    const boot = window.__BOOT_FETCH__[path];
    delete window.__BOOT_FETCH__[path];
    const pre = await boot;
    if (pre) return pre;
  }

  const dedupKey = method === "GET" && !force ? path : null;
  if (dedupKey && inflight.has(dedupKey)) return inflight.get(dedupKey);

  const url = `${API}/api/${path}${force ? (path.includes("?") ? "&" : "?") + "r=1" : ""}`;
  const headers = { "X-Telegram-Init-Data": tg.initData };
  if (body) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  const p = (async () => {
    let res;
    try {
      res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    } catch (e) {
      throw { kind: "network" };
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw { kind: res.status === 401 ? "unauthorized" : (j.error || "http"), message: j.message };
    }
    return res.json();
  })();

  if (dedupKey) {
    inflight.set(dedupKey, p);
    p.finally(() => inflight.delete(dedupKey));
  }
  return p;
}
const api = (path, force) => request("GET", path, null, force);
const post = (path, body) => request("POST", path, body);

// ---------------------------------------------------------------- routing
const semQ = (id) => (S.sem[id] ? `semester=${S.sem[id]}` : "");
function current() {
  if (S.sub) return S.sub;
  if (S.tab === "study") return S.studyTab;
  return S.tab;
}
function pathFor(id) {
  switch (id) {
    case "schedule": return `schedule?week=${S.week}&m=${mondayOf(S.week)}`;
    case "nb": case "exams": case "grades": case "tasks": return `${id}${S.sem[id] ? "?" + semQ(id) : ""}`;
    case "subjects": return `grades${S.sem.subjects ? "?semester=" + S.sem.subjects : ""}`;
    case "resources": return S.res.subject ? `resources?semester=${S.sem.resources}&subject=${S.res.subject}` : `resources${S.sem.resources ? "?" + semQ("resources") : ""}`;
    case "contract": case "settings": return id;
    default: return null;
  }
}
const ttlOf = (id) => (id === "subjects" ? TTL.grades : TTL[id] ?? 0);

// ---------------------------------------------------------------- shared UI primitives
const empty = (emoji, title, text) => `<div class="card empty-box"><div class="big">${emoji}</div><b>${esc(title)}</b>${text ? `<p class="muted small">${esc(text)}</p>` : ""}</div>`;
const seg = (items, active, action) => `<div class="seg">${items.map(([k, t, sub]) => `<button class="${k === active ? "on" : ""}" data-a="${action}" data-k="${k}">${esc(t)}${sub != null && sub !== "" ? `<small>${esc(sub)}</small>` : ""}</button>`).join("")}</div>`;
const fileList = (files) => files && files.length ? `<div class="files">${files.map((f) => `<div class="file">${ico("file")}<span>${esc(f.name)}</span><small>${sizeKb(f.size)}</small></div>`).join("")}</div>` : "";

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
  const statusLbl = active === norm.current ? `${courseNo}-й курс · Текущий` : Number(active) < Number(norm.current) ? `${courseNo}-й курс · Прошедший` : `${courseNo}-й курс · План`;
  const strip = norm.codes.map((code) => {
    const n = semNo(code);
    return `<button class="sem-pill ${code === active ? "on" : ""} ${code === norm.current ? "cur" : ""}" data-a="semjump" data-code="${code}">${n}</button>`;
  }).join("");
  return `<div class="card">
    <div class="pager">
      <button class="pg-btn" data-a="sem" data-dir="-1" ${i > 0 ? "" : "disabled"}>${ico("left")}</button>
      <div class="mid"><b>${sNum}-й семестр</b><span>${esc(statusLbl)}</span></div>
      <button class="pg-btn" data-a="sem" data-dir="1" ${i >= 0 && i < norm.codes.length - 1 ? "" : "disabled"}>${ico("right")}</button>
    </div>
    <div class="sem-strip">${strip}</div>
  </div>`;
}

// ---------------------------------------------------------------- Tab 1: Главное (Priority Pulse Dashboard)
function minutesLeft(deadline) {
  if (!deadline) return null;
  const now = nowTk(), dayDiff = Math.round((parseISO(deadline.slice(0, 10)) - parseISO(now.iso)) / 864e5);
  return dayDiff * 1440 + toMin(deadline.slice(11)) - now.min;
}
function leftLabel(m) {
  const a = Math.abs(m), t = a < 60 ? `${a} мин` : a < 2880 ? `${Math.floor(a / 60)} ч` : `${Math.floor(a / 1440)} дн.`;
  return m < 0 ? `просрочено ${t}` : `через ${t}`;
}

function renderPulse(bundle) {
  const { schedule, tasks, nb, exams, grades } = bundle || {};
  const now = nowTk(), today = now.iso;
  const tomorrow = iso(addDays(parseISO(today), 1));
  const lessons = (schedule && schedule.lessons) || [];
  const todayLessons = lessons.filter((l) => l.date === today).sort((a, b) => toMin(a.start) - toMin(b.start));
  const tomorrowLessons = lessons.filter((l) => l.date === tomorrow).sort((a, b) => toMin(a.start) - toMin(b.start));

  // 1. Hero: Live class OR Next class OR Tomorrow preview
  const live = todayLessons.find((l) => now.min >= toMin(l.start) && now.min < toMin(l.end));
  const next = todayLessons.find((l) => toMin(l.start) > now.min);

  let heroHtml = "";
  if (live) {
    const a = toMin(live.start), b = toMin(live.end);
    const pct = Math.max(4, Math.min(100, Math.round(((now.min - a) / Math.max(b - a, 1)) * 100)));
    const leftMin = Math.max(1, b - now.min);
    const place = [live.room, live.building].filter(Boolean).join(" · ");
    heroHtml = `<div class="pulse-hero">
      <div class="pulse-kicker"><span class="live-dot"></span>Идёт сейчас · ещё ${leftMin} мин</div>
      <div class="pulse-title">${esc(live.subject)}</div>
      <div class="pulse-meta">
        <span>${ico("clock")}${esc(live.start)}–${esc(live.end)}</span>
        ${place ? `<span>${ico("pin")}${esc(place)}</span>` : ""}
        ${live.teacher ? `<span>${ico("user")}${esc(live.teacher)}</span>` : ""}
      </div>
      <div class="pulse-prog"><i style="width:${pct}%"></i></div>
    </div>`;
  } else if (next) {
    const waitMin = toMin(next.start) - now.min;
    const waitTxt = waitMin < 60 ? `через ${waitMin} мин` : `в ${next.start}`;
    const place = [next.room, next.building].filter(Boolean).join(" · ");
    heroHtml = `<div class="pulse-hero">
      <div class="pulse-kicker">Следующая пара · ${esc(waitTxt)}</div>
      <div class="pulse-title">${esc(next.subject)}</div>
      <div class="pulse-meta">
        <span>${ico("clock")}${esc(next.start)}–${esc(next.end)}</span>
        ${place ? `<span>${ico("pin")}${esc(place)}</span>` : ""}
        ${next.teacher ? `<span>${ico("user")}${esc(next.teacher)}</span>` : ""}
      </div>
    </div>`;
  } else {
    const firstTom = tomorrowLessons[0];
    heroHtml = `<div class="pulse-hero calm">
      <div class="pulse-kicker">${todayLessons.length ? "На сегодня пары закончились" : "Сегодня свободный день"}</div>
      <div class="pulse-title">${firstTom ? `Завтра в ${esc(firstTom.start)} — ${esc(firstTom.subject)}` : "Можно спокойно закрыть задачи"}</div>
      ${firstTom ? `<div class="pulse-meta"><span>${ico("clock")}${tomorrowLessons.length} ${plural(tomorrowLessons.length, "пара", "пары", "пар")} завтра</span>${firstTom.room ? `<span>${ico("pin")}${esc(firstTom.room)}</span>` : ""}</div>` : ""}
    </div>`;
  }

  // 2. Bento 3-Tile KPI Strip
  const gpaVal = grades && grades.perf && grades.perf.gpa_calc != null ? grades.perf.gpa_calc : "—";
  const nbRows = (nb && nb.report && nb.report.rows) || [];
  const nbTotal = nb && nb.report ? Number(nb.report.total_hours || 0) : null;
  const nbFail = nbRows.some((r) => r.status === "fail");
  const nbWarn = nbRows.some((r) => r.status === "warn");
  const nbTone = nbFail ? "bad" : nbWarn ? "warn" : nbTotal === 0 ? "ok" : "";

  const upExams = ((exams && exams.exams) || []).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextEx = upExams[0];
  const exDays = nextEx ? Math.round((parseISO(nextEx.date) - parseISO(today)) / 864e5) : null;
  const exVal = nextEx ? (exDays === 0 ? "Сегодня" : exDays === 1 ? "Завтра" : `${exDays} дн.`) : "—";
  const exTone = exDays != null && exDays <= 3 ? "warn" : "";

  const bentoHtml = `<div class="bento-3">
    <button class="bento-tile" data-a="jumpstudy" data-k="grades">
      <b>${gpaVal}</b>
      <span>GPA семестра</span>
    </button>
    <button class="bento-tile ${nbTone}" data-a="jumpstudy" data-k="nb">
      <b>${nbTotal != null ? `${num(nbTotal)} ч` : "—"}</b>
      <span>${nbFail ? "НБ · лимит!" : nbWarn ? "НБ · риск" : "Пропуски НБ"}</span>
    </button>
    <button class="bento-tile ${exTone}" data-a="jumpstudy" data-k="exams">
      <b>${exVal}</b>
      <span>Ближ. экзамен</span>
    </button>
  </div>`;

  // 3. Priority Alerts (NB risks + Urgent tasks + Nearest exam <= 7d)
  const alerts = [];
  nbRows.filter((r) => r.status === "fail" || r.status === "warn").forEach((r) => {
    alerts.push({
      tone: r.status === "fail" ? "bad" : "warn",
      title: `НБ: ${r.subject}`,
      sub: `${num(r.hours)} / ${num(r.limit_hours)} ч · ${r.status === "fail" ? "лимит превышен" : `осталось ${pairsWord(r.left_pairs)}`}`,
      pill: r.status === "fail" ? "Лимит" : "Риск",
      pillTone: r.status === "fail" ? "tone-bad" : "tone-warn",
      target: "nb",
    });
  });

  const activeTasks = ((tasks && tasks.tasks) || [])
    .filter((t) => !t.graded && !t.sent_at)
    .map((t) => ({ ...t, mLeft: minutesLeft(t.deadline) }))
    .sort((a, b) => (a.mLeft ?? 9e9) - (b.mLeft ?? 9e9));

  activeTasks.slice(0, 3).forEach((t) => {
    const overdue = t.overdue || (t.mLeft != null && t.mLeft < 0);
    const soon = t.mLeft != null && t.mLeft >= 0 && t.mLeft < 2880;
    alerts.push({
      tone: overdue ? "bad" : soon ? "warn" : "accent",
      title: t.title,
      sub: `${t.subject}${t.deadline ? ` · до ${dm(t.deadline)}` : ""}`,
      pill: t.mLeft != null ? leftLabel(t.mLeft) : "Задание",
      pillTone: overdue ? "tone-bad" : soon ? "tone-warn" : "",
      target: "tasks",
    });
  });

  if (nextEx && exDays <= 7) {
    alerts.push({
      tone: exDays <= 2 ? "bad" : "warn",
      title: `Экзамен: ${nextEx.subject}`,
      sub: `${dm(nextEx.date)} · ${nextEx.start}${nextEx.room ? ` · ауд. ${nextEx.room}` : ""}`,
      pill: exDays === 0 ? "Сегодня" : exDays === 1 ? "Завтра" : `через ${exDays} дн.`,
      pillTone: exDays <= 2 ? "tone-bad" : "tone-warn",
      target: "exams",
    });
  }

  let alertsHtml = `<div class="section-hd">
    <h2>Самое важное</h2>
    ${activeTasks.length ? `<button class="link-btn" data-a="jumpstudy" data-k="tasks">Все задачи →</button>` : ""}
  </div>`;
  if (!alerts.length) {
    alertsHtml += `<div class="card between small"><span class="muted">Срочных дедлайнов и рисков по НБ нет</span><span class="pill tone-ok">Всё чисто</span></div>`;
  } else {
    alertsHtml += `<div class="card flush">${alerts.map((a) => `<button class="alert-row" data-a="jumpstudy" data-k="${a.target}">
      <span class="alert-dot ${a.tone}"></span>
      <span class="grow" style="min-width:0">
        <b style="display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.title)}</b>
        <span class="tiny muted">${esc(a.sub)}</span>
      </span>
      <span class="pill ${a.pillTone}">${esc(a.pill)}</span>
    </button>`).join("")}</div>`;
  }

  // 4. Today's Schedule Compact Timeline
  let schedHtml = `<div class="section-hd">
    <h2>Пары сегодня${todayLessons.length ? ` · ${todayLessons.length}` : ""}</h2>
    <button class="link-btn" data-a="tab" data-tab="schedule">Неделя →</button>
  </div>`;
  if (!todayLessons.length) {
    schedHtml += `<div class="card small muted" style="text-align:center">Сегодня занятий по расписанию нет</div>`;
  } else {
    schedHtml += todayLessons.map((l) => lessonCard(l, lessonState(l, true, now.min))).join("");
  }

  return heroHtml + bentoHtml + alertsHtml + schedHtml;
}

// ---------------------------------------------------------------- Tab 2: Расписание
const typeClass = (t) => { const x = (t || "").toLowerCase(); return x.includes("лек") || x.includes("lec") ? "tag-lec" : x.includes("лаб") || x.includes("lab") ? "tag-lab" : "tag-prac"; };

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
  const prog = st.state === "now" ? `<div class="progress"><i style="width:${prev}%" data-w="${st.pct}"></i></div>` : "";
  const chips = `${no ? `<span class="chip">${esc(no)} пара</span>` : ""}${l.type ? `<span class="tag ${typeClass(l.type)}">${esc(l.type)}</span>` : ""}${st.state === "now" ? '<span class="tag tag-now">Сейчас</span>' : ""}`;
  return `<div class="card lesson ${st.state} ${open ? "open" : ""}">
    <div class="lesson-main" data-a="lesson" data-key="${esc(key)}" role="button" tabindex="0" aria-expanded="${open}">
      <div class="l-time"><b>${esc(l.start)}</b><span>${esc(l.end)}</span></div>
      <div class="l-sep"></div>
      <div class="l-body">
        <div class="chips">${chips}</div>
        <div class="lname">${esc(l.subject)}</div>
        <div class="meta-inline">${place ? `<span>${ico("pin")}${esc(place)}</span>` : ""}${l.teacher ? `<span>${ico("user")}${esc(l.teacher)}</span>` : ""}</div>
        ${prog}
      </div>
      <span class="l-chev">${ico("right")}</span>
    </div>
    <div class="l-detail"><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
  </div>`;
}

function renderSchedule(d) {
  const mon = parseISO(d.monday), now = nowTk(), today = now.iso, days = [];
  for (let i = 0; i < 7; i++) {
    const day = iso(addDays(mon, i));
    days.push({ iso: day, i, lessons: (d.lessons || []).filter((l) => l.date === day).sort((a, b) => toMin(a.start) - toMin(b.start)) });
  }
  if (!S.day || !days.some((x) => x.iso === S.day)) S.day = (days.find((x) => x.iso === today) || days.find((x) => x.lessons.length) || days[0]).iso;
  const label = S.week === 0 ? "Эта неделя" : S.week === 1 ? "Следующая" : S.week === -1 ? "Прошлая" : "Неделя";
  const head = pager({ label, sub: `${dm(d.monday)} – ${dm(d.sunday)}`, prev: S.week > -8, next: S.week < 8, action: "week" });
  const strip = `<div class="days">${days.map((x) => `<button class="day ${x.iso === S.day ? "sel" : ""} ${x.iso === today ? "today" : ""} ${x.lessons.length ? "has" : ""}" data-a="day" data-day="${x.iso}"><span>${WD[x.i]}</span><b>${Number(x.iso.slice(8))}</b><i class="dot"></i></button>`).join("")}</div>`;
  if (!d.published) return head + empty("⏳", "Неделя не опубликована", "Университет пока не выложил это расписание.");
  const cur = days.find((x) => x.iso === S.day), lessons = cur.lessons, isToday = cur.iso === today;
  const title = isToday ? "Сегодня" : `${WD[cur.i]}, ${dm(cur.iso)}`;
  if (!lessons.length) return head + strip + empty("🎉", `${title} · пар нет`, "Свободный день.");
  const from = Math.min(...lessons.map((l) => toMin(l.start))), to = Math.max(...lessons.map((l) => toMin(l.end)));
  return head + strip + `<div class="section-hd"><h2>${title} · ${lessons.length} ${plural(lessons.length, "пара", "пары", "пар")}</h2><span class="tiny muted">${hhmm(from)} – ${hhmm(to)}</span></div>`
    + lessons.map((l) => lessonCard(l, lessonState(l, isToday, now.min))).join("");
}

// ---------------------------------------------------------------- Tab 3: Учёба (Grades, NB, Exams, Tasks)
const STUDY_SEG = [["grades", "Оценки"], ["nb", "НБ"], ["exams", "Экзамены"], ["tasks", "Задания"]];
const studyHeader = () => (!S.sub && S.tab === "study" ? seg(STUDY_SEG, S.studyTab, "studytab") : "");

const NB_STATUS = { ok: "В норме", warn: "Риск", fail: "Лимит!", unknown: "Лимит ?" };
const NB_TONE = { ok: "tone-ok", warn: "tone-warn", fail: "tone-bad", unknown: "" };

function renderNb(d) {
  const r = (d && d.report) || {};
  const activeSem = String(S.sem.nb || r.semester || (d && d.semesters && d.semesters.current) || "13");
  S.sem.nb = activeSem;
  let html = studyHeader() + semPager(d && d.semesters, activeSem);
  const rows = Array.isArray(r.rows) ? r.rows : [];
  const rowsWithNb = rows.filter((row) => Number(row.hours) > 0 || Number(row.excused_h) > 0 || (row.records && row.records.length > 0));
  const totalH = Number(r.total_hours || 0), excH = Number(r.excused_total || 0);
  html += `<div class="tiles"><div class="tile"><b>${num(totalH)} ч</b><span>Пропущено</span></div><div class="tile"><b>${num(excH)} ч</b><span>Уважит.</span></div><div class="tile"><b>${num(r.limit_pct ?? 25)}%</b><span>Лимит</span></div></div>`;
  if (!rowsWithNb.length && totalH === 0 && excH === 0) return html + empty("🎉", "Нет пропусков", "В этом семестре пропусков (НБ) нет.");
  return html + (rowsWithNb.length ? rowsWithNb : rows).map((row, idx) => {
    const key = `nb${activeSem}_${idx}`, open = S.open.has(key), used = row.limit_hours ? Math.min(row.hours / row.limit_hours, 1) : 0;
    const status = NB_STATUS[row.status] ? row.status : "unknown", approx = row.hours_src === "schedule" ? "≈" : "";
    const hours = row.limit_hours ? `<b>${num(row.hours)}</b> / ${approx}${num(row.limit_hours)} ч` : `<b>${num(row.hours)}</b> ч`;
    const left = !row.limit_hours ? "лимит неизвестен" : row.status === "fail" ? "лимит превышен" : `ещё <b>${pairsWord(row.left_pairs)}</b>`;
    const records = row.records && row.records.length ? `<div class="records" ${open ? "" : "hidden"}>${row.records.map((a) => `<div><span class="d">${esc(dm(a.date))}</span><span>${esc(a.pair)} пара · ${esc(a.type)}</span><span class="muted" style="margin-left:auto">${num(a.unexcused_h)} ч</span></div>`).join("")}</div>` : "";
    return `<div class="card tap" data-a="toggle" data-key="${key}"><div class="between"><b>${esc(row.subject)}</b><span class="pill ${NB_TONE[status]}">${NB_STATUS[status]}</span></div>
      <div class="bar ${status}"><i style="width:${(used * 100).toFixed(0)}%"></i></div><div class="foot"><span>${hours}</span><span>${left}</span></div>${records}</div>`;
  }).join("");
}

const EXAM_TABS = [["1", "1-ON"], ["2", "2-ON"], ["c", "Текущ."], ["s", "Сессия"]];
function renderExams(d) {
  const activeSem = String(S.sem.exams || d.semester || "13");
  S.sem.exams = activeSem;
  const today = nowTk().iso, by = { 1: [], 2: [], c: [], s: [] };
  (d.exams || []).forEach((e) => { if (by[e.group]) by[e.group].push(e); });
  if (!S.examTab || !by[S.examTab]) {
    const up = Object.entries(by).map(([k, v]) => [k, v.filter((e) => e.date >= today)]).filter(([, v]) => v.length).map(([k, v]) => [k, v[0].date]);
    S.examTab = up.length ? up.sort((a, b) => a[1].localeCompare(b[1]))[0][0] : ["s", "c", "2", "1"].find((k) => by[k].length) || "s";
  }
  const tabs = EXAM_TABS.map(([k, t]) => [k, t, by[k].length ? String(by[k].length) : ""]);
  let html = studyHeader() + semPager(d.semesters, activeSem) + seg(tabs, S.examTab, "examtab");
  const items = by[S.examTab];
  if (!(d.exams && d.exams.length)) return html + empty("🗓", "Экзамены не опубликованы", "Даты появятся здесь сразу после публикации в HEMIS.");
  if (!items.length) return html + empty("✨", "В этой категории экзаменов нет", "");
  const card = (e) => {
    const day = parseISO(e.date), left = Math.round((day - parseISO(today)) / 864e5);
    const when = left < 0 ? ["прошёл", ""] : left === 0 ? ["сегодня", "tone-bad"] : left === 1 ? ["завтра", "tone-warn"] : [`${left} дн.`, left <= 3 ? "tone-warn" : ""];
    return `<div class="card exam ${left < 0 ? "past" : ""}">
      <div class="edate"><b>${day.getUTCDate()}</b><span>${MON[day.getUTCMonth()]}</span></div>
      <div class="grow" style="min-width:0">
        <b style="display:block">${esc(e.subject)}</b>
        <div class="meta-inline"><span>${ico("clock")}${WD[(day.getUTCDay() + 6) % 7]}, ${esc(e.start)}${e.end ? `–${esc(e.end)}` : ""}</span>${e.room ? `<span>${ico("pin")}${esc(e.room)}</span>` : ""}</div>
      </div>
      <span class="pill ${when[1]}">${when[0]}</span>
    </div>`;
  };
  const main = items.filter((e) => e.sheet === 1), retake = items.filter((e) => e.sheet !== 1);
  html += main.map(card).join("");
  if (retake.length) html += `<div class="section-hd"><h2>Пересдача</h2></div>` + retake.map(card).join("");
  return html;
}

const grade5 = (pct) => (pct == null ? null : pct >= 86 ? 5 : pct >= 71 ? 4 : pct >= 55 ? 3 : 2);
function renderGrades(d) {
  const p = d.perf || { subjects: [], credits: 0 };
  const activeSem = String(S.sem.grades || p.semester || "13");
  S.sem.grades = activeSem;
  let html = studyHeader() + semPager(d.semesters, activeSem);
  html += `<div class="tiles four"><div class="tile"><b>${p.gpa_calc ?? "—"}</b><span>GPA</span></div><div class="tile"><b>${p.avg_pct != null ? num(p.avg_pct) + "%" : "—"}</b><span>Средний</span></div><div class="tile"><b>${p.credits}</b><span>Кредитов</span></div><div class="tile"><b>${p.subjects.length}</b><span>Предметов</span></div></div>`;
  if (!p.subjects.length) return html + empty("🎓", "Предметов пока нет", "");
  return html + p.subjects.map((s) => {
    const o = s.overall, has = o && o.ball != null && o.ball !== 0, g = s.grade5 || (has ? grade5(o.pct) : null);
    const parts = [["Текущий", s.current], ["Промеж.", s.mid], ["Итоговый", s.final], ...(s.extra || []).map((x) => [x.name, x])].filter(([, v]) => v && v.ball != null);
    return `<div class="card grade ${g ? "g" + g : ""}"><div class="row" style="gap:12px">
      <div class="ring" style="--p:${has ? Math.min(o.pct || 0, 100) : 0}"><b>${has ? num(o.pct) + "%" : "—"}</b></div>
      <div class="grow"><b>${esc(s.name)}</b><div class="muted small">${s.credit} кр.${has ? ` · ${num(o.ball)} / ${num(o.max)} б.` : " · учебный план"}</div></div>
      ${g ? `<div class="gbadge">${g}</div>` : ""}</div>
      ${parts.length ? `<div class="parts">${parts.map(([n, v]) => `<div><div class="ptop"><b>${esc(n)}</b><span>${num(v.ball)}${v.max ? ` / ${num(v.max)}` : ""}</span></div><div class="pb"><i style="width:${Math.min(v.pct ?? (v.max ? (v.ball / v.max) * 100 : 0), 100)}%"></i></div></div>`).join("")}</div>` : ""}
    </div>`;
  }).join("");
}

const taskGroup = (t) => (t.graded ? "graded" : t.overdue ? "overdue" : "active");
function renderTasks(d) {
  const activeSem = String(S.sem.tasks || d.semester || "13");
  S.sem.tasks = activeSem;
  const allTasks = d.tasks || [];
  const groups = { active: [], overdue: [], graded: [], all: allTasks };
  allTasks.forEach((t) => groups[taskGroup(t)].push(t));
  const tabs = [["active", "Актив."], ["overdue", "Проср."], ["graded", "Оцен."], ["all", "Все"]].map(([k, t]) => [k, t, groups[k].length ? String(groups[k].length) : ""]);
  let html = studyHeader() + semPager(d.semesters, activeSem) + seg(tabs, S.taskTab, "tasktab");
  const list = groups[S.taskTab];
  if (!list.length) return html + empty("🎉", S.taskTab === "active" ? "Активных заданий нет" : "Пусто", "");
  return html + list.map((t) => {
    const key = `t${t.id}`, open = S.open.has(key), m = t.graded ? null : minutesLeft(t.deadline);
    const badge = t.graded ? `<span class="pill tone-ok">${num(t.mark)}${t.max_ball ? `/${num(t.max_ball)}` : ""}</span>`
      : t.sent_at ? '<span class="pill tone-violet">Отправлено</span>'
      : m != null ? `<span class="pill ${m < 0 ? "tone-bad" : m < 2880 ? "tone-warn" : ""}">${leftLabel(m)}</span>` : "";
    const detail = `<div class="detail" ${open ? "" : "hidden"}>
      ${t.description ? `<p>${esc(t.description)}</p>` : ""}
      ${t.teacher_comment ? `<p class="muted"><b>Преподаватель:</b> ${esc(t.teacher_comment)}</p>` : ""}
      ${t.teacher ? `<div class="meta-inline"><span>${ico("user")}${esc(t.teacher)}</span><span>Попытки: ${esc(t.attempts)}</span></div>` : ""}
      ${fileList(t.files)}
      <button class="btn tonal block" data-a="send" data-type="task" data-id="${esc(t.id)}">${ico("send")}Карточка и ИИ-разбор в боте</button>
    </div>`;
    return `<div class="card tap" data-a="toggle" data-key="${key}"><div class="between" style="align-items:flex-start">
      <div class="grow"><b>${esc(t.title)}</b><div class="muted small">${esc(t.subject)}${t.lesson_type ? " · " + esc(t.lesson_type) : ""}</div></div>${badge}</div>
      ${t.deadline ? `<div class="meta-inline"><span>${ico("clock")}до ${esc(dm(t.deadline))} ${esc(t.deadline.slice(11))}</span></div>` : ""}${detail}</div>`;
  }).join("");
}

// ---------------------------------------------------------------- Tab 4: Ещё + Sub-screens
const MENU = [
  ["resources", "Учебные ресурсы", "Лекции и презентации по предметам", "book", "ok"],
  ["subjects", "Предметы семестра", "Кредиты и нагрузка (1–8 семестр)", "layers", "brand"],
  ["contract", "Контракт на обучение", "Оплата, остаток и ежемесячный план", "wallet", "warn"],
  ["settings", "Уведомления", "Бот и Helper · время и частота", "bell", "bad"],
];

function renderMore() {
  return `<div class="card flush">${MENU.map(([id, t, sub, icon, tone]) =>
    `<button class="menu-row" data-a="open" data-sub="${id}"><span class="menu-ico tone-${tone}">${ico(icon)}</span><span class="grow"><b>${t}</b><span class="menu-sub">${sub}</span></span><span class="muted">${ico("right")}</span></button>`
  ).join("")}</div>`;
}

function renderSubjects(d) {
  const p = d.perf || { subjects: [], credits: 0 };
  const activeSem = String(S.sem.subjects || p.semester || "13");
  S.sem.subjects = activeSem;
  const html = semPager(d.semesters, activeSem);
  if (!p.subjects.length) return html + empty("📚", "Предметов пока нет", "");
  const total = p.subjects.reduce((a, s) => a + (s.load || 0), 0);
  return html + `<div class="tiles"><div class="tile"><b>${p.subjects.length}</b><span>Предметов</span></div><div class="tile"><b>${p.credits}</b><span>Кредитов</span></div><div class="tile"><b>${total || "—"}</b><span>Часов</span></div></div>`
    + p.subjects.map((s) => `<div class="card"><b>${esc(s.name)}</b><div class="chips" style="margin-top:8px"><span class="pill tone-brand">${s.credit} кр.</span>${s.load ? `<span class="chip">${s.load} ч</span>` : ""}${s.kind ? `<span class="chip">${esc(s.kind)}</span>` : ""}</div></div>`).join("");
}

function renderResources(d) {
  const activeSem = String(S.sem.resources || d.semester || "13");
  S.sem.resources = activeSem;
  if (!S.res.subject) {
    const html = semPager(d.semesters, activeSem);
    const list = (d.subjects || []).filter((x) => x.resources);
    if (!list.length) return html + empty("📖", "Материалов пока нет", "Ресурсы появятся после загрузки преподавателями.");
    return html + `<div class="card flush">${list.map((x) => `<button class="menu-row" data-a="subject" data-id="${esc(x.id)}" data-name="${esc(x.name)}"><span class="menu-ico tone-violet">${ico("book")}</span>
      <span class="grow"><b>${esc(x.name)}</b><span class="menu-sub">${x.resources} ${plural(x.resources, "материал", "материала", "материалов")}</span></span><span class="muted">${ico("right")}</span></button>`).join("")}</div>`;
  }
  if (!d.resources || !d.resources.length) return empty("✨", "Материалов нет", "");
  const kinds = [...new Set(d.resources.map((r) => r.kind).filter(Boolean))];
  const rank = (k) => (/лек/i.test(k) ? 0 : /практ|семин/i.test(k) ? 1 : 2);
  kinds.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ru"));
  if (S.resKind !== "all" && !kinds.includes(S.resKind)) S.resKind = "all";
  const tabs = kinds.length > 1 ? seg([["all", "Все", String(d.resources.length)], ...kinds.map((k) => [k, k, String(d.resources.filter((r) => r.kind === k).length)])], S.resKind, "reskind") : "";
  const shown = S.resKind === "all" ? d.resources : d.resources.filter((r) => r.kind === S.resKind);
  return tabs + shown.map((r) => {
    const key = `r${r.id}`, open = S.open.has(key);
    const items = r.items.map((i) => `${i.url ? `<div class="file">${ico("link")}<span><a class="link" data-a="link" data-url="${esc(i.url)}">${esc(i.comment || i.type || i.url)}</a></span></div>` : ""}${fileList(i.files)}`).join("");
    return `<div class="card tap" data-a="toggle" data-key="${key}"><div class="between"><b>${esc(r.title)}</b>${r.files_count ? `<span class="pill">${r.files_count} ф.</span>` : ""}</div>
      <div class="chips" style="margin-top:6px">${r.kind ? `<span class="tag ${r.kind.toLowerCase().includes("лек") ? "tag-lec" : "tag-prac"}">${esc(r.kind)}</span>` : ""}${(r.languages || []).map((l) => `<span class="chip">${esc(l)}</span>`).join("")}</div>
      <div class="detail" ${open ? "" : "hidden"}>${r.teacher ? `<div class="meta-inline"><span>${ico("user")}${esc(r.teacher)}</span></div>` : ""}${r.comment && r.comment.length > 3 ? `<p>${esc(r.comment)}</p>` : ""}${items}
        ${r.files_count ? `<button class="btn tonal block" data-a="send" data-type="resource" data-id="${esc(r.id)}" data-subject="${esc(S.res.subject)}" data-semester="${esc(activeSem)}">${ico("send")}Прислать файлы и конспект в чат</button>` : ""}</div></div>`;
  }).join("");
}

function renderContract(c) {
  const pct = c.paid_pct != null ? Math.min(c.paid_pct, 100) : null;
  const info = [["Специальность", c.speciality], ["Курс", c.course], ["Форма", c.form], ["Учебный год", c.year], ["GPA", c.gpa]].filter(([, v]) => v != null && v !== "");
  const monthlyRec = c.remaining > 0 ? Math.round(c.remaining / 7) : 0;
  return `<div class="card">
      <div class="between"><b>Оплата контракта</b><span class="pill ${c.remaining > 0 ? "tone-warn" : "tone-ok"}">${c.remaining > 0 ? "есть остаток" : "оплачено"}</span></div>
      <div class="bar ok" style="height:8px;margin:12px 0 8px"><i style="width:${pct ?? 0}%"></i></div>
      <div class="foot"><span>${pct != null ? `Оплачено ${num(pct)}%` : ""}</span>${monthlyRec > 0 ? `<span>План: <b>${money(monthlyRec)}</b> / мес.</span>` : ""}</div>
    </div>
    <div class="tiles"><div class="tile"><b>${money(c.total)}</b><span>Всего</span></div><div class="tile"><b>${money(c.paid)}</b><span>Оплачено</span></div><div class="tile"><b>${money(c.remaining)}</b><span>Остаток</span></div></div>
    ${c.remaining > 0 ? `<button class="btn block" data-a="copy" data-text="${Math.round(c.remaining)}">${ico("copy")}Скопировать остаток</button>` : ""}
    ${info.length ? `<div class="card">${info.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>`).join("")}</div>` : ""}`;
}

// ---------- Two-branch Notifications
const BOT_TOGGLE_META = [
  ["bot_briefing_on", "Утренний ИИ-брифинг", "План дня, задачи, погода и приоритеты"],
  ["bot_finance_on", "Вечерний итог дня", "Выполненные дела и напоминания на завтра"],
  ["bot_model_footer", "Подпись модели ИИ", "Указывать название модели под ответом"],
];
const HEMIS_TOGGLE_META = [
  ["morning_on", "Утренняя сводка пар", "Список пар, корпусов и аудиторий на сегодня"],
  ["lesson_alert_on", "Перед началом пары", "Пуш с аудиторией до звонка"],
  ["prep_on", "Подготовка к семинарам", "Вечернее напоминание о практиках на завтра"],
  ["changes_on", "Изменения расписания", "Мгновенно при переносе или смене кабинета"],
  ["nb_on", "Новые пропуски (НБ)", "Уведомление и расчёт остатка до 25%"],
  ["grades_on", "Новые оценки и баллы", "Текущие, промежуточные и итоговые баллы"],
  ["tasks_on", "Новые задания", "Когда в HEMIS добавлена новая работа"],
  ["deadlines_on", "Дедлайны", "Контроль сроков сдачи работ"],
  ["exams_on", "Экзамены и ведомости", "Новые даты сессии и напоминания"],
];

function renderFreqRow(title, sub, prefKey, curVal, options) {
  return `<div class="notif-row">
    <div><b>${esc(title)}</b>${sub ? `<span class="menu-sub">${esc(sub)}</span>` : ""}</div>
    <div class="freq-pills">${options.map(([val, label]) => `<button class="freq-pill ${curVal === val ? "on" : ""}" data-a="notiffreq" data-key="${esc(prefKey)}" data-val="${esc(val)}">${esc(label)}</button>`).join("")}</div>
  </div>`;
}
function renderTimeRow(title, sub, prefKey, curVal, presets) {
  return `<div class="notif-row">
    <div class="notif-head">
      <div><b>${esc(title)}</b>${sub ? `<span class="menu-sub">${esc(sub)}</span>` : ""}</div>
      <input type="time" class="time-inp" value="${esc(curVal)}" data-a="notiftime" data-key="${esc(prefKey)}">
    </div>
    <div class="freq-pills">${presets.map((t) => `<button class="freq-pill ${curVal === t ? "on" : ""}" data-a="notiffreq" data-key="${esc(prefKey)}" data-val="${esc(t)}">${esc(t)}</button>`).join("")}</div>
  </div>`;
}

function renderSettings(d) {
  const prefs = getNotifPrefs(d && d.prefs);
  const toggleMap = {};
  ((d && d.toggles) || []).forEach((t) => { toggleMap[t.key] = Boolean(t.on); });
  const isOn = (key) => (key in toggleMap ? toggleMap[key] : true);

  const branchTabs = seg([["bot", "🤖 Бот Джарвис"], ["hemis", "🎓 Helper / HEMIS"]], S.notifBranch, "notifbranch");

  if (S.notifBranch === "bot") {
    return branchTabs
      + `<div class="section-hd"><h2>Время и тихий час</h2></div>
        <div class="card">
          ${renderTimeRow("Утренний брифинг", "План дня и курс валют", "bot_morning_time", prefs.bot_morning_time, ["06:00", "07:00", "07:30", "08:00", "09:00"])}
          ${renderTimeRow("Вечерний итог", "Дела и план на завтра", "bot_evening_time", prefs.bot_evening_time, ["20:00", "21:00", "22:00", "23:00"])}
          ${renderFreqRow("Тихий час (Ташкент)", "Без звуковых уведомлений ночью", "bot_quiet_hours", prefs.bot_quiet_hours, [["23:30-05:50", "23:30–05:50"], ["00:00-06:00", "00:00–06:00"], ["off", "Выкл"]])}
        </div>
        <div class="section-hd"><h2>Категории · Бот</h2></div>
        <div class="card flush">${BOT_TOGGLE_META.map(([key, label, sub]) => `<button class="menu-row" data-a="setting" data-key="${esc(key)}"><span class="grow"><b>${esc(label)}</b><span class="menu-sub">${esc(sub)}</span></span><span class="switch ${isOn(key) ? "on" : ""}"></span></button>`).join("")}</div>`;
  }

  const warn = d && d.auth_failed ? `<div class="card between"><b style="color:var(--bad)">HEMIS не принял пароль</b><span class="tiny muted">Обновите в боте</span></div>` : "";
  const last = d && d.last_ok_at ? `<p class="muted tiny" style="text-align:center;margin:0">Синхронизация: ${esc(String(d.last_ok_at).replace("T", " ").slice(0, 16))}</p>` : "";
  return branchTabs + warn
    + `<div class="section-hd"><h2>Расписание опроса</h2></div>
      <div class="card">
        ${renderFreqRow("Опрос HEMIS (05:40–23:00)", "Частота проверки обновлений", "hemis_poll_freq", prefs.hemis_poll_freq, [["20m_540_2300", "20 мин (день)"], ["15m", "15 мин"], ["30m", "30 мин"], ["1h", "1 ч"]])}
        ${renderTimeRow("Утренняя сводка пар", "Расписание на сегодня", "hemis_morning_time", prefs.hemis_morning_time, ["06:30", "07:00", "07:30", "08:00"])}
        ${renderTimeRow("Напоминание о семинарах", "Вечерняя проверка на завтра", "hemis_prep_time", prefs.hemis_prep_time, ["16:00", "18:00", "19:00", "20:00"])}
        ${renderFreqRow("Перед началом пары", "За сколько минут до звонка", "hemis_before_min", prefs.hemis_before_min, [["5", "5 мин"], ["10", "10 мин"], ["15", "15 мин"], ["30", "30 мин"]])}
        ${renderFreqRow("Напоминания о дедлайнах", "График предупреждений", "hemis_deadline_freq", prefs.hemis_deadline_freq, [["intensive", "7д / 3д / 1д / 3ч"], ["standard", "3д / 1д / 12ч / 1ч"], ["minimal", "24ч"]])}
      </div>
      <div class="section-hd"><h2>Категории · Helper</h2></div>
      <div class="card flush">${HEMIS_TOGGLE_META.map(([key, label, sub]) => `<button class="menu-row" data-a="setting" data-key="${esc(key)}"><span class="grow"><b>${esc(label)}</b><span class="menu-sub">${esc(sub)}</span></span><span class="switch ${isOn(key) ? "on" : ""}"></span></button>`).join("")}</div>` + last;
}

function heroFor(id, d) {
  switch (id) {
    case "pulse": return ["Главное", `${WD[(parseISO(nowTk().iso).getUTCDay() + 6) % 7]}, ${dm(nowTk().iso)}`];
    case "schedule": return ["Расписание", d ? `${dm(d.monday)} – ${dm(d.sunday)}` : ""];
    case "nb": return ["Пропуски (НБ)", `${semNo(S.sem.nb || (d && d.report && d.report.semester) || "13")}-й семестр`];
    case "exams": return ["Экзамены", `${semNo(S.sem.exams || (d && d.semester) || "13")}-й семестр`];
    case "grades": return ["Оценки и GPA", `${semNo(S.sem.grades || (d && d.perf && d.perf.semester) || "13")}-й семестр`];
    case "tasks": return ["Задания", `${semNo(S.sem.tasks || (d && d.semester) || "13")}-й семестр`];
    case "subjects": return ["Предметы", `${semNo(S.sem.subjects || (d && d.perf && d.perf.semester) || "13")}-й семестр`];
    case "resources": return S.res.subject ? [S.res.name || "Ресурсы", "Материалы"] : ["Ресурсы", `${semNo(S.sem.resources || (d && d.semester) || "13")}-й семестр`];
    case "contract": return ["Контракт", "Оплата и остаток"];
    case "settings": return ["Уведомления", S.notifBranch === "bot" ? "Бот Джарвис" : "Helper / HEMIS"];
    default: return ["Ещё", "Инструменты и настройки"];
  }
}

const RENDER = { pulse: renderPulse, schedule: renderSchedule, nb: renderNb, exams: renderExams, grades: renderGrades, more: renderMore, subjects: renderSubjects, tasks: renderTasks, resources: renderResources, contract: renderContract, settings: renderSettings };

function errorView(e) {
  const kinds = {
    not_connected: ["🔌", "HEMIS не подключён", "Откройте бота: Меню → Hemis → «Войти»."],
    unauthorized: ["🔒", "Нет доступа", "Откройте приложение кнопкой из бота."],
    network: ["📡", "Нет связи с ботом", "Проверьте интернет и повторите попытку."],
    noapi: ["🧭", "Не указан адрес бота", "Откройте приложение кнопкой из бота."],
    hemis: ["🏫", "HEMIS не отвечает", (e && e.message) || "Попробуйте позже."],
  };
  const [emoji, title, text] = kinds[e && e.kind] || ["⚠️", "Ошибка", (e && e.message) || "Попробуйте ещё раз."];
  return `<div class="card err-box"><div class="big">${emoji}</div><b>${esc(title)}</b><p class="muted small">${esc(text)}</p><button class="btn sm" style="margin-top:8px" data-a="retry">Повторить</button></div>`;
}

// ---------------------------------------------------------------- DOM runtime
if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const view = $("view"), loadbar = $("loadbar"), refreshBtn = $("refresh"), themeBtn = $("themeBtn");
  const SKELETON = '<div class="skel" style="height:112px"></div><div class="skel" style="height:76px"></div><div class="skel" style="height:130px"></div>';
  let toastTimer = 0, lastHtml = "", pressing = false, deferred = null;

  $("back").innerHTML = ico("left");
  $("refreshIco").innerHTML = ico("refresh");

  function renderTabsBar() {
    $("tabsIn").innerHTML = TABS.map((t) =>
      `<button class="tab ${S.tab === t.id && !S.sub ? "on" : ""}" data-a="tab" data-tab="${t.id}">${ico(t.icon)}<span>${t.label}</span></button>`
    ).join("");
  }
  renderTabsBar();

  function toast(text) {
    const el = $("toast"); el.textContent = text; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }
  const haptic = (kind) => {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (kind) tg.HapticFeedback.notificationOccurred(kind);
      else tg.HapticFeedback.selectionChanged();
    } catch (e) { /* ignore */ }
  };

  function syncThemeIcon() {
    if (!themeBtn) return;
    themeBtn.innerHTML = ico(document.documentElement.dataset.theme === "light" ? "moon" : "sun");
  }
  function applyTheme(light) {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    syncThemeIcon();
    const bgHex = light ? "#f5f6f8" : "#090a0d";
    const barHex = light ? "#ffffff" : "#0e1015";
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
    $("subtitle").textContent = sub || "";
    $("stamp").textContent = stampText(stamp);
    renderTabsBar();
    $("back").hidden = !S.sub;
    refreshBtn.hidden = id === "more";
    try { if (tg && tg.BackButton) S.sub ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) { /* ignore */ }
  }

  function show(html, anim) {
    if (html === lastHtml && !anim) return;
    view.innerHTML = html; lastHtml = html;
    view.className = "";
    if (anim) { const cls = `enter-${anim}`; void view.offsetWidth; view.classList.add(cls); setTimeout(() => view.classList.remove(cls), 200); }
    requestAnimationFrame(() => view.querySelectorAll(".progress i[data-w]").forEach((i) => { i.style.width = `${i.dataset.w}%`; }));
  }

  function paint(id, data, stamp, opts = {}) {
    if (opts.token != null && opts.token !== reqId) return;
    if (opts.bg && pressing) { deferred = () => paint(id, data, stamp, opts); return; }
    chrome(id, data, stamp);
    if (!data && id !== "more" && id !== "pulse") {
      if (SEM_SCREENS.has(id) && !(id === "resources" && S.res.subject)) {
        show(studyHeader() + semPager(null, S.sem[id] || "13") + SKELETON, opts.anim);
      } else show(SKELETON, opts.anim);
      return;
    }
    show(RENDER[id](data), opts.anim);
  }

  function readPulseBundle() {
    const pSched = `schedule?week=0&m=${mondayOf(0)}`;
    const eS = cget(pSched), eT = cget("tasks"), eN = cget("nb"), eE = cget("exams"), eG = cget("grades");
    const times = [eS, eT, eN, eE, eG].filter(Boolean).map((x) => x.t);
    return {
      hasAny: times.length > 0,
      stamp: times.length ? Math.max(...times) : 0,
      bundle: {
        schedule: eS && eS.data,
        tasks: eT && eT.data,
        nb: eN && eN.data,
        exams: eE && eE.data,
        grades: eG && eG.data,
      },
    };
  }

  async function loadPulse(my, force, anim) {
    const snap = readPulseBundle();
    if (snap.hasAny) paint("pulse", snap.bundle, snap.stamp, { anim, token: my });
    else { chrome("pulse", null, 0); show(SKELETON, anim); }

    const pSched = `schedule?week=0&m=${mondayOf(0)}`;
    const jobs = [
      [pSched, TTL.schedule],
      ["tasks", TTL.tasks],
      ["nb", TTL.nb],
      ["exams", TTL.exams],
      ["grades", TTL.grades],
    ].filter(([p, ttl]) => {
      if (force) return true;
      const e = cget(p);
      return !e || Date.now() - e.t >= ttl;
    });

    if (!jobs.length) { setBusy(false); return; }
    setBusy(true);
    let okCount = 0, lastErr = null;
    await Promise.allSettled(jobs.map(async ([p]) => {
      try {
        const data = await api(p, force);
        cset(p, data);
        okCount++;
        if (my === reqId) {
          const nextSnap = readPulseBundle();
          paint("pulse", nextSnap.bundle, Date.now(), { bg: true, token: my });
        }
      } catch (err) { lastErr = err; }
    }));
    if (my !== reqId) return;
    setBusy(false);
    if (!okCount && !snap.hasAny && lastErr) show(errorView(lastErr));
    else if (!okCount && snap.hasAny && force) toast("Нет связи — показаны кэшированные данные");
  }

  async function load(opts = {}) {
    const { force = false, anim = "fade" } = opts;
    const my = ++reqId, id = current();
    if (id === "pulse") return loadPulse(my, force, anim);
    const path = pathFor(id);
    if (!path) { paint(id, null, 0, { anim }); setBusy(false); return; }
    const e = cget(path);
    paint(id, e && e.data, e && e.t, { anim });
    if (e && !force && Date.now() - e.t < ttlOf(id)) { setBusy(false); return; }
    setBusy(true);
    try {
      const data = await api(path, force);
      cset(path, data);
      paint(id, data, Date.now(), { bg: true, token: my });
    } catch (err) {
      if (my !== reqId) return;
      if (e) toast("Нет связи — показаны сохранённые данные");
      else if (id === "nb") {
        const fallbackSem = String(S.sem.nb || "13");
        paint(id, { semesters: { codes: ALL_SEM_CODES, current: "13" }, report: { semester: fallbackSem, semester_no: semNo(fallbackSem), limit_pct: 25, total_hours: 0, excused_total: 0, rows: [] } }, Date.now(), { token: my });
      } else {
        show((SEM_SCREENS.has(id) ? studyHeader() + semPager(null, S.sem[id] || "13") : "") + errorView(err));
      }
    } finally {
      if (my === reqId) setBusy(false);
    }
  }

  const repaint = (anim) => {
    const id = current();
    if (id === "pulse") { const s = readPulseBundle(); paint("pulse", s.bundle, s.stamp, { anim }); return; }
    const e = cget(pathFor(id));
    if (e) paint(id, e.data, e.t, { anim });
  };

  const goBack = () => {
    if (S.sub === "resources" && S.res.subject) S.res.subject = null;
    else S.sub = null;
    S.open.clear(); load({ anim: "prev" });
  };

  function copyFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }

  const actions = {
    tab: (el) => { const t = el.dataset.tab; if (S.tab !== t || S.sub) { S.tab = t; S.sub = null; S.open.clear(); load(); } },
    studytab: (el) => { S.studyTab = el.dataset.k; S.open.clear(); load({ anim: "fade" }); },
    jumpstudy: (el) => { S.tab = "study"; S.sub = null; S.studyTab = el.dataset.k; S.open.clear(); load({ anim: "next" }); },
    open: (el) => { S.sub = el.dataset.sub; S.open.clear(); if (S.sub === "resources") S.res.subject = null; load({ anim: "next" }); },
    back: goBack,
    theme: () => {
      const nextLight = document.documentElement.dataset.theme !== "light";
      try { localStorage.setItem("jv2:theme", nextLight ? "light" : "dark"); } catch (e) {}
      applyTheme(nextLight);
    },
    refresh: () => { if (!refreshBtn.classList.contains("spin")) load({ force: true, anim: null }); },
    retry: () => load({ force: true }),
    week: (el) => { const dir = Number(el.dataset.dir); S.week += dir; S.day = null; load({ anim: dir > 0 ? "next" : "prev" }); },
    day: (el) => { S.day = el.dataset.day; repaint("fade"); },
    sem: (el) => {
      const id = current(), e = cget(pathFor(id)), sems = normalizeSemesters(e && e.data && e.data.semesters);
      const dir = Number(el.dataset.dir), cur = String(S.sem[id] || sems.current || "13");
      const i = (sems.codes.indexOf(cur) >= 0 ? sems.codes.indexOf(cur) : 2) + dir;
      if (i < 0 || i >= sems.codes.length) return;
      S.sem[id] = sems.codes[i]; if (id === "exams") S.examTab = null; S.open.clear();
      load({ anim: dir > 0 ? "next" : "prev" });
    },
    semjump: (el) => {
      const id = current(), code = String(el.dataset.code || "");
      if (!code || code === String(S.sem[id] || "13")) return;
      const prev = Number(S.sem[id] || 13);
      S.sem[id] = code; if (id === "exams") S.examTab = null; S.open.clear();
      load({ anim: Number(code) > prev ? "next" : "prev" });
    },
    examtab: (el) => { S.examTab = el.dataset.k; repaint("fade"); },
    notifbranch: (el) => { S.notifBranch = el.dataset.k; repaint("fade"); },
    notiffreq: async (el) => {
      const key = el.dataset.key, val = el.dataset.val;
      if (!key || val == null) return;
      saveNotifPref(key, val); repaint(null);
      try { await post("settings", { pref_key: key, pref_value: val }); } catch (e) {}
      toast("Сохранено ✅"); haptic("success");
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
      try { navigator.clipboard ? await navigator.clipboard.writeText(txt) : copyFallback(txt); toast("Скопировано"); haptic("success"); }
      catch (e) { copyFallback(txt); toast("Скопировано"); }
    },
    send: async (el) => {
      const d = el.dataset, label = el.innerHTML;
      el.disabled = true; el.textContent = "Отправляю…";
      try { await post("send", { type: d.type, id: d.id, subject: d.subject, semester: d.semester }); toast("Отправлено в чат ✅"); haptic("success"); }
      catch (err) { toast((err && err.message) || "Ошибка отправки"); haptic("error"); }
      el.disabled = false; el.innerHTML = label;
    },
    setting: async (el) => {
      const key = el.dataset.key, sw = el.querySelector(".switch"), on = !sw.classList.contains("on");
      sw.classList.toggle("on", on);
      try {
        await post("settings", { key, value: on });
        const path = pathFor("settings"), e = cget(path);
        if (e) {
          const t = (e.data.toggles || []).find((x) => x.key === key);
          if (t) t.on = on; else e.data.toggles = [...(e.data.toggles || []), { key, label: key, on }];
          cset(path, e.data);
        }
      } catch (err) { sw.classList.toggle("on", !on); toast("Не удалось сохранить"); }
    },
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-a]");
    if (!el || el.disabled || (el.tagName === "INPUT" && el.type === "time")) return;
    if (!["refresh", "send", "copy", "setting"].includes(el.dataset.a)) haptic();
    if (actions[el.dataset.a]) actions[el.dataset.a](el, ev);
  });

  document.addEventListener("change", async (ev) => {
    const el = ev.target.closest("input[data-a='notiftime']");
    if (!el || !el.dataset.key || !el.value) return;
    try { await post("settings", { pref_key: el.dataset.key, pref_value: el.value }); }
    catch (e) { toast((e && e.message) || "Не удалось сохранить"); haptic("error"); return; }
    saveNotifPref(el.dataset.key, el.value); repaint(null);
    toast(`Время: ${el.value} ⏰`); haptic("success");
  });

  const release = () => { pressing = false; if (deferred) { const f = deferred; deferred = null; setTimeout(f, 50); } };
  document.addEventListener("pointerdown", () => { pressing = true; }, { passive: true, capture: true });
  ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, release, { passive: true, capture: true }));

  setInterval(() => {
    if (document.hidden) return;
    const id = current();
    if (id === "pulse") { const s = readPulseBundle(); if (s.hasAny) paint("pulse", s.bundle, s.stamp, { bg: true, token: reqId }); return; }
    const e = cget(pathFor(id));
    if (!e) return;
    $("stamp").textContent = stampText(e.t);
    if (id === "schedule" && S.week === 0) paint(id, e.data, e.t, { bg: true, token: reqId });
  }, 30000);

  if (tg) {
    try { tg.requestFullscreen && tg.requestFullscreen(); } catch (e) {}
    tg.onEvent && tg.onEvent("themeChanged", setThemeFromEnv);
    tg.BackButton && tg.BackButton.onClick(goBack);
  }
  setThemeFromEnv();
  load();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load({ anim: null }); });
}

// ---------------------------------------------------------------- Demo state
const demoToggleState = { bot_briefing_on: true, bot_finance_on: true, bot_model_footer: true, morning_on: true, lesson_alert_on: true, prep_on: false, changes_on: true, nb_on: true, tasks_on: true, grades_on: true, deadlines_on: true, exams_on: true };

function demoSubjectsForSem(sem) {
  const sc = (name, ball, max) => ({ name, ball, max, pct: max ? Math.round((ball / max) * 1000) / 10 : null });
  const catalog = {
    "13": [
      { id: "1", name: "Ekonometrika", kind: "Majburiy", load: 120, credit: 6, overall: sc("Umumiy", 45, 50), grade5: 5, current: sc("Joriy", 26, 30), mid: sc("1-ON", 19, 20), final: null, extra: [] },
      { id: "2", name: "Statistika", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 41, 50), grade5: 4, current: sc("Joriy", 24, 30), mid: sc("1-ON", 17, 20), final: null, extra: [] },
      { id: "3", name: "Strategik marketing", kind: "Majburiy", load: 90, credit: 4, overall: sc("Umumiy", 36, 50), grade5: 4, current: sc("Joriy", 21, 30), mid: sc("1-ON", 15, 20), final: null, extra: [] },
      { id: "4", name: "Philosophy", kind: "Tanlov", load: 60, credit: 2, overall: sc("Umumiy", 88, 100), grade5: 5, current: sc("Joriy", 28, 30), mid: sc("Oraliq", 36, 40), final: sc("Yakuniy", 24, 30), extra: [] },
    ],
  };
  return catalog[sem] || catalog["13"];
}

function demoApi(path, method, body) {
  const today = nowTk().iso, base = parseISO(today);
  const q = new URLSearchParams(path.split("?")[1] || ""), kind = path.split("?")[0];
  const sems = { codes: ALL_SEM_CODES, current: "13" };
  const sem = sems.codes.includes(q.get("semester")) ? q.get("semester") : "13";
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 30));
  const d = (n) => iso(addDays(base, n));

  if (method === "POST") {
    if (kind === "settings" && body) {
      if (body.key) demoToggleState[body.key] = Boolean(body.value);
      if (body.pref_key) saveNotifPref(body.pref_key, body.pref_value);
    }
    return wait({ ok: true });
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
    [0, 1, 2, 3, 4, 5].forEach((i) => plan.forEach((p, j) => { if ((i + j) % 4 !== 3) lessons.push({ date: iso(addDays(mon, i)), pair: `${p[0]} пара`, start: p[1], end: p[2], subject: p[3], type: p[4], room: p[5], building: "Корпус A", teacher: p[6], group: "" }); }));
    return wait({ today, monday: iso(mon), sunday: iso(addDays(mon, 6)), published: Math.abs(off) < 3, lessons: Math.abs(off) < 3 ? lessons : [] });
  }
  if (kind === "nb") {
    const rows = sem === "13" ? [
      { subject: "Ekonometrika", hours: 6, pairs: 3, limit_hours: 15, hours_src: "manual", status: "ok", left_pairs: 4, records: [{ date: "2026-10-19", pair: "1", type: "Лекция", unexcused_h: 2 }] },
      { subject: "Philosophy", hours: 14, pairs: 7, limit_hours: 15, hours_src: "manual", status: "warn", left_pairs: 0, records: [{ date: "2026-10-12", pair: "2", type: "Лекция", unexcused_h: 2 }] },
    ] : [];
    return wait({ semesters: sems, report: { semester: sem, semester_no: semNo(sem), limit_pct: 25, total_hours: rows.reduce((a, r) => a + r.hours, 0), excused_total: sem === "13" ? 4 : 0, rows } });
  }
  if (kind === "exams") {
    const ex = (id, subject, group, sheet, n, start, end, room, teacher, k) => ({ id, subject, kind: k || "", group, sheet, date: d(n), start, end, room, teacher });
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), today, exams: sem === "13" ? [ex("1", "Strategik marketing", "2", 1, 3, "10:00", "11:20", "2-214", "MADAMINOVA S. N.", "2-ON"), ex("2", "Ekonometrika", "s", 1, 14, "09:00", "10:20", "3-505", "AKRAMOVA N. M.", "Yakuniy")] : [] });
  }
  if (kind === "grades") {
    const subjects = demoSubjectsForSem(sem);
    return wait({ semesters: sems, perf: { semester: sem, semester_no: semNo(sem), period: "09.2026 – 01.2027", subjects, credits: subjects.reduce((a, s) => a + s.credit, 0), avg_pct: 85.4, gpa_calc: 4.6 } });
  }
  if (kind === "tasks") {
    const t = (id, title, subject, n, hh, extra) => ({ id, title, subject, description: "Решите задачи и прикрепите отчёт.", kind: "Задание", lesson_type: "Практика", teacher: "Akramova N. M.", max_ball: 10, mark: null, graded: false, overdue: n < 0, deadline: `${d(n)} ${hh}`, attempts: "0/3", files: [{ name: "tasks.pdf", size: 245000, ext: "pdf" }], sent_at: null, ...extra });
    const tasks = sem === "13" ? [t("1", "Практикум №8: Эндогенность (2SLS)", "Ekonometrika", 2, "23:59"), t("2", "Расчёт ошибки выборки", "Statistika", -1, "12:00"), t("3", "МНК и Гаусс-Марков", "Ekonometrika", -8, "10:00", { graded: true, overdue: false, mark: 9.5 })] : [];
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), count: tasks.length, tasks });
  }
  if (kind === "resources") {
    if (q.get("subject")) return wait({ semesters: sems, semester: sem, subject_id: q.get("subject"), resources: [{ id: "1", title: "Тема 8. Эндогенность (2SLS)", comment: "Конспект лекции.", kind: "Лекция", languages: ["Русский"], teacher: "AKRAMOVA N. M.", items: [{ type: "Презентация", url: "", files: [{ name: "2sls.pptx", size: 1800000 }] }], files_count: 1 }] });
    return wait({ semesters: sems, semester: sem, subjects: [{ id: "149", name: "Ekonometrika", credit: 6, resources: 18 }, { id: "151", name: "Statistika", credit: 4, resources: 14 }] });
  }
  if (kind === "contract") return wait({ gpa: 4.6, speciality: "Iqtisodiyot (Экономика)", course: "2-курс", form: "Очная", year: "2026-2027", total: 12000000, paid: 7800000, remaining: 4200000, paid_pct: 65.0 });
  if (kind === "settings") {
    const allKeys = [...BOT_TOGGLE_META, ...HEMIS_TOGGLE_META];
    return wait({ auth_failed: false, last_ok_at: new Date().toISOString(), prefs: getNotifPrefs(), toggles: allKeys.map(([key, label]) => ({ key, label, on: key in demoToggleState ? demoToggleState[key] : true })) });
  }
  return wait({});
}

if (typeof module !== "undefined") {
  module.exports = { nowTk, lessonState, hhmm, lessonCard, mondayOf, normalizeSemesters, renderPulse, renderSchedule, renderNb, renderExams, renderGrades, renderSubjects, renderTasks, renderResources, renderContract, renderSettings, renderMore, demoApi, S, errorView, esc, pathFor, minutesLeft, leftLabel, heroFor };
}
