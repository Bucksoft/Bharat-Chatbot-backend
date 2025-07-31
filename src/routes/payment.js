import express from "express";
import { isAuth } from "../middlewares/user.middleware.js";
import {
  createOrders,
  verifyOrder,
} from "../controllers/payment.controller.js";

const router = express.Router();
router.post("/create-order", isAuth, createOrders);
router.post("/verify-order", isAuth, verifyOrder);

export default router;
