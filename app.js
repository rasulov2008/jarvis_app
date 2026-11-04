/* HEMIS · Джарвис — Telegram Mini App. Без сборки: один файл логики, рендер строками, данные — с API бота (или демо). */
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
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
const pairsWord = (n) => `${n} ${plural(n, "пару", "пары", "пар")}`;
const semNo = (code) => Number(code) - 10;

function nowTk() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return { iso: `${g("year")}-${pad(g("month"))}-${pad(g("day"))}`, min: (g("hour") % 24) * 60 + g("minute") };
}

const ICON = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  nb: '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
  exam: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 3h6v3H9zM9 14l2 2 4-4"/>',
  grades: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14.5 7 22l5-3 5 3-1.5-7.5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

// ---------------------------------------------------------------- состояние
const TABS = [
  { id: "schedule", label: "Расписание", icon: "calendar" },
  { id: "nb", label: "НБ", icon: "nb" },
  { id: "exams", label: "Экзамены", icon: "exam" },
  { id: "grades", label: "Оценки", icon: "grades" },
];
const S = { tab: "schedule", week: 0, day: null, sem: { nb: null, exams: null, grades: null }, examTab: null, open: new Set() };
const cache = new Map();
let reqId = 0;

// ---------------------------------------------------------------- API
async function api(path, force) {
  if (DEMO) return demoApi(path);
  if (!API) throw { kind: "noapi" };
  const url = `${API}/api/${path}${force ? (path.includes("?") ? "&" : "?") + "r=1" : ""}`;
  let res;
  try { res = await fetch(url, { headers: { "X-Telegram-Init-Data": tg.initData } }); } catch (e) { throw { kind: "network" }; }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { kind: body.error || "http", message: body.message };
  }
  return res.json();
}

const pathFor = () => {
  if (S.tab === "schedule") return `schedule?week=${S.week}`;
  const sem = S.sem[S.tab];
  return `${S.tab}${sem ? `?semester=${sem}` : ""}`;
};

// ---------------------------------------------------------------- рендер: общие блоки
function pager({ label, sub, prev, next, action }) {
  return `<div class="card pager">
    <button class="pg-btn" data-a="${action}" data-dir="-1" ${prev ? "" : "disabled"} aria-label="Назад">${ico("left")}</button>
    <div class="mid"><b>${esc(label)}</b><span>${esc(sub || "")}</span></div>
    <button class="pg-btn" data-a="${action}" data-dir="1" ${next ? "" : "disabled"} aria-label="Вперёд">${ico("right")}</button>
  </div>`;
}

function semPager(sems, current, action) {
  const i = sems.codes.indexOf(current);
  return pager({
    label: `${semNo(current)}-й семестр`,
    sub: current === sems.current ? "Текущий" : "Прошедший",
    prev: i > 0, next: i >= 0 && i < sems.codes.length - 1, action,
  });
}

const empty = (emoji, title, text) => `<div class="card empty-hint"><div class="big">${emoji}</div><b>${esc(title)}</b><p class="muted small">${esc(text || "")}</p></div>`;

// ---------------------------------------------------------------- рендер: расписание
function typeClass(t) {
  const x = (t || "").toLowerCase();
  return x.includes("лек") || x.includes("lec") || x.includes("ma'r") ? "tag-lec" : x.includes("лаб") || x.includes("lab") ? "tag-lab" : "tag-prac";
}

