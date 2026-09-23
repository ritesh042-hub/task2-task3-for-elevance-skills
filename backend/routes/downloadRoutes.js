import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import DownloadLog from "../models/DownloadLog.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { PLANS, normalizePlan, indiaDateKey } from "../utils/plans.js";

const router = express.Router();
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-files");
const FILES = [
  { id: "starter-guide", name: "starter-guide.txt", description: "Original StreamSphere starter guide." },
  { id: "frontend-notes", name: "frontend-notes.txt", description: "Original frontend notes." },
  { id: "backend-notes", name: "backend-notes.txt", description: "Original backend notes." }
];
const active = new Set();

const meta = req => ({
  ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim(),
  userAgent: req.get("user-agent") || "unknown",
  deviceId: req.get("x-device-id") || "unknown"
});

async function reset(user) {
  const today = indiaDateKey();
  if (user.quotaDate !== today) {
    user.quotaDate = today; user.downloadsUsed = 0; await user.save();
  }
}

router.get("/files", requireAuth, async (req, res) => {
  await reset(req.user);
  const plan = normalizePlan(req.user);
  if (plan === "Free" && req.user.plan !== "Free") { req.user.plan = "Free"; req.user.subscriptionExpiresAt = null; await req.user.save(); }
  const limit = PLANS[plan].dailyLimit;
  res.json({ files: FILES, quota: {
    plan, used: req.user.downloadsUsed, limit,
    remaining: Math.max(0, limit - req.user.downloadsUsed), date: req.user.quotaDate
  }});
});

router.get("/history", requireAuth, async (req, res) => {
  res.json({ history: await DownloadLog.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean() });
});

router.get("/:fileId", requireAuth, async (req, res) => {
  const file = FILES.find(f => f.id === req.params.fileId);
  if (!file) return res.status(404).json({ message: "File not found." });

  await reset(req.user);
  const plan = normalizePlan(req.user);
  if (plan === "Free" && req.user.plan !== "Free") { req.user.plan = "Free"; req.user.subscriptionExpiresAt = null; await req.user.save(); }
  const limit = PLANS[plan].dailyLimit;
  const key = `${req.user._id}:${file.id}`, m = meta(req);

  const duplicate = await DownloadLog.findOne({
    userId: req.user._id, fileId: file.id, status: "success",
    createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
  });

  if (duplicate) {
    await DownloadLog.create({ userId:req.user._id,fileId:file.id,fileName:file.name,status:"duplicate",
      reason:"Duplicate within 10 minutes.",...m });
    return res.status(409).json({ message:"This file was already downloaded recently. Please wait before downloading it again." });
  }

  if (active.has(key)) {
    await DownloadLog.create({ userId:req.user._id,fileId:file.id,fileName:file.name,status:"blocked",
      reason:"Concurrent download blocked.",...m });
    return res.status(409).json({ message:"A download of this file is already in progress." });
  }

  if (req.user.downloadsUsed >= limit) {
    await DownloadLog.create({ userId:req.user._id,fileId:file.id,fileName:file.name,status:"blocked",
      reason:"Daily quota exceeded.",...m });
    return res.status(429).json({ message:`Daily download limit reached for the ${plan} plan.` });
  }

  const full = path.join(dir, file.name);
  if (!fs.existsSync(full)) return res.status(500).json({ message:"Requested file is unavailable." });

  active.add(key);
  await DownloadLog.create({ userId:req.user._id,fileId:file.id,fileName:file.name,status:"started",...m });
  req.user.downloadsUsed += 1;
  await req.user.save();

  res.download(full, file.name, async err => {
    active.delete(key);
    await DownloadLog.create({
      userId:req.user._id,fileId:file.id,fileName:file.name,
      status:err ? "failed" : "success",
      reason:err ? "Transfer interrupted or failed." : "",...m
    }).catch(()=>{});
  });
});

router.post("/demo-plan", requireAuth, async (req,res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ message:"Invalid plan." });
  req.user.plan = plan;
  req.user.subscriptionExpiresAt = plan === "Free" ? null : new Date(Date.now()+30*86400000);
  await req.user.save();
  res.json({ message:`Demo plan changed to ${plan}.`, plan, limit:PLANS[plan].dailyLimit });
});

export default router;
