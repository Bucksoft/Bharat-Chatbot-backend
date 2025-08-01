import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRoute from "./routes/chat.js";
import userRoute from "./routes/user.js";
import planRoute from "./routes/plan.js";
import paymentRoute from "./routes/payment.js";
import subscriptionRoute from "./routes/subscription.js";
import { dbConnect } from "./lib/db.js";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoute from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "https://bharatchatbot.onrender.com",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/chat", chatRoute);
app.use("/auth/google", authRoute);
app.use("/api/user", userRoute);
app.use("/api/plan", planRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/subscription", subscriptionRoute);

app.listen(PORT, () => {
  dbConnect();
  console.log(`Backend running on http://localhost:${PORT} ✅`);
});
