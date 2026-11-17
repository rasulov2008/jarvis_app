/* Раздел «Финансы» (Telegram Mini App). Подключается до app.js; общие утилиты (esc, money, ico, api, post, nowTk…) берёт из него в момент вызова.
   Данные всегда считает бот: здесь нет бизнес-логики денег — только показ и отправка действий. Кэш на устройстве живёт по «ревизии» бота:
   любая запись денег меняет ревизию, и все сохранённые ответы перестают подходить. */
"use strict";

const FIN = (() => {
  const MONTH_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const KIND = { expense: "Расход", income: "Доход", refund: "Возврат", transfer: "Перевод", opening: "Начальный остаток", adjust: "Сверка", savings_in: "В сбережения", savings_out: "Из сбережений" };
  const SUB = { withdraw: "Снятие наличных", deposit: "Внесение наличных", to_savings: "На счёт сбережений", from_savings: "Со счёта сбережений" };
  const PERIODS = [["today", "Сегодня"], ["week", "Неделя"], ["month", "Месяц"], ["year", "Год"]];
  const REFS = { today: ["Сегодня", "Вчера"], week: ["Текущая неделя", "Прошлая неделя"], month: ["Текущий месяц", "Прошлый месяц"], year: ["Текущий год", "Прошлый год"] };
  const KIND_FILTERS = [["", "Все"], ["expense", "Расходы"], ["income,refund,opening", "Доходы"], ["move", "Переводы"], ["savings", "Сбережения"]];
  const EXTRA_ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>', journal: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
    sheet: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>', clip: '<path d="M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  };

  const st = {
    view: "main", period: "month", ref: "current", kind: "", account: "", all: false, catsOpen: false,
    ov: null, items: [], next: null, more: false, busy: false, firstDone: false, err: null,
    jr: { items: [], next: null, more: false, busy: false },
  };
  let host = null, rev = 0, sheetEl = null, formState = null, detailId = null, viewerUrl = null;
  const cache = new Map();

  // ------------------------------------------------------------ утилиты
  const sign = (x, plus) => `${x < 0 ? "−" : plus && x > 0 ? "+" : ""}${money(Math.abs(x))}`;
  const tk = (isoStr) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(isoStr));
    const g = (t) => p.find((x) => x.type === t).value;
    return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour") % 24 < 10 ? "0" + (g("hour") % 24) : g("hour")}:${g("minute")}` };
  };
  const longDate = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${MONTH_GEN[m - 1]}${y !== Number(nowTk().iso.slice(0, 4)) ? " " + y : ""}`; };
  const dayLabel = (d) => { const t = nowTk().iso; return d === t ? "Сегодня" : d === iso(addDays(parseISO(t), -1)) ? "Вчера" : longDate(d); };
  const fmtDT = (s) => { const t = tk(s); return `${longDate(t.date)}, ${t.time}`; };
  const icoSvg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || EXTRA_ICONS[name] || ""}</svg>`;
  const catIcon = (name) => { const c = ((st.ov && st.ov.categories) || []).find((x) => x.name === name); return c ? c.icon : { "начальный остаток": "🏁", "сверка": "⚖️" }[name] || "▫️"; };
  const accounts = () => (st.ov ? st.ov.balances.accounts : []);
  const q = (obj) => Object.entries(obj).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const failText = (e) => (e && e.message) || (e && e.kind === "network" ? "Нет связи с ботом" : "Не получилось — попробуйте ещё раз");

  /** «50к», «1,5 млн», «120 000» -> число; не разобрали — null. */
  function parseAmount(text) {
    const m = String(text || "").toLowerCase().replace(/\s+/g, "").replace(",", ".").match(/^(\d+(?:\.\d+)?)(к|k|тыс|тысяч|м|млн|m|mln)?$/);
    if (!m) return null;
    const mult = !m[2] ? 1 : ["к", "k", "тыс", "тысяч"].includes(m[2]) ? 1e3 : 1e6;
    const v = Math.round(parseFloat(m[1]) * mult * 100) / 100;
    return v > 0 ? v : null;
  }

  // ------------------------------------------------------------ данные и кэш
  async function get(path, fresh) {
    const c = cache.get(path);
    if (!fresh && c && c.rev === rev && Date.now() - c.t < 300000) return c.data;
    const data = await api(`fin/${path}`);
    if (data.rev != null && data.rev !== rev) { cache.clear(); rev = data.rev; }
    cache.set(path, { rev, t: Date.now(), data });
    return data;
  }
  const written = () => { cache.clear(); rev = 0; st.firstDone = false; };
  const periodQ = () => (st.all ? {} : { period: st.period, ref: st.ref });
  const listPath = (cursor) => `transactions?${q({ limit: 30, ...periodQ(), kind: st.kind, account: st.account, cursor })}`;

  async function refresh(fresh) {
    host.busy(true);
    try {
      st.ov = await get(`overview?${q({ period: st.period, ref: st.ref })}`, fresh);
      const page = await get(listPath(), fresh && !st.firstDone ? true : false);
      st.items = page.items; st.next = page.next_cursor; st.more = page.has_more; st.firstDone = true; st.err = null;
      paint();
    } catch (e) {
      st.err = e;
      if (!st.ov) host.show(host.error(e)); else host.toast("Нет связи — показаны сохранённые данные");
    } finally { host.busy(false); }
  }

  async function loadMore() {
    if (st.busy || !st.more) return;
    st.busy = true; setFoot();
    try {
      const page = await get(listPath(st.next));
      st.items = st.items.concat(page.items); st.next = page.next_cursor; st.more = page.has_more;
      const list = document.getElementById("finList");
      if (list) list.insertAdjacentHTML("beforeend", rowsHtml(page.items, st.items.slice(0, st.items.length - page.items.length).slice(-1)[0]));
    } catch (e) { host.toast(failText(e)); }
    st.busy = false; setFoot();
  }

  async function loadJournal(first) {
    const j = st.jr;
    if (j.busy) return;
    j.busy = true; if (first) { j.items = []; j.next = null; j.more = false; } else setJFoot();
    try {
      const page = await get(`journal?${q({ limit: 15, ...periodQ(), cursor: first ? "" : j.next })}`);
      j.items = j.items.concat(page.items); j.next = page.next_cursor; j.more = page.has_more;
    } catch (e) { host.toast(failText(e)); }
    j.busy = false; paintJournal();
  }

  // ------------------------------------------------------------ отрисовка: главный экран
  function heroHtml(b) {
    return `<div class="card fin-hero">
      <div class="fin-cap">Общий баланс</div><div class="fin-total">${money(b.total)}<small> сум</small></div>
      <div class="fin-split"><div><span>Доступно</span><b>${money(b.available)}</b></div><div><span>Сбережения</span><b>${money(b.savings)}</b></div></div>
    </div>
    <div class="card fin-accs">${b.accounts.map((a) => `<div class="fin-acc"><span class="fin-ico">${esc(a.icon)}</span><span class="fin-main"><b>${esc(a.name)}</b>${a.kind === "savings" ? "<small>Отдельный счёт сбережений</small>" : a.savings ? `<small>доступно ${money(a.available)} · отложено ${money(a.savings)}</small>` : ""}</span><span class="fin-val">${sign(a.balance)}</span></div>`).join("")}</div>`;
  }

  function periodHtml() {
    const labels = REFS[st.period];
    return `<div class="seg fin-seg">${PERIODS.map(([k, l]) => `<button data-a="fin" data-f="period" data-k="${k}" class="${!st.all && st.period === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="seg fin-seg two">${labels.map((l, i) => `<button data-a="fin" data-f="ref" data-k="${i ? "previous" : "current"}" class="${!st.all && st.ref === (i ? "previous" : "current") ? "on" : ""}">${l}</button>`).join("")}</div>`;
  }

  function summaryHtml(s, range) {
    const empty = !s.income && !s.expense;
    const per = s.per_day && s.expense ? `В среднем в день ${money(s.per_day)}` : "";
    const prev = s.previous != null && s.previous > 0 ? `${["", "Накануне", "Пред. неделя", "Пред. месяц", "Пред. год"][PERIODS.findIndex(([k]) => k === st.period) + 1] || "Ранее"} ${money(s.previous)} (${s.expense >= s.previous ? "+" : "−"}${Math.round(Math.abs(s.expense - s.previous) / s.previous * 100)}%)` : "";
    const cats = s.expense_by_category, shown = st.catsOpen ? cats : cats.slice(0, 5), top = cats.length ? cats[0].total : 1;
    return `<div class="section-title">${esc(range)}</div>
      <div class="card fin-sum">
        <div class="fin-cols"><div><span>Доходы</span><b class="in">${empty ? "—" : sign(s.income, true)}</b></div><div><span>Расходы</span><b>${empty ? "—" : sign(-s.expense)}</b></div><div><span>Итог</span><b class="${s.net >= 0 ? "in" : ""}">${empty ? "—" : sign(s.net, true)}</b></div></div>
        ${per || prev ? `<div class="fin-note">${[per, prev].filter(Boolean).join(" · ")}</div>` : ""}
        ${cats.length ? `<div class="fin-cats">${shown.map((c) => `<div class="fin-cat"><div class="fin-cat-top"><span>${esc(catIcon(c.name))} ${esc(c.name)}</span><b>${money(c.total)}</b></div><div class="fin-bar"><i style="width:${Math.max(3, Math.round(c.total / top * 100))}%"></i></div></div>`).join("")}
        ${cats.length > 5 ? `<button class="fin-link" data-a="fin" data-f="cats">${st.catsOpen ? "Свернуть" : `Все категории (${cats.length})`}</button>` : ""}</div>` : ""}
        ${s.income_by_category.length ? `<div class="fin-inc">${s.income_by_category.map((c) => `<span>${esc(catIcon(c.name))} ${esc(c.name)} <b>${money(c.total)}</b></span>`).join("")}</div>` : ""}
      </div>`;
  }

  function actionsHtml() {
    return `<div class="fin-actions"><button class="btn" data-a="fin" data-f="new">${icoSvg("plus")}Операция</button>
      <button class="btn tonal" data-a="fin" data-f="journal">${icoSvg("journal")}Журнал</button>
      <button class="btn tonal" data-a="fin" data-f="export">${icoSvg("sheet")}Excel</button></div>`;
  }

  function filtersHtml() {
    const acc = accounts();
    return `<div class="fin-chips">${KIND_FILTERS.map(([k, l]) => `<button class="fin-chip ${st.kind === k ? "on" : ""}" data-a="fin" data-f="kind" data-k="${k}">${l}</button>`).join("")}</div>
      <div class="fin-chips">${[["", "Все счета"], ...acc.map((a) => [String(a.id), a.name])].map(([k, l]) => `<button class="fin-chip ${st.account === k ? "on" : ""}" data-a="fin" data-f="acc" data-k="${k}">${esc(l)}</button>`).join("")}
        <button class="fin-chip ${st.all ? "on" : ""}" data-a="fin" data-f="all">За всё время</button></div>`;
  }

  /** Строка операции: слева значок, по центру название и подпись (категория · счёт · время), справа сумма. */
  function rowHtml(t) {
    const time = tk(t.created_at).time;
    let title, sub, amt, cls = "";
    const acc = esc(t.account || "без счёта");
    if (t.kind === "expense" || t.kind === "income" || t.kind === "refund" || t.kind === "opening") {
      const out = t.kind === "expense";
      title = t.description || (t.kind === "opening" ? "Начальный остаток" : t.category || KIND[t.kind]);
      sub = [t.kind === "refund" ? "Возврат" : t.category, acc, time].filter(Boolean).map(esc).join(" · ").replace(esc(t.account || "без счёта"), acc);
      amt = sign(out ? -t.amount : t.amount, true); cls = out ? "" : "in";
    } else if (t.kind === "adjust") {
      title = "Сверка"; sub = `${acc} · ${time}`; amt = sign(t.effect, true); cls = t.effect > 0 ? "in" : "";
    } else {
      title = SUB[t.subkind] || KIND[t.kind];
      const to = t.to_account ? esc(t.to_account) : "";
      sub = (t.kind === "transfer" ? `${acc} → ${to}` : t.account_id === t.to_account_id ? `${acc} · ${t.kind === "savings_in" ? "в сбережения" : "из сбережений"}` : `${acc} → ${to}`) + ` · ${time}`;
      amt = money(t.amount); cls = "mute";
    }
    const ic = t.kind === "transfer" ? "🔁" : t.kind === "savings_in" || t.kind === "savings_out" ? "🏦" : t.kind === "refund" ? "↩️" : t.kind === "adjust" ? "⚖️" : t.kind === "opening" ? "🏁" : catIcon(t.category);
    const clip = t.receipts_count ? `<span class="fin-clip">${icoSvg("clip")}${t.receipts_count}</span>` : "";
    return `<button class="fin-row" data-a="fin" data-f="open" data-id="${t.id}"><span class="fin-ico">${esc(ic)}</span><span class="fin-main"><b>${esc(title)}</b><small>${sub}</small></span><span class="fin-end"><span class="fin-amt ${cls}">${amt}</span>${clip}</span></button>`;
  }

  /** Операции, сгруппированные по дням; prev — предыдущая операция (для продолжения группы при «Загрузить ещё»). */
  function rowsHtml(items, prev) {
    let last = prev ? tk(prev.created_at).date : null, out = "";
    for (const t of items) {
      const d = tk(t.created_at).date;
      if (d !== last) { out += `<div class="fin-day">${dayLabel(d)}</div>`; last = d; }
      out += rowHtml(t);
    }
    return out;
  }

  function footHtml() {
    if (!st.items.length) return `<div class="fin-end-note">За выбранный период операций нет</div>`;
    if (st.busy) return `<div class="fin-load"><i></i>Загружаю…</div>`;
    return st.more ? `<button class="btn tonal block" data-a="fin" data-f="more">Загрузить ещё</button>` : `<div class="fin-end-note">Это все операции</div>`;
  }
  const setFoot = () => { const el = document.getElementById("finFoot"); if (el) el.innerHTML = footHtml(); };

  function mainHtml() {
    const o = st.ov, range = st.all ? "За всё время" : `${o.period.label} · ${o.period.range}`;
    return `${heroHtml(o.balances)}${periodHtml()}${summaryHtml(o.summary, range)}${actionsHtml()}
      <div class="section-title">История</div>${filtersHtml()}
      <div class="card fin-list" id="finList">${rowsHtml(st.items)}</div><div id="finFoot">${footHtml()}</div>${driveHint()}`;
  }
  const driveHint = () => "";

  function paint() {
    host.chrome();
    if (st.view === "journal") return paintJournal();
    if (!st.ov) { host.show(host.skeleton); return; }
    host.show(mainHtml());
  }

  // ------------------------------------------------------------ журнал проводок
  function entryHtml(e) {
    const t = tk(e.entry_date);
    return `<div class="card fin-je ${e.kind === "reversal" ? "rev" : ""}">
      <div class="fin-je-h"><b>№${e.id}</b><span>${longDate(t.date)}, ${t.time}</span>${e.kind === "reversal" ? '<em class="pill tone-warn">сторно</em>' : e.reversed ? '<em class="pill">сторнирована</em>' : ""}</div>
      <div class="fin-je-d">${esc(e.description || e.category || "")}${e.tx_id ? ` · операция <a data-a="fin" data-f="open" data-id="${e.tx_id}">#${e.tx_id}</a>` : ""}</div>
      ${e.lines.map((l) => `<div class="fin-jl"><span class="dc">${l.debit ? "Дт" : "Кт"}</span><span class="acc">${esc(l.account)}${l.balance_after != null ? `<small>остаток ${money(l.balance_after)}</small>` : ""}</span><b>${money(l.debit || l.credit)}</b></div>`).join("")}
      <div class="fin-jt"><span>Итого</span><span>Дт ${money(e.debit_total)} = Кт ${money(e.credit_total)}</span></div></div>`;
  }
  function paintJournal() {
    if (st.view !== "journal") return;
    const j = st.jr, range = st.all || !st.ov ? "За всё время" : `${st.ov.period.label} · ${st.ov.period.range}`;
    host.show(`<div class="section-title">Журнал проводок · ${esc(range)}</div>
      <p class="muted small fin-hint">Каждая операция — запись с равными суммами по дебету (Дт) и кредиту (Кт). Исправление и отмена делаются сторно, исходная запись остаётся.</p>
      ${j.items.map(entryHtml).join("") || (j.busy ? '<div class="skel"></div>' : '<div class="card empty-hint"><p class="muted">За период проводок нет</p></div>')}
      ${j.busy && j.items.length ? '<div class="fin-load"><i></i>Загружаю…</div>' : j.more ? '<button class="btn tonal block" data-a="fin" data-f="jmore">Загрузить ещё</button>' : j.items.length ? '<div class="fin-end-note">Это все записи</div>' : ""}`);
  }
  const setJFoot = () => paintJournal();

  // ------------------------------------------------------------ окна (sheet)
  function ensureSheet() {
    if (sheetEl) return;
    sheetEl = document.createElement("div");
    sheetEl.className = "sheet-wrap"; sheetEl.hidden = true;
    sheetEl.innerHTML = '<div class="sheet-bg" data-a="fin" data-f="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div><div class="sheet-in" id="finSheetIn"></div></div>';
    document.body.appendChild(sheetEl);
    const file = document.createElement("input");
    file.type = "file"; file.id = "finFile"; file.accept = "image/*,application/pdf"; file.multiple = true; file.hidden = true;
    file.addEventListener("change", () => { const f = [...file.files]; file.value = ""; if (f.length) attachFiles(f); });
    document.body.appendChild(file);
  }
  function openSheet(html) { ensureSheet(); document.getElementById("finSheetIn").innerHTML = html; sheetEl.hidden = false; document.body.classList.add("sheet-open"); }
  function closeSheet() { if (!sheetEl) return; sheetEl.hidden = true; document.body.classList.remove("sheet-open"); formState = null; detailId = null; if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; } }
  const sheetIn = () => document.getElementById("finSheetIn");

  // ------------------------------------------------------------ карточка операции
  async function openDetail(id, fresh) {
    detailId = id;
    openSheet('<div class="skel"></div><div class="skel"></div>');
    try { renderDetail(await get(`transaction?id=${id}`, fresh)); } catch (e) { closeSheet(); host.toast(failText(e)); }
  }

  function receiptHtml(r) {
    const status = r.status === "synced" ? "" : r.status === "pending" ? `<span class="pill tone-warn">ждёт отправки в Drive</span>` : `<span class="pill tone-bad">не загружен</span>`;
    const isImg = String(r.mime).startsWith("image/");
    return `<div class="fin-rc"><span class="fin-ico">${isImg ? "🧾" : "📄"}</span><span class="fin-main"><b>${esc(r.name)}</b><small>${sizeKb(r.size_bytes)} ${status}${r.last_error && r.status !== "synced" ? ` · ${esc(r.last_error)}` : ""}</small></span>
      <span class="fin-rc-a">${r.status !== "synced" ? `<button data-a="fin" data-f="rretry" data-id="${r.id}">Повторить</button>` : ""}
      <button data-a="fin" data-f="rview" data-id="${r.id}" data-mime="${esc(r.mime)}" data-link="${esc(r.drive_link || "")}">Открыть</button>
      <button data-a="fin" data-f="rsend" data-id="${r.id}">В чат</button>
      <button data-a="fin" data-f="rrep" data-id="${r.id}">Заменить</button>
      <button class="danger" data-a="fin" data-f="rdel" data-id="${r.id}" aria-label="Удалить">${icoSvg("trash")}</button></span></div>`;
  }

  function renderDetail(d) {
    const t = d.tx, voided = !!t.voided_at, when = fmtDT(t.created_at);
    const out = t.kind === "expense", moves = ["transfer", "savings_in", "savings_out"].includes(t.kind);
    const amount = moves ? money(t.amount) : sign(t.kind === "adjust" ? t.effect : out ? -t.amount : t.amount, true);
    const accLine = moves ? `${esc(t.account || "")} → ${esc(t.to_account || "")}` : esc(t.account || "без счёта (учтено до переработки учёта)");
    const rows = [["Тип", SUB[t.subkind] || KIND[t.kind]], ["Дата", when], ["Счёт", accLine, true], t.category ? ["Категория", `${catIcon(t.category)} ${t.category}`] : null, t.description ? ["Описание", t.description] : null,
      t.refunded > 0 ? ["Возвращено", `${money(t.refunded)} из ${money(t.amount)}`] : null, t.revision > 1 ? ["Исправлена", `${t.revision - 1} ${plural(t.revision - 1, "раз", "раза", "раз")}`] : null, ["Номер", `#${t.id}`]].filter(Boolean);
    const canRefund = out && !voided && t.refunded < t.amount;
    openSheet(`<div class="sheet-head"><div><div class="fin-cap">${SUB[t.subkind] || KIND[t.kind]}${voided ? " · отменена" : ""}</div><div class="fin-big ${out || moves ? "" : "in"}">${amount}<small> сум</small></div></div><button class="sheet-x" data-a="fin" data-f="close" aria-label="Закрыть">${icoSvg("close")}</button></div>
      <div class="card flat">${rows.map(([k, v, raw]) => `<div class="kv"><span>${k}</span><span>${raw ? v : esc(v)}</span></div>`).join("")}</div>
      <div class="fin-sec"><b>Чеки и документы</b><button class="fin-link" data-a="fin" data-f="rnew">${icoSvg("clip")} Прикрепить</button></div>
      ${d.receipts.length ? `<div class="card flat">${d.receipts.map(receiptHtml).join("")}</div>` : '<p class="muted small fin-hint">Фото чека или PDF сохранятся в Google Drive: Finance → Receipts → год → месяц.</p>'}
      <div class="fin-sec"><b>Проводки</b></div>${d.entries.map(entryHtml).join("") || '<p class="muted small fin-hint">Для этой операции нет журнальных записей.</p>'}
      ${d.refunds.length ? `<div class="fin-sec"><b>Возвраты</b></div><div class="card flat">${d.refunds.map((r) => `<div class="kv"><span>${fmtDT(r.created_at)}</span><span>+${money(r.amount)}</span></div>`).join("")}</div>` : ""}
      ${voided ? "" : `<div class="fin-btns">${t.kind !== "adjust" ? `<button class="btn tonal" data-a="fin" data-f="edit" data-id="${t.id}">Изменить</button>` : ""}${canRefund ? `<button class="btn tonal" data-a="fin" data-f="refund" data-id="${t.id}">Возврат</button>` : ""}<button class="btn danger" data-a="fin" data-f="void" data-id="${t.id}">Отменить</button></div>`}`);
    sheetIn().dataset.tx = t.id;
  }

  // ------------------------------------------------------------ форма операции
  const accOpts = (sel, skipSavings) => accounts().filter((a) => !(skipSavings && a.kind === "savings")).map((a) => `<option value="${a.id}" ${String(sel) === String(a.id) ? "selected" : ""}>${esc(a.icon)} ${esc(a.name)} · ${money(a.available + (a.kind === "savings" ? a.savings : 0))}</option>`).join("");

  function formHtml(f) {
    const edit = f.mode === "edit", cats = (st.ov.categories || []).filter((c) => c.kind === (f.kind === "income" ? "income" : "expense"));
    const kinds = [["expense", "Расход"], ["income", "Доход"], ["transfer", "Перевод"], ["savings", "Сбережения"]];
    const isMove = f.kind === "transfer", isSav = f.kind === "savings", hasCat = f.kind === "expense" || f.kind === "income";
    const first = accounts().find((a) => a.kind !== "savings");
    return `<div class="sheet-head"><b class="fin-title">${edit ? "Изменить операцию" : f.mode === "refund" ? "Возврат по расходу" : "Новая операция"}</b><button class="sheet-x" data-a="fin" data-f="close" aria-label="Закрыть">${icoSvg("close")}</button></div>
      ${f.mode === "new" ? `<div class="seg fin-seg">${kinds.map(([k, l]) => `<button data-a="fin" data-f="fkind" data-k="${k}" class="${f.kind === k ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
      ${isSav ? `<div class="seg fin-seg two"><button data-a="fin" data-f="fdir" data-k="in" class="${f.dir === "in" ? "on" : ""}">В сбережения</button><button data-a="fin" data-f="fdir" data-k="out" class="${f.dir === "out" ? "on" : ""}">Из сбережений</button></div>` : ""}
      <label class="fin-lab">Сумма</label><input id="fAmt" class="fin-in big" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(f.amount || "")}"><div class="fin-sub" id="fAmtHint"></div>
      <label class="fin-lab">${isMove ? "Откуда" : isSav ? (f.dir === "in" ? "С какого счёта" : "Чьи сбережения") : "Счёт"}</label><select id="fAcc" class="fin-in">${accOpts(f.account || (first && first.id), f.kind === "expense")}</select>
      ${isMove ? `<label class="fin-lab">Куда</label><select id="fTo" class="fin-in">${accOpts(f.to || (accounts().find((a) => String(a.id) !== String(f.account || (first && first.id))) || {}).id)}</select>` : ""}
      ${hasCat && f.mode !== "refund" ? `<label class="fin-lab">Категория</label><div class="fin-chips wrap" id="fCats">${(edit ? "" : `<button class="fin-chip ${f.category ? "" : "on"}" data-a="fin" data-f="fcat" data-k="">Авто</button>`)}${cats.map((c) => `<button class="fin-chip ${f.category === c.name ? "on" : ""}" data-a="fin" data-f="fcat" data-k="${esc(c.name)}">${esc(c.icon)} ${esc(c.name)}</button>`).join("")}</div>` : ""}
      ${f.mode !== "refund" ? `<label class="fin-lab">Описание</label><input id="fDesc" class="fin-in" maxlength="200" autocomplete="off" placeholder="${hasCat ? "Например: коржинка" : "Необязательно"}" value="${esc(f.description || "")}">` : ""}
      ${f.mode !== "refund" ? `<label class="fin-lab">Дата</label><input id="fDate" class="fin-in" type="date" max="${nowTk().iso}" value="${esc(f.date || nowTk().iso)}">` : ""}
      <button class="btn block fin-submit" data-a="fin" data-f="submit">${edit ? "Сохранить" : f.mode === "refund" ? "Оформить возврат" : "Записать"}</button>`;
  }
  function openForm(f) { formState = f; openSheet(formHtml(f)); hintAmount(); }
  function readForm() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
    Object.assign(formState, { amount: v("fAmt"), account: v("fAcc") || formState.account, to: v("fTo") || formState.to, description: v("fDesc"), date: v("fDate") || formState.date });
  }
  function hintAmount() {
    const el = document.getElementById("fAmtHint"), inp = document.getElementById("fAmt"); if (!el || !inp) return;
    const v = parseAmount(inp.value), acc = accounts().find((a) => String(a.id) === (document.getElementById("fAcc") || {}).value);
    el.textContent = inp.value && v == null ? "Не похоже на сумму — пример: 50к, 1,5 млн, 120000" : v ? `${money(v)} сум` : acc ? `Доступно: ${money(acc.available)}${acc.savings ? ` · сбережения: ${money(acc.savings)}` : ""}` : "";
    el.className = `fin-sub${inp.value && v == null ? " bad" : ""}`;
  }

  async function submit(btn) {
    readForm();
    const f = formState, amount = parseAmount(f.amount);
    if (!amount) { host.toast("Введите сумму, например 50к"); return; }
    btn.disabled = true;
    const today = nowTk().iso, date = f.date && f.date !== today && f.date !== f.origDate ? f.date : f.mode === "edit" && f.date !== f.origDate ? f.date : undefined;
    try {
      if (f.mode === "edit") {
        const r = await post("fin/transaction/edit", { id: f.id, amount, account: f.account, to_account: f.kind === "transfer" ? f.to : undefined, category: f.category || undefined, description: f.description, date });
        host.toast(r.changed ? "Сохранено" : "Без изменений");
      } else if (f.mode === "refund") {
        await post("fin/transaction", { kind: "refund", amount, account: f.account, refund_of: f.id, client_key: f.key });
        host.toast("Возврат оформлен");
      } else {
        const kind = f.kind === "savings" ? (f.dir === "in" ? "savings_in" : "savings_out") : f.kind;
        const r = await post("fin/transaction", { kind, amount, account: f.account, to_account: kind === "transfer" ? f.to : undefined, category: f.category || undefined, description: f.description, date, client_key: f.key });
        host.toast(r.duplicate ? "Уже записано" : r.overdraft ? "Записано. Баланс ушёл в минус — сверьте остаток" : "Записано");
        if (r.warnings && r.warnings.length) setTimeout(() => host.toast(r.warnings[0].replace(/<[^>]+>/g, "")), 2700);
      }
      host.haptic("success"); closeSheet(); written(); await refresh(true);
    } catch (e) { btn.disabled = false; host.haptic("error"); host.toast(failText(e)); }
  }

  // ------------------------------------------------------------ чеки
  function shrink(file) {
    if (!file.type.startsWith("image/") || file.size < 1.5 * 1048576) return Promise.resolve(file);
    return new Promise((resolve) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 2400 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob((b) => resolve(b ? new File([b], (file.name || "receipt").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file), "image/jpeg", 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  async function upload(file, fields) {
    if (DEMO) return demoReceipt(fields);
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    fd.append("file", file, file.name || "receipt");
    let res;
    try { res = await fetch(`${API}/api/fin/receipt`, { method: "POST", headers: { "X-Telegram-Init-Data": tg.initData }, body: fd }); } catch (e) { throw { kind: "network" }; }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw { kind: j.error || "http", message: j.message };
    return j;
  }
  let replaceId = null;
  async function attachFiles(files) {
    const id = detailId; if (!id) return;
    for (const f of files) {
      host.toast(`Загружаю «${f.name || "файл"}»…`);
      try {
        const r = await upload(await shrink(f), replaceId ? { replace_id: replaceId } : { tx_id: id });
        host.toast(r.synced ? "Сохранено в Google Drive" : "Принято — отправлю в Drive, как только появится связь"); host.haptic("success");
      } catch (e) { host.toast(failText(e)); host.haptic("error"); }
      replaceId = null;
    }
    written(); await openDetail(id, true); refresh(true);
  }
  async function fetchBlob(id) {
    if (DEMO) return null;
    const res = await fetch(`${API}/api/fin/receipt/file?id=${id}`, { headers: { "X-Telegram-Init-Data": tg.initData } });
    if (!res.ok) throw { message: "Не удалось загрузить файл" };
    return res.blob();
  }
  async function viewReceipt(el) {
    const { id, mime, link } = el.dataset;
    if (!String(mime).startsWith("image/")) { if (link) { tg && tg.openLink ? tg.openLink(link) : window.open(link, "_blank"); } else { await post("fin/receipt/send", { id: Number(id) }); host.toast("Файл отправлен в чат с ботом"); } return; }
    host.toast("Открываю…");
    try {
      const blob = await fetchBlob(id); if (viewerUrl) URL.revokeObjectURL(viewerUrl);
      viewerUrl = blob ? URL.createObjectURL(blob) : "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" fill="#555">Демо-чек</text></svg>');
      const v = document.createElement("div"); v.className = "fin-viewer"; v.dataset.a = "fin"; v.dataset.f = "vclose";
      v.innerHTML = `<img src="${viewerUrl}" alt="Чек"><button class="sheet-x" aria-label="Закрыть">${icoSvg("close")}</button>`; document.body.appendChild(v);
    } catch (e) { host.toast(failText(e)); }
  }

  // ------------------------------------------------------------ действия
  const act = {
    period: (el) => { st.period = el.dataset.k; st.ref = "current"; st.all = false; st.firstDone = false; refresh(); },
    ref: (el) => { st.ref = el.dataset.k; st.all = false; st.firstDone = false; refresh(); },
    all: () => { st.all = !st.all; st.firstDone = false; refresh(); },
    kind: (el) => { st.kind = el.dataset.k; st.firstDone = false; refresh(); },
    acc: (el) => { st.account = el.dataset.k; st.firstDone = false; refresh(); },
    cats: () => { st.catsOpen = !st.catsOpen; paint(); },
    more: loadMore,
    jmore: () => loadJournal(false),
    journal: () => { st.view = "journal"; host.chrome(); loadJournal(true); paintJournal(); },
    open: (el) => openDetail(Number(el.dataset.id)),
    close: closeSheet,
    vclose: (el) => { el.remove(); },
    new: () => openForm({ mode: "new", kind: "expense", dir: "in", key: Math.random().toString(36).slice(2) + Date.now().toString(36) }),
    fkind: (el) => { readForm(); formState.kind = el.dataset.k; formState.category = ""; sheetIn().innerHTML = formHtml(formState); hintAmount(); },
    fdir: (el) => { readForm(); formState.dir = el.dataset.k; sheetIn().innerHTML = formHtml(formState); hintAmount(); },
    fcat: (el) => { formState.category = el.dataset.k; document.querySelectorAll("#fCats .fin-chip").forEach((b) => b.classList.toggle("on", b === el)); },
    submit: (el) => submit(el),
    edit: async (el) => {
      const d = await get(`transaction?id=${el.dataset.id}`), t = d.tx, kind = t.kind === "savings_in" || t.kind === "savings_out" ? "savings" : t.kind === "opening" || t.kind === "refund" ? "income" : t.kind;
      openForm({ mode: "edit", id: t.id, kind: t.kind === "refund" ? "expense" : kind, dir: t.kind === "savings_out" ? "out" : "in", amount: String(Math.round(t.amount)), account: t.account_id, to: t.to_account_id, category: ["expense", "income"].includes(t.kind) && t.category ? t.category : "", description: t.description || "", date: tk(t.created_at).date, origDate: tk(t.created_at).date });
    },
    refund: async (el) => {
      const d = await get(`transaction?id=${el.dataset.id}`), t = d.tx;
      openForm({ mode: "refund", id: t.id, kind: "expense", amount: String(Math.round(t.amount - t.refunded)), account: t.account_id, key: Math.random().toString(36).slice(2) });
    },
    void: async (el) => {
      if (!window.confirm("Отменить операцию? Баланс вернётся, а запись останется в журнале как отменённая.")) return;
      try { await post("fin/transaction/void", { id: Number(el.dataset.id) }); host.toast("Операция отменена"); host.haptic("success"); closeSheet(); written(); refresh(true); } catch (e) { host.toast(failText(e)); }
    },
    export: async (el) => {
      el.disabled = true;
      try { await post("fin/export", { period: st.all ? "all" : st.period, ref: st.ref }); host.toast("Отчёт отправлен в чат с ботом"); host.haptic("success"); } catch (e) { host.toast(failText(e)); }
      el.disabled = false;
    },
    rnew: () => { replaceId = null; document.getElementById("finFile").click(); },
    rrep: (el) => { replaceId = Number(el.dataset.id); document.getElementById("finFile").click(); },
    rview: viewReceipt,
    rsend: async (el) => { try { await post("fin/receipt/send", { id: Number(el.dataset.id) }); host.toast("Файл отправлен в чат с ботом"); } catch (e) { host.toast(failText(e)); } },
    rretry: async (el) => { try { const r = await post("fin/receipt/retry", { id: Number(el.dataset.id) }); host.toast(r.status === "synced" ? "Сохранено в Google Drive" : "Пока не получилось — повторю автоматически"); written(); openDetail(detailId, true); } catch (e) { host.toast(failText(e)); } },
    rdel: async (el) => {
      if (!window.confirm("Удалить документ? Файл уйдёт в корзину Google Drive.")) return;
      try { await post("fin/receipt/delete", { id: Number(el.dataset.id) }); host.toast("Удалено"); written(); openDetail(detailId, true); refresh(true); } catch (e) { host.toast(failText(e)); }
    },
  };

  // ------------------------------------------------------------ публичный интерфейс
  function init(h) {
    host = h;
    Object.assign(ICON, EXTRA_ICONS);
    document.addEventListener("input", (ev) => { if (ev.target && ev.target.id === "fAmt") hintAmount(); });
    document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "fAcc") hintAmount(); });
    // бесконечная прокрутка не нужна: по ТЗ — явная кнопка «Загрузить ещё»
  }
  return {
    init,
    get view() { return st.view; },
    mount() { if (st.view === "main" && st.ov) paint(); else if (st.view === "journal") paintJournal(); else host.show(host.skeleton); refresh(true); },
    reload() { refresh(true); },
    back() { if (sheetEl && !sheetEl.hidden) { closeSheet(); return true; } if (st.view !== "main") { st.view = "main"; host.chrome(); paint(); return true; } return false; },
    act(el, ev) { const f = act[el.dataset.f]; if (f) { ev && ev.stopPropagation(); f(el, ev); } },
    subtitle() { return st.ov ? (st.all ? "За всё время" : `${st.ov.period.label} · ${st.ov.period.range}`) : ""; },
    parseAmount,
  };
})();

