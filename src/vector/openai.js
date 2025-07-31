import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";
dotenv.config();

import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { pineConeIndex } from "./db.js";

export async function getResponseWithEmbedding(query, user) {
  try {
    // 0. Load that pdf file which is currently activated
    const activeFile = user.files.find((file) => file.isActive);

    if (!activeFile) {
      throw new Error("There is no active file found");
    }

    // Extract clean name (e.g., "jharkhand.pdf")
    const activeFileName = activeFile.name;

    // Find the actual file in the uploads folder
    const uploadsDir = path.resolve("uploads");
    const allFiles = fs.readdirSync(uploadsDir);

    // Match file by removing timestamp prefix
    const matchedFile = allFiles.find((file) => {
      const parts = file.split("_");
      const nameWithoutTimestamp = parts.slice(1).join("_"); // everything after the first _
      return nameWithoutTimestamp === activeFileName;
    });

    if (!matchedFile) {
      throw new Error(
        `❌ File '${activeFileName}' not found in uploads folder`
      );
    }

    // 1. Load and parse the PDF
    const pdfPath = path.join(uploadsDir, matchedFile);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`❌ PDF file not found at: ${pdfPath}`);
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const parsed = await pdfParse(pdfBuffer);
    const rawText = parsed.text;

    // 2. Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.createDocuments([rawText]);

    // 3. Create OpenAI embeddings
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: "text-embedding-3-small",
      dimensions: 1024,
    });

    // 4. Store in Pinecone
    const data = await PineconeStore.fromDocuments(splitDocs, embeddings, {
      pineconeIndex: pineConeIndex,
    });

    // 5. Search for relevant chunks
    const vectorStore = new PineconeStore(embeddings, {
      pineconeIndex: pineConeIndex,
    });
    const results = await vectorStore.similaritySearch(query, 4);
    const context = results.map((doc) => doc.pageContent).join("\n");
    // 6. Query GPT-4o with context
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `You are a helpful assistant. Use the following context to answer the question:\n\n${context}\n\nQuestion: ${query}\n\nAnswer concisely.`
    );

    const chain = RunnableSequence.from([prompt, model]);

    const response = await chain.invoke({
      context,
      question: query,
    });
    return response.content;
  } catch (error) {
    console.error("❌ Error in getResponseWithEmbedding:", error.message);
    throw error;
  }
}
