import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const LEN = { day: 10, month: 7, year: 4 };
const NAMES = { day: "Day", month: "Month", year: "Year" };

export function groupByPeriod(tx, period) {
  const m = new Map();
  tx.forEach((t) => {
    const k = t.date.slice(0, LEN[period]);
    const r = m.get(k) || { period: k, income: 0, expense: 0 };
    if (t.type === "income") r.income += t.amount; else r.expense += t.amount;
    m.set(k, r);
  });
  return [...m.values()].sort((a, b) => (a.period < b.period ? -1 : 1)).map((r) => {
    const net = r.income - r.expense;
    return { ...r, net, status: net > 0 ? "Profit" : net < 0 ? "Loss" : "Break-even", savings: r.income ? net / r.income : null };
  });
}

export function byCategory(tx) {
  const m = new Map();
  tx.forEach((t) => { const k = `${t.type}|${t.category}`; m.set(k, (m.get(k) || 0) + t.amount); });
  const out = { income: [], expense: [] };
  m.forEach((total, k) => { const [type, category] = k.split("|"); out[type].push({ category, total }); });
  Object.values(out).forEach((a) => a.sort((x, y) => y.total - x.total));
  return out;
}

const totalsOf = (rows) => rows.reduce((a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense }), { income: 0, expense: 0 });

/* ---------- CSV ---------- */
// Prefix risky text so spreadsheets never run it as a formula
const safe = (v) => { const s = String(v ?? ""); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; };
const cell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const line = (a) => a.map(cell).join(",");

export function toCsv({ tx, period, content }) {
  const out = [];
  if (content === "transactions") {
    out.push(line(["Date", "Type", "Category", "Amount", "Note"]));
    tx.forEach((t) => out.push(line([t.date, t.type, safe(t.category), t.amount.toFixed(2), safe(t.note)])));
  } else {
    const rows = groupByPeriod(tx, period), t = totalsOf(rows);
    out.push(line([NAMES[period], "Income", "Expenses", "Net", "Status", "Savings %"]));
    rows.forEach((r) => out.push(line([r.period, r.income.toFixed(2), r.expense.toFixed(2), r.net.toFixed(2), r.status, r.savings === null ? "" : (r.savings * 100).toFixed(1)])));
    out.push(line(["Total", t.income.toFixed(2), t.expense.toFixed(2), (t.income - t.expense).toFixed(2), "", t.income ? (((t.income - t.expense) / t.income) * 100).toFixed(1) : ""]));
  }
  return "\uFEFF" + out.join("\r\n");
}

/* ---------- Excel ---------- */
export async function toXlsx({ tx, period, user, cur }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Money Dashboard";
  wb.created = new Date();
  const money = '#,##0.00;[Red]-#,##0.00';
  const head = (ws) => ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12263A" } };
  });

  const rows = groupByPeriod(tx, period), t = totalsOf(rows);
  const ws = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: NAMES[period], key: "p", width: 14 }, { header: `Income (${cur})`, key: "i", width: 18 },
    { header: `Expenses (${cur})`, key: "e", width: 18 }, { header: `Net (${cur})`, key: "n", width: 18 },
    { header: "Status", key: "s", width: 13 }, { header: "Savings %", key: "r", width: 12 },
  ];
  rows.forEach((r, idx) => {
    const n = idx + 2;
    ws.addRow({
      p: r.period, i: r.income, e: r.expense,
      n: { formula: `B${n}-C${n}`, result: r.net },
      s: { formula: `IF(D${n}>0,"Profit",IF(D${n}<0,"Loss","Break-even"))`, result: r.status },
      r: { formula: `IF(B${n}=0,"",D${n}/B${n})`, result: r.savings ?? "" },
    });
  });
  if (rows.length) {
    const last = rows.length + 1, n = last + 1, net = t.income - t.expense;
    const tr = ws.addRow({
      p: "Total",
      i: { formula: `SUM(B2:B${last})`, result: t.income }, e: { formula: `SUM(C2:C${last})`, result: t.expense },
      n: { formula: `B${n}-C${n}`, result: net },
      s: { formula: `IF(D${n}>0,"Profit",IF(D${n}<0,"Loss","Break-even"))`, result: net > 0 ? "Profit" : net < 0 ? "Loss" : "Break-even" },
      r: { formula: `IF(B${n}=0,"",D${n}/B${n})`, result: t.income ? net / t.income : "" },
    });
    tr.font = { bold: true };
    tr.eachCell((c) => { c.border = { top: { style: "thin" } }; });
  }
  [2, 3, 4].forEach((c) => (ws.getColumn(c).numFmt = money));
  ws.getColumn(6).numFmt = "0%";
  head(ws);

  const cs = wb.addWorksheet("Categories", { views: [{ state: "frozen", ySplit: 1 }] });
  cs.columns = [{ header: "Type", key: "t", width: 12 }, { header: "Category", key: "c", width: 28 }, { header: `Total (${cur})`, key: "a", width: 18 }, { header: "Share of type", key: "s", width: 14 }];
  const cats = byCategory(tx);
  ["expense", "income"].forEach((type) => {
    const sum = cats[type].reduce((a, c) => a + c.total, 0);
    cats[type].forEach((c) => cs.addRow({ t: type === "expense" ? "Expense" : "Income", c: c.category, a: c.total, s: sum ? c.total / sum : 0 }));
  });
  cs.getColumn(3).numFmt = money; cs.getColumn(4).numFmt = "0%";
  head(cs);

  const ts = wb.addWorksheet("Transactions", { views: [{ state: "frozen", ySplit: 1 }] });
  ts.columns = [{ header: "Date", key: "d", width: 13 }, { header: "Type", key: "t", width: 11 }, { header: "Category", key: "c", width: 24 }, { header: `Amount (${cur})`, key: "a", width: 16 }, { header: "Note", key: "n", width: 36 }];
  tx.forEach((x) => ts.addRow({ d: x.date, t: x.type === "income" ? "Income" : "Expense", c: x.category, a: x.amount, n: x.note }));
  ts.getColumn(4).numFmt = money;
  ts.autoFilter = { from: "A1", to: `E${Math.max(tx.length + 1, 2)}` };
  head(ts);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- PDF ---------- */
