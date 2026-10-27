import { useEffect, useMemo, useRef, useState } from "react";
import Reports from "./Reports.jsx";
import Calendar, { Upcoming } from "./Calendar.jsx";
import { Analytics, Sparkline, buildFlow } from "./Charts.jsx";
import { getTransactions, addTransaction, deleteTransaction, getReminders, updateReminder } from "./api.js";

const VIEWS = [["dashboard", "Dashboard"], ["transactions", "Transactions"], ["reports", "Reports"], ["calendar", "Calendar"]];
const TITLES = { dashboard: "My money dashboard", transactions: "Transactions", reports: "Reports & analysis", calendar: "Calendar & reminders" };

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ym = (d) => d.slice(0, 7);
const mlabel = (k) => { const [y, m] = k.split("-"); return `${MN[+m - 1]} ${y}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function App({ user, onLogout }) {
  const [tx, setTx] = useState([]);
  const [cur, setCur] = useState(localStorage.getItem("cur") || "₹");
  const [month, setMonth] = useState(ym(todayStr()));
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "income", amount: "", category: "", date: todayStr(), note: "" });

  const [view, setView] = useState(() => { const h = location.hash.slice(1); return VIEWS.some(([k]) => k === h) ? h : "dashboard"; });
  const [reminders, setReminders] = useState([]);
  const [due, setDue] = useState([]);
  const [calDate, setCalDate] = useState(null);
  const fired = useRef(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("theme", theme); }, [theme]);
  const go = (v) => { setView(v); location.hash = v; window.scrollTo(0, 0); };
  const loadR = () => getReminders().then(setReminders).catch(() => {});
  useEffect(() => { loadR(); }, []);

  // Fire reminders while the app is open
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      reminders.forEach((r) => {
        if (r.notified || r.done || fired.current.has(r._id)) return;
        const at = new Date(`${r.date}T${r.time || "09:00"}`).getTime() - (r.remindBefore || 0) * 60000;
        if (at > now) return;
        fired.current.add(r._id);
        updateReminder(r._id, { notified: true }).then(loadR);
        if (at < now - 86400000) return; // older than a day: don't alert
        setDue((d) => [...d, r]);
        if ("Notification" in window && Notification.permission === "granted")
          new Notification(r.title, { body: `${r.type} · ${r.date} ${r.time}` });
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [reminders]);

  const load = () => getTransactions().then(setTx).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem("cur", cur); }, [cur]);

  const fmt = (n) =>
    (n < 0 ? "−" : "") + cur + Math.abs(n).toLocaleString(cur === "₹" ? "en-IN" : "en-US", { maximumFractionDigits: 2 });

  const months = useMemo(() => {
    const s = new Set([ym(todayStr()), ...tx.map((t) => ym(t.date))]);
    return [...s].sort().reverse();
  }, [tx]);

  const rows = tx.filter((t) => month === "all" || ym(t.date) === month);
  const income = rows.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const expense = rows.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const net = income - expense;
  const spark = buildFlow(rows, month).map((f) => f.run);

  const byCat = useMemo(() => {
    const m = {};
    rows.filter((t) => t.type === "expense").forEach((t) => (m[t.category] = (m[t.category] || 0) + t.amount));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const trend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inM = tx.filter((t) => ym(t.date) === k);
      return {
        label: MN[d.getMonth()],
        inc: inM.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0),
        exp: inM.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0),
      };
    });
  }, [tx]);
  const max = Math.max(1, ...trend.flatMap((m) => [m.inc, m.exp]));

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      await addTransaction({ ...form, amount: parseFloat(form.amount) });
      setForm({ ...form, amount: "", category: "", note: "" });
      setMonth(ym(form.date)); setShowAdd(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (id) => { await deleteTransaction(id); load(); };

  const formEl = (
      <section className="panel">
        <h2>Add a transaction</h2>
        <form onSubmit={submit}>
          <div className="seg w6">
            {["income", "expense"].map((t) => (
              <label key={t} className={form.type === t ? "on" : ""}>
                <input type="radio" name="type" value={t} checked={form.type === t} onChange={set("type")} />
                {t === "income" ? "Income" : "Expense"}
              </label>
            ))}
          </div>
          <input type="number" min="0.01" step="0.01" placeholder="Amount" required value={form.amount} onChange={set("amount")} />
          <input list="cats" placeholder="Category (e.g. Salary, Rent)" required value={form.category} onChange={set("category")} />
          <datalist id="cats">{[...new Set(tx.map((t) => t.category))].map((c) => <option key={c} value={c} />)}</datalist>
          <input type="date" required value={form.date} onChange={set("date")} />
          <input className="w3" placeholder="Note (optional)" value={form.note} onChange={set("note")} />
          <button className="add w3" type="submit">Add transaction</button>
        </form>
      </section>

  );

  return (
    <>
    <nav className="topbar">
      <div className="topin">
        <strong className="brand">💰 Money</strong>
        <div className="links">
          {VIEWS.map(([k, n]) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => { if (k === "calendar") setCalDate(null); go(k); }}>
              {n}{k === "calendar" && due.length > 0 && <span className="pill">{due.length}</span>}
            </button>
          ))}
        </div>
        <button className="theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle dark mode">{theme === "dark" ? "☀️" : "🌙"}</button>
        <span className="who" title={user.email}>{user.name}</span>
        <button className="ghost" onClick={onLogout}>Log out</button>
      </div>
    </nav>
    {due.length > 0 && (
      <div className="toasts" role="alert">
        {due.map((r) => (
          <div className="toast" key={r._id}>
            <div><b>{r.title}</b><br /><small>{r.type} · {r.date} {r.time}</small></div>
            <button className="del" onClick={() => setDue((d) => d.filter((x) => x._id !== r._id))}>Dismiss</button>
          </div>
        ))}
      </div>
    )}
    {(view === "dashboard" || view === "reports") && <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add transaction">+</button>}
    {showAdd && (
      <div className="overlay" onClick={() => setShowAdd(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="x" onClick={() => setShowAdd(false)} aria-label="Close">✕</button>
          {formEl}
        </div>
      </div>
    )}
    <div className="wrap">
      <header>
        <h1>{TITLES[view]}</h1>
        <div className="ctl">
          {(view === "dashboard" || view === "transactions") && (<select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
            <option value="all">All time</option>
            {months.map((m) => <option key={m} value={m}>{mlabel(m)}</option>)}
          </select>)}
          <select value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Currency">
            {["₹", "$", "€", "£", "AED"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </header>

      {error && <p className="err">{error}</p>}

      {view === "dashboard" && (
        <>
      <section className={`hero ${net > 0 ? "profit" : net < 0 ? "loss" : ""}`}>
        <div className="hl">
          <small>{net < 0 ? "Net loss" : "Net profit"} · {month === "all" ? "All time" : mlabel(month)}</small>
          <div className="hbig">{fmt(net)}</div>
          <span className="htag">{net > 0 ? "▲ Profit" : net < 0 ? "▼ Loss" : "Break-even"}</span>
          {income > 0 && <span className="htag">Savings rate {Math.round((net / income) * 100)}%</span>}
        </div>
        <Sparkline values={spark} />
      </section>

      <div className="row">
        <div className="stat i"><span>Income</span><b>{fmt(income)}</b></div>
        <div className="stat e"><span>Expenses</span><b>{fmt(expense)}</b></div>
      </div>

      <Analytics rows={rows} month={month} fmt={fmt} />

      <section className="panel">
        <h2>Upcoming bookings &amp; reminders</h2>
        <Upcoming reminders={reminders} onPick={(d) => { setCalDate(d); go("calendar"); }} />
      </section>
        </>
      )}

      {view === "transactions" && (
        <>
      {formEl}

      <section className="panel">
        <h2>Transactions</h2>
        {rows.length === 0 && <p className="empty">Nothing here yet. Add your first income or expense above.</p>}
        {rows.map((t) => (
          <div className="tx" key={t._id}>
            <div className="m">
              <div>{t.category}{t.note ? ` · ${t.note}` : ""}</div>
              <small>{t.date}</small>
            </div>
            <span className={`amt ${t.type === "income" ? "pos" : "neg"}`}>{t.type === "income" ? "+" : "−"}{fmt(t.amount).replace("−", "")}</span>
            <button className="del" onClick={() => remove(t._id)} aria-label="Delete transaction">Delete</button>
          </div>
        ))}
      </section>
        </>
      )}

      {view === "reports" && <Reports tx={tx} fmt={fmt} cur={cur} />}

      {view === "calendar" && <Calendar key={calDate || "now"} tx={tx} reminders={reminders} fmt={fmt} reload={loadR} initialDate={calDate} />}
    </div>
    </>
  );
}
