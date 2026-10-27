import { useState } from "react";
import { login, register, resendVerification } from "./api.js";

export default function Auth({ onLogin, notice }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(notice?.text || "");
  const [unverified, setUnverified] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setInfo(""); setUnverified(false); setBusy(true);
    try {
      if (mode === "login") {
        const { token, user } = await login(f.email, f.password);
        onLogin(token, user);
      } else {
        const r = await register(f.name, f.email, f.password);
        setInfo(r.message); setSent(true);
      }
    } catch (ex) {
      setErr(ex.message); setUnverified(ex.code === "UNVERIFIED");
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setErr("");
    try { const r = await resendVerification(f.email); setInfo(r.message); setUnverified(false); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  const switchMode = (m) => { setMode(m); setErr(""); setInfo(""); setSent(false); setUnverified(false); };

  return (
    <div className="auth">
      <aside className="authhero">
        <div>
          <strong className="brand">💰 Money</strong>
          <h1>Know exactly where your money goes.</h1>
          <p>Track income and expenses, see profit or loss by day, month and year, and download clean reports.</p>
        </div>
        <ul>
          <li>Pie charts and trend graphs</li>
          <li>Bookings and bill reminders</li>
          <li>PDF, Excel and CSV reports</li>
        </ul>
      </aside>

      <main className="authform">
        {sent ? (
          <div className="authcard">
            <h2>Check your email</h2>
            <p className="okmsg">{info}</p>
            <p className="muted">Open the link we sent to <b>{f.email}</b> to activate your account. It expires in 24 hours.</p>
            <button className="add" onClick={resend} disabled={busy}>Resend verification email</button>
            <button className="linkbtn" onClick={() => switchMode("login")}>Back to log in</button>
          </div>
        ) : (
          <form className="authcard" onSubmit={submit}>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            {notice && !err && info && <p className={notice.ok ? "okmsg" : "errmsg"}>{info}</p>}
            {err && <p className="errmsg" role="alert">{err}</p>}
            {unverified && <button type="button" className="linkbtn" onClick={resend} disabled={busy}>Resend verification email</button>}
            {info && !notice && <p className="okmsg">{info}</p>}

            {mode === "register" && (
              <label>Name<input required maxLength={60} autoComplete="name" value={f.name} onChange={set("name")} /></label>
            )}
            <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></label>
            <label>Password
              <span className="pw">
                <input type={show ? "text" : "password"} required minLength={mode === "register" ? 8 : undefined}
                  autoComplete={mode === "login" ? "current-password" : "new-password"} value={f.password} onChange={set("password")} />
                <button type="button" className="linkbtn" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
              </span>
              {mode === "register" && <small className="muted">At least 8 characters.</small>}
            </label>

            <button className="add" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
            <p className="muted center">
              {mode === "login" ? "New here? " : "Already have an account? "}
              <button type="button" className="linkbtn" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