// ---------------------------------------------------------------- демо-данные (?demo): считаются на лету, чтобы можно было посмотреть и нажать всё
function demoReceipt() { return Promise.resolve({ ok: true, synced: true }); }

FIN.demo = (() => {
  const accs = [{ id: 1, name: "карта", icon: "💳", kind: "bank" }, { id: 2, name: "наличные", icon: "💵", kind: "cash" }, { id: 3, name: "сбережения", icon: "🏦", kind: "savings" }];
  const cats = [["продукты", "🛒", "expense"], ["еда", "🍽", "expense"], ["транспорт", "🚕", "expense"], ["связь", "📱", "expense"], ["покупки", "🛍", "expense"], ["развлечения", "🎮", "expense"], ["подписки", "🔁", "expense"], ["учёба", "📚", "expense"], ["другое", "📦", "expense"],
    ["стипендия", "🎓", "income"], ["подработка", "🧑‍💻", "income"], ["родители", "👪", "income"], ["другое", "📦", "income"]].map(([name, icon, kind]) => ({ name, icon, kind, grp: "" }));
  let seq = 1, rev = Date.now(), txs = null;
  const day = (n) => { const d = addDays(parseISO(nowTk().iso), -n); return `${iso(d)}T${pad(8 + (n * 5) % 12)}:${pad((n * 17) % 60)}:00+05:00`; };
  const seed = () => {
    txs = [];
    const add = (o) => txs.push({ id: seq++, kind: "expense", subkind: null, category: null, description: "", account_id: 1, to_account_id: null, revision: 1, receipts_count: 0, refunded: 0, voided_at: null, ...o });
    add({ kind: "opening", amount: 3000000, created_at: day(120), description: "Начальный остаток" });
    add({ kind: "opening", amount: 1200000, account_id: 2, created_at: day(120) });
    const shops = [["продукты", "Корзинка"], ["еда", "Обед в кафе"], ["транспорт", "Такси"], ["продукты", "Макро"], ["связь", "Интернет"], ["развлечения", "Кино"], ["покупки", "Одежда"], ["подписки", "Spotify"], ["учёба", "Книги"], ["еда", "Кофе"]];
    for (let i = 100; i >= 0; i -= 2) add({ amount: 12000 + ((i * 7919) % 9) * 9000, created_at: day(i), category: shops[i % 10][0], description: shops[i % 10][1], account_id: i % 4 === 0 ? 2 : 1 });
    for (const i of [90, 60, 30, 3]) add({ kind: "income", amount: 1100000, created_at: day(i), category: "стипендия", description: "Стипендия" });
    add({ kind: "transfer", subkind: "withdraw", amount: 200000, created_at: day(20), account_id: 1, to_account_id: 2 });
    add({ kind: "savings_in", amount: 1500000, created_at: day(15), account_id: 1, to_account_id: 1 });
    add({ kind: "income", amount: 300000, created_at: day(1), category: "подработка", description: "Репетиторство" });
    add({ amount: 45000, created_at: day(0), category: "продукты", description: "Корзинка", receipts_count: 1 });
    txs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  };
  const live = () => txs.filter((t) => !t.voided_at);
  const eff = (t) => (["income", "opening", "refund"].includes(t.kind) ? t.amount : t.kind === "expense" ? -t.amount : 0);
  const balances = () => {
    const a = accs.map((w) => ({ ...w, balance: 0, available: 0, savings: 0 })), by = (id) => a.find((x) => x.id === id);
    for (const t of live()) {
      const s = by(t.account_id), d = t.to_account_id ? by(t.to_account_id) : null;
      if (t.kind === "transfer") { s.available -= t.amount; d.available += t.amount; } else if (t.kind === "savings_in") { s.available -= t.amount; d.savings += t.amount; } else if (t.kind === "savings_out") { s.savings -= t.amount; d.available += t.amount; } else s.available += eff(t);
    }
    a.forEach((w) => { if (w.kind === "savings") { w.savings = w.available + w.savings; w.available = 0; } w.balance = w.available + w.savings; });
    return { accounts: a, total: a.reduce((x, w) => x + w.balance, 0), available: a.reduce((x, w) => x + w.available, 0), savings: a.reduce((x, w) => x + w.savings, 0) };
  };
  const bounds = (key, ref) => {
    const t = parseISO(nowTk().iso), prev = ref === "previous"; let s, e, label, range;
    const fmt = (d) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
    if (key === "today") { s = addDays(t, prev ? -1 : 0); e = addDays(s, 1); label = prev ? "Вчера" : "Сегодня"; range = fmt(s); }
    else if (key === "week") { s = addDays(t, -((t.getUTCDay() + 6) % 7) - (prev ? 7 : 0)); e = addDays(s, 7); label = prev ? "Прошлая неделя" : "Текущая неделя"; range = `${fmt(s)} – ${fmt(addDays(e, -1))}`; }
    else if (key === "month") { s = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - (prev ? 1 : 0), 1)); e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1)); label = prev ? "Прошлый месяц" : "Текущий месяц"; range = `${["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"][s.getUTCMonth()]} ${s.getUTCFullYear()}`; }
    else { s = new Date(Date.UTC(t.getUTCFullYear() - (prev ? 1 : 0), 0, 1)); e = new Date(Date.UTC(s.getUTCFullYear() + 1, 0, 1)); label = prev ? "Прошлый год" : "Текущий год"; range = String(s.getUTCFullYear()); }
    return { s: iso(s), e: iso(e), label, range, days: Math.round((e - s) / 864e5) };
  };
  const inRange = (t, b) => { const d = t.created_at.slice(0, 10); return d >= b.s && d < b.e; };
  const summary = (b) => {
    const rows = live().filter((t) => inRange(t, b)), sum = (kind, k) => rows.filter((t) => kind.includes(t.kind)).reduce((m, t) => { m[t[k]] = (m[t[k]] || 0) + (t.kind === "refund" ? -t.amount : t.amount); return m; }, {});
    const ex = sum(["expense", "refund"], "category"), inc = sum(["income"], "category"), list = (o) => Object.entries(o).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([name, total]) => ({ name, total, count: 1 }));
    const expense = Object.values(ex).reduce((x, y) => x + y, 0), income = Object.values(inc).reduce((x, y) => x + y, 0);
    return { expense, income, net: income - expense, expense_by_category: list(ex), income_by_category: list(inc), per_day: expense / Math.max(1, Math.min(b.days, Math.round((parseISO(nowTk().iso) - parseISO(b.s)) / 864e5) + 1)), previous: expense * 0.85 };
  };
  const out = (t) => ({ ...t, effect: eff(t), account: (accs.find((a) => a.id === t.account_id) || {}).name, account_icon: (accs.find((a) => a.id === t.account_id) || {}).icon, to_account: (accs.find((a) => a.id === t.to_account_id) || {}).name });
  const lines = (t) => {
    const A = (id, sub) => `${accs.find((a) => a.id === id).name} — ${sub}`, amt = t.amount;
    if (t.kind === "expense") return [["Расход: " + t.category, amt, 0], [A(t.account_id, "доступно"), 0, amt]];
    if (t.kind === "income" || t.kind === "opening") return [[A(t.account_id, "доступно"), amt, 0], [t.kind === "opening" ? "Начальные остатки" : "Доход: " + t.category, 0, amt]];
    if (t.kind === "transfer") return [[A(t.to_account_id, "доступно"), amt, 0], [A(t.account_id, "доступно"), 0, amt]];
    return [[A(t.to_account_id, "сбережения"), amt, 0], [A(t.account_id, "доступно"), 0, amt]];
  };
  const entry = (t, i) => ({ id: 1000 - i, tx_id: t.id, entry_date: t.created_at, created_at: t.created_at, kind: "post", reversed: !!t.voided_at, revision: 1, description: t.description, category: t.category,
    lines: lines(t).map(([account, debit, credit]) => ({ account, debit, credit, balance_after: Math.round(Math.abs(debit - credit) * 7 + 1200000) })), debit_total: t.amount, credit_total: t.amount });

  return (path, method, body) => {
    if (!txs) seed();
    const [route, qs] = path.replace(/^fin\//, "").split("?"), p = new URLSearchParams(qs || ""), wait = (v) => new Promise((r) => setTimeout(() => r(v), 180));
    if (method === "GET") {
      if (route === "overview") { const b = bounds(p.get("period"), p.get("ref")); return wait({ rev, balances: balances(), summary: summary(b), cashflow: {}, period: { key: p.get("period"), ref: p.get("ref"), label: b.label, range: b.range }, categories: cats }); }
      if (route === "transactions") {
        let list = live(); const b = p.get("period") ? bounds(p.get("period"), p.get("ref")) : null;
        if (b) list = list.filter((t) => inRange(t, b));
        const kinds = { move: ["transfer", "savings_in", "savings_out"], savings: ["savings_in", "savings_out"] }[p.get("kind")] || (p.get("kind") || "").split(",").filter(Boolean);
        if (kinds.length) list = list.filter((t) => kinds.includes(t.kind));
        if (p.get("account")) list = list.filter((t) => String(t.account_id) === p.get("account") || String(t.to_account_id) === p.get("account"));
        const from = p.get("cursor") ? Number(p.get("cursor")) : 0, lim = Number(p.get("limit") || 30), slice = list.slice(from, from + lim);
        return wait({ rev, items: slice.map(out), has_more: from + lim < list.length, next_cursor: String(from + lim) });
      }
      if (route === "transaction") { const t = txs.find((x) => x.id === Number(p.get("id"))); return wait({ rev, tx: out(t), entries: [entry(t, t.id)], receipts: t.receipts_count ? [{ id: 1, name: "2026-11-17_09-10_tx" + t.id + "_a1b2c3d4.jpg", mime: "image/jpeg", size_bytes: 482113, status: "synced", drive_link: "", last_error: null }] : [], refunds: [] }); }
      if (route === "journal") { const b = p.get("period") ? bounds(p.get("period"), p.get("ref")) : null, list = live().filter((t) => !b || inRange(t, b)), from = p.get("cursor") ? Number(p.get("cursor")) : 0, slice = list.slice(from, from + 15); return wait({ rev, items: slice.map((t, i) => entry(t, from + i)), has_more: from + 15 < list.length, next_cursor: String(from + 15) }); }
    } else {
      rev = Date.now();
      if (route === "transaction") {
        const t = { id: seq++, kind: body.kind, subkind: null, amount: body.amount, category: body.category || "другое", description: body.description || "", account_id: Number(body.account), to_account_id: body.to_account ? Number(body.to_account) : (["savings_in", "savings_out"].includes(body.kind) ? Number(body.account) : null), created_at: new Date().toISOString(), revision: 1, receipts_count: 0, refunded: 0, voided_at: null };
        txs.unshift(t); return wait({ ok: true, rev, tx: out(t), balances: balances(), duplicate: false, overdraft: false, warnings: [] });
      }
      if (route === "transaction/void") { const t = txs.find((x) => x.id === body.id); t.voided_at = new Date().toISOString(); return wait({ ok: true, rev, tx: out(t), balances: balances() }); }
      if (route === "transaction/edit") { const t = txs.find((x) => x.id === body.id); if (body.amount) t.amount = body.amount; if (body.description != null) t.description = body.description; if (body.category) t.category = body.category; t.revision++; return wait({ ok: true, rev, tx: out(t), balances: balances(), changed: true }); }
      return wait({ ok: true, rev });
    }
    return wait({ rev });
  };
})();