function renderSchedule(d) {
  const mon = parseISO(d.monday);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = iso(addDays(mon, i));
    const lessons = d.lessons.filter((l) => l.date === day);
    if (i < 6 || lessons.length) days.push({ iso: day, i, lessons });
  }
  const today = d.today;
  if (!S.day || !days.some((x) => x.iso === S.day)) {
    S.day = (days.find((x) => x.iso === today) || days.find((x) => x.lessons.length) || days[0]).iso;
  }
  const label = S.week === 0 ? "Эта неделя" : S.week === 1 ? "Следующая неделя" : S.week === -1 ? "Прошлая неделя" : "Неделя";
  const head = pager({ label, sub: `${dm(d.monday)} – ${dm(d.sunday)}`, prev: S.week > -8, next: S.week < 8, action: "week" });
  const chips = `<div class="days">${days.map((x) => `
    <button class="day ${x.iso === S.day ? "sel" : ""} ${x.iso === today ? "today" : ""} ${x.lessons.length ? "has" : ""}" data-a="day" data-day="${x.iso}">
      <span>${WD[x.i]}</span><b>${Number(x.iso.slice(8))}</b><i class="dot"></i></button>`).join("")}</div>`;

  if (!d.published) return head + empty("⏳", "Расписание ещё не опубликовано", "Университет пока не выложил эту неделю.");
  const cur = days.find((x) => x.iso === S.day);
  const lessons = cur.lessons;
  let body;
  if (!lessons.length) {
    body = empty("🎉", "Пар нет", "Свободный день — можно отдохнуть или заняться делами.");
  } else {
    const now = nowTk();
    const isToday = cur.iso === today;
    let nextMarked = false;
    const cards = lessons.map((l) => {
      let state = "", tag = "", prog = "";
      if (isToday) {
        const a = toMin(l.start), b = toMin(l.end);
        if (now.min >= b) state = "past";
        else if (now.min >= a) {
          state = "now"; tag = '<span class="tag tag-now">Идёт сейчас</span>';
          prog = `<div class="progress"><i style="width:${Math.max(4, Math.min(100, ((now.min - a) / (b - a)) * 100))}%"></i></div>`;
        } else if (!nextMarked) { nextMarked = true; tag = `<span class="tag tag-next">Через ${a - now.min < 60 ? `${a - now.min} мин` : `${Math.floor((a - now.min) / 60)} ч ${(a - now.min) % 60} мин`}</span>`; }
      }
      const place = [l.room, l.building].filter(Boolean).join(" · ");
      return `<div class="card lesson ${state}">
        <div class="time"><b>${esc(l.start)}</b><span>${esc(l.end)}</span></div>
        <div class="lbody">
          <div class="ltop">${l.pair ? `<span class="chip">${esc(l.pair)}</span>` : ""}${l.type ? `<span class="tag ${typeClass(l.type)}">${esc(l.type)}</span>` : ""}${tag}</div>
          <div class="lname">${esc(l.subject)}</div>
          <div class="lmeta">${place ? `<div>${ico("pin")}${esc(place)}</div>` : ""}${l.teacher ? `<div>${ico("user")}${esc(l.teacher)}</div>` : ""}</div>
          ${prog}
        </div></div>`;
    }).join("");
    const first = lessons[0].start, last = lessons[lessons.length - 1].end;
    body = `<div class="summary"><b>${isToday ? "Сегодня" : `${WD[cur.i]}, ${dm(cur.iso)}`} · ${pairsWord(lessons.length)}</b><span class="muted small">${esc(first)}–${esc(last)}</span></div>${cards}`;
  }
  return head + chips + body;
}

// ---------------------------------------------------------------- рендер: НБ
const NB_STATUS = { ok: "В норме", warn: "Осторожно", fail: "Лимит превышен", unknown: "Лимит неизвестен" };

