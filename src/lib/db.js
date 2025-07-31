import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export async function dbConnect() {
  try {
    await mongoose.connect(process.env?.DB_URL);
    console.log("Db Connected ✅");
  } catch (e) {
    console.log("Error in connecting to DB", e);
    process.exit(1);
  }
}
