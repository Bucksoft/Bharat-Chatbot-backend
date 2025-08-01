import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { Api } from "../models/api.model.js";
import { Subscription } from "../models/subscription.model.js";
import { getResponseWithEmbedding } from "../vector/openai.js";
import { scrapeWebsite } from "../utils/scrapeWebsite.js";
import ms from "ms";

// Upload file
export async function uploadFiles(req, res) {
  try {
    const { file } = req;
    const { planId, credits_per_unit } = req.body;
    const userId = req.user.id;

    if (!file) return res.status(400).json({ msg: "No file uploaded" });

    const creditCost = Number(credits_per_unit);
    if (!planId || isNaN(creditCost) || creditCost <= 0) {
      return res.status(400).json({ msg: "Invalid plan ID or credit value" });
    }

    const subscription = await Subscription.findOne({
      userId,
      planId,
      status: "active",
    });

    if (!subscription)
      return res.status(404).json({ msg: "Active subscription not found" });

    const remainingCredits =
      subscription.totalCredits - subscription.creditsUsed;
    if (remainingCredits < creditCost)
      return res.status(403).json({ msg: "Not enough credits" });

    // Ensure uploads folder exists
    const uploadsPath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath);
    }

    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadsPath, fileName);

    // Save file to disk
    fs.writeFileSync(filePath, file.buffer); // Only works if using multer memoryStorage

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${fileName}`;

    await User.findByIdAndUpdate(userId, {
      $push: {
        files: { name: file.originalname, url: fileUrl },
      },
    });

    subscription.creditsUsed += creditCost;
    await subscription.save();

    res.status(200).json({
      msg: "File uploaded successfully",
      fileUrl,
      remainingCredits: subscription.totalCredits - subscription.creditsUsed,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ msg: "Server error during file upload" });
  }
}


// Get all files
export async function getAllFiles(req, res) {
  try {
    const files = await User.findById(req.user.id).select("files");
    res.status(200).json(files);
  } catch (error) {
    console.error("Get files error:", error);
    res.status(500).json({ msg: "Failed to retrieve files" });
  }
}

// Delete file
export async function deleteFiles(req, res) {
  try {
    const { name } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const fileEntry = user.files.find((file) => file.name === name);
    if (!fileEntry)
      return res.status(404).json({ msg: "File not found in user account" });

    const uploadsDir = path.join(process.cwd(), "uploads");
    const fileToDelete = fsSync
      .readdirSync(uploadsDir)
      .find((f) => f.endsWith(`_${name}`));
    if (!fileToDelete)
      return res.status(404).json({ msg: "Physical file not found" });

    await fs.unlink(path.join(uploadsDir, fileToDelete));
    user.files = user.files.filter((f) => f.name !== name);
    await user.save();

    res.status(200).json({ success: true, msg: "File deleted successfully" });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({ msg: "Failed to delete file" });
  }
}

// Mark file as active
export async function markFileAsActive(req, res) {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const fileToActivate = user.files.find((file) => file.name === name);
    if (!fileToActivate) return res.status(404).json({ msg: "File not found" });

    user.files.forEach((file) => (file.isActive = false));
    fileToActivate.isActive = true;
    await user.save();

    res.status(200).json({ success: true, msg: "File marked as active" });
  } catch (error) {
    console.error("Activate file error:", error);
    res.status(500).json({ msg: "Failed to mark file as active" });
  }
}

// Upload URL
export async function uploadUrl(req, res) {
  try {
    const { url, planId, credits_per_unit } = req.body;
    const userId = req.user.id;

    if (!url || !planId || !credits_per_unit)
      return res.status(400).json({ success: false, msg: "Missing fields" });

    const creditCost = Number(credits_per_unit);
    if (isNaN(creditCost) || creditCost <= 0)
      return res
        .status(400)
        .json({ success: false, msg: "Invalid credit cost" });

    const subscription = await Subscription.findOne({
      userId,
      planId,
      status: "active",
    });

    if (!subscription)
      return res
        .status(404)
        .json({ success: false, msg: "No active subscription" });

    const remaining = subscription.totalCredits - subscription.creditsUsed;
    if (remaining < creditCost)
      return res
        .status(403)
        .json({ success: false, msg: "Insufficient credits" });

    const updated = await User.findByIdAndUpdate(
      userId,
      { $push: { website_urls: { url } } },
      { new: true }
    );

    if (!updated)
      return res
        .status(400)
        .json({ success: false, msg: "Could not upload URL" });

    subscription.creditsUsed += creditCost;
    await subscription.save();

    res.status(200).json({ success: true, msg: "URL uploaded successfully" });
  } catch (error) {
    console.error("Upload URL error:", error);
    res.status(500).json({ msg: "Server error while uploading URL" });
  }
}

// Get all URLs
export async function getAllUrls(req, res) {
  try {
    const user = await User.findById(req.user.id).select("website_urls");
    if (!user)
      return res.status(404).json({ success: false, msg: "User not found" });

    res.status(200).json({ success: true, allUrls: user.website_urls });
  } catch (error) {
    console.error("Fetch URLs error:", error);
    res.status(500).json({ msg: "Failed to fetch URLs" });
  }
}

// Delete URL
export async function deleteURL(req, res) {
  try {
    const { url } = req.body;
    const userId = req.user.id;

    if (!url) return res.status(400).json({ msg: "URL is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const exists = user.website_urls.some((u) => u.url === url);
    if (!exists)
      return res.status(404).json({ msg: "URL not found in your list" });

    await User.findByIdAndUpdate(userId, {
      $pull: { website_urls: { url } },
    });

    res.status(200).json({ success: true, msg: "URL deleted successfully" });
  } catch (error) {
    console.error("Delete URL error:", error);
    res.status(500).json({ msg: "Server error while deleting URL" });
  }
}

// Mark URL as active
export async function markURLasActive(req, res) {
  try {
    const { url } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    let found = false;
    user.website_urls.forEach((u) => {
      if (u.url === url) {
        u.isActive = true;
        found = true;
      } else {
        u.isActive = false;
      }
    });

    if (!found) return res.status(404).json({ msg: "URL not found in list" });

    await user.save();
    res.status(200).json({ success: true, msg: "URL marked as active" });
  } catch (error) {
    console.error("Mark URL active error:", error);
    res.status(500).json({ msg: "Failed to update URL status" });
  }
}

// Query AI with embeddings
export async function queryAI(req, res) {
  try {
    const { prompt: query } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const reply = await getResponseWithEmbedding(query, user);
    res.json({ reply });
  } catch (error) {
    console.error("AI Query error:", error);
    res.status(500).json({ msg: "Something went wrong with the AI query" });
  }
}

// API Key verification
export async function verifyApiKey(req, res) {
  try {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ msg: "API key required" });

    const decoded = jwt.verify(apiKey, process.env.API_KEY_SECRET);
    const keyRecord = await Api.findOne({
      key: apiKey,
      createdBy: decoded.userId,
    });
    if (!keyRecord) return res.status(404).json({ msg: "API key not found" });

    if (new Date(keyRecord.expiresIn) < new Date())
      return res.status(403).json({ msg: "API key expired" });

    res.status(200).json({
      success: true,
      msg: "API key valid",
      data: {
        userId: decoded.userId,
        planType: decoded.planType,
        orderId: decoded.orderId,
        expiresAt: keyRecord.expiresIn,
      },
    });
  } catch (error) {
    console.error("API key verification failed:", error);
    res.status(500).json({ msg: "Invalid or expired API key" });
  }
}

// Get all API Keys (admin)
export async function getAllAPIKeys(req, res) {
  try {
    const keys = await Api.find();
    res.status(200).json(keys);
  } catch (error) {
    console.error("Get API keys error:", error);
    res.status(500).json({ msg: "Failed to fetch API keys" });
  }
}
