import { useMemo, useState } from "react";
import { LineChart, Donut } from "./Charts.jsx";
import { downloadReport } from "./api.js";

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const KINDS = {
  day:   { name: "Daily",   sub: "Last 30 days",   cut: 10, prev: "yesterday" },
  month: { name: "Monthly", sub: "Last 12 months", cut: 7,  prev: "last month" },
  year:  { name: "Yearly",  sub: "All years",      cut: 4,  prev: "last year" },
};

function label(kind, k) {
  if (kind === "day") { const [, m, d] = k.split("-"); return `${+d} ${MN[+m - 1]}`; }
  if (kind === "month") { const [y, m] = k.split("-"); return `${MN[+m - 1]} ${y.slice(2)}`; }
  return k;
}

function buildKeys(kind, tx) {
  const now = new Date(), keys = [];
  if (kind === "day") for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); keys.push(iso(d)); }
  if (kind === "month") for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
  if (kind === "year") {
    const first = Math.min(now.getFullYear() - 1, ...tx.map((t) => +t.date.slice(0, 4)));
    for (let y = first; y <= now.getFullYear(); y++) keys.push(String(y));
  }
  return keys;
}

function BarChart({ data, series, fmt }) {
  const n = data.length, slot = 44, W = Math.max(640, n * slot), H = 220, top = 12, bot = 26;
  const all = data.flatMap((d) => series.map((s) => d[s.key]));
  const max = Math.max(1, ...all), min = Math.min(0, ...all);
  const y = (v) => top + ((max - v) / (max - min || 1)) * (H - top - bot);
  const bw = Math.min(16, (slot - 10) / series.length), step = Math.ceil(n / 15);
  return (
    <div className="scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        {data.map((d, i) => (
          <g key={d.key}>
            {series.map((s, j) => {
              const v = d[s.key], y0 = y(0), y1 = y(v);
              const x = i * slot + (slot - bw * series.length) / 2 + j * bw;
              return (
                <rect key={s.key} x={x} y={Math.min(y0, y1)} width={bw - 1} height={Math.abs(y1 - y0) || 1} rx="2"
                  fill={s.color || (v >= 0 ? "var(--inc)" : "var(--exp)")}>
                  <title>{`${d.label} · ${s.name}: ${fmt(v)}`}</title>
                </rect>
              );
            })}
            {i % step === 0 && <text x={i * slot + slot / 2} y={H - 8} textAnchor="middle">{d.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

const pct = (cur, prev) => (prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

function Delta({ cur, prev, goodUp = true }) {
  const p = pct(cur, prev);
  if (p === null) return <small className="muted">no earlier data</small>;
  const up = p >= 0, good = up === goodUp;
  return <small className={good ? "pos" : "neg"}>{up ? "▲" : "▼"} {Math.abs(p).toFixed(0)}% vs previous</small>;
}

export default function Reports({ tx, fmt, cur }) {
  const [kind, setKind] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");
  const [dlErr, setDlErr] = useState("");
  const dl = async (format, content = "summary") => {
    setBusy(format + content); setDlErr("");
    try { await downloadReport({ format, content, period: kind, from, to, cur }); }
    catch (e) { setDlErr(e.message); }
    finally { setBusy(""); }
  };

  const data = useMemo(() => {
    const keys = buildKeys(kind, tx), map = {};
    keys.forEach((k) => (map[k] = { key: k, label: label(kind, k), inc: 0, exp: 0 }));
    tx.forEach((t) => {
      const r = map[t.date.slice(0, KINDS[kind].cut)];
      if (r) { if (t.type === "income") r.inc += t.amount; else r.exp += t.amount; }
    });
    return keys.map((k) => ({ ...map[k], net: map[k].inc - map[k].exp }));
  }, [tx, kind]);

const currentData = data[data.length - 1],
      prev = data[data.length - 2] || { inc: 0, exp: 0, net: 0 };
  const total = data.reduce((a, d) => ({ inc: a.inc + d.inc, exp: a.exp + d.exp, net: a.net + d.net }), { inc: 0, exp: 0, net: 0 });
  const active = data.filter((d) => d.inc || d.exp);
  const best = active.length ? active.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const worst = active.length ? active.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const profitable = data.filter((d) => d.net > 0).length;
  const lossy = data.filter((d) => d.net < 0).length;

  return (
    <section className="panel">
      <div className="rhead">
        <h2>Reports &amp; analysis</h2>
        <div className="tabs" role="tablist">
          {Object.entries(KINDS).map(([k, v]) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{v.name}</button>
          ))}
        </div>
      </div>
      <p className="muted">{KINDS[kind].sub}</p>

      <div className="dl">
        <div className="dlh"><b>Download report</b><small className="muted">Grouped {kind === "day" ? "daily" : kind === "month" ? "monthly" : "yearly"}. Leave dates empty for everything.</small></div>
        <div className="dlf">
          <label>From<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="dlb">
          {[["pdf", "summary", "PDF report"], ["xlsx", "summary", "Excel workbook"], ["csv", "summary", "CSV summary"], ["csv", "transactions", "CSV transactions"]].map(([f, c, label]) => (
            <button key={f + c} className="ghost" disabled={!!busy} onClick={() => dl(f, c)}>{busy === f + c ? "Preparing…" : `⬇ ${label}`}</button>
          ))}
        </div>
        {dlErr && <small className="neg" role="alert">{dlErr}</small>}
      </div>

      <div className="cmp">
        {[["Income", "inc", true], ["Expenses", "exp", false], ["Profit / loss", "net", true]].map(([name, key, goodUp]) => (
          <div className="cbox" key={key}>
            <span className="muted">{name} · {cur.label}</span>
            <b className={key === "net" ? (cur.net >= 0 ? "pos" : "neg") : ""}>{fmt(cur[key])}</b>
            <Delta cur={cur[key]} prev={prev[key]} goodUp={goodUp} />
          </div>
        ))}
      </div>

      <h3>Income vs expenses</h3>
      <BarChart data={data} fmt={fmt} series={[{ key: "inc", name: "Income", color: "var(--inc)" }, { key: "exp", name: "Expenses", color: "var(--exp)" }]} />
      <div className="key"><span className="pos">■ Income</span><span className="neg">■ Expenses</span></div>

      <h3>Profit / loss</h3>
      <BarChart data={data} fmt={fmt} series={[{ key: "net", name: "Net" }]} />
      <div className="key"><span className="pos">■ Profit</span><span className="neg">■ Loss</span></div>

      <h3>Trend</h3>
      <LineChart labels={data.map((d) => d.label)} fmt={fmt} series={[
        { name: "Income", color: "var(--inc)", values: data.map((d) => d.inc) },
        { name: "Expenses", color: "var(--exp)", values: data.map((d) => d.exp) },
        { name: "Net", color: "var(--blue)", values: data.map((d) => d.net) },
      ]} />
      <div className="key"><span className="pos">● Income</span><span className="neg">● Expenses</span><span className="blue">● Net</span></div>

      <h3>Profit vs loss periods</h3>
      <Donut fmt={(n) => String(n)} data={[
        { name: "Profit", value: profitable, color: "var(--inc)" },
        { name: "Loss", value: lossy, color: "var(--exp)" },
        { name: "No activity / even", value: data.length - profitable - lossy, color: "var(--line)" },
      ].filter((d) => d.value > 0)} />

      <div className="insights">
        <p><b>{profitable}</b> profitable and <b>{lossy}</b> loss-making {kind === "day" ? "days" : kind === "month" ? "months" : "years"} in this range.</p>
        {best && <p>Best: <b>{best.label}</b> ({fmt(best.net)}). Worst: <b>{worst.label}</b> ({fmt(worst.net)}).</p>}
        {active.length > 0 && <p>Average per active {kind}: <b>{fmt(total.net / active.length)}</b>. Savings rate: <b>{total.inc ? Math.round((total.net / total.inc) * 100) : 0}%</b>.</p>}
      </div>

      <div className="scroll">
        <table className="tbl">
          <thead>
            <tr><th>{KINDS[kind].name.replace("ly", "")}</th><th>Income</th><th>Expenses</th><th>Net</th><th>Status</th><th>Savings</th></tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td>{fmt(d.inc)}</td>
                <td>{fmt(d.exp)}</td>
                <td className={d.net > 0 ? "pos" : d.net < 0 ? "neg" : ""}>{fmt(d.net)}</td>
                <td>{d.net > 0 ? <span className="badge pos">Profit</span> : d.net < 0 ? <span className="badge neg">Loss</span> : <span className="badge">{d.inc || d.exp ? "Even" : "—"}</span>}</td>
                <td>{d.inc ? Math.round((d.net / d.inc) * 100) + "%" : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td>{fmt(total.inc)}</td><td>{fmt(total.exp)}</td><td className={total.net >= 0 ? "pos" : "neg"}>{fmt(total.net)}</td><td /><td>{total.inc ? Math.round((total.net / total.inc) * 100) + "%" : "—"}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
