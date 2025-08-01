import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    subscriptionStart: {
      type: Date,
      default: Date.now,
    },
    subscriptionEnd: {
      type: Date,
      required: true,
    },
    totalCredits: {
      type: Number,
      required: true,
      min: [0, "Total credits must be >= 0"],
    },
    creditsUsed: {
      type: Number,
      default: 0,
      min: [0, "Credits used must be >= 0"],
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    paymentInfo: {
      transactionId: { type: String, default: null },
      paymentGateway: { type: String, default: null },
      paidOn: { type: Date, default: null },
      amountPaid: { type: Number, default: null },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual field: creditsLeft
subscriptionSchema.virtual("creditsLeft").get(function () {
  return Math.max(this.totalCredits - this.creditsUsed, 0);
});

// Optional: Auto-expire subscription check logic
// Can be used in a cron job or scheduler
subscriptionSchema.statics.expireOldSubscriptions = async function () {
  const result = await this.updateMany(
    {
      subscriptionEnd: { $lt: new Date() },
      status: "active",
    },
    { $set: { status: "expired" } }
  );
  return result.modifiedCount;
};

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
