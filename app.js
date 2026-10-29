(function () {
"use strict";
// ---------- helpers
const NS = "http://www.w3.org/2000/svg";
function h(tag, attrs) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v); }
  for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
  return el;
}
function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach((x) => add(el, x)); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
function sv(tag, attrs) { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }
const fmtEur = (v) => (v < 0 ? "−€" : "€") + Math.abs(v).toFixed(2);
const fmtEur0 = (v) => (v < 0 ? "−€" : "€") + Math.abs(Math.round(v)).toLocaleString("en-US");
const sgn = (v) => (v >= 0 ? "+" : "−") + fmtEur(Math.abs(v));
const px = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tone = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const MKN = ["S&P 500", "Nasdaq-100", "Gold"], BOTS = ["A", "B", "C"], WHYN = ["Stop", "Target", "Time limit", "Break-even stop", "Trailing stop", "News"];
const TRK_NAMES = { A: "A — v5.4", B: "B — high win-rate L7", C: "C — breakout mix", P: "P — portfolio A+B+C" };
let FMT; try { FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { FMT = null; }
const fdate = (ms) => (FMT ? FMT.format(new Date(ms)) : new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC");
function madTime(ms, secs) { try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", second: secs ? "2-digit" : undefined, hour12: false }).format(new Date(ms)); } catch (e) { return ""; } }

function table(cols, rows, opts) {
  opts = opts || {};
  const t = h("table", null, h("thead", null, h("tr", null, cols.map((c, i) => h("th", { class: opts.num && opts.num.includes(i) ? "n" : "" }, c)))),
    h("tbody", null, rows.map((r) => h("tr", null, r.map((c, i) => {
      let cls = opts.num && opts.num.includes(i) ? "n" : "";
      if (c && typeof c === "object" && !c.nodeType && !Array.isArray(c)) { cls += " " + (c.cls || ""); c = c.t; }
      return h("td", { class: cls.trim() }, c);
    })))));
  return h("div", { class: "tw" }, t);
}
const pill = (text, kind) => h("span", { class: "pill " + (kind || "neu") }, text);
const gatePill = (ok) => pill(ok ? "PASS" : "FAIL", ok ? "ok" : "bad");
function metric(v, l, d, t) { return h("div", { class: "metric" }, h("div", { class: "v " + (t || "") }, v), h("div", { class: "l" }, l), d ? h("div", { class: "d" }, d) : null); }
function card(title, cap) { const s = h("section", { class: "card" }); if (title) s.appendChild(h("h2", null, title)); if (cap) s.appendChild(h("p", { class: "cap" }, cap)); for (let i = 2; i < arguments.length; i++) add(s, arguments[i]); return s; }
function seg(options, value, onChange) {
  const wrap = h("div", { class: "seg", role: "group" });
  options.forEach((o) => { const v = o.value !== undefined ? o.value : o, l = o.label || o; wrap.appendChild(h("button", { type: "button", "aria-pressed": String(v === value), onclick: () => onChange(v) }, l)); });
  return wrap;
}
function sel(label, options, value, onChange) {
  const s = h("select", { onchange: (e) => onChange(e.target.value) }, options.map((o) => { const v = o.value !== undefined ? o.value : o, l = o.label || o; return h("option", { value: v, selected: v === value }, l); }));
  return h("label", { class: "f" }, label, s);
}
function props(items) { const dl = h("dl", { class: "props" }); items.forEach((it) => { dl.appendChild(h("dt", null, it.label)); dl.appendChild(h("dd", null, it.value)); }); return dl; }
function callout(text, kind) { return h("div", { class: "callout " + (kind || "") }, text); }

// ---------- data
let LIVE = null, ST = null, liveErr = null, lastFetchOk = 0;
const state = { tab: "overview", cost: "0.01%" };
const TABS = [["overview", "Overview"], ["bots", "Live bots"], ["replay", "Backtest replay 2024–now"], ["robust", "Robustness tests"], ["mc", "Monte Carlo"], ["log", "Research log"], ["rules", "Rules"]];

function marketInfo() {
  try {
    const ny = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false });
    const isOpen = (t) => { const p = ny.formatToParts(new Date(t)); const g = (k) => { const x = p.find((y) => y.type === k); return x ? x.value : ""; }; const wd = g("weekday"); const m = (parseInt(g("hour"), 10) % 24) * 60 + parseInt(g("minute"), 10); return wd !== "Sat" && wd !== "Sun" && m >= 570 && m < 960; };
    const now = Date.now(), step = 30 * 60 * 1000; let t = Math.floor(now / step) * step + step;
    if (isOpen(now)) { while (isOpen(t)) t += step; return { open: true, value: "Open", detail: "closes " + madTime(t) + " Madrid" }; }
    let i = 0; while (!isOpen(t) && i < 400) { t += step; i++; }
    return { open: false, value: "Closed", detail: "opens " + madTime(t) + " Madrid (US holidays not counted)" };
  } catch (e) { return { open: false, value: "?", detail: "" }; }
}
const ageMin = () => (LIVE && LIVE.last_check_utc ? Math.round((Date.now() - Date.parse(LIVE.last_check_utc)) / 60000) : null);

// ---------- replay data
let TR = [];
function decode(str) {
  const out = []; let prev = 0; const E0 = Date.UTC(2024, 0, 1);
  str.split(";").forEach((r) => {
    if (!r) return; const f = r.split(","); prev += parseInt(f[0], 10); const hold = parseInt(f[1], 10), code = parseInt(f[2], 10);
    const trk = Math.floor(code / 36), mk = Math.floor((code % 36) / 12), q = code % 12, entry = parseFloat(f[3]);
    const num = (s) => (s === "" ? null : parseInt(s, 10) / 100); const a = [num(f[5]), num(f[6])]; const p = [f[7] === "=" ? a[0] : num(f[7]), f[8] === "=" ? a[1] : num(f[8])];
    const tin = E0 + prev * 300000;
    out.push({ trk, mk, side: q >= 6 ? -1 : 1, why: q % 6, tin, tout: tin + hold * 60000, hold, entry, exit: entry + parseFloat(f[4]), a, p });
  });
  return out;
}

// ---------- tabs
function renderTabs() {
  const nav = document.getElementById("tabs"); nav.innerHTML = "";
  TABS.forEach(([id, label]) => nav.appendChild(h("button", { role: "tab", "aria-selected": String(state.tab === id), onclick: () => go(id) }, label)));
}
function go(id) { state.tab = id; history.replaceState(null, "", "#" + id); renderTabs(); render(); window.scrollTo(0, 0); }
function render() {
  if (RP.playing && state.tab !== "replay") stopPlay();
  const v = document.getElementById("view"); v.innerHTML = "";
  if (!ST || !LIVE) { v.appendChild(card(null, null, h("p", null, liveErr ? "Could not load data: " + liveErr : "Loading data…"))); return; }
  const fn = { overview, bots, replay, robust, mc, log, rules }[state.tab]; fn(v);
}
function costSwitch() { return seg(["0.01%", "0.02%"], state.cost, (c) => { state.cost = c; if (state.tab === "replay") { RP.rowsDirty = true; } render(); }); }

// ---------- Overview
function overview(v) {
  const T = LIVE.tracks, abc = T.filter((t) => t.key !== "P"), P = T.find((t) => t.key === "P"), mk = marketInfo();
  const totBal = abc.reduce((s, t) => s + t.balance, 0), totStart = abc.reduce((s, t) => s + t.start, 0), day = abc.reduce((s, t) => s + t.day.pnl, 0), nOpen = abc.reduce((s, t) => s + t.open.length, 0);
  const halted = T.filter((t) => t.day.halted || t.day.losses >= 3 || t.day.pnl <= -75).map((t) => t.key);
  const g = h("div", { class: "grid g4" },
    metric(fmtEur(totBal), "Balance A + B + C", sgn(totBal - totStart) + " since start (" + fmtEur0(totStart) + ")", tone(totBal - totStart)),
    metric(sgn(day), "Today A + B + C", "Portfolio P today " + sgn(P.day.pnl), tone(day)),
    metric(String(nOpen), "Open positions", "Portfolio P holds " + P.open.length),
    metric(P.day.trades + " of 10", "Portfolio trades today", "Cap 10 a day; A " + abc[0].day.trades + ", B " + abc[1].day.trades + ", C " + abc[2].day.trades),
    metric(halted.length ? "Hit: " + halted.join(", ") : "Not hit", "Daily stop (−€75 or 3 losses)", halted.length ? "No new trades there today" : "All four accounts can trade", halted.length ? "neg" : "pos"),
    metric(mk.value, "US stock market", mk.detail, mk.open ? "pos" : ""),
    metric(LIVE.last_check_madrid ? LIVE.last_check_madrid.split(", ")[1] : "–", "Last check (Madrid)", LIVE.last_check_madrid ? LIVE.last_check_madrid.split(", ")[0] : ""));
  v.appendChild(card("Right now", "Three independent €500 practice accounts (A, B, C) plus the portfolio P, which re-uses their signals, so its trades are not extra capital.", g,
    callout("The portfolio is not better than its parts in the 2024–2026 tests: +€306 against +€409 for A alone and +€323 for B alone at 0.01% cost, with a €571 drawdown, and −€500 at 0.02%. Nothing here has passed all six validation gates. Real orders are placed only after you approve each one.")));
  const eq = LIVE.equity;
  if (eq.length >= 2) { const box = h("div", { class: "chartbox", style: "height:280px" }); const cv = h("canvas"); box.appendChild(cv); v.appendChild(card("Live equity", "Balance of each practice account per day (closed-trade results; C and P started on 29 Oct, so they sit at €500 before that).", box)); lineChart(cv, eq.map((r) => r.d.slice(5)), [["A v5.4", eq.map((r) => r.A)], ["B L7", eq.map((r) => r.B)], ["C BK3", eq.map((r) => r.C)], ["P portfolio", eq.map((r) => r.P)]], (x) => "€" + x.toFixed(0)); }
  const V = ST.variants["0.01%"], vr = (n) => V.find((r) => r[0] === n);
  const gt = ST.gates["0.01%"];
  const sc = [["A — v5.4", vr("A alone"), gt[0].n + " of 6", "Profitable in the test, but luck cannot be ruled out and it had a long losing stretch in 2024"], ["B — L7", vr("B alone"), gt[1].n + " of 6", "Best-looking, but only 76 trades in 34 months"], ["C — breakout mix", vr("C alone"), gt[2].n + " of 6", "Plenty of trades, about zero edge; loses everything at 0.02% cost"], ["P — portfolio", vr("P = A+B+C"), "not tested", "Mostly C, so deeper drawdowns than A or B and no better profit"]];
  v.appendChild(card("Scoreboard from the backtest", "January 2024 to 27 October 2026, 0.01% cost per side (a hypothetical cost, not measured at a broker). Full tables are in the Backtest replay and Robustness tests tabs.",
    table(["Bot", "Trades", "Profit", "Win rate", "Worst drawdown", "Gates passed", "In one line"], sc.map((s) => [s[0], px(s[1][1]).replace(".00", ""), { t: fmtEur0(s[1][2]), cls: tone(s[1][2]) }, s[1][3] + "%", "€" + s[1][4], s[2], s[3]]), { num: [1, 2, 3, 4] })));
  v.appendChild(card("What the numbers mean", null, props([
    { label: "Balance", value: "What the practice account holds. Everything starts at €500 and no real money is used." },
    { label: "Risk per trade (€25)", value: "The most one trade should lose if its stop is hit (5% of €500), apart from costs and gaps." },
    { label: "R", value: "One R is one unit of planned risk, so +2R is a win worth twice the €25 risk. On this site R means the result divided by €25." },
    { label: "Win rate", value: "Share of trades that ended in profit. A high win rate alone says little: many small wins can be wiped out by a few big losses." },
    { label: "Max drawdown", value: "The biggest fall from a previous high of the account, in euros. It shows how bad the worst stretch felt." },
    { label: "Sharpe", value: "Average daily return divided by its ups and downs, scaled to a year. Above 1 is decent, below 0.5 is weak." },
    { label: "Cost per side", value: "The hypothetical spread and fees paid when opening and again when closing, as a share of the trade value: 0.01% or 0.02% here. The real cost at the broker is still unmeasured." },
    { label: "Backtest", value: "The same rules replayed over Jan 2024 – Oct 2026 index and gold data (US500, USATECH, XAUUSD from Dukascopy). Past results do not predict the future." }])));
}

function lineChart(cv, labels, series, fmt, opts) {
  opts = opts || {}; const cols = [css("--blue"), css("--green"), css("--amber"), css("--red")];
  new Chart(cv, { type: "line", data: { labels, datasets: series.map((s, i) => ({ label: s[0], data: s[1], borderColor: cols[i], backgroundColor: cols[i], borderWidth: 2, pointRadius: labels.length < 12 ? 3 : 0, tension: 0.15 })) },
    options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: css("--muted") } }, tooltip: { callbacks: { label: (c) => c.dataset.label + ": " + fmt(c.parsed.y) } } },
      scales: { x: { ticks: { color: css("--muted"), maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,.05)" } }, y: { ticks: { color: css("--muted"), callback: (x) => fmt(x) }, grid: { color: "rgba(255,255,255,.07)" }, min: opts.min } } } });
}

// ---------- Live bots
function checkStatus(mk) {
  const age = ageMin(), txt = LIVE.last_check_madrid ? "last check " + LIVE.last_check_madrid.split(", ")[1] + (age == null ? "" : age < 60 ? " (" + Math.max(0, age) + " min ago)" : " (" + Math.round(age / 60) + " h ago)") : "no check recorded";
  if (mk.open) return age != null && age > 12 ? pill("No check for " + age + " min – " + txt, "warn") : pill("Running – " + txt, "ok");
  return pill("Idle until the US open – " + txt, "neu");
}
function bots(v) {
  const T = LIVE.tracks, mk = marketInfo();
  const cards = h("div", { class: "grid g2" });
  T.forEach((t) => {
    const hit = t.day.halted || t.day.losses >= 3 || t.day.pnl <= -75; const winrate = t.total_trades ? Math.round((100 * t.wins) / t.total_trades) + "%" : "0 trades";
    const c = card(t.name, t.status + (t.total_trades ? "." : "."));
    c.appendChild(h("div", { class: "grid g4" }, metric(fmtEur(t.balance), "Balance", sgn(t.balance - t.start) + " since start", tone(t.balance - t.start)),
      metric(sgn(t.day.pnl), "Today", t.open.length ? "Open trade " + (t.open_pnl ? sgn(t.open_pnl) : "running") : "No open trade", tone(t.day.pnl)),
      metric(t.day.trades + " of 10", "Trades today", t.day.losses + " of 3 losses"), metric(winrate, "Win rate", t.total_trades ? t.wins + " of " + t.total_trades + " closed trades" : "no closed trades yet")));
    c.appendChild(props([{ label: "Daily stop", value: pill(hit ? "Hit, no more trades today" : "Not hit", hit ? "bad" : "ok") },
      { label: "Open trade", value: t.open.length ? t.open[0].side + " " + t.open[0].market + " at " + t.open[0].entry : "None" }, { label: "Account started", value: t.start_date || "–" }]));
    if (t.recent.length) c.appendChild(table(["Closed", "Market", "Side", "Entry → exit", "Result"], t.recent.slice(0, 3).map((r) => [r.time, r.market, r.side, r.entry + " → " + r.exit + " (" + r.why + ")", { t: sgn(r.pnl), cls: tone(r.pnl) }]), { num: [4] }));
    cards.appendChild(c);
  });
  v.appendChild(card("Trading bots", "Each bot has its own €500 practice account. P re-uses the signals of A, B and C under shared risk rules."));
  v.lastChild.appendChild(cards);
  if (LIVE.benchmark && LIVE.benchmark.value_eur != null) v.lastChild.appendChild(h("p", { class: "small" }, "Hold-a-third-each benchmark (never traded, from the 27 Oct US open): " + fmtEur(LIVE.benchmark.value_eur) + " (" + sgn(LIVE.benchmark.value_eur - 500) + ")."));
  const open = T.flatMap((t) => t.open.map((o) => [t.key + (o.src ? " ← " + o.src : ""), o.market, o.side, o.entry, o.stop == null ? "–" : o.stop, o.target == null ? "–" : o.target, o.since || "–", o.until || "–"]));
  if (open.length) v.appendChild(card("Open trades", null, table(["Bot", "Market", "Side", "Entry", "Stop", "Target", "Opened", "Time exit by"], open, { num: [3, 4, 5] })));
  const closed = T.flatMap((t) => t.recent.map((r) => [t.key + (r.src ? " ← " + r.src : ""), r.time, r.market, r.side, r.entry || "–", r.exit, r.why, { t: sgn(r.pnl), cls: tone(r.pnl) }]));
  v.appendChild(card("Recent closed trades", "Whole trades only (a partial exit counts when the trade finishes). Results are the practice accounts' shadow P&L in euros.",
    closed.length ? table(["Bot", "Closed", "Market", "Side", "Entry", "Exit", "Reason", "Result"], closed, { num: [4, 5, 7] }) : h("p", { class: "mut" }, "No closed trades yet on these accounts.")));
  if (LIVE.skipped.length) v.appendChild(card("Signals the portfolio skipped", null, table(["Time", "Bot", "Market", "Side", "Why skipped"], LIVE.skipped.map((s) => [s.time, s.track, s.market, s.side, s.reason]))));
  if (LIVE.price_sources.length) v.appendChild(card("Latest market data used", "The 1-minute bars the practice check read (Yahoo Finance, ETF proxies).", table(["Ticker", "Last bar (Madrid)", "Last close"], LIVE.price_sources.map((s) => [s.ticker, fdate(Date.parse(s.last_bar_utc)), px(s.last_close)]), { num: [2] })));
  const rows = [["Practice check", "Replays the latest market data through A, B, C and P, records trades, reports them to you and refreshes this page's data", "Every 5 minutes while the US market is open", LIVE.last_check_madrid || "–", checkStatus(mk)],
    ["Strategy research round", "Scores the live bots on new data, tests ideas, keeps the research log", "Every 4 hours", LIVE.research_latest.heading, pill("Scheduled – result in the Research log tab", "neu")],
    ["Morning market brief", "Short briefing on the market and the news before the open", "Weekdays at about 09:00 Madrid time", "Not recorded on this site", pill("Scheduled", "neu")]]
    .concat(DESK.map((d) => [d[0], d[1], "On call: reviews each real trade plan before it is proposed to you", "Not recorded on this site", pill("Standing by", "neu")]));
  v.appendChild(card("Automation bots", "What keeps the practice running. Status is worked out in your browser from the time of the last practice check, so it is a hint, not a heartbeat. " + SCHEDULE_NOTE, table(["Bot", "What it does", "Runs", "Last run known to this site", "Status"], rows)));
}

// ---------- Backtest replay
const RP = { trk: "P", rows: [], k: 0, playing: false, speed: "Normal", mf: "All markets", rf: "All results", wf: "All exit reasons", sort: "Oldest first", upTo: false, page: 0, timer: null, rowsDirty: true, node: null, lastCost: null };
const SPEEDS = { Slow: 1, Normal: 3, Fast: 12, "Very fast": 40 }, PAGE = 25;
function computeRows() {
  const ci = state.cost === "0.01%" ? 0 : 1, out = []; let cum = 0;
  TR.forEach((t) => { const v = RP.trk === "P" ? t.p[ci] : BOTS[t.trk] === RP.trk ? t.a[ci] : null; if (v == null) return; cum += v; out.push({ t, v, cum, i: out.length + 1 }); });
  RP.rows = out; RP.rowsDirty = false;
}
function stopPlay() { RP.playing = false; if (RP.timer) clearInterval(RP.timer); RP.timer = null; }
function replay(v) {
  if (RP.rowsDirty || RP.lastCost !== state.cost) { computeRows(); RP.lastCost = state.cost; RP.k = RP.rows.length; RP.page = 0; }
  const n = () => RP.rows.length;
  const chart = makeChart();
  const readout = h("div", { class: "readout" }), slider = h("input", { type: "range", min: "0", max: String(n()), value: String(RP.k), "aria-label": "Replay position", oninput: (e) => { stopPlay(); RP.k = parseInt(e.target.value, 10); update(true); } });
  const metrics = h("div", { class: "grid g4" }), heatBox = h("div", { class: "heatwrap" }), mktBox = h("div"), tblBox = h("div"), playBtn = h("button", { class: "b pri", type: "button" });
  const setPlayLabel = () => (playBtn.textContent = RP.playing ? "Pause" : "Play");
  playBtn.onclick = () => { if (RP.playing) { stopPlay(); } else { if (RP.k >= n()) RP.k = 0; RP.playing = true; RP.timer = setInterval(() => { RP.k = Math.min(n(), RP.k + SPEEDS[RP.speed]); if (RP.k >= n()) stopPlay(); update(true); }, 60); } setPlayLabel(); update(true); };
  function stats() { let eq = 500, peak = 500, dd = 0, w = 0; for (let i = 0; i < RP.k; i++) { eq += RP.rows[i].v; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); if (RP.rows[i].v > 0) w++; } return { eq, dd, w }; }
  function update(light) {
    const k = RP.k, s = stats(), cur = k > 0 ? RP.rows[k - 1] : null; slider.value = String(k); setPlayLabel(); chart.setK(k);
    readout.textContent = cur ? "Trade " + k + " of " + n() + ": entered " + fdate(cur.t.tin) + " Madrid time, " + (cur.t.side > 0 ? "long" : "short") + " " + MKN[cur.t.mk] + " (bot " + BOTS[cur.t.trk] + "), " + WHYN[cur.t.why].toLowerCase() + ", result " + sgn(cur.v) + ", balance " + fmtEur(s.eq) + "." : "Start of the replay: €500, no trade yet (" + n() + " trades to come).";
    metrics.innerHTML = ""; metrics.append(metric(fmtEur(s.eq), "Balance at this point", sgn(s.eq - 500) + " since start", tone(s.eq - 500)), metric(k + " of " + n(), "Trades replayed", k ? s.w + " wins, " + (k - s.w) + " not wins" : "press play"), metric(k ? Math.round((100 * s.w) / k) + "%" : "–", "Win rate so far"), metric(fmtEur(s.dd), "Worst drawdown so far", "biggest fall from a previous high"));
    if (RP.upTo || !light) drawTable(); else if (!RP.playing) drawTable();
  }
  function drawTable() {
    let r = RP.rows.filter((x) => (RP.upTo ? x.i <= RP.k : true));
    if (RP.mf !== "All markets") r = r.filter((x) => MKN[x.t.mk] === RP.mf);
    if (RP.rf === "Wins") r = r.filter((x) => x.v > 0); else if (RP.rf === "Losses") r = r.filter((x) => x.v < 0); else if (RP.rf === "Break-even") r = r.filter((x) => x.v === 0);
    if (RP.wf !== "All exit reasons") r = r.filter((x) => WHYN[x.t.why] === RP.wf);
    r = r.slice(); if (RP.sort === "Newest first") r.reverse(); else if (RP.sort === "Best result first") r.sort((a, b) => b.v - a.v); else if (RP.sort === "Worst result first") r.sort((a, b) => a.v - b.v);
    const pages = Math.max(1, Math.ceil(r.length / PAGE)); RP.page = Math.min(RP.page, pages - 1); const shown = r.slice(RP.page * PAGE, RP.page * PAGE + PAGE);
    tblBox.innerHTML = "";
    tblBox.appendChild(h("div", { class: "grid g4" }, sel("Market", ["All markets"].concat(MKN), RP.mf, (x) => { RP.mf = x; RP.page = 0; drawTable(); }), sel("Result", ["All results", "Wins", "Losses", "Break-even"], RP.rf, (x) => { RP.rf = x; RP.page = 0; drawTable(); }),
      sel("Exit reason", ["All exit reasons"].concat(WHYN), RP.wf, (x) => { RP.wf = x; RP.page = 0; drawTable(); }), sel("Sort", ["Oldest first", "Newest first", "Best result first", "Worst result first"], RP.sort, (x) => { RP.sort = x; RP.page = 0; drawTable(); })));
    tblBox.appendChild(h("label", { class: "row small" }, h("input", { type: "checkbox", checked: RP.upTo, onchange: (e) => { RP.upTo = e.target.checked; RP.page = 0; drawTable(); } }), " Only trades up to the replay position"));
    tblBox.appendChild(table(["#", "Entered (Madrid)", "Bot", "Market", "Side", "Entry", "Exit", "Exit reason", "Held", "R", "Result", "Balance after"],
      shown.map((x) => [String(x.i), fdate(x.t.tin), BOTS[x.t.trk], MKN[x.t.mk], x.t.side > 0 ? "Long" : "Short", px(x.t.entry), px(x.t.exit), WHYN[x.t.why], x.t.hold + " min", (x.v >= 0 ? "+" : "−") + Math.abs(x.v / 25).toFixed(2) + "R", { t: sgn(x.v), cls: tone(x.v) }, fmtEur(500 + x.cum)]), { num: [0, 5, 6, 8, 9, 10, 11] }));
    tblBox.appendChild(h("div", { class: "row" }, h("button", { class: "b", type: "button", disabled: RP.page === 0, onclick: () => { RP.page--; drawTable(); } }, "Previous"), h("button", { class: "b", type: "button", disabled: RP.page >= pages - 1, onclick: () => { RP.page++; drawTable(); } }, "Next"),
      h("span", { class: "small" }, r.length ? "Trades " + (RP.page * PAGE + 1) + "–" + Math.min(r.length, RP.page * PAGE + PAGE) + " of " + r.length.toLocaleString("en-US") + " (page " + (RP.page + 1) + " of " + pages + "). Exit price and reason are those of the 0.01% run." : "No trades match the filters.")));
  }
  function drawStatic() {
    chart.setRows(RP.rows); heatBox.innerHTML = ""; heatBox.appendChild(heat(RP.rows));
    mktBox.innerHTML = ""; mktBox.appendChild(table(["Market", "Trades", "Win rate", "Total", "Average per trade", "Best trade", "Worst trade"], MKN.map((m, mi) => { const r = RP.rows.filter((x) => x.t.mk === mi), tot = r.reduce((s, x) => s + x.v, 0), w = r.filter((x) => x.v > 0).length;
      return [m, String(r.length), r.length ? Math.round((100 * w) / r.length) + "%" : "–", { t: sgn(tot), cls: tone(tot) }, r.length ? sgn(tot / r.length) : "–", r.length ? fmtEur(Math.max(...r.map((x) => x.v))) : "–", r.length ? fmtEur(Math.min(...r.map((x) => x.v))) : "–"]; }), { num: [1, 2, 3, 4, 5, 6] }));
  }
  const root = h("div", { class: "view", style: "padding:0" });
  const top = card("Replay every backtest trade", "Each dot is one trade of the simulation run over January 2024 to 27 October 2026: green for a win, red for a loss. Press play, or drag the slider to jump to any trade.");
  top.appendChild(h("div", { class: "row" }, sel("Bot", Object.keys(TRK_NAMES).map((k) => ({ value: k, label: TRK_NAMES[k] })), RP.trk, (x) => { stopPlay(); RP.trk = x; RP.rowsDirty = true; RP.page = 0; RP.k = 1e9; render(); }), h("div", { class: "f" }, h("span", { class: "small" }, "Cost per side"), costSwitch())));
  top.appendChild(chart.el);
  top.appendChild(h("div", { class: "row" }, playBtn, h("button", { class: "b", type: "button", onclick: () => { stopPlay(); RP.k = 0; update(true); } }, "Restart"), h("button", { class: "b", type: "button", onclick: () => { stopPlay(); RP.k = n(); update(true); } }, "Show all"), sel("Speed", Object.keys(SPEEDS), RP.speed, (x) => { RP.speed = x; if (RP.playing) { stopPlay(); playBtn.onclick(); } })));
  top.appendChild(slider); top.appendChild(readout); top.appendChild(metrics);
  top.appendChild(callout("Costs are hypothetical: " + state.cost + " of the trade value on each side (spread and fees), not measured at a broker. Prices are Dukascopy US500, USATECH and XAUUSD bars used as proxies for the S&P 500, Nasdaq-100 and gold. No slippage, euro/dollar taken as 1, trade size grows and shrinks with the account (20× cap), no account brake. Results are in euros on the €500 account.", "info"));
  root.appendChild(top);
  root.appendChild(card("Profit and loss by month", TRK_NAMES[RP.trk] + ", " + state.cost + " cost, euros, by month of entry. Green months made money, red months lost money; the right column is the year total.", heatBox));
  root.appendChild(card("Breakdown by market", TRK_NAMES[RP.trk] + ", " + state.cost + " cost, all " + n() + " trades. Gold data starts in September 2024.", mktBox));
  root.appendChild(card("Every trade", "Filter and sort the full list. R is the result divided by the standard €25 risk. Entry time is Madrid time.", tblBox));
  // portfolio vs alone
  const cv = h("canvas"), cbox = h("div", { class: "chartbox", style: "height:300px" }, cv), V = ST.variants[state.cost], cur = ST.curves[state.cost];
  const pv = card("Portfolio against each track alone", "Same history and trades as the replay above, real compounding size, no account brake unless named. Month-end balance from €500.", cbox,
    table(["Variant", "Trades", "Profit", "Win rate", "Max drawdown", "Sharpe"], V.map((r) => [r[0], String(r[1]), { t: fmtEur0(r[2]), cls: tone(r[2]) }, r[3] + "%", fmtEur0(r[4]), r[5].toFixed(2)]), { num: [1, 2, 3, 4, 5] }),
    h("p", { class: "small" }, "Reading it: P is mostly track C (92% of its trades), which has about zero edge, so P behaves like C plus a little of A and B. The €350 brake that live A and B carry would have stopped A for good on 4 Oct 2024 (row A alone, €350 brake); the +€409 for A assumes no brake."));
  root.appendChild(pv); setTimeout(() => lineChart(cv, ST.months, [["A v5.4", cur.A], ["B L7", cur.B], ["C BK3", cur.C], ["P portfolio", cur.P]], (x) => "€" + x.toFixed(0), { min: 0 }), 0);
  root.appendChild(card("Correlation between bots", "Correlation of daily profit and loss over all trading days Jan 2024 – Oct 2026 at 0.01% cost. 1 means they move together, 0 means unrelated.",
    table([""].concat(ST.corr_names), ST.corr.map((row, i) => [ST.corr_names[i]].concat(row.map((x) => (Math.abs(x) < 0.005 ? "0.00" : x.toFixed(2))))), { num: [1, 2, 3, 4] }),
    h("p", { class: "small" }, "A and B overlap (0.63): 72 of B's 76 entries are the same signal as an A entry, taken on wide-opening days with different exits. C is unrelated to A and B, but it adds no profit of its own.")));
  v.appendChild(root); drawStatic(); update(false);
}
function heat(rows) {
  const mn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], grid = {}, has = {};
  rows.forEach((r) => { const d = new Date(r.t.tin), key = d.getUTCFullYear() + "-" + d.getUTCMonth(); grid[key] = (grid[key] || 0) + r.v; has[key] = 1; });
  const mx = Math.max(1, ...Object.keys(grid).map((k) => Math.abs(grid[k]))), g = css("--green"), rd = css("--red"), wrap = h("div", { class: "heat" });
  const cell = (val, bold) => { const d = h("div", { style: val == null || val === 0 ? "" : "background:color-mix(in srgb," + (val > 0 ? g : rd) + " " + Math.round(12 + (Math.abs(val) / mx) * 58) + "%,transparent)" + (bold ? ";font-weight:600" : "") }, val == null ? "" : String(Math.round(val))); return d; };
  wrap.appendChild(h("div", { class: "hh" })); mn.forEach((m) => wrap.appendChild(h("div", { class: "hh" }, m))); wrap.appendChild(h("div", { class: "hh" }, "Year"));
  [2024, 2025, 2026].forEach((y) => { let tot = 0; wrap.appendChild(h("div", { class: "hh", style: "text-align:left;font-size:12px" }, String(y))); mn.forEach((m, i) => { const k = y + "-" + i, val = has[k] ? grid[k] : null; if (val != null) tot += val; wrap.appendChild(cell(val)); }); wrap.appendChild(cell(tot, true)); });
  return wrap;
}
function makeChart() {
  const W = 1000, H = 340, L = 58, R = 14, T = 12, B = 30, x0 = Date.UTC(2024, 0, 1), x1 = Date.UTC(2026, 9, 29);
  const svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "rc", role: "img", "aria-label": "Equity curve replay" });
  const gGrid = sv("g", {}), base = sv("line", { "stroke-dasharray": "4 4", "stroke-width": 1 }), full = sv("path", { fill: "none", "stroke-width": 1.2 }), part = sv("path", { fill: "none", "stroke-width": 1.8 }), gM = sv("g", {}), curC = sv("circle", { r: 5, fill: "none", "stroke-width": 1.5 });
  svg.append(gGrid, base, full, part, gM, curC);
  let sc = null, rows = [], pts = [], parts = [], drawn = 0, startStr = "";
  function setRows(r) {
    rows = r; const col = { muted: css("--muted"), border: css("--border"), blue: css("--blue"), text: css("--text") };
    const eqs = r.map((x) => 500 + x.cum), lo0 = Math.min(500, ...eqs), hi0 = Math.max(500, ...eqs), pad = (hi0 - lo0) * 0.06 + 5, lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
    const xs = (ms) => L + ((ms - x0) / (x1 - x0)) * (W - L - R), ys = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B); sc = { xs, ys };
    gGrid.innerHTML = ""; for (let i = 0; i < 5; i++) { const v = lo + ((hi - lo) * i) / 4; gGrid.appendChild(sv("line", { x1: L, x2: W - R, y1: ys(v), y2: ys(v), stroke: col.border, "stroke-width": 1 })); const t = sv("text", { x: L - 6, y: ys(v) + 4, "text-anchor": "end", "font-size": 11, fill: col.muted }); t.textContent = "€" + Math.round(v); gGrid.appendChild(t); }
    [[2024, 0, "Jan 2024"], [2024, 6, "Jul 2024"], [2025, 0, "Jan 2025"], [2025, 6, "Jul 2025"], [2026, 0, "Jan 2026"], [2026, 6, "Jul 2026"]].forEach((x) => { const t = sv("text", { x: xs(Date.UTC(x[0], x[1], 1)), y: H - 8, "text-anchor": "middle", "font-size": 11, fill: col.muted }); t.textContent = x[2]; gGrid.appendChild(t); });
    base.setAttribute("x1", L); base.setAttribute("x2", W - R); base.setAttribute("y1", ys(500)); base.setAttribute("y2", ys(500)); base.setAttribute("stroke", col.muted);
    pts = r.map((x, i) => [xs(x.t.tout), ys(eqs[i])]); startStr = "M" + xs(x0).toFixed(1) + "," + ys(500).toFixed(1); parts = pts.map((p) => " L" + p[0].toFixed(1) + "," + p[1].toFixed(1));
    full.setAttribute("d", startStr + parts.join("")); full.setAttribute("stroke", col.border); part.setAttribute("stroke", col.blue); curC.setAttribute("stroke", col.text); gM.innerHTML = ""; drawn = 0;
  }
  function setK(k) {
    k = Math.min(k, rows.length); const g = css("--green"), rd = css("--red"), mu = css("--muted"), rr = rows.length > 600 ? 1.5 : 2.8;
    if (k < drawn) { gM.innerHTML = ""; drawn = 0; }
    const frag = document.createDocumentFragment(); for (let i = drawn; i < k; i++) frag.appendChild(sv("circle", { cx: pts[i][0].toFixed(1), cy: pts[i][1].toFixed(1), r: rr, fill: rows[i].v > 0 ? g : rows[i].v < 0 ? rd : mu, "fill-opacity": 0.85 })); gM.appendChild(frag); drawn = k;
    part.setAttribute("d", startStr + parts.slice(0, k).join("")); if (k > 0) { curC.setAttribute("cx", pts[k - 1][0]); curC.setAttribute("cy", pts[k - 1][1]); curC.style.display = ""; } else curC.style.display = "none";
  }
  return { el: svg, setRows, setK };
}

