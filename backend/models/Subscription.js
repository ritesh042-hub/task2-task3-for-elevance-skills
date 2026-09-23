import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: { type: String, enum: ["Free", "Bronze", "Silver", "Gold"], required: true },
  amount: { type: Number, required: true, default: 0 },
  currency: { type: String, default: "INR" },
  provider: { type: String, enum: ["razorpay", "demo"], required: true },
  orderId: { type: String, default: null },
  paymentId: { type: String, default: null },
  signature: { type: String, default: null },
  receipt: { type: String, default: null },
  status: { type: String, enum: ["created", "paid", "active", "cancelled", "failed", "expired"], default: "created" },
  startedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("Subscription", schema);
