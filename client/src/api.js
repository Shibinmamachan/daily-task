const TOKEN_KEY = "token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauth = () => {};
export const setUnauthHandler = (fn) => { onUnauth = fn; };

const authHeader = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

async function req(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.includes("/auth/login")) onUnauth();
  if (!res.ok) { const e = new Error(data.error || "Request failed"); e.code = data.code; throw e; }
  return data;
}

// auth
export const register = (name, email, password) => req("/api/auth/register", { method: "POST", body: { name, email, password } });
export const login = (email, password) => req("/api/auth/login", { method: "POST", body: { email, password } });
export const verifyEmail = (token) => req("/api/auth/verify", { method: "POST", body: { token } });
export const resendVerification = (email) => req("/api/auth/resend", { method: "POST", body: { email } });
export const me = () => req("/api/auth/me");

// data
const TB = "/api/transactions", RB = "/api/reminders";
export const getTransactions = () => req(TB);
export const addTransaction = (t) => req(TB, { method: "POST", body: t });
export const deleteTransaction = (id) => req(`${TB}/${id}`, { method: "DELETE" });
export const getReminders = () => req(RB);
export const addReminder = (r) => req(RB, { method: "POST", body: r });
export const updateReminder = (id, r) => req(`${RB}/${id}`, { method: "PUT", body: r });
export const deleteReminder = (id) => req(`${RB}/${id}`, { method: "DELETE" });

// report download (pdf | xlsx | csv)
export async function downloadReport({ format, content = "summary", period, from, to, cur }) {
  const q = new URLSearchParams({ format, content, period, cur });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await fetch(`/api/reports/export?${q}`, { headers: authHeader() });
  if (res.status === 401) onUnauth();
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Download failed"); }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `money-report-${period}${content === "transactions" ? "-transactions" : ""}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