// ---------- Robustness
function robust(v) {
  const gt = ST.gates[state.cost];
  v.appendChild(card("Validation gates", "Six checks in the style of automated strategy builders, run on the 2024–2026 history. Passing means 'not an obvious fluke', not 'will make money': all three bots were picked on this same history.", costSwitch(),
    table(["Bot"].concat(GATE_NAMES, ["Gates passed"]), gt.map((g) => [g.t].concat(g.p.map((p) => gatePill(p)), [g.n + " of 6"]))),
    table(["Gate", "Passes when", "In plain words"].concat(gt.map((g) => g.t)), GATE_NAMES.map((nm, i) => [nm, GATE_RULES[i], GATE_PLAIN[i]].concat(gt.map((g) => g.d[i])))),
    h("p", { class: "small" }, "The random-entry gate can pass for a bot that still loses money after costs (C at 0.02%), because random entries with the same exits lose even more. The confidence interval is in euros per trade after hypothetical costs of " + state.cost + " per side.")));
  v.appendChild(card("What the gates found", null, props([
    { label: "A — v5.4", value: "Passes 4 of 6. Its entries clearly beat random ones and survive small parameter changes, but the average per trade could be zero by luck and only 3 of 6 time periods made money." },
    { label: "B — L7", value: "Passes 5 of 6 at 0.01% cost. It fails only on size: 76 trades in 34 months is too few to be sure. At 0.02% its confidence interval also touches zero." },
    { label: "C — breakout mix", value: "Passes 2 of 6. It has plenty of trades and beats random entries, but only 62% of nudged copies stay profitable (70% needed), and only gold made money." },
    { label: "Bug fixed on the way", value: "The research exit engine counted partial exits on short trades with the wrong sign. It was fixed before the gates and the replay were run. The live bots were not touched." }])));
}

