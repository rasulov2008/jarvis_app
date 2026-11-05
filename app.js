/* HEMIS · Джарвис — Telegram Mini App. Без сборки. Данные: API бота (или демо), кэш: память + localStorage. */
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
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const dm = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":"); return Number(h) * 60 + Number(m); };
const num = (x) => (x == null ? "—" : Number.isInteger(+x) ? String(+x) : (+x).toFixed(1).replace(/\.0$/, ""));
const money = (x) => (x == null ? "—" : Math.round(+x).toLocaleString("ru-RU").replace(/\u00a0/g, " "));
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
const pairsWord = (n) => `${n} ${plural(n, "пару", "пары", "пар")}`;
const semNo = (code) => Number(code) - 10;
const sizeKb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
};
const HERO_ICON = { schedule: "calendar", nb: "nb", exams: "exam", grades: "grades", more: "more", tasks: "tasks", resources: "book", subjects: "layers", contract: "wallet", settings: "bell" };
const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

// ---------------------------------------------------------------- состояние и кэш
const TABS = [
  { id: "schedule", label: "Расписание", icon: "calendar" },
  { id: "nb", label: "НБ", icon: "nb" },
  { id: "exams", label: "Экзамены", icon: "exam" },
  { id: "grades", label: "Оценки", icon: "grades" },
  { id: "more", label: "Ещё", icon: "more" },
];
const S = { tab: "schedule", sub: null, week: 0, day: null, sem: {}, examTab: null, taskTab: "active", resKind: "all", res: { subject: null, name: "" }, open: new Set(), pct: {} };

// Сколько данные считаются свежими на устройстве: пока свежие — сеть не трогаем вовсе (меньше запросов к боту и HEMIS).
const TTL = { schedule: 10 * 60e3, nb: 30 * 60e3, exams: 3 * 3600e3, grades: 60 * 60e3, subjects: 60 * 60e3, tasks: 30 * 60e3, resources: 3 * 3600e3, contract: 6 * 3600e3, settings: 0 };
const LS = "jv2:";
const mem = new Map();

function cget(path) {
  let e = mem.get(path);
  if (!e) {
    try { const raw = typeof localStorage !== "undefined" && localStorage.getItem(LS + path); if (raw) { e = JSON.parse(raw); mem.set(path, e); } } catch (err) { /* повреждённая запись */ }
  }
  return e;
}
function cset(path, data) {
  const e = { t: Date.now(), data };
  mem.set(path, e);
  const write = () => localStorage.setItem(LS + path, JSON.stringify(e));
  try { write(); } catch (err) {
    try { Object.keys(localStorage).filter((k) => k.startsWith(LS)).forEach((k) => localStorage.removeItem(k)); write(); } catch (err2) { /* без хранилища работаем из памяти */ }
  }
}
function cpurge() {
  mem.clear();
  try { Object.keys(localStorage).filter((k) => k.startsWith(LS)).forEach((k) => localStorage.removeItem(k)); } catch (err) { /* нет хранилища */ }
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
    case "contract": case "settings": return id;
    default: return null;
  }
}
const current = () => S.sub || S.tab;
const ttlOf = (id) => (id === "subjects" ? TTL.grades : TTL[id] ?? 0);

// ---------------------------------------------------------------- общие блоки
function pager({ label, sub, prev, next, action }) {
  return `<div class="card pager">
    <button class="pg-btn" data-a="${action}" data-dir="-1" ${prev ? "" : "disabled"} aria-label="Назад">${ico("left")}</button>
    <div class="mid"><b>${esc(label)}</b><span>${esc(sub || "")}</span></div>
    <button class="pg-btn" data-a="${action}" data-dir="1" ${next ? "" : "disabled"} aria-label="Вперёд">${ico("right")}</button>
  </div>`;
}
function semPager(sems, current) {
  const i = sems.codes.indexOf(current);
  return pager({ label: `${semNo(current)}-й семестр`, sub: current === sems.current ? "Текущий" : "Прошедший", prev: i > 0, next: i >= 0 && i < sems.codes.length - 1, action: "sem" });
}
const empty = (emoji, title, text) => `<div class="card empty-hint"><div class="big">${emoji}</div><b>${esc(title)}</b><p class="muted small">${esc(text || "")}</p></div>`;
const seg = (items, active, action) => `<div class="seg">${items.map(([k, t, sub]) => `<button class="${k === active ? "on" : ""}" data-a="${action}" data-k="${k}">${esc(t)}<small>${esc(sub || "")}</small></button>`).join("")}</div>`;
const fileList = (files) => files && files.length ? `<div class="files">${files.map((f) => `<div class="file">${ico("file")}<span>${esc(f.name)}</span><small>${sizeKb(f.size)}</small></div>`).join("")}</div>` : "";

