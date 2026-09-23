import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import { requireAuth } from "../middleware/auth.js";
import { PLANS, normalizePlan } from "../utils/plans.js";

const router = express.Router();

const razorpay =
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID.trim(),
        key_secret: process.env.RAZORPAY_KEY_SECRET.trim(),
      })
    : null;

function applyPlan(user, plan, startedAt = new Date()) {
  user.plan = plan;
  user.subscriptionExpiresAt =
    plan === "Free"
      ? null
      : new Date(
          startedAt.getTime() +
            PLANS[plan].validityDays * 24 * 60 * 60 * 1000
        );
}

router.get("/plans", requireAuth, (req, res) => {
  res.json({
    plans: PLANS,
    currentPlan: normalizePlan(req.user),
  });
});

router.get("/current", requireAuth, async (req, res) => {
  try {
    const plan = normalizePlan(req.user);

    if (plan === "Free" && req.user.plan !== "Free") {
      req.user.plan = "Free";
      req.user.subscriptionExpiresAt = null;
      await req.user.save();
    }

    const latest = await Subscription.findOne({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      plan,
      expiresAt: req.user.subscriptionExpiresAt,
      latestSubscription: latest,
    });
  } catch (error) {
    console.error("CURRENT SUBSCRIPTION ERROR:", error);
    res.status(500).json({
      message: "Unable to load subscription.",
    });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    res.json({
      subscriptions: await Subscription.find({
        userId: req.user._id,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    });
  } catch (error) {
    console.error("SUBSCRIPTION HISTORY ERROR:", error);
    res.status(500).json({
      message: "Unable to load subscription history.",
    });
  }
});

router.post("/create-order", requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan] || plan === "Free") {
      return res.status(400).json({
        message: "Choose a paid plan.",
      });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        message: "Razorpay test keys are missing in .env.",
      });
    }

    if (!razorpay) {
      return res.status(503).json({
        message: "Razorpay is not configured.",
      });
    }

    const receipt = `ss3_${Date.now()}_${crypto
      .randomBytes(3)
      .toString("hex")}`;

    const amount = Math.round(Number(PLANS[plan].price) * 100);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Invalid plan price.",
      });
    }

    console.log("Creating Razorpay order:", {
      plan,
      amount,
      keyConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
    });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        userId: req.user._id.toString(),
        plan,
      },
    });

    await Subscription.create({
      userId: req.user._id,
      plan,
      amount: PLANS[plan].price,
      currency: "INR",
      provider: "razorpay",
      orderId: order.id,
      receipt,
      status: "created",
    });

    res.json({
      order,
      keyId: process.env.RAZORPAY_KEY_ID.trim(),
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    res.status(500).json({
      message: "Unable to create Razorpay test order.",
      error: error?.message || "Unknown error",
    });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message: "Payment verification details are incomplete.",
      });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        message: "Razorpay secret key is missing.",
      });
    }

    const expected = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET.trim()
      )
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({
        message: "Payment signature verification failed.",
      });
    }

    const sub = await Subscription.findOne({
      userId: req.user._id,
      orderId: razorpay_order_id,
    });

    if (!sub) {
      return res.status(404).json({
        message: "Subscription order not found.",
      });
    }

    const now = new Date();

    sub.paymentId = razorpay_payment_id;
    sub.signature = razorpay_signature;
    sub.status = "active";
    sub.startedAt = now;
    sub.expiresAt = new Date(
      now.getTime() +
        PLANS[sub.plan].validityDays * 24 * 60 * 60 * 1000
    );

    await sub.save();

    applyPlan(req.user, sub.plan, now);
    await req.user.save();

    res.json({
      message: `${sub.plan} subscription activated successfully.`,
      plan: sub.plan,
      expiresAt: req.user.subscriptionExpiresAt,
    });
  } catch (error) {
    console.error("PAYMENT VERIFY ERROR:", error);

    res.status(500).json({
      message: "Payment verification failed.",
      error: error?.message || "Unknown error",
    });
  }
});

router.post("/demo-activate", requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({
        message: "Invalid plan.",
      });
    }

    const now = new Date();

    if (plan === "Free") {
      applyPlan(req.user, "Free", now);
      await req.user.save();

      await Subscription.create({
        userId: req.user._id,
        plan: "Free",
        amount: 0,
        provider: "demo",
        status: "active",
        startedAt: now,
      });

      return res.json({
        message: "Free plan activated.",
        plan: "Free",
        expiresAt: null,
      });
    }

    const expiresAt = new Date(
      now.getTime() +
        PLANS[plan].validityDays * 24 * 60 * 60 * 1000
    );

    applyPlan(req.user, plan, now);
    await req.user.save();

    await Subscription.create({
      userId: req.user._id,
      plan,
      amount: PLANS[plan].price,
      provider: "demo",
      status: "active",
      startedAt: now,
      expiresAt,
    });

    res.json({
      message: `${plan} demo subscription activated for local testing.`,
      plan,
      expiresAt,
    });
  } catch (error) {
    console.error("DEMO ACTIVATION ERROR:", error);

    res.status(500).json({
      message: "Demo activation failed.",
    });
  }
});

router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const current = normalizePlan(req.user);

    if (current === "Free") {
      return res.status(400).json({
        message: "You are already on the Free plan.",
      });
    }

    req.user.plan = "Free";
    req.user.subscriptionExpiresAt = null;
    await req.user.save();

    await Subscription.findOneAndUpdate(
      {
        userId: req.user._id,
        plan: current,
        status: "active",
      },
      {
        status: "cancelled",
      },
      {
        sort: { createdAt: -1 },
      }
    );

    res.json({
      message:
        "Subscription cancelled. Your existing account and download history are preserved.",
      plan: "Free",
    });
  } catch (error) {
    console.error("CANCEL SUBSCRIPTION ERROR:", error);

    res.status(500).json({
      message: "Unable to cancel subscription.",
    });
  }
});

export default router;