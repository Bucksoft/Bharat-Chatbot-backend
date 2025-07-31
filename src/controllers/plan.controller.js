import { Plan } from "../models/plan.schema.js";
import User from "../models/user.model.js";

export async function getPlans(req, res) {
  try {
    const plans = await Plan.find();
    if (!plans) {
      return res.status(400).json({ msg: "No plans found" });
    }
    return res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ msg: "Error in fetching plan details." });
  }
}

export async function getPlanById(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ msg: "Please provide a valid id" });
    }
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(400).json({ msg: "Plan not found" });
    }
    return res.status(200).json(plan);
  } catch (error) {
    res.status(500).json({ msg: "Error in fetching plan detail." });
  }
}

export async function getMyPlans(req, res) {
  try {
    const userPlan = await User.findById(req.user.id).populate("activePlan");
    if (!userPlan) {
      return res.status(400).json({ msg: "No active user plan found" });
    }
    return res.status(200).json(userPlan);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error in fetching plan detail.", error });
  }
}
