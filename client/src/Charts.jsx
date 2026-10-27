import { useId, useMemo, useState } from "react";

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = (n) => String(n).padStart(2, "0");
export const PALETTE = ["#0F7B6C","#2B6CB0","#B4325A","#D69E2E","#7C5CBF","#DD6B20","#319795","#5A67D8","#C05621","#718096"];

/** Daily points for a chosen month, monthly points for "all". Adds running balance. */
export function buildFlow(rows, month) {
  const map = {};
  if (month !== "all") {
    const [y, m] = month.split("-").map(Number);
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
      const k = `${month}-${pad(d)}`;
      map[k] = { key: k, label: String(d), inc: 0, exp: 0 };
    }
  }
  rows.forEach((t) => {
    const k = month === "all" ? t.date.slice(0, 7) : t.date;
    const label = month === "all" ? `${MN[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}` : k.slice(8);
    const r = (map[k] ||= { key: k, label, inc: 0, exp: 0 });
    if (t.type === "income") r.inc += t.amount; else r.exp += t.amount;
  });
  let run = 0;
  return Object.keys(map).sort().map((k) => { const r = map[k]; run += r.inc - r.exp; return { ...r, net: r.inc - r.exp, run }; });
}

export function Sparkline({ values }) {
  if (values.length < 2) return null;
  const mx = Math.max(...values), mn = Math.min(...values), rg = mx - mn || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 200, 70 - ((v - mn) / rg) * 60]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L200 80 L0 80 Z`} fill="rgba(255,255,255,.16)" />
      <path d={line} fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Donut({ data, fmt, empty = "No data for this period." }) {
  const [act, setAct] = useState(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <p className="empty">{empty}</p>;
  const r = 70, C = 2 * Math.PI * r;
  let off = 0;
  const segs = data.map((d, i) => {
    const len = (d.value / total) * C;
    const s = { ...d, len, off, i, color: d.color || PALETTE[i % PALETTE.length] };
    off += len;
    return s;
  });
  const a = act !== null ? segs[act] : null;
  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" className="dsvg" role="img" aria-label="Pie chart">
        <g transform="rotate(-90 100 100)">
          {segs.map((s) => (
            <circle key={s.name} cx="100" cy="100" r={r} fill="none" stroke={s.color}
              strokeWidth={act === s.i ? 34 : 26} strokeDasharray={`${Math.max(s.len - 1.5, 0.5)} ${C}`} strokeDashoffset={-s.off}
              style={{ transition: "stroke-width .15s, opacity .15s", cursor: "pointer", opacity: act === null || act === s.i ? 1 : 0.3 }}
              onMouseEnter={() => setAct(s.i)} onMouseLeave={() => setAct(null)} onClick={() => setAct(act === s.i ? null : s.i)} />
          ))}
        </g>
        <text x="100" y="92" textAnchor="middle" className="c1">{a ? (a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name) : "Total"}</text>
        <text x="100" y="112" textAnchor="middle" className="c2">{fmt(a ? a.value : total)}</text>
        <text x="100" y="128" textAnchor="middle" className="c1">{a ? `${Math.round((a.value / total) * 100)}%` : `${data.length} items`}</text>
      </svg>
      <ul className="legend">
        {segs.map((s) => (
          <li key={s.name}>
            <button className={act === s.i ? "on" : ""} onMouseEnter={() => setAct(s.i)} onMouseLeave={() => setAct(null)} onFocus={() => setAct(s.i)} onBlur={() => setAct(null)}>
              <i className="sw" style={{ background: s.color }} />
              <span className="ln">{s.name}</span>
              <span className="lv">{fmt(s.value)} · {Math.round((s.value / total) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({ labels, series, fmt, height = 240 }) {
  const uid = useId().replace(/:/g, "");
  const [hi, setHi] = useState(null);
  const W = 640, H = height, pl = 8, pr = 8, pt = 14, pb = 26, n = labels.length;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all), min = Math.min(0, ...all);
  const x = (i) => (n < 2 ? W / 2 : pl + (i * (W - pl - pr)) / (n - 1));
  const y = (v) => pt + ((max - v) / (max - min || 1)) * (H - pt - pb);
  const path = (s) => s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const move = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * W;
    setHi(Math.max(0, Math.min(n - 1, Math.round((px - pl) / ((W - pl - pr) / (n - 1 || 1))))));
  };
  const step = Math.ceil(n / 10), pc = hi === null ? 0 : (x(hi) / W) * 100;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);
  return (
    <div className="lc">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line graph" onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHi(null)} style={{ touchAction: "pan-y" }}>
        <defs>
          {series.map((s, k) => (
            <linearGradient key={k} id={`${uid}${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: s.color, stopOpacity: 0.28 }} />
              <stop offset="1" style={{ stopColor: s.color, stopOpacity: 0 }} />
            </linearGradient>
          ))}
        </defs>
        {grid.map((g, i) => <line key={i} x1={pl} x2={W - pr} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray={g === 0 ? "0" : "3 4"} />)}
        {series.map((s, k) => n > 1 && <path key={"a" + k} d={`${path(s)} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${uid}${k})`} />)}
        {series.map((s, k) => <path key={k} d={path(s)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
        {labels.map((l, i) => i % step === 0 && <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
        {hi !== null && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={pt} y2={H - pb} stroke="var(--muted)" strokeDasharray="3 3" />
            {series.map((s, k) => <circle key={k} cx={x(hi)} cy={y(s.values[hi])} r="5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {hi !== null && (
        <div className="tip" style={{ left: `${pc}%`, transform: pc < 18 ? "none" : pc > 82 ? "translateX(-100%)" : "translateX(-50%)" }}>
          <b>{labels[hi]}</b>
          {series.map((s) => <div key={s.name}><i className="sw" style={{ background: s.color }} /> {s.name}: {fmt(s.values[hi])}</div>)}
        </div>
      )}
    </div>
  );
}

export function Analytics({ rows, month, fmt }) {
  const [mode, setMode] = useState("flow");
  const flow = useMemo(() => buildFlow(rows, month), [rows, month]);
  const group = (type) => {
    const m = {};
    rows.filter((t) => t.type === type).forEach((t) => (m[t.category] = (m[t.category] || 0) + t.amount));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  };
  const exp = group("expense"), inc = group("income");
  const series = mode === "flow"
    ? [{ name: "Income", color: "var(--inc)", values: flow.map((f) => f.inc) }, { name: "Expenses", color: "var(--exp)", values: flow.map((f) => f.exp) }]
    : [{ name: "Running balance", color: "var(--blue)", values: flow.map((f) => f.run) }];
  return (
    <>
      <section className="panel">
        <div className="rhead">
          <h2>Cash flow {month === "all" ? "by month" : "by day"}</h2>
          <div className="tabs">
            <button className={mode === "flow" ? "on" : ""} onClick={() => setMode("flow")}>Income &amp; expenses</button>
            <button className={mode === "run" ? "on" : ""} onClick={() => setMode("run")}>Running balance</button>
          </div>
        </div>
        <LineChart labels={flow.map((f) => f.label)} series={series} fmt={fmt} />
        <p className="muted">Hover or touch the graph to see exact values.</p>
      </section>
      <div className="grid">
        <section className="panel"><h2>Expenses by category</h2><Donut data={exp} fmt={fmt} empty="No expenses in this period." /></section>
        <section className="panel"><h2>Income by source</h2><Donut data={inc} fmt={fmt} empty="No income in this period." /></section>
      </div>
    </>
  );
}
