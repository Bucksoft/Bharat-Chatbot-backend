import { Subscription } from "../models/subscription.model.js";
export async function getSubscription(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    })
      .populate("planId")
      .sort({ subscriptionEnd: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    res.status(200).json({
      success: true,
      subscription: {
        id: subscription._id,
        plan: subscription.planId,
        status: subscription.status,
        startDate: subscription.subscriptionStart,
        endDate: subscription.subscriptionEnd,
        totalCredits: subscription.totalCredits,
        creditsUsed: subscription.creditsUsed,
        creditsLeft: subscription.creditsLeft,
        paymentInfo: subscription.paymentInfo,
        createdAt: subscription.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching subscription:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
