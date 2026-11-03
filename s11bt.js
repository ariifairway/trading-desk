// "S11 vs world stocks" tab: S11 backtest on a EUR5,000 account (23 Jan 2012 - 2 Nov 2026) side by side with MSCI ACWI IMI buy-and-hold,
// accuracy notes, exact method, play/pause replay of every trade, and a sortable trade table. Practice/backtest only: no broker, no real order.
// Data (static files in data/s11bt/, built by research_hf/strat21/s11_vs_acwi/build.py): s11_vs_acwi.json, s11_trades.json, s11_price_daily.json, s11_trades_2012_2026_live_rule.csv
(function () {
"use strict";
const VER = "20261103a", BASE = "data/s11bt/";
let H = null, D = null, TD = null, PR = null, err = null, loading = null;
const CH = []; let timer = null;
const S = { variant: "live", view: "all", k: 0, playing: false, speed: 1, ty: "All", tside: "All", tres: "All", tsort: "n", tdir: 1, tpage: 0, last: 0 };
const PAGE = 50, SPEEDS = [["2 trades/s", 2], ["6 trades/s", 6], ["20 trades/s", 20], ["60 trades/s", 60], ["200 trades/s", 200]];
const VARS = [
  ["live", "Live rule: fixed €300 risk, stops at €0 (the €5,000 loss limit)", "#5aa9ff"],
  ["pct5", "5% of current balance per trade (compounding), stops at €0", "#e3b341"],
  ["scaled", "What-if: fixed €300, costs scaled to the index level, stops at €0", "#3fb97a"],
  ["nolimit", "Same as the live rule but WITHOUT the loss limit (not possible in real life)", "#8d9aab"],
];
const VN = {}; VARS.forEach((x) => (VN[x[0]] = x[1]));
const fE = (v, d) => (v < 0 ? "−€" : "€") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
const fS = (v, d) => (v >= 0 ? "+" : "−") + "€" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
const fP = (v, d) => (v == null ? "–" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d == null ? 1 : d) + "%");
const fPx = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fD = (s) => { const p = s.split("-"); return parseInt(p[2], 10) + " " + MON[parseInt(p[1], 10) - 1] + " " + p[0]; };
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const WHY = ["Stop", "Target", "60-min / close"];
const ms = (s) => Date.parse(s + "T00:00:00Z");
const yf = (s) => { const y = +s.slice(0, 4), a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1); return y + (ms(s) - a) / (b - a); };

async function getJ(f) { const r = await fetch(BASE + f + "?v=" + VER); if (!r.ok) throw new Error(f + ": HTTP " + r.status); return r.json(); }
function load() {
  if (loading) return loading;
  loading = Promise.all([getJ("s11_vs_acwi.json"), getJ("s11_trades.json"), getJ("s11_price_daily.json")]).then((a) => { D = a[0]; TD = a[1]; PR = a[2]; PR.t = PR.days.map(ms); err = null; }).catch((e) => { err = String(e.message || e); loading = null; });
  return loading;
}
function stopTimer() { S.playing = false; if (timer) clearInterval(timer); timer = null; }
function killCharts() { CH.forEach((c) => { try { c.destroy(); } catch (e) {} }); CH.length = 0; }

// ---------------------------------------------------------------- page
function render(v, helpers) {
  H = helpers; stopTimer(); killCharts();
  if (!D || !TD || !PR) {
    v.appendChild(H.card("S11 on a €5,000 account vs MSCI ACWI IMI, 2012 to now", null, H.h("p", null, err ? "Could not load the backtest data: " + err : "Loading the backtest data…")));
    load().then(() => { if (window.__s11btOn) { const vv = document.getElementById("view"); if (vv) { vv.innerHTML = ""; render(vv, H); } } });
    return;
  }
  const h = H.h, cardF = H.card;
  if (!S.init) { S.init = true; try { const q = new URLSearchParams(location.search); if (q.get("s11k")) S.k = Math.max(0, Math.min(TD.trades.length, parseInt(q.get("s11k"), 10) || 0)); if (q.get("s11view") === "follow") S.view = "follow"; if (q.get("s11rule") && VN[q.get("s11rule")]) S.variant = q.get("s11rule"); } catch (e) {} }
  v.appendChild(head());
  v.appendChild(chartsCard());
  v.appendChild(yearsCard());
  v.appendChild(replayCard());
  v.appendChild(tableCard());
  v.appendChild(accuracyCard());
  v.appendChild(methodCard());
}
const sv = (k) => D.stats[k], dt = (k) => D.detail[k];

function head() {
  const h = H.h, L = sv("live"), A = sv("acwi"), Sc = sv("scaled"), P5 = sv("pct5"), N = sv("nolimit"), x = D.extra;
  const c = H.card("S11 on a €5,000 account vs MSCI ACWI IMI, " + fD(D.start) + " to " + fD(D.end), "Backtest only, no real money. Both start with €5,000 on " + fD(D.start) + ". S11 is the Nasdaq-100 breakout strategy we practice with (traded as Micro Nasdaq futures); the other line is buying and holding the MSCI ACWI IMI global stock index (net dividends reinvested, in euros) and doing nothing.");
  const g = h("div", { class: "grid g4" },
    H.metric(fE(A.final), "MSCI ACWI IMI, buy and hold", fP(A.ret_pct, 0) + " · " + fP(A.cagr) + " a year · worst year " + fP(A.worst_year_pct) + " (" + A.worst_year + ")", "pos"),
    H.metric(fE(0), "S11 with the live rule and the €5,000 loss limit", "Lost all €5,000 on " + fD(dt("live").ruin) + " after " + dt("live").ruin_trade_no + " trades. It had been up to " + fE(dt("live").peak_before_ruin) + " on " + fD(dt("live").peak_day) + ".", "neg"),
    H.metric(fE(P5.final), "S11 risking 5% of the balance", fP(P5.ret_pct, 0) + ". Never hit €0, but fell as low as " + fE(P5.low) + " and could not afford a single contract after Jan 2017.", "neg"),
    H.metric(fE(Sc.final), "What-if: S11 with costs scaled to today's index level", fP(Sc.cagr) + " a year, worst fall " + fE(Sc.max_dd_eur) + ". Not what a real account would have got.", "warn"));
  c.appendChild(g);
  c.appendChild(H.callout("Honest result. With the real Micro Nasdaq costs and the live €300-per-trade rule, a €5,000 account that started in January 2012 would have been wiped out in March 2013 (" + dt("live").ruin_trade_no + " trades in), while the global index fund grew to " + fE(A.final) + ". The same rule started in January 2018 would not have been (" + fE(x.from2018.final) + " by 2 Nov 2026, lowest point " + fE(x.from2018.low) + "), and started in January 2024 would have ended at " + fE(x.from2024.final) + ", but a start in January 2015 would have been wiped out on " + fD(x.from2015.ruin) + ". So the result depends heavily on when you start; the 2012–2017 stretch is the problem (45% win rate, −€10,106 in total with these costs).", "warn"));
  c.appendChild(H.callout("The loss limit means: the account trades until its balance reaches €0, then stops for good, and each trade never risks more than the money left. Even so, the last trade before the stop lost " + fE(Math.abs(dt("live").final_raw), 2).replace("€", "€") + " more than was left (a stop that slipped past its level plus costs), which is shown as a result of −€38.95 in the table and counted as €0 in the charts.", "info"));
  return c;
}

