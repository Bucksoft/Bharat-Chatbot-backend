import mongoose from "mongoose";

const apiSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    key: {
      type: String,
      required: [true, "API key is required"],
      unique: true,
      // select: false, // Do not return key in queries by default for security
    },
    expiresIn: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

apiSchema.index({ key: 1 });

apiSchema.virtual("isExpired").get(function () {
  return this.expiresIn && new Date() > this.expiresIn;
});

apiSchema.index({ expiresIn: 1 }, { expireAfterSeconds: 0 });

export const Api = mongoose.model("Api", apiSchema);
