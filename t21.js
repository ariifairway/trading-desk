// "Nasdaq 21" tab (landing page): best strategies first, all 21 ranked, equity charts back to Jan 2024, per-strategy rules, sources and browsable trade lists.
// Self-contained module; app.js only calls window.T21.render(v, helpers). Practice only: no broker, no real order.
// Data: t21.json (live + backtest summary, data branch on GitHub with local fallback), t21_bt.json (daily backtest curves) and t21_tr_Sxx.json (backtest trades; loaded on demand).
(function () {
"use strict";
const VER = "20261029e", RAW = "https://raw.githubusercontent.com/ariifairway/trading-desk/data/";
const LOCAL = location.hostname === "127.0.0.1" || location.hostname === "localhost";
let D = null, err = null, BT = null, btErr = null, FU = null, FUerr = null, FC = null, FCerr = null; const TRS = {}, TRERR = {}; const CH = [];
const S = { sel: "S11", cmb: "c01", month: null, page: 0, scroll: false };
const PAGE = 40;
async function getJ(urls) { let e; for (const u of urls) { try { const r = await fetch(u, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } catch (x) { e = x; } } throw e; }
async function load() {
  const t = Math.floor(Date.now() / 60000);
  try { const j = await getJ(LOCAL ? ["data/t21.json?t=" + t] : [RAW + "t21.json?t=" + t, "data/t21.json?t=" + t]); if (!(D && Date.parse(j.generated_utc) < Date.parse(D.generated_utc))) D = j; err = null; } catch (x) { err = String(x && x.message || x); }
}
async function loadFU() { const t = Math.floor(Date.now() / 60000); try { const j = await getJ(LOCAL ? ["data/t21fut.json?t=" + t] : [RAW + "t21fut.json?t=" + t, "data/t21fut.json?t=" + t]); if (!(FU && Date.parse(j.generated_utc) < Date.parse(FU.generated_utc))) FU = j; FUerr = null; } catch (x) { FUerr = String(x && x.message || x); } }
async function loadFC() { if (FC) return; try { FC = await getJ(["data/equity_curves_fixed.json?v=" + VER, RAW + "equity_curves_fixed.json?v=" + VER]); FCerr = null; } catch (x) { FCerr = String(x && x.message || x); } }
async function loadBT() { if (BT) return; try { BT = await getJ(["data/t21_bt.json?v=" + VER, RAW + "t21_bt.json?v=" + VER]); btErr = null; } catch (x) { btErr = String(x && x.message || x); } }
async function loadTR(id) { if (TRS[id]) return; try { TRS[id] = await getJ(["data/t21_tr_" + id + ".json?v=" + VER, RAW + "t21_tr_" + id + ".json?v=" + VER]); delete TRERR[id]; } catch (x) { TRERR[id] = String(x && x.message || x); } }
let busy = false;
function rerender() {
  if (!window.__t21On || !window.__t21H) return; const v = document.getElementById("view"); if (!v) return;
  const y = window.scrollY; CH.splice(0).forEach((c) => { try { c.destroy(); } catch (e) {} }); v.innerHTML = ""; window.T21.render(v, window.__t21H); window.scrollTo(0, y);
  if (S.scroll) { S.scroll = false; const el = document.getElementById("t21-detail"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
}
async function tick() { const a = document.activeElement; if (a && (a.tagName === "SELECT" || a.tagName === "INPUT")) return; await Promise.all([load(), loadFU()]); rerender(); }
setInterval(tick, 60000);
const MAD = (() => { try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { return null; } })();
const fmtMad = (iso) => { try { return MAD.format(new Date(iso)).replace(",", "") + " Madrid"; } catch (e) { return iso; } };
const hm = (iso) => { try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)); } catch (e) { return iso; } };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mlabel = (m) => MONTHS[parseInt(m.slice(5), 10) - 1] + " " + m.slice(0, 4);
const dlabel = (d) => d.slice(8) + " " + MONTHS[parseInt(d.slice(5, 7), 10) - 1] + " " + d.slice(0, 4);
const money = (x, dec) => (x == null || isNaN(x) ? "–" : (x < 0 ? "−€" : "€") + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: dec == null ? 0 : dec, maximumFractionDigits: dec == null ? 0 : dec }));
const smoney = (x, dec) => (x == null ? "–" : (x >= 0 ? "+" : "−") + money(Math.abs(x), dec).replace("−", ""));
const tn = (x) => (x > 0 ? "pos" : x < 0 ? "neg" : "mut");
const COLORS = ["#3fb97a", "#5aa9ff", "#e3b341", "#b48cff", "#ff8fa3"];
const liveOf = (id) => (D && D.live && D.live.strategies ? D.live.strategies.find((x) => x.id === id) : null);
function verdict(x, top) {
  if (x.c01.total > 0 && top) return x.rank === 1 ? ["★ Most promising", "ok"] : ["Profitable after costs (shaky)", "warn"];
  if (x.c0.total > 0) return ["Profit only at zero cost", "warn"];
  return ["No edge", "bad"];
}
const vlabel = (x) => verdict(x, x.c01.total > 0);
const vshort = (x) => (x.c01.total > 0 ? (x.rank === 1 ? ["★ Promising", "ok"] : ["Shaky profit", "warn"]) : x.c0.total > 0 ? ["Zero-cost only", "warn"] : ["No edge", "bad"]);
function liveDates() {
  const set = new Set(); if (D.live && D.live.session_day) set.add(D.live.session_day);
  Object.values(D.live_trades || {}).forEach((a) => a.forEach((t) => set.add(t[1].slice(0, 10)))); return Array.from(set).sort();
}
// cumulative live (zero-cost practice) P&L per live day for a strategy: array aligned with liveDates()
function liveCum(id, ld) {
  const tr = (D.live_trades || {})[id] || [], by = {}; tr.forEach((t) => { const d = t[1].slice(0, 10); by[d] = (by[d] || 0) + t[6]; });
  let a = 0; return ld.map((d) => (a += by[d] || 0, Math.round(a * 100) / 100));
}
const vline = { id: "t21vline", afterDatasetsDraw(c, a, o) {
  if (o == null || o.idx == null) return; const x = c.scales.x.getPixelForValue(o.idx), { top, bottom } = c.chartArea, g = c.ctx; g.save(); g.strokeStyle = "rgba(227,179,65,.8)"; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke(); g.setLineDash([]); g.fillStyle = "#e3b341"; g.font = "12px system-ui,sans-serif";
  const t = o.text, w = g.measureText(t).width, tx = x - w - 6 > c.chartArea.left ? x - w - 6 : x + 6; g.fillText(t, tx, top + 14); g.restore(); } };
