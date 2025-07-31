import mongoose from "mongoose";

const apiSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    key: {
      type: String,
      required: true,
    },
    expiresIn: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Api = mongoose.model("Api", apiSchema);
