import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["Free", "Pro", "Enterprise"],
      required: true,
      unique: true,
    },
    price: {
      type: Number,
      required: true,
    },
    durationInDays: {
      type: Number,
      required: true,
    },
    totalCredits: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    features: [
      {
        name: {
          type: String,
          enum: ["ai_message", "pdf_upload", "url_upload"],
          required: true,
        },
        perUnitCreditCost: {
          type: Number,
          required: true,
        },
        maxUnitsAllowed: {
          type: Number,
          required: true,
        },
        allocatedCredits: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

export const Plan = mongoose.model("Plan", planSchema);
