import express from "express";
import { isAuth } from "../middlewares/user.middleware.js";
import { getSubscription } from "../controllers/subscription.controller.js";

const router = express.Router();

router.get("/", isAuth, getSubscription);

export default router;
