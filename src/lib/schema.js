import { z } from "zod";

export const websiteUrlSchema = z.object({
  url: z.string().url(),
});
