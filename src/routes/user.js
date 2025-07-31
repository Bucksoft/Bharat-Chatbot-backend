import express from "express";
import { isAuth } from "../middlewares/user.middleware.js";
import {
  login,
  logout,
  profile,
  signup,
} from "../controllers/user.controller.js";

const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", isAuth, logout);

router.get("/me", isAuth, profile);

export default router;
