import mongoose from "mongoose";

const ALLOWED_PLAN_NAMES = ["Free", "Pro", "Enterprise"];
const ALLOWED_FEATURES = ["ai_message", "pdf_upload", "url_upload"];

const featureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: {
        values: ALLOWED_FEATURES,
        message: "Feature '{VALUE}' is not supported.",
      },
      required: [true, "Feature name is required"],
    },
    perUnitCreditCost: {
      type: Number,
      required: [true, "perUnitCreditCost is required"],
      min: [0, "Credit cost cannot be negative"],
    },
    maxUnitsAllowed: {
      type: Number,
      required: [true, "maxUnitsAllowed is required"],
      min: [0, "maxUnitsAllowed cannot be negative"],
    },
    allocatedCredits: {
      type: Number,
      required: [true, "allocatedCredits is required"],
      min: [0, "allocatedCredits cannot be negative"],
    },
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: {
        values: ALLOWED_PLAN_NAMES,
        message: "Plan '{VALUE}' is not supported",
      },
      required: [true, "Plan name is required"],
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Plan price is required"],
      min: [0, "Price must be a positive number"],
    },
    durationInDays: {
      type: Number,
      required: [true, "Plan duration is required"],
      min: [1, "Duration must be at least 1 day"],
    },
    totalCredits: {
      type: Number,
      required: [true, "Total credits are required"],
      min: [0, "Total credits must be zero or positive"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    features: {
      type: [featureSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one feature is required",
      },
    },
  },
  { timestamps: true }
);

export const Plan = mongoose.model("Plan", planSchema);
