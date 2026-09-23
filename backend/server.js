import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import downloadRoutes from "./routes/downloadRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());
app.get("/api/health", (_, res) => res.json({ ok: true, service: "StreamSphere Task 3" }));
app.use("/api/auth", authRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`StreamSphere Task 3 backend running at http://localhost:${PORT}`));
}).catch(e => { console.error("MongoDB connection failed:", e.message); process.exit(1); });
