import express from "express";
const router = express.Router();
import { isAuth } from "../middlewares/user.middleware.js";
import multer from "multer";

import {
  deleteFiles,
  deleteURL,
  getAllAPIKeys,
  getAllFiles,
  getAllUrls,
  markFileAsActive,
  markURLasActive,
  queryAI,
  uploadFiles,
  uploadUrl,
  verifyApiKey,
} from "../controllers/chat.controller.js";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware.js";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname.split(" ").join("_"));
  },
});

const upload = multer({ storage: storage });

// uploading files
router.post("/upload", upload.single("file"), isAuth, uploadFiles);

// getting all files
router.get("/files", isAuth, getAllFiles);

// marking file as active
router.post("/files/active", isAuth, markFileAsActive);

// AI code
router.post("/", apiKeyMiddleware, queryAI);

// // generating API key
// router.post("/api-key", isAuth, generateAPIKey);

// verify API key
router.post("/verify-key", verifyApiKey);

// getting all API keys
router.get("/keys", isAuth, getAllAPIKeys);

// upload website url
router.post("/url", isAuth, uploadUrl);

// get all urls
router.get("/all", isAuth, getAllUrls);

// mark url as active
router.put("/url/active", isAuth, markURLasActive);

// deleting files
router.delete("/files/:name", isAuth, deleteFiles);

// deleting url
router.delete("/url", isAuth, deleteURL);

export default router;
