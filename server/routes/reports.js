import { Router } from "express";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { toCsv, toXlsx, toPdf } from "../utils/report.js";

const router = Router();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = ["₹", "$", "€", "£", "AED"];

// GET /api/reports/export?format=pdf|xlsx|csv&period=day|month|year&content=summary|transactions&from=&to=&cur=
router.get("/export", async (req, res) => {
  try {
    const { format = "pdf", period = "month", content = "summary", from, to, cur = "₹" } = req.query;
    if (!["pdf", "xlsx", "csv"].includes(format)) return res.status(400).json({ error: "Unknown format" });
    if (!["day", "month", "year"].includes(period)) return res.status(400).json({ error: "Unknown period" });
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return res.status(400).json({ error: "Dates must be YYYY-MM-DD" });
    if (!CURRENCIES.includes(cur)) return res.status(400).json({ error: "Unknown currency" });

    const filter = { user: req.userId };
    if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const tx = await Transaction.find(filter).sort({ date: 1, createdAt: 1 }).lean();
    const user = await User.findById(req.userId).select("name").lean();

    const base = `money-report-${period}-${new Date().toISOString().slice(0, 10)}`;
    const ctx = { tx, period, content, user, cur, from, to };

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${base}${content === "transactions" ? "-transactions" : ""}.csv"`);
      return res.send(toCsv(ctx));
    }
    if (format === "xlsx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
      return res.send(await toXlsx(ctx));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
    toPdf(ctx, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: "Could not build the report." });
  }
});

export default router;
