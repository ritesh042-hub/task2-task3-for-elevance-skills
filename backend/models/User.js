import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  plan: { type: String, enum: ["Free","Bronze","Silver","Gold"], default: "Free" },
  subscriptionExpiresAt: { type: Date, default: null },
  quotaDate: { type: String, default: null },
  downloadsUsed: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("User", schema);