export function toPdf({ tx, period, user, cur, from, to }, res) {
  const sym = cur === "₹" ? "Rs. " : cur === "AED" ? "AED " : cur; // built-in PDF fonts have no rupee glyph
  const fmt = (n) => (n < 0 ? "-" : "") + sym + Math.abs(n).toLocaleString(cur === "₹" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const INK = "#12263A", GREEN = "#0F7B6C", ROSE = "#B4325A", MUTED = "#5B6B7B";
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  doc.pipe(res);

  const rows = groupByPeriod(tx, period), t = totalsOf(rows), net = t.income - t.expense, cats = byCategory(tx);
  const range = from || to ? `${from || "start"} to ${to || "today"}` : "All dates";

  doc.rect(0, 0, 595.28, 92).fill(INK);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(20).text("Income & Expense Report", 40, 26);
  doc.font("Helvetica").fontSize(10).text(`${user.name}  |  ${range}  |  By ${NAMES[period].toLowerCase()}  |  Generated ${new Date().toISOString().slice(0, 10)}`, 40, 58);

  [["Income", t.income, GREEN], ["Expenses", t.expense, ROSE], [net < 0 ? "Net loss" : "Net profit", net, net < 0 ? ROSE : GREEN]].forEach(([label, v, col], i) => {
    const x = 40 + i * 175;
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(label, x, 112, { lineBreak: false });
    doc.fillColor(col).font("Helvetica-Bold").fontSize(15).text(fmt(v), x, 126, { lineBreak: false });
  });
  doc.y = 160; doc.x = 40;

  const heading = (text) => {
    if (doc.y > 720) doc.addPage();
    doc.x = 40; doc.moveDown(0.6);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(text, 40, doc.y, { lineBreak: false });
    doc.y += 20;
  };
  const table = (cols, data) => {
    let y = doc.y;
    const head = () => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
      let x = 40; cols.forEach((c) => { doc.text(c.h, x, y, { width: c.w - 6, align: c.a || "left", lineBreak: false }); x += c.w; });
      y += 15; doc.moveTo(40, y - 3).lineTo(555, y - 3).strokeColor("#D5DEE5").lineWidth(0.7).stroke();
    };
    head();
    data.forEach((r) => {
      if (y > 770) { doc.addPage(); y = 40; head(); }
      doc.font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      let x = 40;
      cols.forEach((c) => {
        doc.fillColor(c.color ? c.color(r) : INK).text(String(c.get(r)), x, y, { width: c.w - 6, align: c.a || "left", lineBreak: false, ellipsis: true });
        x += c.w;
      });
      y += 15;
    });
    doc.y = y + 4; doc.x = 40;
  };
  const netColor = (r) => (r.net > 0 ? GREEN : r.net < 0 ? ROSE : INK);

  heading(`Summary by ${NAMES[period].toLowerCase()}`);
  const srows = rows.map((r) => ({ ...r })).concat(rows.length ? [{ period: "Total", income: t.income, expense: t.expense, net, status: net > 0 ? "Profit" : net < 0 ? "Loss" : "Break-even", savings: t.income ? net / t.income : null, bold: true }] : []);
  if (!rows.length) doc.fillColor(MUTED).font("Helvetica").fontSize(10).text("No transactions in this range.", 40, doc.y);
  else table([
    { h: NAMES[period], w: 80, get: (r) => r.period },
    { h: "Income", w: 100, a: "right", get: (r) => fmt(r.income) },
    { h: "Expenses", w: 100, a: "right", get: (r) => fmt(r.expense) },
    { h: "Net", w: 105, a: "right", get: (r) => fmt(r.net), color: netColor },
    { h: "Status", w: 70, a: "right", get: (r) => r.status, color: netColor },
    { h: "Savings", w: 60, a: "right", get: (r) => (r.savings === null ? "-" : Math.round(r.savings * 100) + "%") },
  ], srows);

  [["expense", "Expenses by category"], ["income", "Income by source"]].forEach(([type, title]) => {
    if (!cats[type].length) return;
    const sum = cats[type].reduce((a, c) => a + c.total, 0);
    heading(title);
    table([
      { h: "Category", w: 260, get: (r) => r.category },
      { h: "Total", w: 130, a: "right", get: (r) => fmt(r.total) },
      { h: "Share", w: 125, a: "right", get: (r) => Math.round((r.total / sum) * 100) + "%" },
    ], cats[type]);
  });

  if (tx.length) {
    heading("All transactions");
    table([
      { h: "Date", w: 70, get: (r) => r.date },
      { h: "Type", w: 60, get: (r) => (r.type === "income" ? "Income" : "Expense"), color: (r) => (r.type === "income" ? GREEN : ROSE) },
      { h: "Category", w: 130, get: (r) => r.category },
      { h: "Amount", w: 95, a: "right", get: (r) => fmt(r.amount) },
      { h: "Note", w: 160, get: (r) => r.note || "" },
    ], tx);
  }

  const { count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`Page ${i + 1} of ${count}`, 40, 815, { width: 515, align: "center", lineBreak: false });
  }
  doc.end();
}
