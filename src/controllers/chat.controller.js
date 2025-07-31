import User from "../models/user.model.js";
import { getResponseWithEmbedding } from "../vector/openai.js";
import { Api } from "../models/api.model.js";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import fsSync from "fs";
import { websiteUrlSchema } from "../lib/schema.js";
import { Subscription } from "../models/subscription.model.js";
import { scrapeWebsite } from "../utils/scrapeWebsite.js";

export async function uploadFiles(req, res) {
  try {
    const file = req.file;
    const { planId, credits_per_unit } = req.body;
    if (!file) {
      return res.status(400).json({ msg: "No file uploaded" });
    }

    const creditsToDeduct = Number(credits_per_unit);
    if (!planId || isNaN(creditsToDeduct)) {
      return res
        .status(400)
        .json({ msg: "Missing planId or invalid credit value" });
    }

    // Find the active subscription
    const subscription = await Subscription.findOne({
      userId: req.user.id,
      planId,
      status: "active",
    });

    if (!subscription) {
      return res.status(404).json({ msg: "Active subscription not found" });
    }

    const remainingCredits =
      subscription.totalCredits - subscription.creditsUsed;
    if (remainingCredits < creditsToDeduct) {
      return res.status(403).json({ msg: "Not enough credits to upload file" });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
      Date.now() + "_" + file.originalname.split(" ").join("_")
    }`;
    await User.findByIdAndUpdate(req?.user?.id, {
      $push: {
        files: {
          name: file.originalname,
          url: fileUrl,
        },
      },
    });

    subscription.creditsUsed += creditsToDeduct;
    await subscription.save();
    return res.status(200).json({
      msg: "File uploaded successfully!",
      fileUrl,
      remainingCredits: subscription.totalCredits - subscription.creditsUsed,
    });
  } catch (error) {
    return res.status(500).json({ msg: "ERROR" });
  }
}

export async function getAllFiles(req, res) {
  try {
    const files = await User.findById(req.user.id).select("files");
    return res.status(200).json(files);
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Something went wrong in fetching files" });
  }
}

export async function markURLasActive(req, res) {
  try {
    const { url } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, msg: "Please provide a URL" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    let urlFound = false;
    user.website_urls.forEach((website_url) => {
      if (website_url.url === url) {
        website_url.isActive = true;
        urlFound = true;
      } else {
        website_url.isActive = false;
      }
    });

    if (!urlFound) {
      return res
        .status(404)
        .json({ success: false, msg: "URL not found in user's website URLs" });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      msg: "URL marked as active",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, msg: "Server error while updating URLs" });
  }
}

export async function processWebsiteAndChat(req, res) {
  try {
    const { url } = req.body;
    if (!url) {
      return res
        .status(200)
        .json({ success: false, msg: "Please provide a URL" });
    }
    const rawText = await scrapeWebsite(url);

    // AI Code goes here
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.createDocuments([rawText]);

    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: "text-embedding-3-small",
      dimensions: 1024,
    });

    const namespace = `url-${Buffer.from(url).toString("base64")}`;

    // Optional: clear previous embeddings for this URL
    await pineConeIndex._index.delete1({ namespace, deleteAll: true });

    await PineconeStore.fromDocuments(splitDocs, embeddings, {
      pineconeIndex,
      namespace,
    });

    const vectorStore = new PineconeStore(embeddings, {
      pineconeIndex,
      namespace,
    });

    const results = await vectorStore.similaritySearch(query, 4);
    const context = results.map((doc) => doc.pageContent).join("\n");

    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `You are a helpful assistant. Use the following context from the website to answer the question:\n\n{context}\n\nQuestion: {question}\n\nAnswer:`
    );

    const chain = RunnableSequence.from([prompt, model]);

    const response = await chain.invoke({
      context,
      question: query,
    });

    res.status(200).json({ reply: response.content });
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Something went wrong in processing website " });
  }
}

export async function queryAI(req, res) {
  const { prompt: query } = req.body;
  const userId = req?.userId;
  if (!userId) {
    return res.status(404).json({ success: false, msg: "User not found" });
  }
  const user = await User.findById(req.userId);
  try {
    const reply = await getResponseWithEmbedding(query, user);
    return res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
}

// export async function generateAPIKey(req, res) {
//   try {
//     const { name } = req.body;

//     if (!name) {
//       return res
//         .status(400)
//         .json({ error: "Please provide a name for your API key." });
//     }

//     const apiKey = jwt.sign({ id: req.user.id }, process.env.API_KEY_SECRET, {
//       expiresIn: "24h",
//     });

//     const newKey = await Api.create({
//       name,
//       key: apiKey,
//       expiresIn: new Date(Date.now() + 24 * 60 * 60 * 1000),
//       createdBy: req.user.id,
//     });

//     return res.status(201).json({
//       message: "API key generated successfully.",
//       apiKey: newKey,
//     });
//   } catch (error) {
//     console.error("API key generation failed:", error);
//     return res.status(500).json({ error: "Internal server error." });
//   }
// }

// verify API key
export async function verifyApiKey(req, res) {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ msg: "Please provide an API key" });
    }

    const decodedData = jwt.verify(apiKey, process.env.API_KEY_SECRET);
    if (!decodedData || !decodedData?.userId) {
      return res.status(401).json({ success: false, msg: "Invalid API key" });
    }
    const existingKey = await Api.findOne({
      key: apiKey,
      createdBy: decodedData?.userId,
    });
    if (!existingKey) {
      return res
        .status(404)
        .json({ success: false, msg: "Key doesn't exists" });
    }
    if (new Date(existingKey?.expiresIn) < new Date()) {
      return res
        .status(403)
        .json({ success: false, msg: "API key has expired" });
    }

    return res.status(200).json({
      success: true,
      msg: "Verification successfull",
      data: {
        userId: decodedData?.userId,
        planType: decodedData?.planType,
        orderId: decodedData?.orderId,
        expiresAt: existingKey?.expiresIn,
      },
    });
  } catch (error) {
    console.log("ERROR ", error);
    return res.status(500).json({ error: "API verification failed." });
  }
}

export async function getAllAPIKeys(req, res) {
  try {
    const keys = await Api.find();
    return res.status(200).json(keys);
  } catch (error) {
    return res.status(500).json({ msg: "Something went wrong" });
  }
}

export async function deleteFiles(req, res) {
  try {
    const { name } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const fileExistsInUser = user.files.find((file) => file.name === name);
    if (!fileExistsInUser) {
      return res.status(404).json({ msg: "File not found in your account" });
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    const allFiles = fsSync.readdirSync(uploadsDir);

    const matchedFile = allFiles.find((file) => file.endsWith(`_${name}`));
    if (!matchedFile) {
      return res.status(404).json({ msg: "Physical file not found" });
    }

    const fullPath = path.join(uploadsDir, matchedFile);

    await fs.unlink(fullPath);

    user.files = user.files.filter((file) => file.name !== name);
    await user.save();

    res.status(200).json({ success: true, msg: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ msg: "Something went wrong while deleting file" });
  }
}

// mark file as active
export async function markFileAsActive(req, res) {
  try {
    const { name } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const fileToActivate = user.files.find((file) => file.name === name);
    if (!fileToActivate) {
      return res.status(404).json({ msg: "File not found" });
    }

    user.files.forEach((file) => {
      file.isActive = false;
    });

    fileToActivate.isActive = true;

    await user.save();

    res.status(200).json({ success: true, msg: "File marked as active" });
  } catch (error) {
    res.status(500).json({
      msg: "Something went wrong while marking file as active",
      error: error.message,
    });
  }
}

// upload URL
export async function uploadUrl(req, res) {
  try {
    const { url, planId, credits_per_unit } = req.body;

    if (!url || !planId || !credits_per_unit) {
      return res
        .status(400)
        .json({ success: false, msg: "Missing required fields" });
    }

    const creditCost = Number(credits_per_unit);
    if (isNaN(creditCost) || creditCost <= 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Invalid credit cost" });
    }

    // Find active subscription
    const subscription = await Subscription.findOne({
      userId: req.user.id,
      planId,
      status: "active",
    });

    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, msg: "No active subscription found" });
    }

    const remainingCredits =
      subscription.totalCredits - subscription.creditsUsed;

    if (remainingCredits < creditCost) {
      return res
        .status(403)
        .json({ success: false, msg: "Not enough credits to upload URL" });
    }

    // Add URL to user's list
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          website_urls: {
            url,
          },
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(400)
        .json({ success: false, msg: "Could not upload URL" });
    }

    // Deduct credits
    subscription.creditsUsed += creditCost;
    await subscription.save();

    return res
      .status(200)
      .json({ success: true, msg: "URL uploaded successfully" });
  } catch (error) {
    console.error("Error uploading URL:", error);
    res
      .status(500)
      .json({ msg: "Something went wrong while uploading the URL" });
  }
}

// getting all the URLs
export async function getAllUrls(req, res) {
  try {
    const allUrls = await User.findById(req.user.id).select("website_urls");
    if (!allUrls || allUrls.length === 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Failed to fetch the URLs" });
    }
    return res.status(200).json({ success: true, allUrls });
  } catch (error) {
    console.error("Error uploading file url :", error);
    res
      .status(500)
      .json({ msg: "Something went wrong while uploading file url" });
  }
}

// deleting URL
export async function deleteURL(req, res) {
  try {
    const { url } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, msg: "Please provide a URL" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // Check if the URL exists in the user's website_urls
    const urlExists = user.website_urls.some((item) => item.url === url);

    if (!urlExists) {
      return res
        .status(404)
        .json({ success: false, msg: "URL not found in user's list" });
    }
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { website_urls: { url: url } },
    });

    return res
      .status(200)
      .json({ success: true, msg: "URL deleted successfully" });
  } catch (error) {
    console.error("ERROR deleting URL:", error);
    return res
      .status(500)
      .json({ success: false, msg: "Server error while deleting URL" });
  }
}
