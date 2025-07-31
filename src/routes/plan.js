import express from "express";
import {
  getPlanById,
  getPlans,
  getMyPlans,
} from "../controllers/plan.controller.js";
import { isAuth } from "../middlewares/user.middleware.js";

const router = express.Router();

router.get("/all", isAuth, getPlans);
router.get("/active", isAuth, getMyPlans);
router.get(`/:id`, isAuth, getPlanById);

export default router;
