// "Nasdaq 21" tab: 21 rule-based Nasdaq-100 strategies, live practice leaderboard + backtest table + sources. Self-contained module; app.js only calls window.T21.render().
// Data: t21.json (data branch of the GitHub repo, falls back to the copy bundled with the page). Practice only, zero cost in the live accounts.
(function () {
"use strict";
const RAW = "https://raw.githubusercontent.com/ariifairway/trading-desk/data/";
let D = null, err = null, lastOk = 0; const S = { sort: "balance", dir: -1, bt: "rank", btdir: 1 };
async function load() {
  const t = Math.floor(Date.now() / 60000), local = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const src = local ? ["data/t21.json?t=" + t] : [RAW + "t21.json?t=" + t, "data/t21.json?t=" + t]; let e;
  for (const u of src) {
    try { const r = await fetch(u, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); if (D && Date.parse(j.generated_utc) < Date.parse(D.generated_utc)) return; D = j; err = null; lastOk = Date.now(); return; } catch (x) { e = x; }
  }
  err = String(e);
}
function rerender() { if (location.hash.slice(1) === "t21" && window.__t21H) { const v = document.getElementById("view"); if (v) { const y = window.scrollY; v.innerHTML = ""; window.T21.render(v, window.__t21H); window.scrollTo(0, y); } } }
async function tick() { await load(); rerender(); }
setInterval(tick, 60000);
const fmtMad = (iso) => { try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) + " Madrid"; } catch (e) { return iso; } };
function render(v, H) {
  window.__t21H = H; const { h, table, card, metric, callout, pill, fmtEur0, sgn, tone } = H;
  if (!D) { v.appendChild(card("Nasdaq 21", null, h("p", null, err ? "Could not load Nasdaq 21 data: " + err : "Loading…"))); if (!err) load().then(rerender); else load().then(rerender); return; }
  const L = D.live, B = D.backtest;
  const eur = (x) => (x == null ? "–" : (x < 0 ? "−€" : "€") + Math.abs(x).toFixed(2));
  const eur0 = (x) => (x == null ? "–" : fmtEur0(x));
  v.appendChild(card("Nasdaq-100: 21 strategies from well-known traders, funds and papers",
    "From now on the desk trades only the Nasdaq-100. Each of the 21 strategies below is a different published rule set (Crabel, Raschke, Williams, Connors, Bollinger, Carter, Fisher, the Turtles, academic papers…) with its own €500 practice account, €25 risk per trade, 60-minute maximum hold, zero cost and no daily trade cap. Practice only, nothing here places a real order.",
    B ? callout((function () { const n0 = B.strategies.filter((x) => x.c0.total > 0).length, n1 = B.strategies.filter((x) => x.c01.total > 0).length, pr = B.strategies.filter((x) => x.verdict === "promising"); return "Honest read: in the 2024–2026 backtest " + n0 + " of the 21 make money at zero cost, only " + n1 + " still do at 0.01% per side, and " + (pr.length ? pr.length + " (" + pr.map((x) => x.id + " " + x.name).join("; ") + ") is profitable in all three years with a direction signal that beats coin-flips" : "none is clearly robust") + ". Because 21 rules were tested, one apparent winner is partly expected by luck. The live practice below is the real test."; })(), "info") : null));
  // live summary
  if (L) {
    const T = L.totals, sts = L.strategies.slice();
    v.appendChild(card("Live practice leaderboard", "Updated every practice check (about every 5 minutes while the US market is open, 14:30–21:00 Madrid time). Last 1-minute bar used: " + (L.last_bar_madrid || "–") + " Madrid. Live data is QQQ (the Nasdaq-100 ETF) as a stand-in for the NAS100 CFD. Trades before " + fmtMad(L.started_utc) + " were computed from already completed minute bars of 29 Oct (marked 'replayed' in the files).",
      h("div", { class: "grid g4" }, metric(String(T.trades_today), "Trades today", T.open_positions + " open now"), metric(sgn(T.pnl_today), "All 21 accounts today", null, tone(T.pnl_today)),
        metric(sgn(T.pnl), "All 21 accounts since start", T.in_profit + " of 21 above €500", tone(T.pnl)), metric(String(T.trades), "Closed trades since start", "zero cost, no daily cap")),
      (function () {
        const keyf = { id: (x) => x.id, balance: (x) => x.balance, today: (x) => x.pnl_today, trades: (x) => x.trades, tt: (x) => x.trades_today, win: (x) => (x.win_rate == null ? -1 : x.win_rate) };
        sts.sort((a, b) => { const f = keyf[S.sort] || keyf.balance; const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * S.dir; });
        const hd = (label, k) => h("button", { class: "lnk", onclick: () => { if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = -1; } rerender(); }, style: "background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0" }, label + (S.sort === k ? (S.dir < 0 ? " ▼" : " ▲") : ""));
        const rows = sts.map((x, i) => [String(i + 1), h("span", null, h("b", null, x.id), " ", x.name), { t: eur(x.balance), cls: tone(x.balance - 500) }, { t: sgn(x.pnl), cls: tone(x.pnl) }, String(x.trades), String(x.trades_today), x.win_rate == null ? "–" : x.win_rate + "%", { t: sgn(x.pnl_today), cls: tone(x.pnl_today) },
          x.open ? h("span", null, pill(x.open.side, x.open.side === "LONG" ? "ok" : "bad"), " " + x.open.entry + " ", h("span", { class: tone(x.open.open_pnl) }, sgn(x.open.open_pnl))) : h("span", { class: "mut" }, "flat")]);
        const t = table(["#", h("span", null, hd("Strategy", "id")), h("span", null, hd("Balance", "balance")), "Since start", h("span", null, hd("Trades", "trades")), h("span", null, hd("Today", "tt")), h("span", null, hd("Win rate", "win")), h("span", null, hd("P&L today", "today")), "Open trade"], rows, { num: [2, 3, 4, 5, 6, 7] });
        return t;
      })(),
      h("p", { class: "cap", style: "margin-top:8px" }, "Click a column title to sort. 'Balance' is each strategy's own €500 account; a strategy that has not traded yet stays at €500.")));
    const rec = []; sts.forEach((x) => x.recent.slice(0, 2).forEach((r) => rec.push([x.id, r.time, r.side, r.entry + " → " + r.exit + " (" + r.why + ")", { t: sgn(r.pnl), cls: tone(r.pnl) }])));
    if (rec.length) v.appendChild(card("Latest closed trades", null, table(["Strategy", "Closed (Madrid)", "Side", "Entry → exit", "Result"], rec.slice(0, 24), { num: [4] })));
  } else v.appendChild(card("Live practice leaderboard", null, h("p", { class: "mut" }, "The live accounts have not produced data yet.")));
  // backtest
  if (B) {
    const V = { promising: ["Promising", "ok"], marginal: ["Marginal", "warn"], "zero-cost only": ["Zero-cost only", "warn"], "no edge": ["No edge", "bad"] };
    const bs = B.strategies.slice(); const kf = { rank: (x) => x.rank, id: (x) => x.id, trades: (x) => x.trades, win: (x) => x.c0.win, c0: (x) => x.c0.total, c01: (x) => x.c01.total, dd: (x) => x.c0.mdd };
    bs.sort((a, b) => { const f = kf[S.bt] || kf.rank, x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * S.btdir; });
    const bh = (label, k, first) => h("button", { onclick: () => { if (S.bt === k) S.btdir = -S.btdir; else { S.bt = k; S.btdir = first || -1; } rerender(); }, style: "background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0" }, label + (S.bt === k ? (S.btdir < 0 ? " ▼" : " ▲") : ""));
    const yrs = (o) => Object.values(o).map((y) => (y < 0 ? "−" : "+") + Math.round(Math.abs(y))).join(" / ");
    v.appendChild(card("Backtest, " + B.period + " (" + B.sessions + " sessions)", "Dukascopy Nasdaq-100 CFD 1-minute bars, regular US hours. €500 start, €25 risk per trade. Zero cost is the practice setting; 0.01% per side is shown for honesty (a hypothetical cost, not measured at a broker). Same code as the live accounts. The rules were fixed before the results were seen, with one parameter set each.",
      table([bh("Rank", "rank", 1), h("span", null, bh("Strategy", "id", 1)), bh("Trades", "trades"), "A day", bh("Win rate", "win"), bh("Profit, zero cost", "c0"), bh("Profit, 0.01%", "c01"), bh("Worst drop", "dd"), "2024 / 2025 / 2026 at 0.01%", "Real €500 account at 0.01%", "Verdict"],
        bs.map((x) => [String(x.rank), h("span", null, h("b", null, x.id), " ", x.name), String(x.trades), x.per_day.toFixed(2), x.c0.win + "%", { t: eur0(x.c0.total), cls: tone(x.c0.total) }, { t: eur0(x.c01.total), cls: tone(x.c01.total) }, eur0(x.c0.mdd), yrs(x.c01.years), x.c01.blown ? pill("below €50 from " + x.c01.blown, "bad") : h("span", { class: "mut" }, "survives"), pill(V[x.verdict][0], V[x.verdict][1])]), { num: [0, 2, 3, 4, 5, 6, 7] }),
      callout("Every trade risks a fixed €25 here, so the numbers are comparable. Worst drop = biggest fall from a peak of the zero-cost profit curve. Strategies that trade several times a day are hit hard by costs: 0.01% per side is about €1–2 per trade. The long/short split in the table further down shows which side made the money.")));
    const rows2 = B.strategies.slice().sort((a, b) => a.id < b.id ? -1 : 1).map((x) => [x.id, h("span", null, h("b", null, x.name), h("div", { class: "mut", style: "font-size:12.5px" }, x.attr)), h("a", { href: x.link, target: "_blank", rel: "noopener" }, x.who), eur0(x.c0.long_pnl) + " / " + eur0(x.c0.short_pnl), x.null ? (x.null.p_c0 * 100).toFixed(0) + "%" : "–"]);
    v.appendChild(card("Who each strategy comes from", "Where a famous name is only loosely attached, it says so. Click the source link to read the original. 'Long / short' is the zero-cost profit of each side. 'Luck of direction' is the share of 150 re-runs with a coin-flip direction on each signal (same timing, stop and target) that did at least as well at zero cost; under 5% means the direction signal adds something.",
      table(["ID", "Strategy and how direct the attribution is", "Source", "Long / short profit", "Luck of direction"], rows2, { num: [3, 4] })));
    const det = h("div", { class: "rules" });
    B.strategies.slice().sort((a, b) => a.id < b.id ? -1 : 1).forEach((x) => det.appendChild(h("details", { style: "margin:6px 0" }, h("summary", { style: "cursor:pointer" }, h("b", null, x.id + " "), x.name), h("p", { style: "margin:6px 0 2px" }, x.rules), h("p", { class: "mut", style: "margin:2px 0" }, "Exits: " + Object.entries(x.exits).map(([k, p]) => p + "% " + k).join(", ") + ". Average stop " + x.avg_stop_pct + "% of price."))));
    v.appendChild(card("Exact rules", B.common, det));
  }
  v.appendChild(h("p", { class: "mut", style: "font-size:12.5px" }, "Data file generated " + fmtMad(D.generated_utc) + ". Practice only: simulated accounts, no broker, no real order is ever placed."));
}
window.T21 = { render, load, refresh: tick };
load().then(rerender);
})();
