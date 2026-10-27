import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import auth from "./routes/auth.js";
import transactions from "./routes/transactions.js";
import reminders from "./routes/reminders.js";
import reports from "./routes/reports.js";
import { requireAuth } from "./middleware/auth.js";

const { PORT = 5000, MONGO_URI, JWT_SECRET, CLIENT_URL = "http://localhost:5173" } = process.env;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error("Set JWT_SECRET (16+ characters) in server/.env");
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: "100kb" }));

app.use("/api/auth", auth);
app.use("/api/transactions", requireAuth, transactions);
app.use("/api/reminders", requireAuth, reminders);
app.use("/api/reports", requireAuth, reports);

mongoose
  .connect(MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