function mkChart(box, series, live, ld, H, big) {
  const cv = document.createElement("canvas"); box.appendChild(cv); const days = BT.days, n = days.length, labels = days.concat(ld.filter((d) => d > days[n - 1]));
  const ds = [];
  series.forEach((s) => { ds.push({ label: s.label, data: s.data.concat(new Array(labels.length - n).fill(null)), borderColor: s.color, backgroundColor: s.color, borderWidth: s.w || 1.8, pointRadius: 0, tension: 0.1, spanGaps: false, order: 2 }); });
  live.forEach((l) => { const arr = new Array(labels.length).fill(null); arr[n - 1] = l.anchor; ld.forEach((d, i) => { const k = labels.indexOf(d); if (k >= 0) arr[k] = Math.round((l.anchor + l.cum[i]) * 10) / 10; }); ds.push({ label: l.label, data: arr, borderColor: l.color, backgroundColor: l.color, borderWidth: 3.2, borderDash: [], pointRadius: (c) => (c.dataIndex >= n ? 5 : 0), pointHoverRadius: 6, tension: 0, spanGaps: true, order: 1 }); });
  const muted = "#8d9aab";
  const c = new Chart(cv, { type: "line", data: { labels, datasets: ds }, plugins: [vline], options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
    plugins: { legend: { labels: { color: muted, boxWidth: 14, usePointStyle: false } }, t21vline: { idx: n, text: "Live practice from " + dlabel((ld[0] || "2026-10-29")).slice(0, 6) }, tooltip: { callbacks: { title: (it) => dlabel(it[0].label), label: (it) => (it.parsed.y == null ? null : it.dataset.label + ": " + smoney(it.parsed.y, 0)) } } },
    scales: { x: { ticks: { color: muted, maxTicksLimit: 7, autoSkip: true, maxRotation: 0, callback(v) { const l = this.getLabelForValue(v); return MONTHS[parseInt(l.slice(5, 7), 10) - 1] + " " + l.slice(2, 4); } }, grid: { color: "rgba(255,255,255,.05)" } }, y: { ticks: { color: muted, callback: (x) => money(x, 0) }, grid: { color: "rgba(255,255,255,.07)" } } } } });
  CH.push(c); return c;
}
function chartBox(h, ht) { return h("div", { class: "chartbox", style: "height:" + (ht || 300) + "px" }); }

