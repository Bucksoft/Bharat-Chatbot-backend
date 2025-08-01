import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

dotenv.config();

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const googleAuthURL =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri:
          "https://bharat-chatbot-backend.onrender.com/auth/google/callback",
        response_type: "code",
        scope: "profile email",
        access_type: "offline",
        prompt: "consent",
      });
    res.redirect(googleAuthURL);
  } catch (error) {
    console.log("ERROR", error);
    return res
      .status(500)
      .json({ msg: "Something went wrong while logging with Google" });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      null,
      {
        params: {
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri:
            "https://bharat-chatbot-backend.onrender.com/auth/google/callback",
          grant_type: "authorization_code",
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenRes.data.access_token;
    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const user = userRes.data;
    let dbUser = await User.findOne({ email: user.email });

    if (!dbUser) {
      dbUser = await User.create({
        name: user.name,
        email: user.email,
        profilePicture: user.picture,
      });
    }
    const token = jwt.sign(
      {
        id: dbUser._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.redirect("https://bharatchatbot.onrender.com/dashboard/pricing");
  } catch (error) {
    console.log("ERROR IN AUTHENTICATING USER : ", error);
    return res.status(500).json({ msg: "Authentication failed" });
  }
});

router.get("/logout", (req, res) => {
  try {
    res.clearCookie("token");
    return res.status(200).json({ msg: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ msg: "Logout failed" });
  }
});

export default router;
