import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    note: { type: String, trim: true, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