function render(v, H) {
  window.__t21H = H; const { h, table, card, metric, callout, pill } = H;
  if (!D) { v.appendChild(card("Nasdaq 21", null, h("p", null, err ? "Could not load Nasdaq 21 data: " + err : "Loading…"))); load().then(rerender); return; }
  if (!BT && !btErr) loadBT().then(rerender);
  if (!FU && !FUerr) loadFU().then(rerender);
  const L = D.live || {}, B = D.backtest; if (!B) { v.appendChild(card("Nasdaq 21", null, h("p", null, "No backtest data yet."))); return; }
  const strategies = B.strategies.slice().sort((a, b) => a.rank - b.rank), top = strategies.filter((x) => x.c01.total > 0), byId = {}; strategies.forEach((x) => (byId[x.id] = x));
  if (!byId[S.sel]) S.sel = strategies[0].id;
  const ld = liveDates(); const sel = (id) => { S.sel = id; S.month = null; S.page = 0; S.scroll = true; rerender(); };
  const feed = (D.live && D.live.last_bar_utc) ? (Date.now() - Date.parse(D.live.last_bar_utc)) / 60000 < 15 : false;
  // ---- HEADLINE: EUR5,000 Micro Nasdaq futures (MNQ) practice set
  try {
    if (FU && FU.strategies) {
      const FS = FU.strategies, M = FU.model || {}, T = FU.totals || {}, fl = (x) => x.live, started = FU.started_utc;
      const bestIds = (FU.ranking_2018_26 || []).slice(0, 5).map((r) => r.id), fsById = {}; FS.forEach((x) => (fsById[x.id] = x));
      const rankOf = {}; (FU.ranking_2018_26 || []).forEach((r) => (rankOf[r.id] = r.rank));
      const liveBal = FS.reduce((a, x) => a + (fl(x) ? fl(x).balance : 5000), 0), livePnl = FS.reduce((a, x) => a + (fl(x) ? fl(x).pnl : 0), 0), todayP = FS.reduce((a, x) => a + (fl(x) ? fl(x).pnl_today : 0), 0), nTr = FS.reduce((a, x) => a + (fl(x) ? fl(x).trades : 0), 0), nOp = FS.filter((x) => fl(x) && fl(x).open && !fl(x).open.skipped_too_big && !fl(x).open.pre_start).length, nSk = FU.skipped_total || 0;
      const fcard = h("section", { class: "card hl", id: "t21-fut" }, h("h2", null, "★ Main practice: €5,000 Micro Nasdaq futures (MNQ)"),
        h("p", { class: "cap" }, "21 strategies, each with its own €5,000 practice account. Risk " + (M.risk_pct_of_equity || 5) + "% of the account per trade, whole MNQ contracts ($" + (M.usd_per_point || 2) + " a point), costs included: " + (M.slippage_ticks || 1) + " tick slippage and $" + (M.commission_usd_per_side || 0.94) + " per side. " + (started ? "Live since " + fmtMad(started) + ". " : "Not started yet. ") + "Simulation only, no broker, no real order."),
        h("div", { class: "grid g4" },
          metric(smoney(livePnl, 2), "Live P&L, all 21", started ? "since " + fmtMad(started) : "waiting for the first run", tn(livePnl)),
          metric(smoney(todayP, 2), "Today, all 21", nTr + " trades so far, " + nOp + " open", tn(todayP)),
          metric(money(liveBal, 0), "Total of the 21 accounts", "21 × €5,000 = €105,000 at the start"),
          metric(String(nSk), "Trades skipped", "one MNQ would risk more than the cap")));
      const bgrid = h("div", { class: "bestgrid", style: "margin-top:12px" });
      bestIds.forEach((id, i) => {
        const x = fsById[id]; if (!x) return; const l = fl(x), b = x.backtest, a = b.p2024_26, c = b.p2018_23, op = l && l.open && !l.open.skipped_too_big && !l.open.pre_start ? l.open : null;
        const strip = !l ? h("div", { class: "livestrip" }, "no live data yet") : op ? h("div", { class: "livestrip on" }, h("span", { class: "ldot" }), h("b", null, "TRADING NOW: " + op.side + " " + op.contracts + " MNQ"), " from " + op.entry_pts + ", open ", h("b", { class: tn(op.open_pnl_eur) }, smoney(op.open_pnl_eur, 2))) : h("div", { class: "livestrip" }, h("span", { class: "ldot off" }), h("span", null, feed ? "Watching the market, no open trade" : "Market closed, no open trade"));
        bgrid.appendChild(h("div", { class: "bcard" + (i === 0 ? " first" : "") },
          h("div", { class: "bhead" }, h("span", { class: "brank" }, "#" + (i + 1)), pill(i === 0 ? "★ Best on futures" : "Profitable in both periods", i === 0 ? "ok" : "warn")),
          h("div", { class: "bname" }, h("b", null, x.id), " ", x.name), 
          h("div", { class: "bnums" },
            h("div", null, h("div", { class: "bv " + tn(a.net_eur) }, smoney(a.net_eur)), h("div", { class: "bl" }, "backtest 2024–26")),
            h("div", null, h("div", { class: "bv " + tn(c.net_eur) }, smoney(c.net_eur)), h("div", { class: "bl" }, "backtest 2018–23"))),
          h("div", { class: "bsmall" }, a.trades + " + " + c.trades + " trades · win " + a.win_rate + "% / " + c.win_rate + "% · worst drop " + money(a.max_drawdown_eur) + " / " + money(c.max_drawdown_eur)),
          h("div", { class: "bsmall" }, "2024–26 per year: ", Object.keys(a.per_year).map((k) => h("span", { class: tn(a.per_year[k]) }, k + " " + smoney(a.per_year[k]) + "  "))),
          h("div", { class: "blive" }, h("div", { class: "bl2" }, "Live €5,000 account"), strip,
            h("div", { class: "bsmall2" }, l ? h("span", null, "Balance ", h("b", { class: tn(l.balance - 5000) }, money(l.balance, 2)), " · today ", h("b", { class: tn(l.pnl_today) }, smoney(l.pnl_today, 2)), " · trades today " + l.trades_today) : ""))));
      });
      fcard.appendChild(bgrid);
      // equity chart 2018 -> today
      fcard.appendChild(h("h3", { style: "margin-top:14px" }, "The 5 best on futures, January 2018 to today"));
      fcard.appendChild(h("p", { class: "cap" }, "Daily balance from €5,000 (simulated backtest, risk fixed at 5% of the starting €5,000, 1 tick slippage, $0.94 per side). The 2018–23 and 2024–26 runs are joined at 1 Jan 2024."));
      const fcb = chartBox(h, 300); fcard.appendChild(fcb);
      if (!FC && !FCerr) loadFC().then(rerender);
      if (FC) { try {
        const cv = document.createElement("canvas"); fcb.appendChild(cv); const muted = "#8d9aab";
        const ds = bestIds.map((id, i) => ({ label: id, data: FC.series[id], borderColor: COLORS[i % 5], backgroundColor: COLORS[i % 5], borderWidth: i === 0 ? 2.8 : 1.6, pointRadius: 0, tension: 0.1 }));
        CH.push(new Chart(cv, { type: "line", data: { labels: FC.dates, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { labels: { color: muted, boxWidth: 14 } }, tooltip: { callbacks: { title: (it) => dlabel(it[0].label), label: (it) => it.dataset.label + ": " + money(it.parsed.y, 0) } } },
          scales: { x: { ticks: { color: muted, maxTicksLimit: 7, autoSkip: true, maxRotation: 0, callback(v) { const l = this.getLabelForValue(v); return MONTHS[parseInt(l.slice(5, 7), 10) - 1] + " " + l.slice(2, 4); } }, grid: { color: "rgba(255,255,255,.05)" } }, y: { ticks: { color: muted, callback: (x) => money(x, 0) }, grid: { color: "rgba(255,255,255,.07)" } } } } }));
      } catch (e) { fcb.textContent = "Chart error: " + e.message; } }
      else fcb.appendChild(h("p", { class: "mut" }, FCerr ? "Could not load the curves: " + FCerr : "Loading the chart…"));
      // all 21
      const frows = FS.slice().sort((a, b) => (rankOf[a.id] || 99) - (rankOf[b.id] || 99)).map((x) => { const l = fl(x), b = x.backtest, a = b.p2024_26, c = b.p2018_23, both = a && c && a.net_eur > 0 && c.net_eur > 0;
        return [h("span", null, h("b", null, x.id), " ", x.name.slice(0, 30)), { t: l ? money(l.balance, 2) + (l.open && !l.open.skipped_too_big && !l.open.pre_start ? " ●" : "") : "–", cls: tn(l ? l.balance - 5000 : 0) }, { t: l ? smoney(l.pnl_today, 2) : "–", cls: tn(l ? l.pnl_today : 0) }, { t: a ? smoney(a.net_eur) : "–", cls: tn(a ? a.net_eur : 0) }, { t: c ? smoney(c.net_eur) : "–", cls: tn(c ? c.net_eur : 0) }, { t: a ? money(a.max_drawdown_eur) : "–" }, { t: both ? "yes" : "no", cls: both ? "pos" : "mut" }]; });
      fcard.appendChild(h("h3", { style: "margin-top:14px" }, "All 21 on futures, best first"));
      fcard.appendChild(h("div", { class: "tw" }, h("table", { class: "t21t" }, h("thead", null, h("tr", null, ["Strategy", "Live balance", "Live today", "2024–26", "2018–23", "Worst drop 24–26", "Both +"].map((c, i) => h("th", { class: i ? "n" : "" }, c)))),
        h("tbody", null, frows.map((r) => h("tr", null, r.map((c, i) => (i === 0 ? h("td", { class: "namecell" }, c) : h("td", { class: "n " + (c.cls || "") }, c.t)))))))));
      fcard.appendChild(h("p", { class: "cap" }, "Backtest net € = after slippage and commission, whole contracts, risk 5% of the starting €5,000 (a strategy that loses more than the account stops trading). Only 5 of the 21 make money in both periods. S11 is the best of 21 tested on the same history (2018–23 was never used to pick it); treat the numbers as an upper bound until live practice shows the same. The NAS100 index data stands in for the futures price. ● = open trade right now."));
      v.appendChild(fcard);
      v.appendChild(h("h2", { style: "margin:6px 2px 0;font-size:17px" }, "Secondary comparisons: the €500 CFD sets"));
    } else if (FUerr) v.appendChild(card("Futures practice", null, h("p", { class: "mut" }, "Could not load the futures data: " + FUerr)));
  } catch (e) { v.appendChild(h("p", { class: "mut" }, "Futures section error: " + e.message)); }
  // ---- header
  const lastBarAge = L.last_bar_utc ? (Date.now() - Date.parse(L.last_bar_utc)) / 60000 : null;
  const totT = (L.strategies || []).reduce((s, x) => s + x.trades_today, 0), totP = (L.strategies || []).reduce((s, x) => s + x.pnl_today, 0), nOpen = (L.strategies || []).filter((x) => x.open).length;
  v.appendChild(h("section", { class: "card topcard" }, h("h2", null, "Nasdaq-100: 21 strategies, best ones first"),
    h("div", { class: "mini" },
      h("div", null, h("b", { class: feed ? "pos" : "warn" }, feed ? "● Live" : "Market closed"), h("span", { class: "mut" }, " · last price " + (L.last_bar_madrid || "–").replace(/^\d+ \w+ /, "") + " Madrid")),
      h("div", null, h("b", null, totT + " trades today"), h("span", { class: "mut" }, " · " + nOpen + " open")),
      h("div", null, h("b", { class: tn(totP) }, smoney(totP, 2) + " today"), h("span", { class: "mut" }, " (all 21, zero cost)"))),
    h("p", { class: "cap", style: "margin:8px 0 0" }, "Practice only: 21 published rule sets, each with its own €500 account and €25 risk per trade. No broker, no real order.")));
  // ---- best strategies
  const best = h("div", { class: "bestgrid" });
  top.forEach((x, i) => {
    const l = liveOf(x.id), vv = vlabel(x), yrs = x.c01.years, neg = Object.keys(yrs).filter((k) => yrs[k] < 0);
    const status = l ? (l.open ? h("div", { class: "livestrip on" }, h("span", { class: "ldot" }), h("b", null, "TRADING NOW: " + l.open.side), " from " + l.open.entry + ", open P&L ", h("b", { class: tn(l.open.open_pnl) }, smoney(l.open.open_pnl, 2))) : h("div", { class: "livestrip" }, h("span", { class: "ldot off" }), h("span", null, feed ? "Watching the market, no open trade right now" : "Market closed, no open trade"))) : h("div", { class: "livestrip" }, "no live data yet");
    const last = l && l.recent && l.recent[0];
    best.appendChild(h("div", { class: "bcard" + (x.rank === 1 ? " first" : ""), onclick: () => sel(x.id) },
      h("div", { class: "bhead" }, h("span", { class: "brank" }, "#" + (i + 1)), pill(vv[0], vv[1])),
      h("div", { class: "bname" }, h("b", null, x.id), " ", x.name),
      h("div", { class: "bwho mut" }, x.who.split(",")[0].split("(")[0]),
      h("div", { class: "bnums" },
        h("div", null, h("div", { class: "bv " + tn(x.c01.total) }, smoney(x.c01.total)), h("div", { class: "bl" }, "backtest profit at 0.01% cost")),
        h("div", null, h("div", { class: "bv " + tn(x.c0.total) }, smoney(x.c0.total)), h("div", { class: "bl" }, "at zero cost"))),
      h("div", { class: "bsmall" }, x.trades + " trades · " + x.c0.win + "% wins · worst drop " + money(x.c0.mdd)),
      h("div", { class: "bsmall" }, "Per year at 0.01%: ", Object.keys(yrs).map((k) => h("span", { class: tn(yrs[k]) }, k + " " + smoney(yrs[k]) + "  "))),
      x.id === "S11" ? h("div", { class: "bwarn" }, "All its profit is from short trades; best of 21 tested, so some luck.") : (neg.length ? h("div", { class: "bwarn" }, "Lost money in " + neg.join(", ") + " at 0.01% cost.") : null),
      h("div", { class: "blive" }, h("div", { class: "bl2" }, "Live practice"), status,
        h("div", { class: "bsmall2" }, l ? h("span", null, "Balance ", h("b", { class: tn((l.balance || 500) - 500) }, money(l.balance, 2)), " · today ", h("b", { class: tn(l.pnl_today) }, smoney(l.pnl_today, 2)), " · trades today " + l.trades_today) : ""),
        last ? h("div", { class: "bsmall2 mut" }, "Last trade " + last.time + ": " + last.side + " " + last.entry + " → " + last.exit + " ", h("b", { class: tn(last.pnl) }, smoney(last.pnl, 2))) : h("div", { class: "bsmall2 mut" }, "No trade closed yet today")),
      h("div", { class: "btap" }, "Tap for chart, rules and trades ›")));
  });
  v.appendChild(h("section", { class: "card hl" }, h("h2", null, "★ Best strategies (the " + top.length + " profitable after costs)"), h("p", { class: "cap" }, "Ranked by backtest profit at 0.01% cost per side, January 2024 to 28 October 2026. All of them trade live in practice right now."), best));
  v.appendChild(callout("Honest summary: only " + top.length + " of the 21 made money in the backtest once a small trading cost (0.01% per side) is counted. S11 is the best, but all its profit came from short trades and it is the best of 21 tested, so part of it may be luck. The live accounts trade at zero cost, so their balances look better than a real account would. The next weeks of live trading are the real test."));
  // ---- YOUR RULES comparison (-30 / +45 / lock +1 at +20) vs the current rules: live balances (separate EUR500 accounts) + backtest
  try {
    const U = D.userrules, UL = U && U.live, UB = U && U.bt;
    if (UL && UB) {
      const ul = (id) => (UL.strategies || []).find((q) => q.id === id), tot = UL.totals || {}, curTot = (L.strategies || []).reduce((a, q) => a + q.pnl, 0);
      const order = strategies.slice().sort((a, b) => ((UB[b.id] ? UB[b.id].user["0.0001"].total : 0) - (UB[a.id] ? UB[a.id].user["0.0001"].total : 0)));
      const urows = order.map((x) => {
        const c = liveOf(x.id), u = ul(x.id), b = UB[x.id]; if (!b) return null;
        const cell = (q) => (q ? { t: money(q.balance, 2) + (q.open ? " ●" : ""), cls: tn(q.balance - 500) } : { t: "–", cls: "mut" });
        const bt = (o, k) => ({ t: smoney(o[k].total), cls: tn(o[k].total) });
        return [h("span", null, h("b", null, x.id), " ", x.name.slice(0, 26)), cell(c), cell(u), bt(b.cur, "0.0001"), bt(b.user, "0.0001"), bt(b.cur, "0.0"), bt(b.user, "0.0")];
      }).filter(Boolean);
      const sumBt = (k, c) => Object.values(UB).reduce((a, o) => a + o[k][c].total, 0), nPos = (k, c) => Object.values(UB).filter((o) => o[k][c].total > 0).length;
      v.appendChild(h("section", { class: "card hl2", id: "t21-userrules" }, h("h2", null, "Your rules (−€30 / +€45 / lock +€1 at +€20) vs the current rules"),
        h("p", { class: "cap" }, "Same entries, different exits. Your rules: about €10,000 per trade, stop −0.30% (−€30), target +0.45% (+€45), once +€20 is reached the stop moves to +€1, 60 min max. Both sets run live on separate €500 practice accounts (zero cost) since " + (UL.started_utc ? fmtMad(UL.started_utc) : "29 Oct") + ". Today's earlier trades were replayed from the minute bars, like the current set."),
        h("div", { class: "grid g4" },
          metric(smoney(curTot, 2), "Live total, current rules", "all 21, since 29 Oct", tn(curTot)),
          metric(smoney(tot.pnl, 2), "Live total, your rules", (tot.trades || 0) + " trades, " + (tot.open_positions || 0) + " open", tn(tot.pnl)),
          metric(smoney(sumBt("cur", "0.0001")), "Backtest, current rules, 0.01% cost", nPos("cur", "0.0001") + " of 21 profitable", tn(sumBt("cur", "0.0001"))),
          metric(smoney(sumBt("user", "0.0001")), "Backtest, your rules, 0.01% cost", nPos("user", "0.0001") + " of 21 profitable", tn(sumBt("user", "0.0001")))),
        h("p", { class: "cap", style: "margin-top:10px" }, "Backtest 2 Jan 2024 – 28 Oct 2026, fixed €10,000 per trade, sorted by your rules at 0.01%. ● = open trade right now. Live balance starts at €500."),
        h("div", { class: "tw" }, h("table", { class: "t21t" }, h("thead", null, h("tr", null, ["Strategy", "Live: current", "Live: yours", "0.01%: current", "0.01%: yours", "Zero cost: current", "Zero cost: yours"].map((c, i) => h("th", { class: i ? "n" : "" }, c)))),
          h("tbody", null, urows.map((r) => h("tr", null, r.map((c, i) => (i === 0 ? h("td", { class: "namecell" }, c) : h("td", { class: "n " + (c.cls || "") }, c.t)))))))),
        h("p", { class: "cap" }, "Verdict so far: your rules do worse than the current ones in the backtest (the \"+€1 lock\" closes many trades that would later reach the target). We are letting them run live next to each other so both are tested on the same real prices.")));
    }
  } catch (e) { v.appendChild(h("p", { class: "mut" }, "Your-rules comparison error: " + e.message)); }
  // ---- combined chart
  const ccard = h("section", { class: "card" }, h("h2", null, "Top " + top.length + " together, January 2024 to today"),
    h("p", { class: "cap" }, "Cumulative profit in € (fixed €25 risk per trade). The thick line after the dashed marker is the live practice (zero cost) continuing from the backtest."),
    h("div", { class: "row" }, H.h("div", { class: "seg", role: "group" }, [["c01", "With 0.01% cost"], ["c0", "Zero cost"]].map(([k, l]) => h("button", { type: "button", "aria-pressed": String(S.cmb === k), onclick: () => { S.cmb = k; rerender(); } }, l)))));
  const cb = chartBox(h, 320); ccard.appendChild(cb);
  if (BT) { try { mkChart(cb, top.map((x, i) => ({ label: x.id, data: BT.s[x.id][S.cmb], color: COLORS[i % 5] })), top.map((x, i) => ({ label: x.id + " live", anchor: BT.s[x.id][S.cmb][BT.days.length - 1], cum: liveCum(x.id, ld), color: COLORS[i % 5] })), ld, H); } catch (e) { cb.textContent = "Chart error: " + e.message; } }
  else cb.appendChild(h("p", { class: "mut" }, btErr ? "Could not load the backtest curves: " + btErr : "Loading the chart…"));
  v.appendChild(ccard);
  // ---- all 21
  const rows = strategies.map((x) => {
    const l = liveOf(x.id), vv = vlabel(x), loser = x.c01.total <= 0, t = top.indexOf(x) >= 0;
    const tr = h("tr", { class: "clk" + (loser ? " loser" : "") + (S.sel === x.id ? " selrow" : ""), onclick: () => sel(x.id) },
      h("td", { class: "n" }, String(x.rank)), h("td", { class: "namecell" }, h("b", null, x.id), " ", x.name, h("div", null, pill(vshort(x)[0], vshort(x)[1]))),
      h("td", { class: "n " + tn(x.c01.total) }, smoney(x.c01.total)), h("td", { class: "n " + tn(x.c0.total) }, smoney(x.c0.total)), h("td", { class: "n" }, String(x.trades)), h("td", { class: "n" }, x.c0.win + "%"), h("td", { class: "n" }, money(x.c0.mdd)),
      h("td", { class: "n" }, l ? money(l.balance, 2) : "–"), h("td", { class: "n " + tn(l ? l.pnl_today : 0) }, l ? smoney(l.pnl_today, 2) : "–"), h("td", null, l && l.open ? pill(l.open.side + " " + smoney(l.open.open_pnl, 2), l.open.open_pnl >= 0 ? "ok" : "bad") : h("span", { class: "mut" }, "flat")));
    return tr;
  });
  const th = ["#", "Strategy", "Backtest, 0.01% cost", "Backtest, zero cost", "Trades", "Win rate", "Worst drop", "Live balance", "Live today", "Open"];
  const tbl = h("div", { class: "tw" }, h("table", { class: "t21t" }, h("thead", null, h("tr", null, th.map((c, i) => h("th", { class: [0, 2, 3, 4, 5, 6, 7, 8].includes(i) ? "n" : "" }, c)))), h("tbody", null, rows)));
  v.appendChild(card("All 21 strategies, best to worst", "Backtest January 2024 – 28 October 2026. Tap a row to see its chart, rules, source and every trade. Strategies marked 'No edge' lose money even before costs or are not worth trading.", tbl));
  // ---- detail
  const x = byId[S.sel], l = liveOf(x.id), vv = vlabel(x), isTop = top.indexOf(x) >= 0;
  const det = h("section", { class: "card hl2", id: "t21-detail" },
    h("div", { class: "row", style: "justify-content:space-between" }, h("h2", { style: "margin:0" }, x.id + " · " + x.name), pill(vv[0], vv[1])),
    h("div", { class: "row" }, h("label", { class: "f" }, "Pick another strategy", h("select", { onchange: (e) => sel(e.target.value) }, strategies.map((s) => h("option", { value: s.id, selected: s.id === x.id }, "#" + s.rank + "  " + s.id + "  " + s.name.slice(0, 48)))))),
    x.id === "S11" ? callout("All of S11's profit came from short trades (longs lost money), and it is the best of 21 rules tested on the same data, so some of the result may be luck.") : (!isTop ? callout(x.c0.total > 0 ? "Makes money only if trading costs nothing. With 0.01% per side it loses." : "Loses money in the backtest even at zero cost.", "") : null),
    h("div", { class: "grid g4" },
      metric(smoney(x.c01.total), "Backtest profit, 0.01% cost", x.trades + " trades (" + x.per_day.toFixed(2) + " a day)", tn(x.c01.total)),
      metric(smoney(x.c0.total), "Backtest profit, zero cost", "win rate " + x.c0.win + "%, profit factor " + (x.c0.pf == null ? "–" : x.c0.pf), tn(x.c0.total)),
      metric(money(x.c0.mdd), "Worst drop (zero cost)", "at 0.01%: " + money(x.c01.mdd)),
      metric(l ? money(l.balance, 2) : "–", "Live practice balance", l ? (l.trades + (l.trades === 1 ? " trade" : " trades") + " since 29 Oct, today " + smoney(l.pnl_today, 2)) : "", l ? tn(l.balance - 500) : ""))
  );
  const lb = l && l.open ? h("div", { class: "livestrip on" }, h("span", { class: "ldot" }), h("b", null, "Open now: " + l.open.side), " from " + l.open.entry + ", open P&L ", h("b", { class: tn(l.open.open_pnl) }, smoney(l.open.open_pnl, 2))) : h("div", { class: "livestrip" }, h("span", { class: "ldot off" }), "No open trade right now");
  det.appendChild(lb);
  det.appendChild(h("h3", { style: "margin-top:14px" }, "Profit since January 2024"));
  det.appendChild(h("p", { class: "cap" }, "Cumulative € at a fixed €25 risk per trade. Blue: zero cost. Amber: 0.01% cost per side. Green: live practice (zero cost) continuing from 29 October."));
  const cb2 = chartBox(h, 300); det.appendChild(cb2);
  if (BT) { try { const s = BT.s[x.id]; mkChart(cb2, [{ label: "Backtest, zero cost", data: s.c0, color: "#5aa9ff" }, { label: "Backtest, 0.01% cost", data: s.c01, color: "#e3b341" }], [{ label: "Live practice", anchor: s.c0[BT.days.length - 1], cum: liveCum(x.id, ld), color: "#3fb97a" }], ld, H); } catch (e) { cb2.textContent = "Chart error: " + e.message; } }
  else cb2.appendChild(h("p", { class: "mut" }, btErr ? "Could not load the backtest curves: " + btErr : "Loading the chart…"));
  // per-year
  const ys = Object.keys(x.c0.years);
  det.appendChild(h("h3", { style: "margin-top:14px" }, "Per year"));
  det.appendChild(table(["Year", "Profit, zero cost", "Profit, 0.01% cost"], ys.map((y) => [y === "2026" ? "2026 (to 28 Oct)" : y, { t: smoney(x.c0.years[y]), cls: tn(x.c0.years[y]) }, { t: smoney(x.c01.years[y]), cls: tn(x.c01.years[y]) }]), { num: [1, 2] }));
  det.appendChild(H.h("dl", { class: "props" }, ...[["Rules", x.rules], ["Source", h("span", null, h("a", { href: x.link, target: "_blank", rel: "noopener" }, x.who), h("div", { class: "mut small" }, x.attr))],
    ["Exits", Object.entries(x.exits).map(([k, p]) => p + "% " + k).join(", ") + ". Average stop " + x.avg_stop_pct + "% of price."], ["Long / short profit", "Zero cost: longs " + smoney(x.c0.long_pnl) + ", shorts " + smoney(x.c0.short_pnl)],
    ["Luck check", x.null ? (x.null.p_c0 * 100).toFixed(0) + "% of 150 coin-flip-direction re-runs did as well at zero cost (under 5% means the direction signal adds something)." : "–"]].flatMap(([a, b]) => [h("dt", null, a), h("dd", null, b)])));
  det.appendChild(h("p", { class: "cap" }, B.common));
  // trades
  det.appendChild(h("h3", { style: "margin-top:14px" }, "Every trade, back to January 2024"));
  const tcard = h("div", null); det.appendChild(tcard);
  const liveTr = ((D.live_trades || {})[x.id] || []).slice().sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (!TRS[x.id] && !TRERR[x.id]) { tcard.appendChild(h("p", { class: "mut" }, "Loading trades…")); loadTR(x.id).then(rerender); }
  else if (TRERR[x.id]) tcard.appendChild(h("p", { class: "neg" }, "Could not load the trade list: " + TRERR[x.id]));
  else {
    const all = TRS[x.id].trades, why = TRS[x.id].why, months = {}; all.forEach((t) => { const m = t[0].slice(0, 7); const o = months[m] || (months[m] = { n: 0, p0: 0, p1: 0 }); o.n++; o.p0 += t[6]; o.p1 += t[7]; });
    const ml = Object.keys(months).sort().reverse(); if (S.month == null || (S.month !== "live" && S.month !== "all" && !months[S.month])) S.month = liveTr.length ? "live" : ml[0];
    const opts = []; if (liveTr.length) opts.push(["live", "Live practice since 29 Oct (" + liveTr.length + (liveTr.length === 1 ? " trade)" : " trades)")]); ml.forEach((m) => opts.push([m, mlabel(m) + " · " + months[m].n + " trades · " + smoney(months[m].p1) + " at 0.01%"])); opts.push(["all", "All backtest trades (" + all.length + ")"]);
    const idx = opts.findIndex((o) => o[0] === S.month);
    tcard.appendChild(h("div", { class: "row" }, h("button", { class: "b", type: "button", disabled: idx <= 0, onclick: () => { S.month = opts[idx - 1][0]; S.page = 0; rerender(); } }, "‹ Newer"),
      h("label", { class: "f", style: "flex:1;min-width:200px" }, "Month", h("select", { onchange: (e) => { S.month = e.target.value; S.page = 0; rerender(); } }, opts.map((o) => h("option", { value: o[0], selected: o[0] === S.month }, o[1])))),
      h("button", { class: "b", type: "button", disabled: idx >= opts.length - 1, onclick: () => { S.month = opts[idx + 1][0]; S.page = 0; rerender(); } }, "Older ›")));
    if (S.month === "live") {
      tcard.appendChild(table(["Date", "In (Madrid)", "Out", "Side", "In price", "Out price", "Exit", "P&L (zero cost)"], liveTr.map((t) => [t[0].slice(0, 10), hm(t[0].slice(0, 16) + ":00Z"), hm(t[1].slice(0, 16) + ":00Z"), { t: t[2] > 0 ? "Long" : "Short", cls: t[2] > 0 ? "pos" : "neg" }, String(t[3]), String(t[4]), t[5] + (t[7] === "replayed" ? " (replayed)" : ""), { t: smoney(t[6], 2), cls: tn(t[6]) }]), { num: [4, 5, 7] }));
      tcard.appendChild(h("p", { class: "cap" }, "Live practice prices are QQQ (the Nasdaq-100 ETF), about 1/35 of the index level. 'Replayed' = the signal came before the practice was switched on, replayed from that day's completed minute bars."));
    } else {
      let list = S.month === "all" ? all : all.filter((t) => t[0].slice(0, 7) === S.month); const np = Math.max(1, Math.ceil(list.length / PAGE)); if (S.page >= np) S.page = np - 1; const pg = list.slice(S.page * PAGE, S.page * PAGE + PAGE);
      const tot = list.reduce((a, t) => [a[0] + t[6], a[1] + t[7]], [0, 0]);
      tcard.appendChild(h("p", { class: "small" }, list.length + " trades · total " + smoney(tot[0]) + " at zero cost, " + smoney(tot[1]) + " at 0.01% · page " + (S.page + 1) + " of " + np));
      tcard.appendChild(table(["Date", "In (Madrid)", "Side", "In price", "Out price", "Exit", "P&L, zero cost", "P&L, 0.01%"], pg.map((t) => [t[0], t[1], { t: t[2] > 0 ? "Long" : "Short", cls: t[2] > 0 ? "pos" : "neg" }, t[3].toFixed(1), t[4].toFixed(1), why[t[5]], { t: smoney(t[6], 2), cls: tn(t[6]) }, { t: smoney(t[7], 2), cls: tn(t[7]) }]), { num: [3, 4, 6, 7] }));
      if (np > 1) tcard.appendChild(h("div", { class: "row" }, h("button", { class: "b", type: "button", disabled: S.page === 0, onclick: () => { S.page--; rerender(); } }, "‹ Previous page"), h("button", { class: "b", type: "button", disabled: S.page >= np - 1, onclick: () => { S.page++; rerender(); } }, "Next page ›")));
      tcard.appendChild(h("p", { class: "cap" }, "Backtest prices are the Dukascopy Nasdaq-100 CFD. P&L uses a fixed €25 risk per trade."));
    }
  }
  v.appendChild(det);
  v.appendChild(h("p", { class: "mut", style: "font-size:12.5px" }, "Data file generated " + fmtMad(D.generated_utc) + ". Practice only: simulated accounts, no broker, no real order is ever placed."));
}
window.T21 = { render, load, refresh: tick };
Promise.all([load(), loadFU()]).then(rerender);
})();