function metricsTable() {
  const h = H.h, rows = [], add = (name, k, note) => {
    const s = sv(k), d = dt(k) || {}, ruin = d.ruin ? "Yes, " + fD(d.ruin) : (k === "acwi" ? "No (index fund)" : "No");
    const fin = k === "live" ? { t: fE(0) + " (ruined)", cls: "neg" } : { t: fE(s.final), cls: s.final > EQ() ? "pos" : "neg" };
    rows.push([name, fin, { t: fP(k === "live" ? -100 : s.ret_pct, 0), cls: (k === "live" ? -1 : s.ret_pct) >= 0 ? "pos" : "neg" }, s.cagr == null ? { t: "−100% (wiped out)", cls: "neg" } : { t: fP(s.cagr), cls: s.cagr >= 0 ? "pos" : "neg" },
      k === "nolimit" ? fE(s.max_dd_eur) + " (" + fD(s.dd_peak) + " → " + fD(s.dd_trough) + ")" : fE(s.max_dd_eur) + " · " + s.max_dd_pct.toFixed(0) + "% (" + fD(s.dd_peak) + " → " + fD(s.dd_trough) + ")",
      k === "nolimit" ? s.worst_abs_year + ": " + fS(s.worst_abs_eur, 0) : s.worst_year_eur > 0 ? "No losing year (lowest: " + s.worst_year + " " + fS(s.worst_year_eur, 0) + ")" : s.worst_year + ": " + fS(s.worst_year_eur, 0) + (s.worst_year_pct == null ? "" : " (" + fP(s.worst_year_pct, 0) + ")"), { t: ruin, cls: d.ruin ? "neg" : "" }, note]);
  };
  add("MSCI ACWI IMI buy and hold", "acwi", "Index, EUR, net total return, no fund fee");
  add("S11 live rule, fixed €300 + €5,000 loss limit", "live", dt("live").trades_taken + " trades taken, " + dt("live").win_pct.toFixed(0) + "% wins; avg " + dt("live").avg_contracts.toFixed(0) + " contracts per trade");
  add("S11 5% of balance per trade + loss limit", "pct5", dt("pct5").trades_taken + " trades taken, " + dt("pct5").skipped_size.toLocaleString("en-US") + " signals skipped (one contract was too big for 5% of the balance)");
  add("What-if: costs scaled to index level (fixed €300)", "scaled", "Own cross-check. Commission and slippage scaled to the index level, not the real cost model");
  add("Same as live rule but no loss limit", "nolimit", "Would have needed to keep adding money: balance reaches " + fE(sv("nolimit").low) + " in 2013, not possible on a real €5,000 account");
  return H.table(["", "Final value of €5,000", "Total return", "Per year (CAGR)", "Biggest fall (peak → trough)", "Worst calendar year", "Wiped out?", "Notes"], rows, { num: [1, 2, 3] });
}
const EQ = () => D.start_eur;

function chartsCard() {
  const h = H.h, c = H.card("Side by side: €5,000 in each", "Balance after every trading day. The red line is €0: the point where the whole €5,000 is lost. S11 stops there; the global index never came near it. Hover for the values; the x-axis is the calendar year.");
  c.appendChild(metricsTable());
  c.appendChild(h("div", { class: "row" }, h("label", { class: "f" }, "Vertical range", h("select", { onchange: (e) => { const ch = CH[0]; if (!ch) return; const z = e.target.value === "zoom"; ch.options.scales.y.min = -9000; ch.options.scales.y.max = z ? 30000 : 90000; ch.update(); } }, h("option", { value: "zoom" }, "Zoom: −€9,000 to €30,000 (see the €5,000 account)"), h("option", { value: "all" }, "Everything (up to €90,000)")))));
  const bx = h("div", { class: "chartbox", style: "height:420px" }), cv = h("canvas"); bx.appendChild(cv); c.appendChild(bx);
  c.appendChild(h("h3", { style: "margin-top:16px" }, "Biggest fall from the previous high (drawdown)"));
  c.appendChild(h("p", { class: "cap" }, "How far each balance sits below its own highest point so far. −100% means everything is gone. The no-loss-limit line is left out because it goes below zero."));
  const bx2 = h("div", { class: "chartbox", style: "height:300px" }), cv2 = h("canvas"); bx2.appendChild(cv2); c.appendChild(bx2);
  setTimeout(() => drawCharts(cv, cv2), 0);
  return c;
}
function drawCharts(cv, cv2) {
  if (typeof Chart === "undefined") return;
  const X = D.dates.map(yf), mu = css("--muted"), bd = css("--border"), tx = css("--text");
  const mk = (key, label, col, dash, w) => ({ label, data: D.series[key].map((y, i) => ({ x: X[i], y })), borderColor: col, backgroundColor: col, borderWidth: w || 1.6, borderDash: dash || [], pointRadius: 0, pointHoverRadius: 3, tension: 0, parsing: false });
  const zero = { id: "zero", afterDraw(ch) { const { ctx, chartArea: a, scales: { y } } = ch; ctx.save(); [[0, "#f0605a", "€0 = the whole €5,000 is lost", [6, 4]], [5000, "#8d9aab", "€5,000 start", [2, 4]]].forEach((l) => { const py = y.getPixelForValue(l[0]); if (py < a.top || py > a.bottom) return; ctx.strokeStyle = l[1]; ctx.lineWidth = l[0] === 0 ? 1.6 : 1; ctx.setLineDash(l[3]); ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = l[1]; ctx.font = "12px system-ui"; ctx.textAlign = "right"; ctx.fillText(l[2], a.right - 6, l[0] === 0 ? py + 14 : py - 6); }); ctx.restore(); } };
  const ds = [mk("acwi", "MSCI ACWI IMI buy and hold", "#ffffff", [], 2.2), mk("live", "S11 live rule (fixed €300, stops at €0)", VARS[0][2], [], 2.2), mk("pct5", "S11 5% of balance (compounding)", VARS[1][2]), mk("scaled", "What-if: S11 with costs scaled to index level", VARS[2][2], [5, 3]), mk("nolimit", "S11 live rule without loss limit (not possible)", VARS[3][2], [2, 3], 1.2)];
  const opt = (yfmt, ymin, ymax) => ({ responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "nearest", axis: "x", intersect: false }, parsing: false,
    plugins: { legend: { labels: { color: tx, boxWidth: 18, font: { size: 12 } } }, tooltip: { callbacks: { title: (it) => fD(D.dates[it[0].dataIndex]), label: (it) => it.dataset.label + ": " + yfmt(it.parsed.y) } }, decimation: { enabled: false } },
    scales: { x: { type: "linear", min: 2012, max: 2027, ticks: { color: mu, stepSize: 1, callback: (v) => (v >= 2012 && v <= 2026 ? String(v) : ""), maxRotation: 0 }, grid: { color: bd } }, y: { min: ymin, max: ymax, ticks: { color: mu, callback: (v) => yfmt(v) }, grid: { color: bd } } } });
  CH.push(new Chart(cv, { type: "line", data: { datasets: ds }, plugins: [zero], options: opt((v) => fE(v), -9000, 30000) }));
  const dd = (key) => { let pk = -1e18; return D.series[key].map((y, i) => { pk = Math.max(pk, y); return { x: X[i], y: pk > 0 ? Math.max(-100, (y / pk - 1) * 100) : 0 }; }); };
  const dsd = [["acwi", "MSCI ACWI IMI", "#ffffff", [], 2.2], ["live", "S11 live rule", VARS[0][2], [], 2.2], ["pct5", "S11 5% of balance", VARS[1][2], [], 1.6], ["scaled", "What-if: costs scaled", VARS[2][2], [5, 3], 1.6]].map((a) => ({ label: a[1], data: dd(a[0]), borderColor: a[2], backgroundColor: a[2], borderDash: a[3], borderWidth: a[4], pointRadius: 0, pointHoverRadius: 3, tension: 0, parsing: false }));
  CH.push(new Chart(cv2, { type: "line", data: { datasets: dsd }, options: opt((v) => (v > 0 ? "" : v.toFixed(0) + "%"), -105, 2) }));
}