// ---------------------------------------------------------------- расписание
const typeClass = (t) => { const x = (t || "").toLowerCase(); return x.includes("лек") || x.includes("lec") ? "tag-lec" : x.includes("лаб") || x.includes("lab") ? "tag-lab" : "tag-prac"; };
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Состояние пары по текущему времени: past | now | future и процент пройденного (для now). */
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

// ---------------------------------------------------------------- НБ
const NB_STATUS = { ok: "В норме", warn: "Осторожно", fail: "Лимит превышен", unknown: "Лимит неизвестен" };
const NB_TONE = { ok: "tone-ok", warn: "tone-warn", fail: "tone-bad", unknown: "" };

function renderNb(d) {
  const r = d.report;
  S.sem.nb = S.sem.nb || r.semester;
  let html = semPager(d.semesters, r.semester);
  html += `<div class="tiles"><div class="tile"><b>${num(r.total_hours)} ч</b><span>Пропущено</span></div><div class="tile"><b>${num(r.excused_total)} ч</b><span>Уважительные</span></div><div class="tile"><b>${num(r.limit_pct)}%</b><span>Лимит часов</span></div></div>`;
  if (!r.rows.length) return html + empty("🎉", "Пропусков нет", "По всем предметам ни одного НБ.");
  return html + r.rows.map((row, idx) => {
    const key = `nb${idx}`, open = S.open.has(key), used = row.limit_hours ? Math.min(row.hours / row.limit_hours, 1) : 0;
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
  S.sem.exams = S.sem.exams || d.semester;
  const today = nowTk().iso, by = { 1: [], 2: [], c: [], s: [] };
  d.exams.forEach((e) => by[e.group].push(e));
  if (!S.examTab || !by[S.examTab]) {
    const up = Object.entries(by).map(([k, v]) => [k, v.filter((e) => e.date >= today)]).filter(([, v]) => v.length).map(([k, v]) => [k, v[0].date]);
    S.examTab = up.length ? up.sort((a, b) => a[1].localeCompare(b[1]))[0][0] : ["s", "c", "2", "1"].find((k) => by[k].length) || "s";
  }
  const tabs = EXAM_TABS.map(([k, t, sub]) => [k, t, by[k].length ? `${by[k].length} экз.` : sub]);
  let html = semPager(d.semesters, d.semester) + seg(tabs, S.examTab, "examtab");
  const items = by[S.examTab];
  if (!d.exams.length) return html + empty("🗓", "Расписание экзаменов пока не опубликовано", "Как только оно появится в HEMIS, здесь появятся даты.");
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

// ---------------------------------------------------------------- оценки и предметы
const grade5 = (pct) => (pct == null ? null : pct >= 86 ? 5 : pct >= 71 ? 4 : pct >= 55 ? 3 : 2);

function forecast(o) {
  if (!o || o.ball == null || !o.max || !(o.max > 0 && o.max < 100)) return "";
  const left = 100 - o.max, parts = [];
  [[3, 55], [4, 71], [5, 86]].forEach(([g, t]) => { const need = t - o.ball; if (need > 0) parts.push(`«${g}» — ${need <= left ? "ещё " + num(Math.round(need * 10) / 10) : "недостижима"}`); });
  return parts.length ? `🎯 Осталось ${num(left)} б. · до ${parts.join(" · ")}` : "🎯 Высшая оценка уже обеспечена";
}

function renderGrades(d) {
  const p = d.perf;
  S.sem.grades = S.sem.grades || p.semester;
  let html = semPager(d.semesters, p.semester);
  html += `<div class="tiles four"><div class="tile"><b>${p.gpa_calc ?? "—"}</b><span>GPA</span></div><div class="tile"><b>${p.avg_pct != null ? num(p.avg_pct) + "%" : "—"}</b><span>Средний</span></div><div class="tile"><b>${p.credits}</b><span>Кредитов</span></div><div class="tile"><b>${p.subjects.length}</b><span>Предметов</span></div></div>`;
  if (!p.subjects.length) return html + empty("🎓", "Предметов пока нет", "");
  return html + p.subjects.map((s) => {
    const o = s.overall, has = o && o.ball != null && o.ball !== 0, g = s.grade5 || (has ? grade5(o.pct) : null);
    const parts = [["Текущий", s.current], ["Промежуточный", s.mid], ["Итоговый", s.final], ...(s.extra || []).map((x) => [x.name, x])].filter(([, v]) => v && v.ball != null);
    return `<div class="card grade ${g ? "g" + g : ""}"><div class="row" style="gap:14px">
        <div class="ring" style="--p:${has ? Math.min(o.pct || 0, 100) : 0}"><b>${has ? num(o.pct) + "%" : "—"}</b></div>
        <div class="grow"><div class="name">${esc(s.name)}</div><div class="muted small">${s.credit} кр.${has ? ` · ${num(o.ball)} / ${num(o.max)} б.` : " · баллов пока нет"}</div></div>
        ${g ? `<div class="gbadge">${g}</div>` : ""}</div>
      ${parts.length ? `<div class="parts">${parts.map(([n, v]) => `<div class="part"><div class="ptop"><b>${esc(n)}</b><span>${num(v.ball)}${v.max ? ` / ${num(v.max)}` : ""}</span></div><div class="pb"><i style="width:${Math.min(v.pct ?? (v.max ? (v.ball / v.max) * 100 : 0), 100)}%"></i></div></div>`).join("")}</div>` : ""}
      ${forecast(o) ? `<div class="forecast">${forecast(o)}</div>` : ""}</div>`;
  }).join("");
}

function renderSubjects(d) {
  const p = d.perf;
  S.sem.subjects = S.sem.subjects || p.semester;
  const html = semPager(d.semesters, p.semester);
  if (!p.subjects.length) return html + empty("📚", "Предметов пока нет", "");
  const total = p.subjects.reduce((a, s) => a + (s.load || 0), 0);
  return html + `<div class="tiles"><div class="tile"><b>${p.subjects.length}</b><span>Предметов</span></div><div class="tile"><b>${p.credits}</b><span>Кредитов</span></div><div class="tile"><b>${total || "—"}</b><span>Часов</span></div></div>`
    + p.subjects.map((s) => `<div class="card"><div class="name">${esc(s.name)}</div><div class="chips" style="margin-top:8px"><span class="chip tone-brand">${s.credit} кр.</span>${s.load ? `<span class="chip">${s.load} ч</span>` : ""}${s.kind ? `<span class="chip">${esc(s.kind)}</span>` : ""}</div></div>`).join("");
}

// ---------------------------------------------------------------- «Ещё» и подразделы
const MENU = [
  ["tasks", "Задания", "Дедлайны, оценки и файлы заданий", "tasks", "brand"],
  ["resources", "Ресурсы", "Материалы по предметам — файлы пришлёт бот", "book", "violet"],
  ["subjects", "Предметы", "Кредиты и нагрузка по семестрам", "layers", "ok"],
  ["contract", "Контракт", "Оплата и остаток", "wallet", "warn"],
  ["settings", "Уведомления", "Что присылает бот", "bell", "bad"],
];
function renderMore() {
  return `<div class="card menu">${MENU.map(([id, t, sub, icon, tone]) => `<button class="menu-item" data-a="open" data-sub="${id}"><span class="menu-ico tone-${tone}">${ico(icon)}</span><span class="grow"><b>${t}</b><span class="muted small">${sub}</span></span><span class="chev">${ico("right")}</span></button>`).join("")}</div>
    <p class="muted small" style="text-align:center;margin:8px 0 0">Данные кэшируются на устройстве — приложение открывается мгновенно, а HEMIS не перегружается запросами.<br>Кнопка ⟳ в шапке обновляет экран (не чаще раза в минуту).</p>`;
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
  S.sem.tasks = S.sem.tasks || d.semester;
  const groups = { active: [], overdue: [], graded: [], all: d.tasks };
  d.tasks.forEach((t) => groups[taskGroup(t)].push(t));
  const tabs = [["active", "Активные"], ["overdue", "Просрочено"], ["graded", "Оценено"], ["all", "Все"]].map(([k, t]) => [k, t, groups[k].length]);
  let html = semPager(d.semesters, d.semester) + seg(tabs, S.taskTab, "tasktab");
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
      ${fileList(t.files)}${t.files && t.files.length ? `<button class="btn tonal block" data-a="send" data-type="task" data-id="${esc(t.id)}">${ico("send")}Прислать файлы в чат</button>` : ""}</div>`;
    return `<div class="card tap" data-a="toggle" data-key="${key}"><div class="item-top"><div class="grow"><div class="name">${esc(t.title)}</div><div class="muted small" style="margin-top:2px">${esc(t.subject)}${t.lesson_type ? " · " + esc(t.lesson_type) : ""}</div></div>${badge}</div>
      ${t.deadline ? `<div class="meta-inline"><span>${ico("clock")}до ${esc(dm(t.deadline))} ${esc(t.deadline.slice(11))}</span></div>` : ""}${detail}</div>`;
  }).join("");
}

// ---------- ресурсы
function renderResources(d) {
  S.sem.resources = S.sem.resources || d.semester;
  if (!S.res.subject) {
    const html = semPager(d.semesters, d.semester);
    const list = d.subjects.filter((x) => x.resources);
    if (!list.length) return html + empty("📖", "Материалов пока нет", "Преподаватели ещё не загрузили ресурсы в этом семестре.");
    return html + list.map((x) => `<button class="card tap row" style="width:100%" data-a="subject" data-id="${esc(x.id)}" data-name="${esc(x.name)}"><span class="menu-ico tone-violet">${ico("book")}</span>
      <span class="grow"><span class="name" style="display:block">${esc(x.name)}</span><span class="muted small">${x.resources} ${plural(x.resources, "материал", "материала", "материалов")}</span></span><span class="muted">${ico("right")}</span></button>`).join("");
  }
  if (!d.resources.length) return empty("✨", "Материалов нет", "");
  // Разделы по типу занятия — ровно как отдаёт HEMIS (лекции, практика и т. д.)
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
        ${r.files_count ? `<button class="btn tonal block" data-a="send" data-type="resource" data-id="${esc(r.id)}" data-subject="${esc(S.res.subject)}" data-semester="${esc(d.semester)}">${ico("send")}Прислать файлы в чат</button>` : ""}</div></div>`;
  }).join("");
}

// ---------- контракт
function renderContract(c) {
  const pct = c.paid_pct != null ? Math.min(c.paid_pct, 100) : null;
  const info = [["Специальность", c.speciality], ["Курс", c.course], ["Форма обучения", c.form], ["Учебный год", c.year], ["GPA в HEMIS", c.gpa]].filter(([, v]) => v != null && v !== "");
  return `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><b>Оплата контракта</b><span class="pill ${c.remaining > 0 ? "tone-warn" : "tone-ok"}">${c.remaining > 0 ? "есть остаток" : "оплачено"}</span></div>
      <div class="bigbar"><i style="width:${pct ?? 0}%"></i></div><div class="foot" style="margin-top:8px"><span>${pct != null ? `Оплачено ${num(pct)}%` : ""}</span><span></span></div></div>
    <div class="money"><div class="tile"><b>${money(c.total)}</b><span>Всего</span></div><div class="tile"><b>${money(c.paid)}</b><span>Оплачено</span></div><div class="tile"><b>${money(c.remaining)}</b><span>Остаток</span></div></div>
    ${c.remaining > 0 ? `<button class="btn block" data-a="copy" data-text="${Math.round(c.remaining)}">${ico("copy")}Скопировать остаток</button>` : ""}
    ${info.length ? `<div class="card">${info.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>`).join("")}</div>` : ""}`;
}

// ---------- настройки
function renderSettings(d) {
  const warn = d.auth_failed ? `<div class="card notice"><span class="menu-ico tone-bad">${ico("bell")}</span><div><b>HEMIS не принял пароль</b><div class="muted small">Введите его заново в боте: Меню → HEMIS → «Войти».</div></div></div>` : "";
  const last = d.last_ok_at ? `<p class="muted small" style="text-align:center;margin:4px 0 0">Последний успешный вход в HEMIS: ${esc(String(d.last_ok_at).replace("T", " ").slice(0, 16))}</p>` : "";
  return warn + `<div class="card menu">${d.toggles.map((t) => `<button class="setting" data-a="setting" data-key="${esc(t.key)}"><span class="grow"><b>${esc(t.label)}</b></span><span class="switch ${t.on ? "on" : ""}"></span></button>`).join("")}</div>${last}`;
}

// ---------------------------------------------------------------- заголовки и ошибки
function heroFor(id, d) {
  switch (id) {
    case "schedule": return ["Расписание", d ? `${dm(d.monday)} – ${dm(d.sunday)}` : ""];
    case "nb": return ["Пропуски (НБ)", d ? `${semNo(d.report.semester)}-й семестр · лимит ${num(d.report.limit_pct)}%` : ""];
    case "exams": return ["Экзамены", d ? `${semNo(d.semester)}-й семестр · ${d.exams.length} ${plural(d.exams.length, "экзамен", "экзамена", "экзаменов")}` : ""];
    case "grades": return ["Оценки", d ? `${semNo(d.perf.semester)}-й семестр${d.perf.period ? " · " + d.perf.period : ""}` : ""];
    case "subjects": return ["Предметы", d ? `${semNo(d.perf.semester)}-й семестр` : ""];
    case "tasks": return ["Задания", d ? `${semNo(d.semester)}-й семестр · ${d.count} ${plural(d.count, "задание", "задания", "заданий")}` : ""];
    case "resources": return S.res.subject ? [S.res.name || "Ресурсы", "Материалы предмета"] : ["Ресурсы", d ? `${semNo(d.semester)}-й семестр` : ""];
    case "contract": return ["Контракт", ""];
    case "settings": return ["Уведомления", "Бот присылает только включённое"];
    default: return ["Ещё", "Разделы HEMIS"];
  }
}
const RENDER = { schedule: renderSchedule, nb: renderNb, exams: renderExams, grades: renderGrades, more: renderMore, subjects: renderSubjects, tasks: renderTasks, resources: renderResources, contract: renderContract, settings: renderSettings };

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

// ---------------------------------------------------------------- DOM
if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const view = $("view"), loadbar = $("loadbar"), refreshBtn = $("refresh");
  const SKELETON = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  let toastTimer = 0, lastHtml = "", lastIcon = "", pressing = false, deferred = null, lastFetch = 0;

  // Нижняя панель строится один раз: пересоздание кнопок во время нажатия «съедало» тапы.
  $("tabsIn").innerHTML = TABS.map((t) => `<button class="tab" data-a="tab" data-tab="${t.id}">${ico(t.icon)}<span>${t.label}</span></button>`).join("");
  const tabEls = [...document.querySelectorAll(".tab")];
  $("back").innerHTML = ico("left");
  $("stampIco").innerHTML = ico("clock");

  function toast(text) {
    const el = $("toast"); el.textContent = text; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  const haptic = (kind) => { try { tg && tg.HapticFeedback && (kind ? tg.HapticFeedback.notificationOccurred(kind) : tg.HapticFeedback.selectionChanged()); } catch (e) { /* нет */ } };

  function setTheme() {
    const light = tg ? tg.colorScheme === "light" : matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.dataset.theme = light ? "light" : "dark";
    try {
      tg && tg.setHeaderColor && tg.setHeaderColor(light ? "#2864f0" : "#0f1c40");
      tg && tg.setBackgroundColor && tg.setBackgroundColor(light ? "#f1f4fb" : "#080e1d");
      tg && tg.setBottomBarColor && tg.setBottomBarColor(light ? "#ffffff" : "#0a1124");
    } catch (e) { /* старый клиент */ }
  }

  const setBusy = (on) => { loadbar.classList.toggle("on", on); refreshBtn.classList.toggle("spin", on); };
  const stampText = (t) => (DEMO ? "демо" : t ? ago(t) : "");

  function chrome(id, data, stamp) {
    const [title, sub] = heroFor(id, data);
    $("title").textContent = title;
    $("subtitle").textContent = sub || "\u00a0";
    $("stamp").textContent = stampText(stamp);
    const icon = HERO_ICON[id] || "calendar";
    if (icon !== lastIcon) { $("badge").innerHTML = ico(icon); lastIcon = icon; }
    tabEls.forEach((el) => el.classList.toggle("on", el.dataset.tab === S.tab));
    $("back").hidden = !S.sub;
    refreshBtn.hidden = id === "more";
    try { if (tg && tg.BackButton) S.sub ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) { /* нет */ }
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

  // opts.bg — перерисовка от ответа сервера/таймера: ждёт, пока палец отпущен, и не затирает более новый экран (token).
  function paint(id, data, stamp, opts = {}) {
    if (opts.token != null && opts.token !== reqId) return;
    if (opts.bg && pressing) { deferred = () => paint(id, data, stamp, opts); return; }
    chrome(id, data, stamp);
    show(data || id === "more" ? RENDER[id](data) : SKELETON, opts.anim);
    const [t, s] = heroFor(id, data);
    $("title").textContent = t; $("subtitle").textContent = s || "\u00a0";
  }

  async function load(opts = {}) {
    const { force = false, anim = "fade" } = opts;
    const my = ++reqId, id = current(), path = pathFor(id);
    if (!path) { paint(id, null, 0, { anim }); setBusy(false); return; }
    const e = cget(path);
    paint(id, e && e.data, e && e.t, { anim });      // мгновенный отклик: сохранённые данные или заглушка
    if (e && !force && Date.now() - e.t < ttlOf(id)) { setBusy(false); return; }
    setBusy(true);
    try {
      const data = await api(path, force);
      cset(path, data); lastFetch = Date.now();
      paint(id, data, lastFetch, { bg: true, token: my });
    } catch (err) {
      if (my !== reqId) return;
      if (e) toast("Нет связи — показаны сохранённые данные"); else show(errorView(err));
    } finally {
      if (my === reqId) setBusy(false);
    }
  }

  const repaint = (anim) => { const id = current(), e = cget(pathFor(id)); if (e) paint(id, e.data, e.t, { anim }); };
  const goBack = () => {
    if (S.sub === "resources" && S.res.subject) { S.res.subject = null; } else { S.sub = null; }
    S.open.clear(); load({ anim: "prev" });
  };

  const actions = {
    tab: (el) => { const t = el.dataset.tab; if (S.tab !== t || S.sub) { S.tab = t; S.sub = null; S.open.clear(); load(); } },
    open: (el) => { S.sub = el.dataset.sub; S.open.clear(); if (S.sub === "resources") S.res.subject = null; load({ anim: "next" }); },
    back: goBack,
    refresh: () => {
      if (Date.now() - lastFetch < 20000) { toast("Данные уже свежие"); return; }
      toast("Обновляю…"); load({ force: true, anim: null });
    },
    retry: () => load({ force: true }),
    week: (el) => { const dir = Number(el.dataset.dir); S.week += dir; S.day = null; load({ anim: dir > 0 ? "next" : "prev" }); },
    day: (el) => { S.day = el.dataset.day; repaint("fade"); },
    sem: (el) => {
      const id = current(), e = cget(pathFor(id)); if (!e) return;
      const sems = e.data.semesters, dir = Number(el.dataset.dir), cur = S.sem[id] || sems.current, i = sems.codes.indexOf(cur) + dir;
      if (i < 0 || i >= sems.codes.length) return;
      S.sem[id] = sems.codes[i]; if (id === "exams") S.examTab = null; S.open.clear(); load({ anim: dir > 0 ? "next" : "prev" });
    },
    examtab: (el) => { S.examTab = el.dataset.k; repaint("fade"); },
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
      try { await navigator.clipboard.writeText(el.dataset.text); toast("Скопировано"); haptic("success"); } catch (e) { toast("Не удалось скопировать"); }
    },
    send: async (el) => {
      const d = el.dataset, label = el.innerHTML;
      el.disabled = true; el.innerHTML = "Отправляю…";
      try {
        await post("send", { type: d.type, id: d.id, subject: d.subject, semester: d.semester });
        toast("Готово — файлы в чате с ботом"); haptic("success");
      } catch (err) { toast((err && err.message) || "Не удалось отправить"); haptic("error"); }
      el.disabled = false; el.innerHTML = label;
    },
    setting: async (el) => {
      const key = el.dataset.key, sw = el.querySelector(".switch"), on = !sw.classList.contains("on");
      sw.classList.toggle("on", on);
      try {
        await post("settings", { key, value: on });
        const path = pathFor("settings"), e = cget(path);
        if (e) { const t = e.data.toggles.find((x) => x.key === key); if (t) t.on = on; cset(path, e.data); }
      } catch (err) { sw.classList.toggle("on", !on); toast("Не удалось сохранить"); }
    },
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-a]");
    if (!el || el.disabled) return;
    const a = el.dataset.a;
    if (!["toggle", "refresh", "send", "copy", "setting", "lesson"].includes(a)) haptic();
    if (actions[a]) actions[a](el, ev);
  });
  document.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches("[role='button']")) { ev.preventDefault(); ev.target.click(); } });

  // Пока палец на экране, фоновые перерисовки откладываются — иначе кнопка исчезает прямо под пальцем и тап пропадает.
  const release = () => { pressing = false; if (deferred) { const f = deferred; deferred = null; setTimeout(f, 60); } };
  document.addEventListener("pointerdown", () => { pressing = true; }, { passive: true, capture: true });
  ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, release, { passive: true, capture: true }));

  // Раз в полминуты: «идёт сейчас», прогресс пары и подпись «N мин назад» живут по часам без запросов к серверу.
  setInterval(() => {
    if (document.hidden) return;
    const id = current(), e = cget(pathFor(id));
    if (!e) return;
    $("stamp").textContent = stampText(e.t);
    if (id === "schedule" && S.week === 0) paint(id, e.data, e.t, { bg: true, token: reqId });
  }, 30000);

  if (tg) {
    tg.ready(); tg.expand();
    tg.onEvent && tg.onEvent("themeChanged", setTheme);
    tg.BackButton && tg.BackButton.onClick(goBack);
  }
  setTheme();
  load();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load({ anim: null }); });
}

// ---------------------------------------------------------------- демо-данные (просмотр без бота: ?demo)
function demoApi(path, method, body) {
  const today = nowTk().iso, base = parseISO(today);
  const q = new URLSearchParams(path.split("?")[1] || ""), kind = path.split("?")[0];
  const sems = { codes: ["11", "12", "13"], current: "13" };
  const sem = sems.codes.includes(q.get("semester")) ? q.get("semester") : "13";
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 200));
  const d = (n) => iso(addDays(base, n));
  if (method === "POST") return wait({ ok: true });

  if (kind === "schedule") {
    const off = Number(q.get("week") || 0), mon = addDays(parseISO(mondayOf(0)), off * 7);
    const plan = [["1", "08:30", "09:50", "Mikroiqtisodiyot 1", "Лекция", "3-505", "Akramova N. M."], ["2", "10:00", "11:20", "Matematika", "Практика", "2-214", "Karimov S. R."], ["3", "11:30", "12:50", "Xorijiy til", "Практика", "5-305", "Madaminova S. N."], ["4", "13:00", "14:20", "Statistika", "Лекция", "1-101", "Rustamov A. B."]];
    const lessons = [];
    [0, 1, 2, 3, 4].forEach((i) => plan.forEach((p, j) => { if ((i + j) % 4 !== 3) lessons.push({ date: iso(addDays(mon, i)), pair: `${p[0]} пара`, start: p[1], end: p[2], subject: p[3], type: p[4], room: p[5], building: "Корпус A", teacher: p[6], group: "" }); }));
    return wait({ today, monday: iso(mon), sunday: iso(addDays(mon, 6)), published: Math.abs(off) < 3, lessons: Math.abs(off) < 3 ? lessons : [] });
  }
  if (kind === "nb") {
    const rows = [
      { subject: "Philosophy", hours: 14, pairs: 7, limit_hours: 15, hours_src: "manual", status: "warn", left_pairs: 0, records: [{ date: "2026-10-12", pair: "2", type: "Лекция", unexcused_h: 2 }, { date: "2026-10-19", pair: "3", type: "Практика", unexcused_h: 2 }] },
      { subject: "Mikroiqtisodiyot 1", hours: 6, pairs: 3, limit_hours: 15, hours_src: "schedule", status: "ok", left_pairs: 4, records: [{ date: "2026-10-05", pair: "1", type: "Лекция", unexcused_h: 2 }] },
      { subject: "Ekonometrika", hours: 20, pairs: 10, limit_hours: 15, hours_src: "manual", status: "fail", left_pairs: 0, records: [] },
      { subject: "Statistika", hours: 2, pairs: 1, limit_hours: null, hours_src: null, status: "unknown", left_pairs: null, records: [] },
    ];
    return wait({ semesters: sems, report: { semester: sem, semester_no: semNo(sem), limit_pct: 25, total_hours: 42, excused_total: 6, hours_table_missing: [], rows: sem === "13" ? rows : rows.slice(0, 2) } });
  }
  if (kind === "exams") {
    const ex = (id, subject, group, sheet, n, start, end, room, teacher, k) => ({ id, subject, kind: k || "", group, sheet, date: d(n), start, end, room, teacher });
    const exams = sem === "13" ? [
      ex("1", "Mikroiqtisodiyot 1", "s", 1, 16, "09:00", "10:20", "3-505", "AKRAMOVA N. M.", "Yakuniy nazorat"), ex("2", "Statistika", "s", 1, 19, "13:00", "14:20", "5-305", "RUSTAMOV A. B.", "Yakuniy nazorat"),
      ex("3", "Philosophy", "s", 2, 27, "10:00", "11:20", "2-214", "KARIMOV S. R.", "Yakuniy nazorat"), ex("4", "Matematika", "c", 1, 3, "11:30", "12:50", "2-214", "KARIMOV S. R.", "Joriy nazorat"),
      ex("5", "Xorijiy til", "1", 1, -20, "08:30", "09:50", "5-305", "MADAMINOVA S. N.", "1-ON"), ex("6", "Xorijiy til", "2", 1, 1, "08:30", "09:50", "5-305", "MADAMINOVA S. N.", "2-ON"),
    ] : [ex("7", "Iqtisodiyot nazariyasi", "s", 1, -90, "09:00", "10:20", "1-101", "SOBIROV T. K.", "Yakuniy nazorat"), ex("8", "Tarix", "s", 1, -88, "13:00", "14:20", "1-102", "NAZAROV D. A.", "Yakuniy nazorat")];
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), today, exams });
  }
  if (kind === "grades") {
    const sc = (name, ball, max) => ({ name, ball, max, pct: max ? Math.round((ball / max) * 1000) / 10 : null });
    const subjects = [
      { id: "1", name: "Mikroiqtisodiyot 1", kind: "Majburiy", load: 120, credit: 4, overall: sc("Umumiy", 62, 70), grade5: 5, current: sc("Joriy", 24, 30), mid: sc("Oraliq", 38, 40), final: null, extra: [] },
      { id: "2", name: "Statistika", kind: "Majburiy", load: 90, credit: 3, overall: sc("Umumiy", 51, 70), grade5: 4, current: sc("Joriy", 21, 30), mid: sc("Oraliq", 30, 40), final: null, extra: [] },
      { id: "3", name: "Philosophy", kind: "Tanlov", load: 60, credit: 2, overall: sc("Umumiy", 88, 100), grade5: 5, current: sc("Joriy", 28, 30), mid: sc("Oraliq", 36, 40), final: sc("Yakuniy", 24, 30), extra: [] },
      { id: "4", name: "Xorijiy til", kind: "Majburiy", load: 90, credit: 3, overall: null, grade5: null, current: null, mid: null, final: null, extra: [] },
    ];
    return wait({ semesters: sems, perf: { semester: sem, semester_no: semNo(sem), period: "01.09 – 30.12", subjects: sem === "13" ? subjects : subjects.slice(2, 3), credits: 12, avg_pct: 84.7, gpa_calc: 4.6 } });
  }
  if (kind === "tasks") {
    const t = (id, title, subject, n, hh, extra) => ({ id, title, subject, description: "Выполните задание и загрузите отчёт в формате PDF.", kind: "Задание", lesson_type: "Практика", teacher: "Karimov S. R.", max_ball: 10, mark: null, graded: false, overdue: n < 0, status: "", deadline: `${d(n)} ${hh}`, deadline_left: "", attempts: "0/3", files: [{ name: "task.pdf", size: 220000, ext: "pdf" }], my_files: [], sent_at: null, teacher_comment: "", ...extra });
    const tasks = [t("1", "Лабораторная работа №3", "Matematika", 2, "23:59"), t("2", "Реферат по теме 5", "Philosophy", 6, "18:00", { files: [] }), t("3", "Тест по главе 2", "Statistika", -2, "12:00"), t("4", "Эссе", "Xorijiy til", -9, "10:00", { graded: true, overdue: false, mark: 9, sent_at: d(-10) + " 09:00", teacher_comment: "Хорошая работа." })];
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), status: "all", count: tasks.length, tasks });
  }
  if (kind === "resources") {
    if (q.get("subject")) {
      const r = (id, title, k, files) => ({ id, title, comment: "", subject: "Mikroiqtisodiyot 1", kind: k, languages: ["Русский"], teacher: "AKRAMOVA N. M.", items: [{ type: "Презентация", comment: "", url: "", files: Array.from({ length: files }, (_, i) => ({ name: `${title}-${i + 1}.pptx`, size: 1800000, ext: "pptx" })) }], files_count: files, links_count: 0 });
      return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), subject_id: q.get("subject"), resources: [r("1", "1-тема. Введение", "Лекция", 1), r("2", "2-тема. Спрос и предложение", "Лекция", 1), r("3", "Практика 1", "Практика", 2)] });
    }
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), subjects: [{ id: "149", name: "Mikroiqtisodiyot 1", credit: 4, resources: 36 }, { id: "151", name: "Statistika", credit: 3, resources: 12 }, { id: "153", name: "Philosophy", credit: 2, resources: 8 }] });
  }
  if (kind === "contract") return wait({ gpa: 4.4, speciality: "Iqtisodiyot", course: "2-kurs", form: "Kunduzgi", year: "2026-2027", total: 12000000, paid: 7500000, remaining: 4500000, paid_pct: 62.5, fields_consistent: true });
  if (kind === "settings") return wait({ auth_failed: false, last_ok_at: new Date().toISOString(), toggles: [["morning_on", "Утренняя сводка пар"], ["prep_on", "Подготовка к семинарам"], ["changes_on", "Изменения в расписании"], ["nb_on", "Новые НБ"], ["tasks_on", "Новые задания"], ["grades_on", "Новые баллы"], ["deadlines_on", "Дедлайны заданий"], ["exams_on", "Экзамены"]].concat([["lesson_alert_on", "За 10 минут до пары"]]).map(([key, label], i) => ({ key, label, on: i !== 1 })) });
  return wait({});
}

if (typeof module !== "undefined") module.exports = { nowTk, lessonState, hhmm, lessonCard, mondayOf, renderSchedule, renderNb, renderExams, renderGrades, renderSubjects, renderTasks, renderResources, renderContract, renderSettings, renderMore, demoApi, S, errorView, forecast, esc, pathFor, minutesLeft, leftLabel, heroFor };
