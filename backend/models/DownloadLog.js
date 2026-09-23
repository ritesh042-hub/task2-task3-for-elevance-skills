import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fileId: String,
  fileName: String,
  status: { type: String, enum: ["started","success","failed","blocked","duplicate"] },
  reason: String,
  deviceId: String,
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("DownloadLog", schema);
