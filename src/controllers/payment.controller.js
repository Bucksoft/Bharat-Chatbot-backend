import { razorpay } from "../lib/razorpay.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import ms from "ms";

import { Api } from "../models/api.model.js";
import User from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Plan } from "../models/plan.schema.js";

// Create Razorpay Order
export async function createOrders(req, res) {
  try {
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ msg: "Amount and currency are required" });
    }

    const options = {
      amount,
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return res.status(201).json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Failed to create Razorpay order:", error);
    return res.status(500).json({
      success: false,
      msg: "Unable to create order",
      error: error.message,
    });
  }
}

// Verify Razorpay Order & Create API Key, Subscription
export async function verifyOrder(req, res) {
  try {
    const {
      orderId,
      razorpayPaymentId,
      razorpaySignature,
      planType,
      userId,
      planId,
      planCredits,
      price,
    } = req.body;

    // Input validation
    if (
      !orderId ||
      !razorpayPaymentId ||
      !razorpaySignature ||
      !planType ||
      !userId ||
      !planId ||
      !planCredits ||
      !price
    ) {
      return res.status(400).json({ msg: "Missing required parameters" });
    }

    // Validate Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(403).json({ msg: "Invalid Razorpay signature" });
    }

    // Determine plan expiry
    const planDurations = {
      free: "7d",
      pro: "30d",
      enterprise: "90d",
    };

    const planKey = planType.toLowerCase();
    const planExpiryDuration = planDurations[planKey];

    if (!planExpiryDuration) {
      return res.status(400).json({ msg: "Invalid plan type provided" });
    }

    const expiryDate = new Date(Date.now() + ms(planExpiryDuration));

    // Create signed API key
    const tokenPayload = { userId, planType, orderId };
    const apiKey = jwt.sign(tokenPayload, process.env.API_KEY_SECRET, {
      expiresIn: planExpiryDuration,
    });

    // Save API key to DB
    const savedApiKey = await Api.create({
      name: `${planType}-plan`,
      key: apiKey,
      expiresIn: expiryDate,
      createdBy: userId,
    });

    // Update User: Add API key and activate plan
    await User.findByIdAndUpdate(userId, {
      $push: { apiKeys: savedApiKey._id },
      activePlan: planId,
      planExpiresAt: expiryDate,
    });

    await Plan.findByIdAndUpdate(planId, { isActive: true });

    const subscription = await Subscription.create({
      userId,
      planId,
      subscriptionStart: new Date(),
      subscriptionEnd: expiryDate,
      totalCredits: planCredits,
      creditsUsed: 0,
      status: "active",
      paymentInfo: {
        transactionId: razorpayPaymentId,
        paymentGateway: "razorpay",
        paidOn: new Date(),
        amountPaid: price,
      },
    });

    return res.status(200).json({
      success: true,
      msg: "Payment verified successfully",
      apiKey: savedApiKey,
      subscription,
      expiresAt: expiryDate,
    });
  } catch (error) {
    console.error("Order verification failed:", error);
    return res.status(500).json({
      success: false,
      msg: "Order verification failed",
      error: error.message,
    });
  }
}