// ---------- Monte Carlo
function mc(v) {
  const V = ST.variants[state.cost];
  v.appendChild(card("Monte Carlo summary", "20,000 resampled paths per row: whole trading days are drawn at random, with replacement, from the real 705 trading days, and the trades of each drawn day are replayed with the bot's own rules. It shows how much luck can change the result. It cannot create an edge.", costSwitch(),
    table(["Variant", "Profitable, 705 days", "Profitable, 1 year", "Median final balance", "Lose ≥ €100", "Wiped out", "Drawdown, bad case (95th)"], V.map((r) => [r[0], r[6] + "%", (r[11] == null ? "–" : r[11] + "%"), fmtEur0(r[7]), r[8] + "%", r[9] + "%", fmtEur0(r[10])]), { num: [1, 2, 3, 4, 5, 6] })));
  const rows = ST.mc.filter((m) => m.cost === state.cost);
  v.appendChild(card("Per bot, with the spread of outcomes", "Same method, one row per bot at " + state.cost + ". The 5th and 95th percentiles bracket 90% of the 20,000 paths (final balance from €500). C appears twice: with the overnight range from the evening before, and the live-style version that uses the pre-market range.",
    table(["Bot", "Real trades", "Real profit", "Profitable (705 d)", "Final: 5th", "Final: median", "Final: 95th", "Lose ≥ €100", "Lose ≥ €250", "Wiped (≤ €10)", "Drawdown 95th", "Losing streak 95th"],
      rows.map((m) => [m.track, m.hist_trades.toLocaleString("en-US"), { t: fmtEur0(m.hist_pnl), cls: tone(m.hist_pnl) }, m.p_profit + "%", fmtEur0(m.p5), fmtEur0(m.med), fmtEur0(m.p95), m.p_lose100 + "%", m.p_lose250 + "%", m.p_wiped + "%", fmtEur0(m.dd_p95), String(m.streak_p95)]), { num: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })));
  v.appendChild(card("How to read the columns", null, props([
    { label: "Profitable, 705 days", value: "Out of 20,000 imagined repeats of the whole 34 months, the share that ended above €500." },
    { label: "Profitable, 1 year", value: "The same for a random year (250 trading days)." },
    { label: "Median final balance", value: "The middle outcome of the 20,000 paths, starting from €500." },
    { label: "Lose ≥ €100", value: "Share of paths that ended at €400 or less." },
    { label: "Wiped out", value: "Share of paths where the balance fell to €10 or less at some point; the practice account is treated as dead from there." },
    { label: "Drawdown, bad case", value: "The peak-to-trough fall that only 1 path in 20 exceeded." }]),
    callout("Only 153 (A) and 76 (B) real trades stand behind these numbers, however many paths are drawn, and all three bots were chosen on this same history. At 0.02% cost C and the portfolio P are wiped out in about 9 paths in 10. The real broker cost decides this.")));
}

