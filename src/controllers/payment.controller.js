import { razorpay } from "../lib/razorpay.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Api } from "../models/api.model.js";
import ms from "ms";
import User from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Plan } from "../models/plan.schema.js";

export async function createOrders(req, res) {
  try {
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ msg: "Invalid request parameters" });
    }

    const options = {
      amount: amount,
      currency: currency,
      receipt: `receipt-${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return res.status(200).json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    console.log("Failed to create order ", error);
    res
      .status(500)
      .json({ msg: "Failed to create order", error: error.message });
  }
}



// verify Order
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
    if (!orderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ msg: "Invalid request parameters" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", String(process.env.RAZORPAY_KEY_SECRET))
      .update(`${orderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(403).json({
        msg: "Payment verification failed",
      });
    }

    const planDurations = {
      free: "7d",
      pro: "30d",
      enterprise: "90d",
    };

    const planExpiry = planDurations[planType.toLowerCase()];
    if (!planExpiry) {
      return res.status(400).json({ msg: "Invalid plan type" });
    }
    const tokenPayload = {
      userId,
      planType,
      orderId,
    };
    const apiKey = jwt.sign(tokenPayload, process.env.API_KEY_SECRET, {
      expiresIn: planExpiry,
    });

    const expiryDate = new Date(Date.now() + ms(planExpiry));

    // save the apiKey in the user db
    const key = await Api.create({
      name: `${planType}-plan`,
      key: apiKey,
      expiresIn: expiryDate,
      createdBy: userId,
    });

    // update user with the api key and active plan set to planId
    await User.findByIdAndUpdate(userId, {
      $push: { apiKeys: key._id },
      activePlan: planId,
      planExpiresAt: expiryDate,
    });

    // update the plan with active status in the plan model
    await Plan.findByIdAndUpdate(planId, {
      isActive: true,
    });

    // add a record in the subscription model as well
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
      msg: "Payment verification successfull",
      key,
      planExpiry,
      subscription,
    });
  } catch (error) {
    console.log("Failed to verify order : ", error);
    res
      .status(500)
      .json({ msg: "Failed to verify order", error: error.message });
  }
}
