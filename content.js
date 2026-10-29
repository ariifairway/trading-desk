// Static text content (copied from the canvas dashboard)
const GATE_NAMES = ["Trade count", "Random entries", "Nudged copies", "Confidence interval", "K-fold by time", "Cross-market"];
const GATE_RULES = ["At least 100 trades", "Real €/trade beats 95% of 10,000 random-entry runs", "At least 70% of copies with parameters moved ±10–20% still profitable", "95% interval of €/trade (bootstrap over days) stays above 0", "At least 4 of 6 equal time folds profitable", "Profitable on at least 2 of the 3 markets run alone"];
const GATE_PLAIN = ["Too few trades and one lucky streak can look like skill. Under 100 trades the average result is too uncertain to trust.", "Same exits and sizes, but entries at random times and directions. If random entries do as well, the entry signal adds nothing.", "Tweaks every key setting a little. A strategy that only works at one exact setting is probably fitted to the past.", "How far the average result per trade could be off by luck. If the low end is below zero, 'no edge' cannot be ruled out.", "Cuts the 34 months into 6 equal periods. A real edge should not live in one or two good periods only.", "Runs the same rule on each market alone. An edge that exists on only one market is more likely luck."];
const SCHEDULE_NOTE = "Times in Madrid time. The US stock market is open 14:30–21:00 this week (EU clocks changed on 25 Oct, US clocks change on 1 Nov) and 15:30–22:00 from 2 Nov.";
const DESK = [
  ["Chart Analyst", "Reads charts and checks the strategy logic behind a trade idea"],
  ["News Watch", "Watches news and the economic calendar; keeps the list of big releases that the simulation avoids"],
  ["Risk Check", "Checks every plan against the risk rules (€25 risk, 10 trades a day, daily stop)"],
  ["Trade Auditor", "Checks the mechanics of a plan before it goes out: size, stop, target, costs"],
  ["Devil's Advocate", "Argues against the idea: a logic and sanity check"],
];
const LOG = [
  ["27 Oct", "Round 1", "9 intraday ideas on Yahoo data (VWAP, gap fade, opening range, sweep and more) with many exit rules", "Everything lost on the design data. Only the prior-day high/low sweep looked promising on a holdout: +€112 at 0.01% on 39 trades, but 90% of that profit came from 3 trades."],
  ["27 Oct", "Round 2", "Two years of Dukascopy data; v5.3 and new ideas, then one look at a held-out period (Feb–Jul 2026)", "v5.3 failed on the holdout (−€166 / −€135). v5.4 (sweep with a strong close, 09:40–10:30 New York, minimum stop 0.16%, trailing stop) made +€49.7 / +€6.3 on 38 trades: the best found, not a proven edge."],
  ["27 Oct", "Rounds 3–4", "Walk-forward tests (learn on 6 months, test on 3) and filters for v5.4", "v5.4 made +€489.5 / +€359.1 on 87 trades in 7 test windows (6 of 7 positive), but its early windows were in-sample. Filters on the opening gap and on the first-15-minute range were tested."],
  ["27 Oct", "Rounds 5–7", "Exits that let winners run, locked candidates, new families", "Version L7 (wide first 15 minutes, half off at +0.5R, rest to 1.2R) won 78.7% of 61 trades in the walk-forward test windows (+€249 / +€147, 7 of 10 windows positive). It became track B, run side by side with A."],
  ["27–28 Oct", "Rounds 7–12", "More families (for example prior-week sweeps) and forward checks", "Prior-week sweeps lost (−€223 to −€288). No new candidate; forward checks showed no live signal on 28 Oct, and live matched the engine."],
  ["28 Oct", "High-frequency search", "73 signal rules × 10 exit sets on 34 months, every candidate needing at least 1,400 trades", "740 runs with at least 1,400 trades: none profitable at 0.01% or 0.02%. The signals have a gross edge of about €0.6 a trade, while costs take €2–4 a trade."],
  ["28 Oct", "Round 13", "First forward score", "No engine trade on 28 Oct for any locked variant; the live tracks agreed."],
  ["29 Oct", "High-frequency round 2", "19,456 more runs: wide stops, scale-outs, regime filters", "None with at least 1,400 trades was profitable at 0.01% (best −€327). Profitable only at a hypothetical 0.005%. About 21,500 runs in total, so any winner is probably luck."],
  ["29 Oct", "Track C added", "Breakout mix (opening-range breaks plus an overnight fade), 1,585 trades in the history", "+€48.9 at 0.01% and −€1,403 at 0.02%, win rate about 49%: about break-even, so it measures live behaviour and costs."],
  ["29 Oct", "Monte Carlo", "20,000 reshuffled paths per track", "At 0.01% over the full history: A profitable in 93% of paths, B in 99%, C in 47% (evening-overnight version) or 58% (the live-style version used on this site). It shows luck, not edge."],
  ["29 Oct", "Round 18", "Six validation gates and the combined portfolio P", "No track passes all six gates. P is not better than A or B alone and is mostly track C. Details are in the Robustness tests and Backtest replay tabs."],
];
const COMMON = [
  { label: "Risk per trade", value: "€25 (5% of the account), size capped at 20× leverage" },
  { label: "Entries", value: "Signal bar ending 09:40 to 10:30 New York time, one position at a time, max 10 trades a day" },
  { label: "Daily stop", value: "−€75 or 3 losing trades" },
  { label: "Max hold", value: "30 minutes" },
  { label: "News", value: "No entries from 35 minutes before to 30 minutes after big releases" },
];
const RULES = {
  A: [
    { label: "Setup", value: "Sweep and reclaim of the prior day's high or low with a strong close back inside (S&P 500 and Nasdaq-100); skips quiet markets" },
    { label: "Exit", value: "Target 2 times the risk; stop moves to break-even once up half the risk, then trails after 1 times the risk" },
    ...COMMON,
    { label: "Account brake", value: "Stops trading below €350" },
  ],
  B: [
    { label: "Setup", value: "Same sweep and reclaim as track A, only on days when the first 15 minutes (09:30–09:45) moved more than the 20-day median" },
    { label: "Exit", value: "Half closed at +0.5 times the risk, stop on the rest moves to break-even, rest targets 1.2 times the risk; no trailing stop" },
    ...COMMON,
    { label: "Account brake", value: "Stops trading below €350" },
  ],
  C: [
    { label: "Setup", value: "Breakouts of the opening range (first 5 and 15 minutes) in the direction of the opening gap, repeated up to 6 times a day; plus a fade of a sweep of the overnight high or low on quiet days (S&P 500, Nasdaq-100, gold)" },
    { label: "Exit", value: "Fixed stop 0.5% from entry, target 3 times the risk; stop to break-even at +1 times the risk, then trails behind the best price after +1.5 times the risk" },
    { label: "Risk per trade", value: "€25 (5% of the account), size capped at 20× leverage" },
    { label: "Entries", value: "Signal bar ending 09:35 to 14:55 New York time, one position at a time, max 10 trades a day" },
    { label: "Daily stop", value: "−€75 or 3 losing trades" },
    { label: "Max hold", value: "60 minutes" },
    { label: "News", value: "No entries from 65 minutes before to 30 minutes after big releases" },
    { label: "Account brake", value: "None, so trades keep accumulating" },
  ],
  P: [
    { label: "Setup", value: "Takes the signals of A, B and C; when two fire in the same minute, B comes before A before C" },
    { label: "Risk per trade", value: "€25, cut when a correlated position is open so the combined risk stays within €37.5 (S&P 500 and Nasdaq-100 move together at 0.95, gold at about 0.2 with both); a trade below €5 of risk is skipped" },
    { label: "Positions", value: "One position per market, up to 3 at once" },
    { label: "Daily limits", value: "Max 10 trades a day for the whole portfolio, stop at −€75 or 3 losing trades" },
    { label: "Exits and hold", value: "Each trade follows the exit rules and hold time of the track it came from (30 or 60 minutes)" },
    { label: "Account brake", value: "None" },
  ],
};
