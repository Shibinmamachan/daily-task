import { Router } from "express";
import Reminder from "../models/Reminder.js";

const router = Router();
const FIELDS = ["title", "type", "date", "time", "remindBefore", "notes", "done", "notified"];
const pick = (b = {}) => Object.fromEntries(FIELDS.filter((k) => k in b).map((k) => [k, b[k]]));

router.get("/", async (req, res) => {
  try { res.json(await Reminder.find({ user: req.userId }).sort({ date: 1, time: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try { res.status(201).json(await Reminder.create({ ...pick(req.body), user: req.userId })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const r = await Reminder.findOneAndUpdate({ _id: req.params.id, user: req.userId }, pick(req.body), { new: true, runValidators: true });
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try { await Reminder.findOneAndDelete({ _id: req.params.id, user: req.userId }); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