function yearsCard() {
  const h = H.h, c = H.card("Year by year", "Profit or loss in each calendar year, in euros and as a share of the balance at the start of that year. 2012 starts on 23 Jan and 2026 ends on 2 Nov. S11 lines below are the three with a loss limit.");
  const ys = Object.keys(D.stats.acwi.years), rows = ys.map((y) => {
    const f = (k) => { const e = D.stats[k].years[y]; return e.pct == null ? { t: "–", cls: "mut" } : { t: fS(e.eur, 0) + " (" + fP(e.pct, 0) + ")", cls: e.eur >= 0 ? "pos" : "neg" }; };
    return [y, f("acwi"), f("live"), f("pct5"), f("scaled")];
  });
  c.appendChild(H.table(["Year", "MSCI ACWI IMI", "S11 live rule (stops at €0)", "S11 5% of balance", "What-if: costs scaled"], rows, { num: [1, 2, 3, 4] }));
  const nl = D.stats.nolimit.years; c.appendChild(h("p", { class: "cap" }, "After 2013 the live-rule account is at €0, so later years show no result (–). The same S11 trades without a loss limit made " + ["2012", "2013", "2014", "2015", "2016", "2017"].map((y) => fS(nl[y].eur, 0) + " in " + y).join(", ") + ", and a profit in every year from 2018 to 2026."));
  return c;
}

// ---------------------------------------------------------------- replay
function vt() { return TD.variants[S.variant]; }
function curRow(k) { if (k < 1) return null; const i = k - 1, r = TD.trades[i], m = vt()[i]; return { i, r, k: m[0], pnl: m[1], bal: m[2] }; }
let RP = null;
function replayCard() {
  const h = H.h, N = TD.trades.length;
  const c = H.card("Replay every S11 trade on the €5,000 balance", "Press play. The top chart is the Nasdaq-100 (daily close) with an arrow at every entry (blue up = long, amber down = short; hollow = signal not taken because the account had stopped). The bottom chart is the account balance growing or shrinking trade by trade. Drag the slider to jump to any trade.");
  const sel = (label, opts, val, fn) => h("label", { class: "f" }, label, h("select", { onchange: (e) => fn(e.target.value) }, opts.map((o) => h("option", { value: o[0], selected: String(o[0]) === String(val) }, o[1]))));
  const cv = h("canvas", { style: "width:100%;height:540px;display:block;background:var(--panel2);border:1px solid var(--border);border-radius:10px" });
  const slider = h("input", { type: "range", min: "0", max: String(N), value: String(S.k), "aria-label": "Replay position (trade number)" });
  const play = h("button", { class: "b pri", type: "button" }, "Play");
  const read = h("div", { class: "grid g4", style: "margin-top:8px" });
  const line = h("div", { class: "readout" });
  RP = { cv, slider, play, read, line, N };
  c.appendChild(h("div", { class: "row" }, sel("Account rule", VARS.map((x) => [x[0], x[1]]), S.variant, (x) => { S.variant = x; S.tpage = 0; S.tsort = "n"; redrawAll(); }),
    sel("View", [["all", "Whole period 2012–2026"], ["follow", "Follow the current trade (14 months)"]], S.view, (x) => { S.view = x; draw(); })));
  c.appendChild(h("p", { class: "small", style: "margin:2px 0" }, "Under the live rule the account stops on " + fD(TD.ruin.live) + " and the later signals are shown hollow (not taken). To keep watching all 2,562 trades, pick “without the loss limit” or “costs scaled” in Account rule."));
  c.appendChild(h("div", { class: "row" }, play, h("button", { class: "b", type: "button", onclick: () => { stopTimer(); S.k = 0; syncUI(); } }, "Restart"), h("button", { class: "b", type: "button", onclick: () => { stopTimer(); S.k = N; syncUI(); } }, "Show all"),
    h("button", { class: "b", type: "button", onclick: () => { stopTimer(); S.k = Math.max(0, S.k - 1); syncUI(); } }, "◀ Prev trade"), h("button", { class: "b", type: "button", onclick: () => { stopTimer(); S.k = Math.min(N, S.k + 1); syncUI(); } }, "Next trade ▶"),
    sel("Speed", SPEEDS.map((x, i) => [i, x[0]]), S.speed, (x) => { S.speed = +x; })));
  c.appendChild(slider); c.appendChild(cv); c.appendChild(line); c.appendChild(read);
  slider.addEventListener("input", (e) => { stopTimer(); S.k = +e.target.value; syncUI(true); });
  play.onclick = () => {
    if (S.playing) { stopTimer(); syncUI(); return; }
    if (S.k >= N) S.k = 0; S.playing = true; let acc = 0, last = performance.now();
    timer = setInterval(() => { const now = performance.now(); acc += ((now - last) / 1000) * SPEEDS[S.speed][1]; last = now; const st = Math.floor(acc); if (st >= 1) { acc -= st; S.k = Math.min(N, S.k + st); if (S.k >= N) stopTimer(); syncUI(); } }, 50);
    syncUI();
  };
  window.addEventListener("resize", onResize);
  setTimeout(() => syncUI(), 0);
  return c;
}
function onResize() { if (RP && RP.cv.isConnected) draw(); }
function syncUI(fromSlider) {
  if (!RP || !RP.cv.isConnected) { stopTimer(); return; }
  if (!fromSlider) RP.slider.value = String(S.k);
  RP.play.textContent = S.playing ? "Pause" : "Play";
  const cur = curRow(S.k), h = H.h, b0 = TD.start;
  if (!cur) { RP.line.textContent = "Start of the replay: €5,000 on " + fD(D.start) + ", no trade yet (" + RP.N.toLocaleString("en-US") + " signals to come)."; RP.read.innerHTML = ""; }
  else {
    const r = cur.r, taken = cur.k > 0, ruin = TD.ruin[S.variant];
    RP.line.textContent = "Trade " + (cur.i + 1).toLocaleString("en-US") + " of " + RP.N.toLocaleString("en-US") + (taken ? "" : " (not taken: the account has stopped)") + " · balance " + fE(cur.bal, 2) + " · " + fS(cur.bal - b0, 2) + " since the start" + (ruin && r[0] >= ruin ? " · account stopped on " + fD(ruin) : "");
    RP.read.innerHTML = "";
    const M = (v, l, d, t) => RP.read.appendChild(H.metric(v, l, d, t));
    M(fD(r[0]) + ", " + r[1], "Date and entry time (Madrid)", "Exit about " + r[2] + " Madrid · " + WHY[r[8]].toLowerCase());
    M(r[3] > 0 ? "Long (buy)" : "Short (sell)", "Side", "Stop " + r[9].toFixed(2) + "% away, target 2× that", r[3] > 0 ? "pos" : "warn");
    M(fPx(r[4]), "Entry price", "Stop " + fPx(r[5]) + " · target " + fPx(r[6]));
    M(fPx(r[7]), "Exit price", WHY[r[8]] + (r[8] === 1 ? " hit" : r[8] === 0 ? " hit" : ""));
    M(taken ? String(cur.k) : "0", "Micro Nasdaq contracts", taken ? "" : "no trade");
    M(taken ? fS(cur.pnl, 2) : "–", "Result of this trade", "after slippage, commission, in €", taken ? (cur.pnl >= 0 ? "pos" : "neg") : "");
    M(fE(cur.bal, 2), "Balance after this trade", fS(cur.bal - b0, 2) + " vs €5,000", cur.bal >= b0 ? "pos" : "neg");
    const wins = (() => { let w = 0, n = 0; const v = vt(); for (let i = 0; i < S.k; i++) if (v[i][0] > 0) { n++; if (v[i][1] > 0) w++; } return [w, n]; })();
    M(wins[1] ? Math.round((100 * wins[0]) / wins[1]) + "%" : "–", "Win rate so far", wins[0] + " wins of " + wins[1] + " trades taken");
  }
  draw();
}
function redrawAll() { stopTimer(); const v = document.getElementById("view"); if (v) { const y = window.scrollY; v.innerHTML = ""; render(v, H); window.scrollTo(0, y); } }

