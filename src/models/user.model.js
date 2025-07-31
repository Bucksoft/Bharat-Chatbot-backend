import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    password: {
      type: String,
    },
    profilePicture: {
      type: String,
      default:
        "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541",
    },
    files: [
      {
        isActive: Boolean,
        url: { type: String, required: true },
        name: { type: String },
        type: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    apiKeys: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Api",
      },
    ],

    website_urls: [
      {
        url: { type: String, required: true },
        isActive: { type: Boolean, default: false },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    activePlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },
    planExpiresAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
