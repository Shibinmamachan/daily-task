import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ["booking", "reminder", "bill"], default: "reminder" },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, default: "09:00", match: /^\d{2}:\d{2}$/ },
    remindBefore: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", maxlength: 300 },
    done: { type: Boolean, default: false },
    notified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Reminder", reminderSchema);
