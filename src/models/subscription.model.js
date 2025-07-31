import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },
    subscriptionStart: {
      type: Date,
      default: Date.now,
    },
    subscriptionEnd: {
      type: Date,
      default: Date.now,
    },
    totalCredits: {
      type: Number,
      required: true,
    },
    creditsUsed: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    paymentInfo: {
      transactionId: String,
      paymentGateway: String,
      paidOn: Date,
      amountPaid: Number,
    },
  },
  { timestamps: true }
);

subscriptionSchema.virtual("creditsLeft").get(function () {
  return this.totalCredits - this.creditsUsed;
});

export const Subscription = mongoose.model("Subscription", subscriptionSchema);

// Run daily
// await UserSubscription.updateMany(
//   { subscriptionEnd: { $lt: new Date() }, status: "active" },
//   { $set: { status: "expired" } }
// );

// server/cron/expireSubscriptions.js
// import cron from 'node-cron';
// import UserSubscription from '../models/UserSubscription.js';

// // Runs every day at 12:00 AM
// cron.schedule('0 0 * * *', async () => {
//   console.log("⏰ Running daily subscription expiry job...");
//   try {
//     const result = await UserSubscription.updateMany(
//       { subscriptionEnd: { $lt: new Date() }, status: "active" },
//       { $set: { status: "expired" } }
//     );
//     console.log(`✅ Updated ${result.modifiedCount} expired subscriptions.`);
//   } catch (err) {
//     console.error("❌ CRON Job Failed:", err.message);
//   }
// });
