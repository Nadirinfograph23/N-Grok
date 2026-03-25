import type { VercelRequest, VercelResponse } from "@vercel/node";
import { askGrok } from "../lib/grok-client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, fileAttachments = [] } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const result = await askGrok({
      message: `Edit an image based on this description: ${prompt}`,
      modelName: "grok-3",
      enableImageGeneration: true,
      imageGenerationCount: 2,
      fileAttachments,
      forceConcise: true,
      disableTextFollowUps: true,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    const imageUrls = result.modelResponse.generatedImageUrls;
    if (imageUrls.length > 0) {
      return res.status(200).json({
        data: imageUrls.map((url) => ({ url })),
      });
    }

    return res.status(200).json({
      data: [],
      message: result.modelResponse.message || "No images were generated. Try a different prompt.",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to edit image", details: String(err) });
  }
}