function renderNb(d) {
  const r = d.report;
  S.sem.nb = S.sem.nb || r.semester;
  let html = semPager(d.semesters, r.semester, "sem");
  html += `<div class="tiles">
    <div class="tile"><b>${num(r.total_hours)} ч</b><span>Пропущено</span></div>
    <div class="tile"><b>${num(r.excused_total)} ч</b><span>Уважительные</span></div>
    <div class="tile"><b>${num(r.limit_pct)}%</b><span>Лимит часов</span></div></div>`;
  if (!r.rows.length) return html + empty("🎉", "Пропусков нет", "По всем предметам ни одного НБ.");
  html += r.rows.map((row, idx) => {
    const key = `nb${idx}`, open = S.open.has(key);
    const used = row.limit_hours ? Math.min(row.hours / row.limit_hours, 1) : 0;
    const status = NB_STATUS[row.status] ? row.status : "unknown";
    const approx = row.hours_src === "schedule" ? "≈" : "";
    const hours = row.limit_hours ? `<b>${num(row.hours)}</b> / ${approx}${num(row.limit_hours)} ч` : `<b>${num(row.hours)}</b> ч`;
    const left = !row.limit_hours ? "лимит неизвестен" : row.status === "fail" ? "лимит превышен" : `можно ещё <b>${pairsWord(row.left_pairs)}</b>`;
    const records = row.records && row.records.length ? `<div class="records" ${open ? "" : "hidden"}>${row.records.map((a) => `<div><span class="d">${esc(dm(a.date))}</span><span>${esc(a.pair)} пара · ${esc(a.type)}</span><span class="muted" style="margin-left:auto">${num(a.unexcused_h)} ч</span></div>`).join("")}</div>` : "";
    return `<div class="card nbrow" data-a="toggle" data-key="${key}">
      <div class="nbhead"><div class="name">${esc(row.subject)}</div><span class="pill ${status}">${NB_STATUS[status]}</span></div>
      <div class="bar ${status}"><i style="width:${(used * 100).toFixed(0)}%"></i></div>
      <div class="nbfoot"><span>${hours}</span><span>${left}</span></div>${records}</div>`;
  }).join("");
  return html;
}

// ---------------------------------------------------------------- рендер: экзамены
const EXAM_TABS = [["1", "1-е", "промеж."], ["2", "2-е", "промеж."], ["c", "Текущий", "контроль"], ["s", "Сессия", "итоговый"]];

function renderExams(d) {
  S.sem.exams = S.sem.exams || d.semester;
  const by = { 1: [], 2: [], c: [], s: [] };
  d.exams.forEach((e) => by[e.group].push(e));
  if (!S.examTab || !by[S.examTab]) {
    const up = Object.entries(by).filter(([, v]) => v.some((e) => e.date >= d.today)).map(([k, v]) => [k, v.filter((e) => e.date >= d.today)[0].date]);
    S.examTab = up.length ? up.sort((a, b) => a[1].localeCompare(b[1]))[0][0] : ["s", "c", "2", "1"].find((k) => by[k].length) || "s";
  }
  let html = semPager(d.semesters, d.semester, "sem");
  html += `<div class="seg">${EXAM_TABS.map(([k, t, sub]) => `<button class="${k === S.examTab ? "on" : ""}" data-a="examtab" data-k="${k}">${t}<small>${by[k].length ? by[k].length + " экз." : sub}</small></button>`).join("")}</div>`;
  const items = by[S.examTab];
  if (!d.exams.length) return html + empty("🗓", "Расписание экзаменов пока не опубликовано", "Как только оно появится в HEMIS, здесь появятся даты.");
  if (!items.length) return html + empty("✨", "В этой вкладке экзаменов нет", "");
  const card = (e) => {
    const day = parseISO(e.date), left = Math.round((day - parseISO(d.today)) / 864e5);
    const state = left < 0 ? "past" : left === 0 ? "today" : "";
    const when = left < 0 ? ["прошёл", ""] : left === 0 ? ["сегодня", "today"] : left === 1 ? ["завтра", "soon"] : [`через ${left} дн.`, left <= 3 ? "soon" : ""];
    return `<div class="card exam ${state}">
      <div class="edate"><b>${day.getUTCDate()}</b><span>${MON[day.getUTCMonth()]}</span></div>
      <div class="ebody"><div class="name">${esc(e.subject)}</div>
        <div class="emeta"><span>${ico("clock")}${esc(WD[(day.getUTCDay() + 6) % 7])}, ${esc(e.start)}${e.end ? `–${esc(e.end)}` : ""}</span>${e.room ? `<span>${ico("pin")}${esc(e.room)}</span>` : ""}${e.teacher ? `<span>${ico("user")}${esc(e.teacher)}</span>` : ""}</div>
        ${S.examTab === "c" && e.kind ? `<div style="margin-top:7px"><span class="chip">${esc(e.kind)}</span></div>` : ""}</div>
      <span class="chip when ${when[1]}">${when[0]}</span></div>`;
  };
  const main = items.filter((e) => e.sheet === 1), retake = items.filter((e) => e.sheet !== 1);
  html += main.map(card).join("");
  if (retake.length) html += `<div class="section-title">Пересдача · 2-я ведомость</div>` + retake.map(card).join("");
  return html;
}