// ---------- Research log
function log(v) {
  const r = LIVE.research_latest;
  v.appendChild(card("Latest research round", "Read from the end of research_log.md each minute.", h("h3", null, r.heading), h("p", null, r.text + (r.truncated ? " …" : ""))));
  v.appendChild(card("How the research went", "Summary of research_log.md, oldest first. About 21,900 strategy runs have been run on this history, which is why any winner is probably partly luck.", h("div", { class: "timeline" }, table(["When", "Round", "What was tested", "What came out"], LOG))));
  v.appendChild(card("Still open", null, props([
    { label: "Real trading costs", value: "The spread and fees at the real broker are not measured yet (no demo login). The 0.01% and 0.02% costs on this site are assumptions, and they decide whether C and P can work at all." },
    { label: "Forward test", value: "Only a few live days exist so far. The next score of A, B, C and P comes after the 29 Oct US close." },
    { label: "Real orders", value: "None placed. A real trade needs your approval of each order after the desk's review." }])));
}

// ---------- Rules
function rules(v) {
  const g = h("div", { class: "rules" });
  LIVE.tracks.forEach((t) => g.appendChild(h("section", null, h("h3", null, t.name), props(RULES[t.key]))));
  v.appendChild(card("Rules of each bot", null, g, callout("Practice only. The hypothetical costs (0.01% and 0.02% per side) are not yet measured against a real broker, and C was added on 29 Oct to collect many trades, not as a proven winner.", "info")));
}

