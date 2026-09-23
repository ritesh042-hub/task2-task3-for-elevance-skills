import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { PLANS, normalizePlan, indiaDateKey } from "../utils/plans.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const safeUser = u => ({
  id: u._id,
  name: u.name,
  email: u.email,
  plan: normalizePlan(u),
  subscriptionExpiresAt: u.subscriptionExpiresAt,
  downloadsUsed: u.downloadsUsed
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password || password.length < 6)
      return res.status(400).json({ message: "Name, email and password (6+ characters) are required." });
    const cleanEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: cleanEmail }))
      return res.status(409).json({ message: "An account with this email already exists." });
    const user = await User.create({ name: name.trim(), email: cleanEmail, passwordHash: await bcrypt.hash(password, 12), quotaDate: indiaDateKey() });
    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: safeUser(user) });
  } catch (e) { res.status(500).json({ message: "Registration failed.", error: e.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(req.body.password || "", user.passwordHash)))
      return res.status(401).json({ message: "Incorrect email or password." });
    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: safeUser(user) });
  } catch (e) { res.status(500).json({ message: "Login failed.", error: e.message }); }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: safeUser(req.user), plans: PLANS });
});

export default router;
