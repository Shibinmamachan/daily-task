import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Auth from "./Auth.jsx";
import { getToken, setToken, me, verifyEmail, setUnauthHandler } from "./api.js";
import "./styles.css";

document.documentElement.dataset.theme =
  localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function Root() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(null);
  const [verifyToken] = useState(() => (location.hash.match(/^#verify=([a-f0-9]+)$/) || [])[1] || null);

  const logout = () => { setToken(null); setUser(null); history.replaceState(null, "", location.pathname); };

  useEffect(() => {
    setUnauthHandler(logout);
    if (verifyToken) {
      verifyEmail(verifyToken)
        .then((r) => setNotice({ ok: true, text: r.message }))
        .catch((e) => setNotice({ ok: false, text: e.message }))
        .finally(() => { history.replaceState(null, "", location.pathname); setReady(true); });
    } else if (getToken()) {
      me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
    } else setReady(true);
  }, []);

  if (!ready) return <p className="boot">Loading…</p>;
  if (!user) return <Auth notice={notice} onLogin={(t, u) => { setToken(t); setUser(u); setNotice(null); }} />;
  return <App user={user} onLogout={logout} />;
}

createRoot(document.getElementById("root")).render(<Root />);
