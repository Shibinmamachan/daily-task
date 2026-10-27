import { Router } from "express";
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";

const router = Router();
const MONTH = /^\d{4}-\d{2}$/;
const pick = (b = {}) => ({
  type: b.type,
  amount: Number(b.amount),
  category: String(b.category || "").trim(),
  date: b.date,
  note: String(b.note || "").trim(),
});
const filterFor = (req) => {
  const f = { user: req.userId };
  if (typeof req.query.month === "string" && MONTH.test(req.query.month)) f.date = { $regex: `^${req.query.month}` };
  return f;
};

router.get("/", async (req, res) => {
  try { res.json(await Transaction.find(filterFor(req)).sort({ date: -1, createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try { res.status(201).json(await Transaction.create({ ...pick(req.body), user: req.userId })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const t = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.userId }, pick(req.body), { new: true, runValidators: true });
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try { await Transaction.findOneAndDelete({ _id: req.params.id, user: req.userId }); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/summary", async (req, res) => {
  try {
    const f = filterFor(req);
    f.user = new mongoose.Types.ObjectId(req.userId);
    const rows = await Transaction.aggregate([
      { $match: f },
      { $group: { _id: { type: "$type", category: "$category" }, total: { $sum: "$amount" } } },
    ]);
    let income = 0, expense = 0;
    const byCategory = {};
    rows.forEach((r) => { if (r._id.type === "income") income += r.total; else { expense += r.total; byCategory[r._id.category] = r.total; } });
    res.json({ income, expense, net: income - expense, byCategory });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