// ---------------------------------------------------------------- рендер: оценки
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
  let html = semPager(d.semesters, p.semester, "sem");
  html += `<div class="tiles four">
    <div class="tile"><b>${p.gpa_calc ?? "—"}</b><span>GPA</span></div>
    <div class="tile"><b>${p.avg_pct != null ? num(p.avg_pct) + "%" : "—"}</b><span>Средний</span></div>
    <div class="tile"><b>${p.credits}</b><span>Кредитов</span></div>
    <div class="tile"><b>${p.subjects.length}</b><span>Предметов</span></div></div>`;
  if (!p.subjects.length) return html + empty("🎓", "Предметов пока нет", "");
  html += p.subjects.map((s) => {
    const o = s.overall, has = o && o.ball != null && o.ball !== 0;
    const g = s.grade5 || (has ? grade5(o.pct) : null);
    const parts = [["Текущий", s.current], ["Промежуточный", s.mid], ["Итоговый", s.final], ...(s.extra || []).map((x) => [x.name, x])].filter(([, v]) => v && v.ball != null);
    return `<div class="card grade ${g ? "g" + g : ""}">
      <div class="ghead">
        <div class="ring" style="--p:${has ? Math.min(o.pct || 0, 100) : 0}"><b>${has ? num(o.pct) + "%" : "—"}</b></div>
        <div class="gtitle"><div class="name">${esc(s.name)}</div><div class="muted small">${s.credit} кр.${has ? ` · ${num(o.ball)} / ${num(o.max)} б.` : " · баллов пока нет"}</div></div>
        ${g ? `<div class="gbadge">${g}</div>` : ""}
      </div>
      ${parts.length ? `<div class="parts">${parts.map(([n, v]) => `<div class="part"><div class="ptop"><b>${esc(n)}</b><span>${num(v.ball)}${v.max ? ` / ${num(v.max)}` : ""}</span></div><div class="pb"><i style="width:${Math.min(v.pct ?? (v.max ? (v.ball / v.max) * 100 : 0), 100)}%"></i></div></div>`).join("")}</div>` : ""}
      ${forecast(o) ? `<div class="forecast">${forecast(o)}</div>` : ""}
    </div>`;
  }).join("");
  return html;
}

// ---------------------------------------------------------------- шапка по вкладкам
function heroFor(tab, d) {
  if (tab === "schedule") return ["Расписание", d ? `${dm(d.monday)} – ${dm(d.sunday)}` : ""];
  if (tab === "nb") return ["Пропуски (НБ)", d ? `${semNo(d.report.semester)}-й семестр · лимит ${num(d.report.limit_pct)}%` : ""];
  if (tab === "exams") return ["Экзамены", d ? `${semNo(d.semester)}-й семестр · ${d.exams.length} ${plural(d.exams.length, "экзамен", "экзамена", "экзаменов")}` : ""];
  return ["Оценки", d ? `${semNo(d.perf.semester)}-й семестр${d.perf.period ? " · " + d.perf.period : ""}` : ""];
}

const RENDER = { schedule: renderSchedule, nb: renderNb, exams: renderExams, grades: renderGrades };