function draw() {
  if (!RP) return; const cv = RP.cv, dpr = window.devicePixelRatio || 1, W = cv.clientWidth, Ht = cv.clientHeight; if (!W) return;
  cv.width = Math.round(W * dpr); cv.height = Math.round(Ht * dpr); const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Ht);
  const mu = css("--muted"), bd = css("--border"), tx = css("--text"), grn = css("--green"), red = css("--red"), blue = css("--blue"), amb = css("--amber");
  const L = 62, R = 12, T1 = 14, H1 = Math.round(Ht * 0.55) - 20, T2 = T1 + H1 + 34, H2 = Ht - T2 - 24, k = S.k, tr = TD.trades, bals = vt(), N = tr.length;
  const tcur = k > 0 ? ms(tr[k - 1][0]) : ms(D.start);
  let x0 = ms(D.start) - 20 * 864e5, x1 = ms(D.end) + 20 * 864e5;
  if (S.view === "follow") { x0 = tcur - 400 * 864e5; x1 = tcur + 30 * 864e5; }
  const xs = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  // ---- price panel
  let pmin = 1e12, pmax = 0; const pt = PR.t, pc = PR.close;
  let a = 0, b = pt.length - 1; while (a < pt.length && pt[a] < x0) a++; while (b > 0 && pt[b] > x1) b--;
  for (let i = Math.max(0, a - 1); i <= Math.min(pt.length - 1, b + 1); i++) { if (pc[i] < pmin) pmin = pc[i]; if (pc[i] > pmax) pmax = pc[i]; }
  if (S.view === "follow") for (let i = Math.max(0, k - 80); i < k; i++) { pmin = Math.min(pmin, tr[i][5], tr[i][6]); pmax = Math.max(pmax, tr[i][5], tr[i][6]); }
  const lp0 = Math.log(pmin * 0.97), lp1 = Math.log(pmax * 1.03), ys = (p) => T1 + ((lp1 - Math.log(p)) / (lp1 - lp0)) * H1;
  g.font = "11px system-ui"; g.textBaseline = "middle";
  const grid = (T, Hh, ticks, fmt, ymap) => { g.strokeStyle = bd; g.fillStyle = mu; g.lineWidth = 1; g.textAlign = "right"; ticks.forEach((v) => { const y = ymap(v); if (y < T - 1 || y > T + Hh + 1) return; g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke(); g.fillText(fmt(v), L - 6, y); }); };
  const pt_ticks = []; { const nice = [1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 40000]; nice.forEach((v) => { if (v >= pmin * 0.97 && v <= pmax * 1.03) pt_ticks.push(v); }); if (pt_ticks.length < 2) { pt_ticks.push(Math.round(pmin / 100) * 100, Math.round(pmax / 100) * 100); } }
  grid(T1, H1, pt_ticks, (v) => v.toLocaleString("en-US"), ys);
  // x ticks
  g.textAlign = "center"; g.fillStyle = mu; const yrs = (x1 - x0) / (365 * 864e5), stepY = yrs > 8 ? 2 : 1;
  for (let y = 2012; y <= 2027; y += 1) { const t = Date.UTC(y, 0, 1); if (t < x0 || t > x1) continue; if (S.view === "all" && (y - 2012) % stepY) continue; const x = xs(t); g.strokeStyle = bd; g.beginPath(); g.moveTo(x, T1); g.lineTo(x, T2 + H2); g.stroke(); g.fillText(String(y), x, T2 + H2 + 12); if (S.view === "follow") { for (let m = 3; m < 12; m += 3) { const tm = Date.UTC(y, m, 1); if (tm > x0 && tm < x1) g.fillText(MON[m], xs(tm), T2 + H2 + 12); } } }
  g.fillStyle = mu; g.textAlign = "left"; g.fillText("Nasdaq-100 (daily close, log scale)", L + 4, T1 + 8);
  // price line: dim future, bright past
  g.lineWidth = 1.2; let started = false; g.beginPath(); for (let i = 0; i < pt.length; i++) { if (pt[i] > tcur) break; const x = xs(pt[i]); if (x < L - 5 || x > W - R + 5) { started = false; continue; } const y = ys(pc[i]); if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); } g.strokeStyle = tx; g.stroke();
  g.beginPath(); started = false; for (let i = 0; i < pt.length; i++) { if (pt[i] < tcur) continue; const x = xs(pt[i]); if (x < L - 5 || x > W - R + 5) { started = false; continue; } const y = ys(pc[i]); if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); } g.strokeStyle = bd; g.lineWidth = 1; g.stroke();
  // trade markers
  const sz = S.view === "all" ? 2.6 : 4.2;
  g.save(); g.beginPath(); g.rect(L, T1, W - L - R, H1); g.clip();
  for (let i = 0; i < k; i++) { const r = tr[i], x = xs(ms(r[0])); if (x < L - 6 || x > W - R + 6) continue; const taken = bals[i][0] > 0, y = ys(r[4]); g.beginPath(); if (r[3] > 0) { g.moveTo(x, y - sz); g.lineTo(x - sz, y + sz); g.lineTo(x + sz, y + sz); } else { g.moveTo(x, y + sz); g.lineTo(x - sz, y - sz); g.lineTo(x + sz, y - sz); } g.closePath();
    if (taken) { g.fillStyle = r[3] > 0 ? blue : amb; g.globalAlpha = S.view === "all" ? 0.75 : 0.95; g.fill(); g.globalAlpha = 1; if (S.view === "follow") { g.strokeStyle = bals[i][1] >= 0 ? grn : red; g.lineWidth = 1.2; g.stroke(); } } else { g.strokeStyle = mu; g.lineWidth = 0.8; g.stroke(); } }
  if (k > 0) { const r = tr[k - 1], m = bals[k - 1], x = xs(ms(r[0])), wd = S.view === "all" ? 0 : 26; if (S.view === "follow") { const ye = ys(r[4]), yst = ys(r[5]), ytg = ys(r[6]); g.fillStyle = "rgba(240,96,90,.25)"; g.fillRect(x - wd, Math.min(ye, yst), wd * 2, Math.abs(yst - ye)); g.fillStyle = "rgba(63,185,122,.25)"; g.fillRect(x - wd, Math.min(ye, ytg), wd * 2, Math.abs(ytg - ye)); const yx = ys(r[7]); g.strokeStyle = tx; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - wd, yx); g.lineTo(x + wd, yx); g.stroke(); }
    g.strokeStyle = tx; g.lineWidth = 1.6; g.beginPath(); g.arc(x, ys(r[4]), S.view === "all" ? 6 : 9, 0, 6.2832); g.stroke(); }
  g.restore();
  // ---- balance panel
  const pts = []; for (let i = 0; i < k; i++) pts.push([ms(tr[i][0]), Math.max(bals[i][2], -1e9)]);
  let bmin, bmax; if (S.view === "all") { bmin = Math.min(0, TD.start); bmax = TD.start; const v = vt(); for (let i = 0; i < N; i++) { bmax = Math.max(bmax, v[i][2]); bmin = Math.min(bmin, v[i][2]); } } else { bmin = 1e12; bmax = -1e12; for (const p of pts) if (p[0] >= x0 && p[0] <= x1) { bmax = Math.max(bmax, p[1]); bmin = Math.min(bmin, p[1]); } if (bmax < bmin) { bmin = TD.start * 0.9; bmax = TD.start * 1.1; } }
  if (bmax - bmin < 600) { const mid = (bmax + bmin) / 2; bmax = mid + 300; bmin = mid - 300; } const pad = (bmax - bmin) * 0.08 + 50; bmax += pad; bmin -= pad; if (S.view === "all" && bmin > -pad && bmin < 0) bmin = -pad; const yb = (v) => T2 + ((bmax - v) / (bmax - bmin)) * H2;
  const bt = []; const rng = bmax - bmin, raw = rng / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), stp = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) || raw; for (let v = Math.ceil(bmin / stp) * stp; v <= bmax; v += stp) bt.push(v);
  grid(T2, H2, bt, (v) => fE(v), yb);
  g.fillStyle = mu; g.textAlign = "left"; g.fillText("Account balance (€)", L + 4, T2 + 8);
  [[0, red, "€0: the €5,000 is gone", [6, 4]], [TD.start, mu, "€5,000 start", [2, 4]]].forEach((l) => { const y = yb(l[0]); if (y < T2 || y > T2 + H2) return; g.strokeStyle = l[1]; g.setLineDash(l[3]); g.lineWidth = 1.3; g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke(); g.setLineDash([]); g.fillStyle = l[1]; g.textAlign = "right"; g.fillText(l[2], W - R - 4, y - 7); });
  g.save(); g.beginPath(); g.rect(L, T2 - 2, W - L - R, H2 + 4); g.clip();
  g.beginPath(); g.moveTo(xs(ms(D.start)), yb(TD.start)); for (const p of pts) { g.lineTo(xs(p[0]), yb(p[1])); } g.strokeStyle = VARS.find((x) => x[0] === S.variant)[2]; g.lineWidth = 1.8; g.stroke();
  if (k > 0) { const p = pts[k - 1], x = xs(p[0]), y = yb(p[1]); g.beginPath(); g.arc(x, y, 5, 0, 6.2832); g.fillStyle = p[1] >= TD.start ? grn : red; g.fill(); g.strokeStyle = tx; g.lineWidth = 1.2; g.stroke(); }
  const ru = TD.ruin[S.variant]; if (ru && ms(ru) <= tcur) { const x = xs(ms(ru)); g.strokeStyle = red; g.lineWidth = 1.2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, T1); g.lineTo(x, T2 + H2); g.stroke(); g.setLineDash([]); g.fillStyle = red; g.textAlign = x > W - 160 ? "right" : "left"; g.fillText("stopped " + fD(ru), x + (x > W - 160 ? -4 : 4), T1 + 22); }
  g.restore();
  // legend
  g.textAlign = "right"; g.fillStyle = blue; g.fillText("▲ long", W - R - 120, T1 + 8); g.fillStyle = amb; g.fillText("▼ short", W - R - 70, T1 + 8); g.fillStyle = mu; g.fillText("○ not taken", W - R - 4, T1 + 8);
}