// ---------- loading + status
// Live data comes from the "data" branch on GitHub (raw CDN, cache-busted per minute); the copy bundled with the page is the fallback.
const RAW = "https://raw.githubusercontent.com/ariifairway/trading-desk/data/", POLL_MS = 60000;
async function getJSON(name, bucket) {
  const t = Math.floor(Date.now() / bucket);
  const src = (location.hostname === "127.0.0.1" || location.hostname === "localhost") ? ["data/" + name + "?t=" + t] : [RAW + name + "?t=" + t, "data/" + name + "?t=" + t];
  let err;
  for (const u of src) { try { const r = await fetch(u, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); if (name === "live.json" && LIVE && Date.parse(j.generated_utc) < Date.parse(LIVE.generated_utc)) return LIVE; return j; } catch (e) { err = e; } }
  if (err) throw err; throw new Error("no newer data");
}
async function loadLive() {
  try {
    const j = await getJSON("live.json", 60000); LIVE = j; liveErr = null; lastFetchOk = Date.now();
    if (["overview", "bots", "log", "rules"].includes(state.tab)) render();
  } catch (e) { liveErr = String(e.message || e); }
  updateStatus();
}
function updateStatus() {
  const el = document.getElementById("status"), tx = document.getElementById("status-text");
  if (!LIVE) { tx.textContent = liveErr ? "Data unavailable: " + liveErr : "Loading…"; el.className = "status stale"; return; }
  const age = Math.round((Date.now() - Date.parse(LIVE.generated_utc)) / 1000), stale = age > 600;
  tx.textContent = "Last updated " + madTime(Date.parse(LIVE.generated_utc), true) + " Madrid · " + (age < 90 ? age + " s" : Math.round(age / 60) + " min") + " ago" + (stale ? " – data may be stale" : "") + (liveErr ? " (refresh failing)" : "");
  el.className = "status " + (stale || liveErr ? "stale" : "ok");
}
async function init() {
  const hash = location.hash.slice(1); if (TABS.some((t) => t[0] === hash)) state.tab = hash;
  window.addEventListener("hashchange", () => { const x = location.hash.slice(1); if (TABS.some((t) => t[0] === x) && x !== state.tab) { state.tab = x; renderTabs(); render(); } });
  renderTabs(); render();
  try { ST = await getJSON("static.json", 600000); TR = decode(ST.replay); } catch (e) { liveErr = "static data: " + e.message; }
  await loadLive(); render();
  setInterval(loadLive, POLL_MS); setInterval(updateStatus, 1000);
}
init();
})();
