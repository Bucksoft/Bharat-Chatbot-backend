import jwt from "jsonwebtoken";
import { Api } from "../models/api.model.js";

export async function apiKeyMiddleware(req, res, next) {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res.status(400).json({ msg: "Please provide an API key" });
    }

    const decodedData = jwt.verify(apiKey, process.env.API_KEY_SECRET);
    if (!decodedData || !decodedData.userId) {
      return res.status(401).json({ success: false, msg: "Invalid API key" });
    }

    // Look up API key in DB
    const existingKey = await Api.findOne({
      key: apiKey,
      createdBy: decodedData.userId,
    });

    if (!existingKey) {
      return res.status(404).json({ success: false, msg: "API key not found" });
    }

    // Check expiry
    if (new Date(existingKey.expiresIn) < new Date()) {
      return res
        .status(403)
        .json({ success: false, msg: "API key has expired" });
    }

    // ✅ Attach data to request
    req.userId = decodedData.userId;
    req.planType = decodedData.planType;
    req.orderId = decodedData.orderId;

    next(); // move to the next middleware/controller
  } catch (error) {
    console.error("API Key Middleware Error:", error.message);
    return res.status(500).json({ msg: "API verification failed" });
  }
}