// ---------------------------------------------------------------- table
function rowsFor() {
  const v = vt(), tr = TD.trades, out = [];
  for (let i = 0; i < tr.length; i++) {
    const r = tr[i], m = v[i];
    if (S.ty !== "All" && r[0].slice(0, 4) !== S.ty) continue;
    if (S.tside !== "All" && (S.tside === "Long") !== (r[3] > 0)) continue;
    if (S.tres === "Wins" && !(m[0] > 0 && m[1] > 0)) continue; if (S.tres === "Losses" && !(m[0] > 0 && m[1] <= 0)) continue; if (S.tres === "Not taken" && m[0] > 0) continue;
    out.push(i);
  }
  const key = { n: (i) => i, date: (i) => i, time: (i) => tr[i][1], side: (i) => tr[i][3], entry: (i) => tr[i][4], exit: (i) => tr[i][7], why: (i) => tr[i][8], k: (i) => v[i][0], pnl: (i) => v[i][1], bal: (i) => v[i][2] }[S.tsort] || ((i) => i);
  out.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : a - b) * S.tdir; });
  return out;
}
function csvFor(variant) {
  const v = TD.variants[variant], tr = TD.trades, L = ["n,date,entry_time_madrid,exit_time_madrid,side,entry_price,stop,target,exit_price,exit_reason,contracts,pnl_eur,balance_eur,traded"];
  for (let i = 0; i < tr.length; i++) { const r = tr[i], m = v[i]; L.push([i + 1, r[0], r[1], r[2], r[3] > 0 ? "long" : "short", r[4], r[5], r[6], r[7], ["stop", "target", "60-min/close"][r[8]], m[0], m[1], m[2], m[0] > 0 ? "yes" : "no (account stopped)"].join(",")); }
  return L.join("\n") + "\n";
}
function tableCard() {
  const h = H.h, c = H.card("All S11 trades on the €5,000 account", "Every one of the 2,562 signals from 23 Jan 2012 to 2 Nov 2026, with the balance after each. Click a column title to sort; filter by year, side or result. Times are Madrid time (US open 09:30 New York = 15:30 Madrid, or 14:30 in the weeks when the US and Europe change clocks on different dates). Prices are Nasdaq-100 index points before slippage; the € result is after 1 tick slippage and $0.94 commission per side.");
  const box = h("div"), info = h("div", { class: "small" }), pager = h("div", { class: "row" });
  const years = ["All"]; for (let y = 2012; y <= 2026; y++) years.push(String(y));
  const sel = (label, opts, val, fn) => h("label", { class: "f" }, label, h("select", { onchange: (e) => { fn(e.target.value); S.tpage = 0; fill(); } }, opts.map((o) => h("option", { value: o, selected: o === val }, o))));
  c.appendChild(h("div", { class: "row" }, h("label", { class: "f" }, "Account rule", h("select", { onchange: (e) => { S.variant = e.target.value; S.tpage = 0; redrawAll(); } }, VARS.map((x) => h("option", { value: x[0], selected: x[0] === S.variant }, x[1])))),
    sel("Year", years, S.ty, (x) => (S.ty = x)), sel("Side", ["All", "Long", "Short"], S.tside, (x) => (S.tside = x)), sel("Result", ["All", "Wins", "Losses", "Not taken"], S.tres, (x) => (S.tres = x)),
    h("button", { class: "b pri", type: "button", onclick: () => dl(csvFor(S.variant), "s11_trades_2012_2026_" + S.variant + ".csv") }, "Download CSV (all trades, this rule)")));
  c.appendChild(info); c.appendChild(box); c.appendChild(pager);
  c.appendChild(h("p", { class: "small" }, "Also available as a static file: ", h("a", { href: BASE + "s11_trades_2012_2026_live_rule.csv", download: "" }, "s11_trades_2012_2026_live_rule.csv"), " (live rule)."));
  const cols = [["n", "#", 1], ["date", "Date", 0], ["time", "Entry (Madrid)", 0], ["side", "Side", 0], ["entry", "Entry price", 1], ["exit", "Exit price", 1], ["why", "Exit reason", 0], ["k", "Contracts", 1], ["pnl", "P&L €", 1], ["bal", "Balance €", 1]];
  function fill() {
    const idx = rowsFor(), pages = Math.max(1, Math.ceil(idx.length / PAGE)); if (S.tpage >= pages) S.tpage = pages - 1; const v = vt(), tr = TD.trades, sl = idx.slice(S.tpage * PAGE, S.tpage * PAGE + PAGE);
    const tot = idx.reduce((s, i) => s + v[i][1], 0), taken = idx.filter((i) => v[i][0] > 0), wins = taken.filter((i) => v[i][1] > 0).length;
    info.textContent = idx.length.toLocaleString("en-US") + " signals shown · " + taken.length.toLocaleString("en-US") + " taken, " + wins + " wins" + (taken.length ? " (" + Math.round((100 * wins) / taken.length) + "%)" : "") + " · total " + fS(tot, 2) + " · rule: " + VN[S.variant];
    const thead = h("tr", null, cols.map((x) => h("th", { class: x[2] ? "n" : "", style: "cursor:pointer", title: "Sort", onclick: () => { if (S.tsort === x[0]) S.tdir *= -1; else { S.tsort = x[0]; S.tdir = 1; } S.tpage = 0; fill(); } }, x[1] + (S.tsort === x[0] ? (S.tdir > 0 ? " ▲" : " ▼") : ""))));
    const body = sl.map((i) => { const r = tr[i], m = v[i], tk = m[0] > 0; return h("tr", { style: tk ? "" : "opacity:.5" }, h("td", { class: "n" }, String(i + 1)), h("td", null, fD(r[0])), h("td", null, r[1]), h("td", { class: r[3] > 0 ? "pos" : "warn" }, r[3] > 0 ? "Long" : "Short"), h("td", { class: "n" }, fPx(r[4])), h("td", { class: "n" }, fPx(r[7])), h("td", null, WHY[r[8]]),
      h("td", { class: "n" }, tk ? String(m[0]) : "–"), h("td", { class: "n " + (tk ? (m[1] >= 0 ? "pos" : "neg") : "mut") }, tk ? fS(m[1], 2) : "not taken"), h("td", { class: "n" }, fE(m[2], 2))); });
    box.innerHTML = ""; box.appendChild(h("div", { class: "tw" }, h("table", null, h("thead", null, thead), h("tbody", null, body))));
    pager.innerHTML = ""; const go = (p) => () => { S.tpage = Math.max(0, Math.min(pages - 1, p)); fill(); };
    pager.append(h("button", { class: "b", type: "button", onclick: go(0) }, "« First"), h("button", { class: "b", type: "button", onclick: go(S.tpage - 1) }, "‹ Prev"), h("span", { class: "small" }, "Page " + (S.tpage + 1) + " of " + pages), h("button", { class: "b", type: "button", onclick: go(S.tpage + 1) }, "Next ›"), h("button", { class: "b", type: "button", onclick: go(pages - 1) }, "Last »"));
  }
  fill(); return c;
}
function dl(text, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

// ---------------------------------------------------------------- accuracy
function accuracyCard() {
  const h = H.h, x = D.extra, d = dt("live"), A = sv("acwi");
  const c = H.card("How accurate is this backtest, really?", "Plain-language answer, with numbers where we have them.");
  c.appendChild(H.callout("Verdict. The trading rules are reproduced exactly: every stored 2018–2026 trade (1,540 of 1,540) came out identical when rebuilt, and the practice trades so far (3 of 3 for S11) took the same side, minute and exit type as the backtest. The euro amounts are less certain. The backtest assumes only 1 tick of slippage, one fixed euro rate, no margin limit and fills at index-CFD prices; the practice trades are simulated from a live price feed, not real broker fills, so they cannot show true slippage, and they differ from the backtest by a few euros to about €20 per trade on other strategies. S11 was also picked as the best of 21 strategies using 2024–26 data. So trust the direction (a small edge since 2018) more than the amounts, and treat 2012–2017 as a warning that the edge is thin.", "info"));
  c.appendChild(h("h3", { style: "margin-top:14px" }, "What matches"));
  c.appendChild(H.table(["Check", "Result", "How much it proves"], [
    ["Rebuilt backtest vs the stored 2018–2026 backtest", "1,540 of 1,540 trades identical (side, entry, exit). One extra trade, 2 Jan 2018, appears only because the 2017 data now supplies the prior day's range.", "The code does what the earlier tests did; it does not prove the rules are right."],
    ["Practice trades vs backtest (S11)", "3 of 3 identical: 29 Oct (replayed), 30 Oct, 2 Nov. S11's 30 Oct trade lost −€131.32 live and −€130.69 in the futures engine (difference €0.63).", "Only 3 trades, far too few to measure how big the live gap really is."],
    ["Whole practice set vs backtest, same session", "30 Oct: 4 of 5 signals identical, and the 5-trade set lost −€251.54 live vs −€233.99 in the engine (−€17.55; −€17.40 of it from one strategy entering 5 minutes early). 2 Nov: 5 of 5 identical; set −€190.04 practice vs −€173.50 (−€16.54, mostly one stop that came out about 11 index points worse than in the backtest, about €20 for one contract, from the QQQ-to-index conversion).", "Shows the size of price-feed gaps: roughly €17 on a day with 4–5 trades. These were other strategies, not S11. The practice account is simulated from a live price feed (QQQ converted to index points), so it has no real broker fills."],
    ["QQQ (live feed) vs the index CFD used in the backtest", "Same decision on 35 of 35 common trades over 58 sessions at 5-minute resolution, return correlation 0.99.", "Good, but 5-minute resolution only."],
  ], {}));
  c.appendChild(h("h3", { style: "margin-top:14px" }, "Known gaps (what the backtest does not capture)"));
  const gap = (t, b) => h("li", null, h("b", null, t + " "), b);
  c.appendChild(h("ul", { class: "cap", style: "line-height:1.55" },
    gap("Slippage is 1 tick (0.25 points) on entries and on every exit except a take-profit.", "Real market orders in fast moves can fill worse, and we have no real broker fills yet to measure it. Earlier research on 2024–26 put S11's break-even cost at about 0.0227% of price per side (95% range 0.012–0.033%, about 5 index points then). At today's index level (about 28,000) the assumed cost is only about 0.0026% per side, so there is a lot of room; in 2012 (index about 2,650) the same fixed commission and tick were about 0.027% per side, above that break-even, which is why 2012–2017 lose."),
    gap("Costs hit early years hardest.", "The Nasdaq-100 was 2,650–5,800 in 2012–2017, so €300 of risk meant 10–27 MNQ contracts and a fixed $0.94 commission plus 1 tick took a much larger share of each trade (0.036% of price against an average gross gain of 0.027% per trade). That is why 2012–2017 lose money here. In the cost-scaled what-if the same trades make +€24,616 in 2012–2017, but that is our own cross-check, not a real cost model."),
    gap("MNQ did not exist before May 2019.", "Before that, the 'Micro Nasdaq' result is hypothetical: the same $2-per-point contract applied to the index level. The 2012–2018 commission schedule is also unknown; the 2026 NinjaTrader schedule is used for all years."),
    gap("Fixed euro rate.", "All years convert at EURUSD 1.1130 (29 Oct 2026). The real rate moved between " + D.fx_note.actual_min.toFixed(2) + " and " + D.fx_note.actual_max.toFixed(2) + " in this period. Re-running the live rule with each day's real EURUSD gives the same outcome (balance " + fE(x.fx_live.final, 2) + " in 2013, essentially wiped out by " + fD(x.fx_below50) + ") and, without a loss limit, +€" + Math.round(x.fx_nolimit.final - 5000).toLocaleString("en-US") + " instead of +€" + Math.round(D.detail.nolimit.sum_pnl).toLocaleString("en-US") + "."),
    gap("Prices are an index CFD, not real futures.", "Dukascopy 1-minute Nasdaq-100 CFD bars, not the CME contract: no contract rolls or futures basis, and minutes with no trades are filled with the previous price. Sessions with fewer than 300 one-minute bars (half days) are dropped."),
    gap("Fills inside one-minute bars.", "If a stop and a target are both touched in the same minute, the stop is assumed first (the cautious choice). A stop jumped over by a gap fills at the next open. No news filter and no slippage widening for news."),
    gap("No margin limit.", "The live-rule account averaged " + d.avg_contracts.toFixed(0) + " contracts per trade and used up to " + d.max_contracts + " in 2012–2013. A real broker's margin on a €5,000 account may well have refused orders that large; margin is not modelled, so the true 2012–13 result could be even worse or the trades smaller."),
    gap("Selection bias.", "S11 was the best of 21 rules on 2024–26. After correcting for the 21 tries, its before-cost edge on that sample was significant (adjusted p = 0.015), but after a small 0.01%-per-side cost it was not (p 0.35–0.50 on that sample alone). Two later checks help: 2018–23 (not used to choose it) was positive after costs, and the 2012–17 stretch tested here is a new, honest out-of-sample test. There, the entry/exit rule had a small positive edge before costs (t-statistic 3.2) but lost money after real MNQ costs."),
    gap("Short history of live trades.", "Only 3 S11 practice trades exist so far. The pre-registered live test needs about 250 trades before a first verdict.")));
  c.appendChild(h("h3", { style: "margin-top:14px" }, "What this means for a €5,000 account"));
  c.appendChild(H.table(["Question", "Answer"], [
    ["Does the rule make money over 14 years?", "Yes, before an account limit: +€32,567 on 2,562 trades (48.0% wins, profit factor 1.12) with fixed €300 risk and real MNQ costs, but it needed " + fE(sv("nolimit").max_dd_eur) + " of drawdown room (2012 to 2017), almost three times a €5,000 account."],
    ["Would a €5,000 account with the €5,000 loss limit have survived?", "Not if started 23 Jan 2012 (wiped out " + fD(d.ruin) + "). Started 1 Jan 2015: wiped out " + fD(x.from2015.ruin) + ". Started 1 Jan 2018: " + fE(x.from2018.final) + " on 2 Nov 2026, lowest balance " + fE(x.from2018.low) + ". Started 1 Jan 2024: " + fE(x.from2024.final) + "."],
    ["Is 5% of the balance safer?", "It never hit €0, but it ended at " + fE(sv("pct5").final) + " (−91%): after losses, 5% of the balance was too small for even one contract at today's index levels, so " + dt("pct5").skipped_size.toLocaleString("en-US") + " later signals were skipped and the account never recovered. The last trade it took was 31 Jan 2017."],
    ["Versus the global index fund?", "MSCI ACWI IMI turned €5,000 into " + fE(A.final) + " (" + fP(A.cagr) + " a year) with a worst fall of " + A.max_dd_pct.toFixed(0) + "% (Feb–Mar 2020) and a worst year of " + fP(A.worst_year_pct) + " (" + A.worst_year + "). Over the full period it beat the live S11 account by far, and S11's extra edge since 2018 does not make up for its first years."],
  ], {}));
  return c;
}

// ---------------------------------------------------------------- method
function methodCard() {
  const h = H.h, ex = D.example, c = H.card("Exactly how we did it", "Every step below is what the code does. Practice and research only: no broker, no real order.");
  const steps = [
    ["1. Data", "Dukascopy 1-minute Nasdaq-100 index CFD (USATECH.IDX/USD), 19 Jan 2012 to 2 Nov 2026. Regular US session only (09:30–16:00 New York). Days with under 300 minute bars are dropped. Dukascopy's data starts in 2012, so 2005–2011 cannot be tested."],
    ["2. Signal", "Each day: range R = yesterday's high minus low. Level = today's 09:30 open ± 0.5 × R. The first 1-minute close beyond the level (from 09:35 to 15:00 New York) is the signal: above = long, below = short. At most one trade a day."],
    ["3. Entry and stop", "Entry at the open of the next minute. Stop distance = 0.25 × R as a share of price, kept between 0.25% and 0.50%. Target = twice the stop distance."],
    ["4. Exit", "First of: stop touched (a gap fills at the next open), target touched (stop first if both in one minute), 60 minutes after entry, or the 15:59 close."],
    ["5. Size", "Contracts = whole number of Micro Nasdaq (MNQ, $2 per index point) contracts so that the loss at the stop is at most the risk: fixed €300 (live rule) or 5% of the current balance (compounding variant), and never more than the money left. If one contract risks more, the signal is skipped."],
    ["6. Costs and euros", "1 tick (0.25 points = $0.50) slippage on the entry and on every exit except a target; $0.94 commission per contract per side; profit converted to euros at EURUSD 1.1130."],
    ["7. Loss limit", "Balance starts at €5,000. When it falls to €0 or below, the account stops trading for good (ruin). No money is added, no margin limit is modelled."],
    ["8. Compare", "MSCI ACWI IMI net total return index in EUR, daily levels, €5,000 bought at the 23 Jan 2012 close and held to 2 Nov 2026. CAGR uses 14.78 years; drawdowns use daily closes."],
  ];
  const flow = h("div", { class: "grid g4" }, steps.map((s) => h("div", { class: "metric" }, h("div", { class: "l", style: "font-weight:650;color:var(--text);font-size:14px" }, s[0]), h("div", { class: "d", style: "font-size:13px;line-height:1.45;margin-top:4px" }, s[1]))));
  c.appendChild(flow);
  const risk = ex.per_contract_risk, gross = Math.abs(ex.exit - ex.entry);
  c.appendChild(h("h3", { style: "margin-top:14px" }, "Worked example: the very first trade, " + fD(ex.day)));
  c.appendChild(h("p", { class: "cap", style: "line-height:1.6" }, "A long entry at " + fPx(ex.entry) + " with a stop " + (ex.sd * 100).toFixed(2) + "% away: one contract risks " + ex.sd * 100 + "% × " + fPx(ex.entry) + " × $2 ÷ 1.1130 = " + fE(risk, 2) + ", so €300 buys " + ex.k + " contracts (⌊300 ÷ " + risk.toFixed(2) + "⌋). The target (twice the stop distance) at " + fPx(ex.exit) + " was hit: (" + gross.toFixed(2) + " points − 0.25 slippage on the entry) × $2 − $1.88 commission = $22.04 per contract, × " + ex.k + " contracts ÷ 1.1130 = " + fS(ex.pnl, 2) + ". The balance goes from €5,000.00 to " + fE(5000 + ex.pnl, 2) + "."));
  const L = D.acwi_levels;
  c.appendChild(h("h3", { style: "margin-top:14px" }, "The comparison series"));
  c.appendChild(h("p", { class: "cap", style: "line-height:1.6" }, "MSCI ACWI IMI Index (MSCI index code 664204), net total return (dividends reinvested after withholding tax), in EUR, daily closing levels from MSCI's public index-level service (app2.msci.com). Level " + L.first.toFixed(2) + " on " + fD(L.first_date) + " and " + L.last.toFixed(2) + " on " + fD(L.last_date) + " (× " + (L.last / L.first).toFixed(2) + "), 3,856 trading days. It is an index, not a fund: no fund fee, no tracking difference, no trading cost, so a real ETF would be slightly lower. Cross-check: the SPDR MSCI ACWI IMI UCITS ETF on Xetra (SPYI.DE, in EUR, trading since May 2011) grew × 5.38 from 1 Feb 2012 to 2 Nov 2026 against × 5.25 for the index over the same dates. I did not use the ETF for the numbers because its Yahoo price history has stale and alternating prints in 2011 and mid-2017."));
  c.appendChild(h("h3", { style: "margin-top:14px" }, "Files"));
  c.appendChild(h("p", { class: "cap" }, "Trades and balances: data/s11bt/s11_trades.json · daily balances and statistics: data/s11bt/s11_vs_acwi.json · Nasdaq-100 daily closes for the replay: data/s11bt/s11_price_daily.json · CSV: data/s11bt/s11_trades_2012_2026_live_rule.csv. Past results do not predict the future; this is a simulation."));
  return c;
}

window.S11BT = { render, load };
})();