function errorView(e) {
  const kinds = {
    not_connected: ["🔌", "HEMIS не подключён", "Откройте бота: Меню → HEMIS → «Войти»."],
    unauthorized: ["🔒", "Нет доступа", "Откройте приложение кнопкой из бота — только владелец может смотреть данные."],
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
  const view = $("view");

  function setTheme() {
    const dark = tg ? tg.colorScheme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { tg && tg.setHeaderColor && tg.setHeaderColor("#1e40af"); tg && tg.setBackgroundColor && tg.setBackgroundColor(dark ? "#0a1020" : "#f1f5fb"); tg && tg.setBottomBarColor && tg.setBottomBarColor(dark ? "#111a31" : "#ffffff"); } catch (e) { /* старый клиент */ }
  }

  function paintTabs() {
    $("tabs").innerHTML = TABS.map((t) => `<button class="tab ${t.id === S.tab ? "on" : ""}" data-a="tab" data-tab="${t.id}">${ico(t.icon)}<span>${t.label}</span></button>`).join("");
  }

  function paint(data, tab) {
    const [title, sub] = heroFor(tab, data);
    $("title").textContent = title;
    $("subtitle").textContent = sub;
    $("heroExtra").innerHTML = DEMO ? '<span class="demo-badge">демо-данные</span>' : "";
    view.innerHTML = data ? RENDER[tab](data) : '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
    // перерисовка могла сменить выбранный день/вкладку — шапка по итогам рендера
    if (data) { const [t2, s2] = heroFor(tab, data); $("title").textContent = t2; $("subtitle").textContent = s2; }
  }

  async function load(force) {
    const my = ++reqId, tab = S.tab, path = pathFor();
    const cached = cache.get(path);
    const spin = $("refresh");
    paint(cached || null, tab);
    spin.classList.add("spin");
    try {
      const data = await api(path, force);
      cache.set(path, data);
      if (my === reqId) paint(data, tab);
    } catch (e) {
      if (my === reqId && !cached) { view.innerHTML = errorView(e); }
    } finally {
      if (my === reqId) spin.classList.remove("spin");
    }
  }

  function haptic() { try { tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged(); } catch (e) { /* нет */ } }

  const actions = {
    tab: (el) => { if (S.tab !== el.dataset.tab) { S.tab = el.dataset.tab; paintTabs(); load(); } },
    refresh: () => { cache.clear(); load(true); },
    retry: () => load(true),
    week: (el) => { S.week += Number(el.dataset.dir); S.day = null; load(); },
    day: (el) => { S.day = el.dataset.day; paint(cache.get(pathFor()), S.tab); },
    sem: (el) => {
      const d = cache.get(pathFor()); if (!d) return;
      const sems = d.semesters, cur = S.sem[S.tab] || sems.current, i = sems.codes.indexOf(cur) + Number(el.dataset.dir);
      if (i < 0 || i >= sems.codes.length) return;
      S.sem[S.tab] = sems.codes[i]; if (S.tab === "exams") S.examTab = null; load();
    },
    examtab: (el) => { S.examTab = el.dataset.k; paint(cache.get(pathFor()), "exams"); },
    toggle: (el) => {
      const key = el.dataset.key; S.open.has(key) ? S.open.delete(key) : S.open.add(key);
      const rec = el.querySelector(".records"); if (rec) rec.hidden = !S.open.has(key);
    },
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-a]");
    if (!el || el.disabled) return;
    if (el.dataset.a !== "toggle" && el.dataset.a !== "refresh") haptic();
    actions[el.dataset.a] && actions[el.dataset.a](el);
  });

  $("refresh").innerHTML = ico("refresh");
  if (tg) { tg.ready(); tg.expand(); tg.onEvent && tg.onEvent("themeChanged", setTheme); }
  setTheme();
  paintTabs();
  load();
  // данные меняются в течение дня — подтягиваем свежие при возвращении в приложение
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
}

