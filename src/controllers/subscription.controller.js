import { Subscription } from "../models/subscription.model.js";

export async function getSubscription(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    })
      .sort({ subscriptionStart: -1 })
      .populate("planId")
      .populate("userId");

    if (!subscription || !subscription.planId) {
      return res.status(404).json({ msg: "No active subscription found" });
    }

    res.status(200).json({ subscription });
  } catch (error) {
    console.error("Failed to get subscription:", error);
    res
      .status(500)
      .json({ msg: "Failed to get subscription", error: error.message });
  }
}
