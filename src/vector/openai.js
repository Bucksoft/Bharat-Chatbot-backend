import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { PineconeStore } from "@langchain/community/vectorstores/pinecone";
import { pineConeIndex } from "./db.js";

// Required for pdfjs-dist
import { createRequire } from "module";
const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = require("pdfjs-dist/legacy/build/pdf.worker.js");

async function extractTextFromPDF(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += pageText + "\n";
  }

  return text;
}

export async function getResponseWithEmbedding(query, user) {
  try {
    // 0. Load that pdf file which is currently activated
    const activeFile = user.files.find((file) => file.isActive);
    if (!activeFile) {
      throw new Error("There is no active file found");
    }

    const activeFileName = activeFile.name;
    const uploadsDir = path.resolve("uploads");
    const allFiles = fs.readdirSync(uploadsDir);

    const matchedFile = allFiles.find((file) => {
      const parts = file.split("_");
      const nameWithoutTimestamp = parts.slice(1).join("_");
      return nameWithoutTimestamp === activeFileName;
    });

    if (!matchedFile) {
      throw new Error(
        `❌ File '${activeFileName}' not found in uploads folder`
      );
    }

    const pdfPath = path.join(uploadsDir, matchedFile);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`❌ PDF file not found at: ${pdfPath}`);
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const rawText = await extractTextFromPDF(pdfBuffer);

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

    // 6. Query GPT with context
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `You are a helpful assistant. Use the following context to answer the question:\n\n${context}\n\nQuestion: {question}\n\nAnswer concisely.`
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