// ---------------------------------------------------------------- демо-данные (для просмотра без бота: ?demo)
function demoApi(path) {
  const today = nowTk().iso, base = parseISO(today);
  const monday = addDays(base, -((base.getUTCDay() + 6) % 7));
  const q = new URLSearchParams(path.split("?")[1] || "");
  const kind = path.split("?")[0];
  const sems = { codes: ["11", "12", "13"], current: "13" };
  const sem = q.get("semester") && sems.codes.includes(q.get("semester")) ? q.get("semester") : "13";
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 250));

  if (kind === "schedule") {
    const off = Number(q.get("week") || 0), mon = addDays(monday, off * 7);
    const plan = [
      ["1", "08:30", "09:50", "Mikroiqtisodiyot 1", "Лекция", "3-505", "Akramova N. M."],
      ["2", "10:00", "11:20", "Matematika", "Практика", "2-214", "Karimov S. R."],
      ["3", "11:30", "12:50", "Xorijiy til", "Практика", "5-305", "Madaminova S. N."],
      ["4", "13:00", "14:20", "Statistika", "Лекция", "1-101", "Rustamov A. B."],
    ];
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
    const d = (n) => iso(addDays(base, n));
    const ex = (id, subject, group, sheet, n, start, end, room, teacher, kind2) => ({ id, subject, kind: kind2 || "", group, sheet, date: d(n), start, end, room, teacher });
    const exams = sem === "13" ? [
      ex("1", "Mikroiqtisodiyot 1", "s", 1, 16, "09:00", "10:20", "3-505", "AKRAMOVA N. M.", "Yakuniy nazorat"),
      ex("2", "Statistika", "s", 1, 19, "13:00", "14:20", "5-305", "RUSTAMOV A. B.", "Yakuniy nazorat"),
      ex("3", "Philosophy", "s", 2, 27, "10:00", "11:20", "2-214", "KARIMOV S. R.", "Yakuniy nazorat"),
      ex("4", "Matematika", "c", 1, 3, "11:30", "12:50", "2-214", "KARIMOV S. R.", "Joriy nazorat"),
      ex("5", "Xorijiy til", "1", 1, -20, "08:30", "09:50", "5-305", "MADAMINOVA S. N.", "1-ON"),
      ex("6", "Xorijiy til", "2", 1, 1, "08:30", "09:50", "5-305", "MADAMINOVA S. N.", "2-ON"),
    ] : [
      ex("7", "Iqtisodiyot nazariyasi", "s", 1, -90, "09:00", "10:20", "1-101", "SOBIROV T. K.", "Yakuniy nazorat"),
      ex("8", "Tarix", "s", 1, -88, "13:00", "14:20", "1-102", "NAZAROV D. A.", "Yakuniy nazorat"),
    ];
    return wait({ semesters: sems, semester: sem, semester_no: semNo(sem), today, exams });
  }
  const sc = (name, ball, max) => ({ name, ball, max, pct: max ? Math.round((ball / max) * 1000) / 10 : null });
  const subjects = [
    { id: "1", name: "Mikroiqtisodiyot 1", credit: 4, overall: sc("Umumiy", 62, 70), grade5: 5, current: sc("Joriy", 24, 30), mid: sc("Oraliq", 38, 40), final: null, extra: [] },
    { id: "2", name: "Statistika", credit: 3, overall: sc("Umumiy", 51, 70), grade5: 4, current: sc("Joriy", 21, 30), mid: sc("Oraliq", 30, 40), final: null, extra: [] },
    { id: "3", name: "Philosophy", credit: 2, overall: sc("Umumiy", 88, 100), grade5: 5, current: sc("Joriy", 28, 30), mid: sc("Oraliq", 36, 40), final: sc("Yakuniy", 24, 30), extra: [] },
    { id: "4", name: "Xorijiy til", credit: 3, overall: null, grade5: null, current: null, mid: null, final: null, extra: [] },
  ];
  return wait({ semesters: sems, perf: { semester: sem, semester_no: semNo(sem), period: "01.09 – 30.12", subjects: sem === "13" ? subjects : subjects.slice(2, 3), credits: 12, avg_pct: 84.7, gpa_calc: 4.6 } });
}

if (typeof module !== "undefined") module.exports = { renderSchedule, renderNb, renderExams, renderGrades, demoApi, S, errorView, forecast, esc };
