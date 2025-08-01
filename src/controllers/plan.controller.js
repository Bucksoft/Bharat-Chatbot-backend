import { Plan } from "../models/plan.schema.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

export async function getPlans(req, res) {
  try {
    const plans = await Plan.find({});

    if (!plans || plans.length === 0) {
      return res.status(404).json({ msg: "No active plans found." });
    }

    return res.status(200).json({ plans });
  } catch (error) {
    console.error("Error in getPlans:", error);
    res
      .status(500)
      .json({ msg: "Internal server error while fetching plans." });
  }
}

export async function getPlanById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid plan ID." });
    }

    const plan = await Plan.findById(id).lean();

    if (!plan) {
      return res.status(404).json({ msg: "Plan not found." });
    }

    return res.status(200).json({ plan });
  } catch (error) {
    console.error("Error in getPlanById:", error);
    res
      .status(500)
      .json({ msg: "Internal server error while fetching the plan." });
  }
}

export async function getMyPlans(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ msg: "Unauthorized: Invalid user ID." });
    }

    const user = await User.findById(userId).populate("activePlan").lean();

    if (!user || !user.activePlan) {
      return res
        .status(404)
        .json({ msg: "No active plan found for the user." });
    }

    return res.status(200).json({ plan: user.activePlan });
  } catch (error) {
    console.error("Error in getMyPlans:", error);
    res
      .status(500)
      .json({ msg: "Internal server error while fetching user plan." });
  }
}
