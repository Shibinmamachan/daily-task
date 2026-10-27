import { useMemo, useState } from "react";
import { addReminder, deleteReminder, updateReminder } from "./api.js";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const when = (r) => new Date(`${r.date}T${r.time || "09:00"}`);

function downloadIcs(r) {
  const start = when(r), end = new Date(start.getTime() + 3600000);
  const esc = (t) => String(t || "").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Money Dashboard//EN", "BEGIN:VEVENT",
    `UID:${r._id}@money-dashboard`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(r.title)}`, `DESCRIPTION:${esc(r.notes)}`,
    "BEGIN:VALARM", `TRIGGER:-PT${r.remindBefore || 0}M`, "ACTION:DISPLAY", `DESCRIPTION:${esc(r.title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = `${r.title.replace(/\W+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Upcoming({ reminders, onPick }) {
  const now = new Date();
  const list = reminders.filter((r) => !r.done && when(r) >= new Date(now.getTime() - 3600000)).sort((a, b) => when(a) - when(b)).slice(0, 5);
  if (!list.length) return <p className="muted">No upcoming bookings or reminders.</p>;
  return list.map((r) => (
    <button key={r._id} className="up" onClick={() => onPick(r.date)}>
      <span className="badge blue">{r.type}</span>
      <span className="upt">{r.title}</span>
      <small className="muted">{r.date} · {r.time}</small>
    </button>
  ));
}

export default function Calendar({ tx, reminders, fmt, reload, initialDate }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(initialDate || Date.now()); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(initialDate || iso(new Date()));
  const [f, setF] = useState({ title: "", type: "booking", time: "09:00", remindBefore: 30, notes: "" });
  const [perm, setPerm] = useState("Notification" in window ? Notification.permission : "unsupported");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const y = cursor.getFullYear(), m = cursor.getMonth(), today = iso(new Date());
  const cells = useMemo(() => {
    const arr = Array(new Date(y, m, 1).getDay()).fill(null);
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) arr.push(new Date(y, m, d));
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [y, m]);

  const money = useMemo(() => {
    const o = {};
    tx.forEach((t) => { const r = (o[t.date] ||= { inc: 0, exp: 0 }); t.type === "income" ? (r.inc += t.amount) : (r.exp += t.amount); });
    return o;
  }, [tx]);
  const byDate = useMemo(() => {
    const o = {};
    reminders.forEach((r) => (o[r.date] ||= []).push(r));
    Object.values(o).forEach((a) => a.sort((p, q) => (p.time > q.time ? 1 : -1)));
    return o;
  }, [reminders]);

  const dayRem = byDate[sel] || [];
  const dayTx = tx.filter((t) => t.date === sel);
  const dm = money[sel] || { inc: 0, exp: 0 };

  const submit = async (e) => {
    e.preventDefault();
    await addReminder({ ...f, date: sel, remindBefore: Number(f.remindBefore) || 0 });
    setF({ ...f, title: "", notes: "" });
    reload();
  };
  const ask = async () => setPerm(await Notification.requestPermission());
  const go = (n) => setCursor(new Date(y, m + n, 1));

  return (
    <>
      <section className="panel">
        <div className="rhead">
          <div className="mnav">
            <button className="ghost" onClick={() => go(-1)} aria-label="Previous month">‹</button>
            <h2>{MONTHS[m]} {y}</h2>
            <button className="ghost" onClick={() => go(1)} aria-label="Next month">›</button>
            <button className="ghost" onClick={() => { setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSel(today); }}>Today</button>
          </div>
          {perm === "default" && <button className="ghost" onClick={ask}>Enable reminder notifications</button>}
          {perm === "denied" && <small className="muted">Notifications are blocked in your browser settings.</small>}
        </div>

        <div className="cal">
          {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="blank" />;
            const k = iso(d), rs = byDate[k] || [], mo = money[k];
            return (
              <button key={k} className={`day ${k === sel ? "sel" : ""} ${k === today ? "today" : ""}`} onClick={() => setSel(k)} aria-label={k}>
                <span className="dn">{d.getDate()}</span>
                {rs.slice(0, 2).map((r) => <span key={r._id} className={`chip ${r.done ? "done" : ""}`}>{r.time} {r.title}</span>)}
                {rs.length > 2 && <span className="chip more">+{rs.length - 2} more</span>}
                {rs.length > 0 && <span className="rdot" />}
                {mo && <span className="dots">{mo.inc > 0 && <i className="d inc" />}{mo.exp > 0 && <i className="d exp" />}</span>}
              </button>
            );
          })}
        </div>
        <div className="key"><span className="pos">● Income</span><span className="neg">● Expense</span><span className="blue">● Booking / reminder</span></div>
      </section>

      <section className="panel">
        <h2>{new Date(sel + "T00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
        <p className="muted">Income {fmt(dm.inc)} · Expenses {fmt(dm.exp)} · Net <span className={dm.inc - dm.exp >= 0 ? "pos" : "neg"}>{fmt(dm.inc - dm.exp)}</span></p>

        <h3>Bookings &amp; reminders</h3>
        {dayRem.length === 0 && <p className="empty">Nothing scheduled. Add one below.</p>}
        {dayRem.map((r) => (
          <div className="tx" key={r._id}>
            <input type="checkbox" className="chk" checked={r.done} onChange={() => updateReminder(r._id, { done: !r.done }).then(reload)} aria-label="Mark done" />
            <div className="m">
              <div style={{ textDecoration: r.done ? "line-through" : "none" }}>{r.time} · {r.title}</div>
              <small>{r.type}{r.remindBefore ? ` · reminds ${r.remindBefore} min before` : ""}{r.notes ? ` · ${r.notes}` : ""}</small>
            </div>
            <button className="del" onClick={() => downloadIcs(r)}>Add to phone calendar</button>
            <button className="del" onClick={() => deleteReminder(r._id).then(reload)} aria-label="Delete">Delete</button>
          </div>
        ))}

        <form onSubmit={submit} className="rform">
          <input className="w6" placeholder="Title (e.g. Hotel booking, Pay rent)" required value={f.title} onChange={set("title")} />
          <select value={f.type} onChange={set("type")} aria-label="Type"><option value="booking">Booking</option><option value="reminder">Reminder</option><option value="bill">Bill due</option></select>
          <input type="time" required value={f.time} onChange={set("time")} aria-label="Time" />
          <select value={f.remindBefore} onChange={set("remindBefore")} aria-label="Remind me">
            <option value="0">At the time</option><option value="15">15 min before</option><option value="30">30 min before</option>
            <option value="60">1 hour before</option><option value="1440">1 day before</option>
          </select>
          <input className="w6" placeholder="Notes (optional)" value={f.notes} onChange={set("notes")} />
          <button className="add w6" type="submit">Add to {sel}</button>
        </form>

        {dayTx.length > 0 && (
          <>
            <h3>Money on this day</h3>
            {dayTx.map((t) => (
              <div className="tx" key={t._id}>
                <div className="m"><div>{t.category}{t.note ? ` · ${t.note}` : ""}</div></div>
                <span className={`amt ${t.type === "income" ? "pos" : "neg"}`}>{t.type === "income" ? "+" : "−"}{fmt(t.amount).replace("−", "")}</span>
              </div>
            ))}
          </>
        )}
      </section>
    </>
  );
}
